import { redirect } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/actions/projects";
import { GenerationStream } from "@/components/generate/generation-stream";
import { OutlineView } from "@/components/project/outline-view";
import { CharacterSheet } from "@/components/project/character-sheet";
import { EpisodeView } from "@/components/project/episode-view";
import { DownloadButton } from "@/components/project/download-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { OutlineData, CharacterData, CoverPrompt, SeoData } from "@/types";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    redirect("/dashboard");
  }

  if (project.status === "generating") {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">생성 중...</h1>
        </div>
        <GenerationStream projectId={id} />
      </div>
    );
  }

  const outline = project.outline as OutlineData | null;
  const characters = project.characters as CharacterData[] | null;
  const coverPrompts = project.cover_prompts as CoverPrompt[] | null;
  const seo = project.seo as SeoData | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {outline?.title || project.title || "제목 없음"}
            </h1>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{project.genre}</Badge>
              <Badge variant="outline">{project.mood}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href={`/generate?variation_of=${project.id}`} />}>
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 생성
          </Button>
          <DownloadButton project={project} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        생성된 모든 콘텐츠의 저작권은 사용자에게 100% 귀속됩니다.
      </p>

      <Tabs defaultValue="outline">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="outline">아웃라인</TabsTrigger>
          <TabsTrigger value="characters">캐릭터</TabsTrigger>
          <TabsTrigger value="episode">1화</TabsTrigger>
          <TabsTrigger value="meta">표지 & SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="outline" className="mt-4">
          {outline ? <OutlineView outline={outline} /> : <p className="text-muted-foreground">아웃라인 데이터가 없습니다.</p>}
        </TabsContent>

        <TabsContent value="characters" className="mt-4">
          {characters ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {characters.map((char, i) => <CharacterSheet key={i} character={char} />)}
            </div>
          ) : <p className="text-muted-foreground">캐릭터 데이터가 없습니다.</p>}
        </TabsContent>

        <TabsContent value="episode" className="mt-4">
          {project.first_episode ? <EpisodeView content={project.first_episode} /> : <p className="text-muted-foreground">1화 데이터가 없습니다.</p>}
        </TabsContent>

        <TabsContent value="meta" className="mt-4 space-y-4">
          {seo && (
            <Card>
              <CardHeader><CardTitle className="text-base">SEO 제목 후보</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {seo.titles.map((t, i) => <p key={i} className="text-sm">{i + 1}. {t}</p>)}
                <div className="flex flex-wrap gap-1 mt-3">
                  {seo.hashtags.map((tag, i) => <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>)}
                </div>
              </CardContent>
            </Card>
          )}
          {coverPrompts && (
            <div className="space-y-4">
              <h3 className="font-semibold">표지 이미지 프롬프트</h3>
              {coverPrompts.map((cp, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{cp.style}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Prompt</p>
                      <p className="rounded bg-muted p-2 text-xs font-mono">{cp.prompt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Negative Prompt</p>
                      <p className="rounded bg-muted p-2 text-xs font-mono">{cp.negative_prompt}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
