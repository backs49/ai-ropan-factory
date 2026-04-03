import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;
const PRO_AMOUNT = 9900;

export async function GET(request: Request) {
  // Vercel Cron 인증
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const now = new Date().toISOString();

  // 만료된 활성 구독 조회
  const { data: expiredSubs } = await serviceClient
    .from("subscriptions")
    .select("*")
    .eq("status", "active")
    .lte("current_period_end", now);

  if (!expiredSubs || expiredSubs.length === 0) {
    return NextResponse.json({ message: "No subscriptions to renew", count: 0 });
  }

  const tossAuth = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const sub of expiredSubs) {
    const orderId = `renew_${sub.user_id}_${Date.now()}`;

    try {
      const res = await fetch(
        `https://api.tosspayments.com/v1/billing/${sub.billing_key}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${tossAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerKey: sub.user_id,
            amount: PRO_AMOUNT,
            orderId,
            orderName: "AI 로판 팩토리 Pro 월 구독 갱신",
          }),
        }
      );

      if (res.ok) {
        const paymentData = await res.json();
        const newPeriodEnd = new Date();
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

        // 결제 기록
        await serviceClient.from("payments").insert({
          user_id: sub.user_id,
          order_id: orderId,
          payment_key: paymentData.paymentKey,
          amount: PRO_AMOUNT,
          status: "paid",
          method: paymentData.method,
        });

        // 구독 기간 갱신
        await serviceClient
          .from("subscriptions")
          .update({
            current_period_start: new Date().toISOString(),
            current_period_end: newPeriodEnd.toISOString(),
          })
          .eq("id", sub.id);

        results.push({ userId: sub.user_id, success: true });
      } else {
        const err = await res.json();

        // 결제 실패 → 다운그레이드
        await serviceClient
          .from("subscriptions")
          .update({ status: "failed" })
          .eq("id", sub.id);

        await serviceClient
          .from("profiles")
          .update({ tier: "free" })
          .eq("id", sub.user_id);

        results.push({
          userId: sub.user_id,
          success: false,
          error: err.message,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({ userId: sub.user_id, success: false, error: message });
    }
  }

  // 해지된 구독 중 기간 만료된 것 → 다운그레이드
  const { data: cancelledExpired } = await serviceClient
    .from("subscriptions")
    .select("user_id")
    .eq("status", "cancelled")
    .lte("current_period_end", now);

  if (cancelledExpired && cancelledExpired.length > 0) {
    for (const sub of cancelledExpired) {
      await serviceClient
        .from("profiles")
        .update({ tier: "free" })
        .eq("id", sub.user_id);
    }
  }

  return NextResponse.json({
    message: "Billing cron completed",
    renewed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    downgraded: cancelledExpired?.length || 0,
    results,
  });
}
