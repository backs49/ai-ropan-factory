"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeDate } from "@/lib/utils";
import { BookOpen, Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { Project } from "@/types";

const statusConfig = {
  generating: { label: "생성 중", icon: Loader2, variant: "secondary" as const },
  completed: { label: "완료", icon: CheckCircle2, variant: "default" as const },
  failed: { label: "실패", icon: XCircle, variant: "destructive" as const },
  archived: { label: "보관됨", icon: BookOpen, variant: "outline" as const },
};

export function ProjectCard({ project }: { project: Project }) {
  const status = statusConfig[project.status];
  const StatusIcon = status.icon;

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base line-clamp-1">
              {project.title || (project.outline as any)?.title || "제목 없음"}
            </CardTitle>
            <Badge variant={status.variant} className="ml-2 shrink-0">
              <StatusIcon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge variant="outline" className="text-xs">{project.genre}</Badge>
            <Badge variant="outline" className="text-xs">{project.mood}</Badge>
            {project.keywords.slice(0, 3).map((kw) => (
              <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
            ))}
          </div>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            {formatRelativeDate(project.created_at)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
