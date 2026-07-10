import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/dashboard/project-list";
import { getProjects } from "@/lib/actions/projects";
import { createClient } from "@/lib/supabase/server";
import { Sparkles, Crown } from "lucide-react";
import type { Tier } from "@/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { upgraded } = await searchParams;
  const projects = await getProjects();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("tier").eq("id", user.id).single()
    : { data: null };
  const tier = (profile?.tier as Tier) || "free";
  const isFreeLimit = tier === "free" && projects.filter((p) => p.status !== "failed").length >= 3;

  return (
    <div className="space-y-6">
      {upgraded === "true" && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm">
          🎉 Pro 구독이 시작됐습니다! 이제 무제한으로 생성할 수 있어요.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 작품</h1>
          <p className="text-muted-foreground">
            총 {projects.length}개의 프로젝트
            {tier === "free" && <span> (무료 최대 3개)</span>}
          </p>
        </div>
        {isFreeLimit ? (
          <div className="flex gap-2">
            <Button render={<Link href="/pricing" />}>
              <Crown className="mr-2 h-4 w-4" />
              Pro 업그레이드
            </Button>
            <Button variant="outline" disabled>
              <Sparkles className="mr-2 h-4 w-4" />
              제한 도달
            </Button>
          </div>
        ) : (
          <Button render={<Link href="/generate" />}>
            <Sparkles className="mr-2 h-4 w-4" />
            새로 생성
          </Button>
        )}
      </div>
      <ProjectList projects={projects} />
    </div>
  );
}
