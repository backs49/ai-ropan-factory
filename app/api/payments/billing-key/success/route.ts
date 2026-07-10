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

  // customerKey는 반드시 본인 user.id여야 함 (Task 2에서 고정)
  if (customerKey !== user.id) {
    redirect("/pricing?error=missing_params");
  }

  const serviceClient = await createServiceClient();

  // 이미 유효한 구독이 있으면 중복 결제 차단
  const { data: existingSub } = await serviceClient
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .in("status", ["active", "past_due"])
    .maybeSingle();

  if (existingSub) {
    redirect("/pricing?error=already_subscribed");
  }

  const orderId = `pro_${user.id.slice(0, 8)}_${crypto.randomUUID()}`;
  const authHeader = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");

  let errorCode: string | null = null;

  try {
    // 1. 빌링키 발급
    const billingRes = await fetch(
      "https://api.tosspayments.com/v1/billing/authorizations/issue",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `issue_${authKey}`,
        },
        body: JSON.stringify({ authKey, customerKey }),
      }
    );

    if (!billingRes.ok) {
      const err = await billingRes.json();
      console.error("Billing key issue failed:", err);
      errorCode = "billing_key_failed";
    } else {
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
            "Idempotency-Key": orderId,
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
        // 실패 결제도 기록 (감사 추적)
        await serviceClient.from("payments").insert({
          user_id: user.id,
          order_id: orderId,
          amount: PRO_AMOUNT,
          status: "failed",
        });
        errorCode = "payment_failed";
      } else {
        const paymentData = await paymentRes.json();

        // 3. DB 반영 — 구독이 가장 중요하므로 먼저, 각 쓰기 에러 체크
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        if (periodEnd.getDate() < now.getDate()) periodEnd.setDate(0);

        const { error: subError } = await serviceClient
          .from("subscriptions")
          .upsert(
            {
              user_id: user.id,
              billing_key: billingKey,
              customer_key: customerKey,
              status: "active",
              current_period_start: now.toISOString(),
              current_period_end: periodEnd.toISOString(),
            },
            { onConflict: "user_id" }
          );

        const { error: tierError } = await serviceClient
          .from("profiles")
          .update({ tier: "pro" })
          .eq("id", user.id);

        const { error: paymentError } = await serviceClient
          .from("payments")
          .insert({
            user_id: user.id,
            order_id: orderId,
            payment_key: paymentData.paymentKey,
            amount: PRO_AMOUNT,
            status: "paid",
            method: paymentData.method,
          });

        if (subError || tierError) {
          // 돈은 빠졌는데 반영 실패 — 반드시 수동 복구 가능하도록 상세 로그
          console.error(
            `[CRITICAL] 결제 성공했으나 DB 반영 실패. user=${user.id} orderId=${orderId} paymentKey=${paymentData.paymentKey}`,
            { subError, tierError }
          );
          errorCode = "sync_failed";
        } else if (paymentError) {
          // 결제 기록만 실패 — 구독은 정상이므로 성공 처리하되 로그
          console.error(
            `[WARN] 결제 기록 저장 실패. user=${user.id} orderId=${orderId}`,
            paymentError
          );
        }
      }
    }
  } catch (error) {
    console.error("Payment processing error:", error);
    errorCode = "processing_failed";
  }

  if (errorCode) {
    redirect(`/pricing?error=${errorCode}`);
  }
  redirect("/dashboard?upgraded=true");
}
