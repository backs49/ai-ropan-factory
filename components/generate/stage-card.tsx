"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, BookOpen, Users, FileText, Palette } from "lucide-react";
import type { GenerationStage } from "@/types";

const stageConfig: Record<
  GenerationStage,
  { title: string; icon: typeof BookOpen; description: string }
> = {
  outline: {
    title: "3막 구조 & 아웃라인",
    icon: BookOpen,
    description: "전체 스토리 구조와 에피소드별 아웃라인을 생성합니다",
  },
  characters: {
    title: "캐릭터 시트",
    icon: Users,
    description: "8명의 주요 캐릭터 상세 설정을 생성합니다",
  },
  first_episode: {
    title: "1화 완성본",
    icon: FileText,
    description: "4,000~5,000자의 웹소설 1화를 작성합니다",
  },
  meta: {
    title: "표지 & SEO",
    icon: Palette,
    description: "AI 표지 프롬프트와 SEO용 제목/해시태그를 생성합니다",
  },
};

interface StageCardProps {
  stage: GenerationStage;
  status: "pending" | "started" | "streaming" | "completed" | "error";
  content: string;
  error?: string;
}

export function StageCard({ stage, status, content, error }: StageCardProps) {
  const config = stageConfig[stage];
  const Icon = config.icon;

  return (
    <Card className={status === "streaming" || status === "started" ? "border-primary/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{config.title}</CardTitle>
          </div>
          {status === "pending" && (
            <Badge variant="outline" className="text-xs">대기 중</Badge>
          )}
          {(status === "started" || status === "streaming") && (
            <Badge variant="secondary" className="text-xs">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              생성 중
            </Badge>
          )}
          {status === "completed" && (
            <Badge className="text-xs bg-green-500/20 text-green-400 hover:bg-green-500/20">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              완료
            </Badge>
          )}
          {status === "error" && (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="mr-1 h-3 w-3" />
              실패
            </Badge>
          )}
        </div>
        {(status === "pending" || status === "started") && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </CardHeader>
      {(status === "streaming" || status === "completed") && content && (
        <CardContent>
          <div className="max-h-96 overflow-y-auto rounded-md bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{content}</pre>
          </div>
        </CardContent>
      )}
      {status === "error" && error && (
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      )}
    </Card>
  );
}
