import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectList } from "@/components/dashboard/project-list";
import { getProjects } from "@/lib/actions/projects";
import { Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">내 작품</h1>
          <p className="text-muted-foreground">총 {projects.length}개의 프로젝트</p>
        </div>
        <Button asChild>
          <Link href="/generate">
            <Sparkles className="mr-2 h-4 w-4" />
            새로 생성
          </Link>
        </Button>
      </div>
      <ProjectList projects={projects} />
    </div>
  );
}
