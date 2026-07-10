import { createClient } from "@/lib/supabase/server";
import { PricingCards } from "@/components/pricing/pricing-cards";
import type { Tier } from "@/types";

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "결제 정보가 올바르지 않습니다. 다시 시도해주세요.",
  already_subscribed: "이미 구독 중입니다. 설정에서 구독을 관리하세요.",
  billing_key_failed: "카드 등록에 실패했습니다. 카드 정보를 확인 후 다시 시도해주세요.",
  payment_failed: "결제에 실패했습니다. 카드 한도나 잔액을 확인해주세요.",
  sync_failed: "결제는 완료됐지만 반영이 지연되고 있습니다. 잠시 후에도 Pro가 아니라면 문의해주세요.",
  processing_failed: "결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error
    ? ERROR_MESSAGES[error] ?? ERROR_MESSAGES.processing_failed
    : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let tier: Tier = "free";
  let hasSubscription = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();
    tier = (profile?.tier as Tier) || "free";

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    hasSubscription = !!sub;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">요금제</h1>
        <p className="text-muted-foreground">
          AI 웹소설 기획의 모든 잠재력을 Pro로 잠금 해제하세요
        </p>
      </div>
      {errorMessage && (
        <div className="mx-auto max-w-3xl rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}
      <PricingCards currentTier={tier} hasSubscription={hasSubscription} customerKey={user?.id} />
    </div>
  );
}
