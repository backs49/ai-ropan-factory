"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export function SubscriptionManager({
  subscription,
}: {
  subscription: {
    status: string;
    currentPeriodEnd: string;
  } | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodEnd = subscription
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("ko-KR")
    : null;

  async function handleCancel() {
    setCancelling(true);
    setError(null);

    try {
      const res = await fetch("/api/payments/cancel", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "해지에 실패했습니다.");
      } else {
        router.refresh();
      }
    } catch {
      setError("요청에 실패했습니다.");
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  }

  if (!subscription) {
    return (
      <p className="text-sm text-muted-foreground">
        Pro 플랜 이용 중 (관리자 설정)
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">구독 상태</span>
        <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
          {subscription.status === "active" ? "활성" : "해지 예정"}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {subscription.status === "active" ? "다음 결제일" : "Pro 만료일"}
        </span>
        <span>{periodEnd}</span>
      </div>

      {subscription.status === "active" && (
        <>
          {confirming ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
              <span className="text-sm">정말 구독을 해지하시겠어요?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "해지"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={cancelling}
              >
                취소
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setConfirming(true)}
            >
              구독 해지
            </Button>
          )}
        </>
      )}

      {subscription.status === "cancelled" && (
        <p className="text-xs text-muted-foreground">
          {periodEnd}까지 Pro를 이용할 수 있습니다. 이후 Free로 전환됩니다.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
