import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./project-card";
import { Sparkles } from "lucide-react";
import type { Project } from "@/types";

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-primary/10 p-4 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">아직 생성된 작품이 없습니다</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          장르, 키워드, 분위기만 입력하면 AI가 웹소설 기획을 자동으로 생성합니다.
        </p>
        <Button render={<Link href="/generate" />}>
          <Sparkles className="mr-2 h-4 w-4" />
          첫 작품 생성하기
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
