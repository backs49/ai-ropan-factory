"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";

export function TossCheckout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const { loadTossPayments } = await import(
        "@tosspayments/tosspayments-sdk"
      );
      const tossPayments = await loadTossPayments(
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!
      );

      const payment = tossPayments.payment({
        customerKey: crypto.randomUUID(),
      });

      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${window.location.origin}/api/payments/billing-key/success`,
        failUrl: `${window.location.origin}/api/payments/billing-key/fail`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "결제 요청 실패";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleCheckout} disabled={loading} className="w-full">
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        Pro 구독 시작
      </Button>
      {error && <p className="text-xs text-destructive text-center">{error}</p>}
    </div>
  );
}
