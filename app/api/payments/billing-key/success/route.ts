import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY!;
const PRO_AMOUNT = 9900;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authKey = searchParams.get("authKey");
  const customerKey = searchParams.get("customerKey");

  if (!authKey || !customerKey) {
    redirect("/pricing?error=missing_params");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceClient = await createServiceClient();
  const orderId = `pro_${user.id}_${Date.now()}`;

  try {
    // 1. 빌링키 발급
    const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");

    const billingRes = await fetch(
      "https://api.tosspayments.com/v1/billing/authorizations/issue",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ authKey, customerKey }),
      }
    );

    if (!billingRes.ok) {
      const err = await billingRes.json();
      console.error("Billing key issue failed:", err);
      redirect(`/pricing?error=${encodeURIComponent(err.message || "billing_key_failed")}`);
    }

    const billingData = await billingRes.json();
    const billingKey = billingData.billingKey;

    // 2. 빌링키로 즉시 첫 결제
    const paymentRes = await fetch(
      `https://api.tosspayments.com/v1/billing/${billingKey}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerKey,
          amount: PRO_AMOUNT,
          orderId,
          orderName: "AI 로판 팩토리 Pro 월 구독",
          customerEmail: user.email,
        }),
      }
    );

    if (!paymentRes.ok) {
      const err = await paymentRes.json();
      console.error("First payment failed:", err);
      redirect(`/pricing?error=${encodeURIComponent(err.message || "payment_failed")}`);
    }

    const paymentData = await paymentRes.json();

    // 3. DB 업데이트
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // 결제 기록
    await serviceClient.from("payments").insert({
      user_id: user.id,
      order_id: orderId,
      payment_key: paymentData.paymentKey,
      amount: PRO_AMOUNT,
      status: "paid",
      method: paymentData.method,
    });

    // 구독 생성 (upsert)
    await serviceClient.from("subscriptions").upsert(
      {
        user_id: user.id,
        billing_key: billingKey,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      },
      { onConflict: "user_id" }
    );

    // 프로필 tier 업그레이드
    await serviceClient
      .from("profiles")
      .update({ tier: "pro" })
      .eq("id", user.id);
  } catch (error) {
    console.error("Payment processing error:", error);
    redirect("/pricing?error=processing_failed");
  }

  redirect("/dashboard?upgraded=true");
}
