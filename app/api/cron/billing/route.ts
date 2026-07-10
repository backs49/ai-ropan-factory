import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;
const PRO_AMOUNT = 9900;
const GRACE_DAYS = 3;
const BATCH_LIMIT = 100;

function addOneMonth(d: Date): Date {
  const r = new Date(d);
  const day = r.getDate();
  r.setMonth(r.getMonth() + 1);
  if (r.getDate() < day) r.setDate(0); // 1/31 → 2/28 말일 클램프
  return r;
}

export async function GET(request: Request) {
  // CRON_SECRET 미설정 시에도 무조건 거부 — 결제를 트리거하는 엔드포인트
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();

  // 만료된 활성/유예 구독 조회
  const { data: expiredSubs, error: queryError } = await serviceClient
    .from("subscriptions")
    .select("*")
    .in("status", ["active", "past_due"])
    .lte("current_period_end", nowIso)
    .limit(BATCH_LIMIT);

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const tossAuth = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
  const results: { userId: string; success: boolean; error?: string }[] = [];

  for (const sub of expiredSubs ?? []) {
    const periodEnd = new Date(sub.current_period_end);
    // 결정적 orderId: 같은 기간의 갱신 재시도는 같은 orderId → Toss 멱등키로 이중 청구 방지
    const periodTag = sub.current_period_end.slice(0, 10).replace(/-/g, "");
    const orderId = `renew_${sub.id.slice(0, 8)}_${periodTag}`;

    let charged = false;
    let failMessage = "";

    try {
      const res = await fetch(
        `https://api.tosspayments.com/v1/billing/${sub.billing_key}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${tossAuth}`,
            "Content-Type": "application/json",
            "Idempotency-Key": orderId,
          },
          body: JSON.stringify({
            customerKey: sub.customer_key ?? sub.user_id,
            amount: PRO_AMOUNT,
            orderId,
            orderName: "AI 로판 팩토리 Pro 월 구독 갱신",
          }),
        }
      );

      if (res.ok) {
        charged = true;
        const paymentData = await res.json();
        const newStart = periodEnd;
        const newEnd = addOneMonth(periodEnd);

        // 기간 갱신이 최우선 — 실패 시 다음 실행에서 같은 orderId로 재시도(멱등)
        const { error: renewError } = await serviceClient
          .from("subscriptions")
          .update({
            status: "active",
            current_period_start: newStart.toISOString(),
            current_period_end: newEnd.toISOString(),
          })
          .eq("id", sub.id);

        if (renewError) {
          console.error(
            `[CRITICAL] 갱신 결제 성공했으나 기간 갱신 실패. sub=${sub.id} orderId=${orderId}`,
            renewError
          );
        }

        // upsert: 재시도로 같은 orderId가 이미 있으면 무시
        await serviceClient.from("payments").upsert(
          {
            user_id: sub.user_id,
            order_id: orderId,
            payment_key: paymentData.paymentKey,
            amount: PRO_AMOUNT,
            status: "paid",
            method: paymentData.method,
          },
          { onConflict: "order_id", ignoreDuplicates: true }
        );
      } else {
        const err = await res.json();
        failMessage = err.message ?? "unknown";
      }
    } catch (error) {
      failMessage = error instanceof Error ? error.message : "Unknown error";
    }

    if (charged) {
      results.push({ userId: sub.user_id, success: true });
    } else {
      // 결제 실패: 3일 유예 후 강등. 네트워크 예외도 동일 경로.
      const graceEnd = new Date(periodEnd);
      graceEnd.setDate(graceEnd.getDate() + GRACE_DAYS);

      if (now > graceEnd) {
        await serviceClient
          .from("subscriptions")
          .update({ status: "failed" })
          .eq("id", sub.id);
        await serviceClient
          .from("profiles")
          .update({ tier: "free" })
          .eq("id", sub.user_id);
      } else if (sub.status !== "past_due") {
        await serviceClient
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("id", sub.id);
      }

      results.push({ userId: sub.user_id, success: false, error: failMessage });
    }
  }

  // 해지된 구독 중 기간 만료 → 강등 + expired 마킹 (재처리 방지)
  const { data: cancelledExpired } = await serviceClient
    .from("subscriptions")
    .select("id, user_id")
    .eq("status", "cancelled")
    .lte("current_period_end", nowIso)
    .limit(BATCH_LIMIT);

  for (const sub of cancelledExpired ?? []) {
    await serviceClient
      .from("profiles")
      .update({ tier: "free" })
      .eq("id", sub.user_id);
    await serviceClient
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("id", sub.id);
  }

  return NextResponse.json({
    message: "Billing cron completed",
    renewed: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    downgraded: cancelledExpired?.length || 0,
    results,
  });
}
