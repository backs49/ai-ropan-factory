"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteProject } from "@/lib/actions/projects";
import { formatRelativeDate } from "@/lib/utils";
import { BookOpen, Clock, Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { Project } from "@/types";

const statusConfig = {
  generating: { label: "생성 중", icon: Loader2, variant: "secondary" as const },
  completed: { label: "완료", icon: CheckCircle2, variant: "default" as const },
  failed: { label: "실패", icon: XCircle, variant: "destructive" as const },
  archived: { label: "보관됨", icon: BookOpen, variant: "outline" as const },
};

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();
  const status = statusConfig[project.status];
  const StatusIcon = status.icon;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteProject(project.id);
    if (result.error) {
      setDeleting(false);
      setConfirming(false);
    } else {
      router.refresh();
    }
  }

  return (
    <Card className="transition-colors hover:bg-accent/50 relative">
      <Link href={`/projects/${project.id}`} className="block">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-base line-clamp-1 pr-8">
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
      </Link>

      {/* 삭제 영역 */}
      <div className="absolute bottom-3 right-4">
        {confirming ? (
          <div className="flex items-center gap-1.5 bg-background rounded-md border p-1" onClick={(e) => e.preventDefault()}>
            <span className="text-xs text-destructive font-medium px-1">삭제?</span>
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "확인"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              취소
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.preventDefault();
              setConfirming(true);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}
