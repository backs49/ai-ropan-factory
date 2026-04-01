import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Profile } from "@/types";
import { TIER_LIMITS } from "@/types";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const p = profile as Profile;
  const limit = TIER_LIMITS[p.tier];
  const remaining = limit === Infinity ? "무제한" : `${limit - p.monthly_generations}회 남음`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">계정 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">이메일</span>
            <span>{p.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">닉네임</span>
            <span>{p.display_name || "-"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">구독 플랜</CardTitle>
          <CardDescription>현재 이용 중인 플랜과 사용량</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={p.tier === "pro" ? "default" : "secondary"} className="text-sm">
                {p.tier === "free" ? "Free" : "Pro"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {p.tier === "free" ? "월 3회 생성" : "무제한 생성"}
              </span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">이번 달 사용량</span>
              <span>{p.monthly_generations}회 사용 / {remaining}</span>
            </div>
            {p.tier === "free" && (
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min((p.monthly_generations / 3) * 100, 100)}%` }}
                />
              </div>
            )}
          </div>

          {p.tier === "free" && (
            <>
              <Separator />
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <h4 className="font-medium mb-1">Pro로 업그레이드</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  무제한 생성, 우선 처리, 향후 추가 기능 우선 제공
                </p>
                <Button disabled>곧 출시 예정 (Toss Payments 연동 준비 중)</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
