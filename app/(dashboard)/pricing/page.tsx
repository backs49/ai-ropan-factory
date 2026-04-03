import { createClient } from "@/lib/supabase/server";
import { PricingCards } from "@/components/pricing/pricing-cards";
import type { Tier } from "@/types";

export default async function PricingPage() {
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
      <PricingCards currentTier={tier} hasSubscription={hasSubscription} />
    </div>
  );
}
