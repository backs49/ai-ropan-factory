import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/dashboard/project-list";
import { getProjects } from "@/lib/actions/projects";
import { createClient } from "@/lib/supabase/server";
import { Sparkles } from "lucide-react";
import type { Tier } from "@/types";

export default async function DashboardPage() {
  const projects = await getProjects();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("tier").eq("id", user.id).single()
    : { data: null };
  const tier = (profile?.tier as Tier) || "free";
  const isFreeLimit = tier === "free" && projects.length >= 3;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 작품</h1>
          <p className="text-muted-foreground">
            총 {projects.length}개의 프로젝트
            {tier === "free" && <span> (무료 최대 3개)</span>}
          </p>
        </div>
        {isFreeLimit ? (
          <Button disabled title="무료 플랜 프로젝트 3개 제한">
            <Sparkles className="mr-2 h-4 w-4" />
            프로젝트 제한 도달
          </Button>
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
