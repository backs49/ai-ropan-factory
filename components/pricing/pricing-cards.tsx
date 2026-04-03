"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { TossCheckout } from "./toss-checkout";
import type { Tier } from "@/types";

const FREE_FEATURES = [
  "프로젝트 최대 3개",
  "프로젝트당 3화까지",
  "경량 + 고급 AI 모델 조합",
  "아웃라인 / 캐릭터 / 표지 / SEO",
];

const PRO_FEATURES = [
  "프로젝트 무제한",
  "에피소드 무제한",
  "최신 고급 AI 모델 전용",
  "아웃라인 / 캐릭터 / 표지 / SEO",
  "우선 생성 큐",
];

export function PricingCards({
  currentTier,
  hasSubscription,
}: {
  currentTier: Tier;
  hasSubscription: boolean;
}) {
  const isPro = currentTier === "pro" || currentTier === "enterprise";

  return (
    <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
      {/* Free */}
      <Card className={!isPro ? "border-primary" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Free</CardTitle>
            {!isPro && <Badge>현재 플랜</Badge>}
          </div>
          <CardDescription>웹소설 기획을 무료로 체험</CardDescription>
          <div className="pt-2">
            <span className="text-3xl font-bold">0</span>
            <span className="text-muted-foreground">원/월</span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Pro */}
      <Card className={isPro ? "border-primary" : "border-2 border-primary/50"}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pro</CardTitle>
            {isPro ? (
              <Badge>현재 플랜</Badge>
            ) : (
              <Badge variant="secondary">추천</Badge>
            )}
          </div>
          <CardDescription>무제한 창작의 자유</CardDescription>
          <div className="pt-2">
            <span className="text-3xl font-bold">9,900</span>
            <span className="text-muted-foreground">원/월</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {isPro ? (
            hasSubscription ? (
              <p className="text-sm text-muted-foreground text-center">
                구독 중입니다. 설정에서 관리하세요.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Pro 플랜 이용 중
              </p>
            )
          ) : (
            <TossCheckout />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
