import { redirect } from "next/navigation";
import Link from "next/link";
import { getProject } from "@/lib/actions/projects";
import { getEpisodes } from "@/lib/actions/episodes";
import { createClient } from "@/lib/supabase/server";
import { GenerationStream } from "@/components/generate/generation-stream";
import { OutlineView } from "@/components/project/outline-view";
import { CharacterSheet } from "@/components/project/character-sheet";
import { EpisodeList } from "@/components/project/episode-list";
import { DownloadButton } from "@/components/project/download-button";
import { RetryButton } from "@/components/project/retry-button";
import { CopyPrompt } from "@/components/project/copy-prompt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw } from "lucide-react";
import type { OutlineData, CharacterData, CoverPrompt, SeoData, Tier } from "@/types";

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
  const rawChars = project.characters;
  const characters = Array.isArray(rawChars) ? rawChars as CharacterData[] : null;
  const rawCover = project.cover_prompts;
  const coverPrompts = Array.isArray(rawCover) ? rawCover as CoverPrompt[] : null;
  const rawSeo = project.seo as SeoData | null;
  const seo = rawSeo && Array.isArray(rawSeo.titles) ? rawSeo : null;

  const hasMissingStages = outline && (!characters || !project.first_episode || (!seo && !coverPrompts));

  // 에피소드 + 프로필 조회
  const episodes = await getEpisodes(id);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("tier").eq("id", user.id).single()
    : { data: null };
  const tier = (profile?.tier as Tier) || "free";

  const FREE_EPISODE_LIMIT = 3;
  const canGenerateMore =
    tier !== "free" || episodes.length < FREE_EPISODE_LIMIT;
  const limitReason =
    !canGenerateMore
      ? `무료 플랜에서는 프로젝트당 ${FREE_EPISODE_LIMIT}화까지 생성 가능합니다. Pro로 업그레이드하세요.`
      : undefined;

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
          {hasMissingStages && <RetryButton projectId={project.id} />}
          <Button variant="outline" render={<Link href={`/generate?variation_of=${project.id}`} />}>
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 생성
          </Button>
          <DownloadButton project={project} episodes={episodes} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        생성된 모든 콘텐츠의 저작권은 사용자에게 100% 귀속됩니다.
      </p>

      <Tabs defaultValue="outline">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="outline">아웃라인</TabsTrigger>
          <TabsTrigger value="characters">캐릭터</TabsTrigger>
          <TabsTrigger value="episode">에피소드 ({episodes.length})</TabsTrigger>
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
          {episodes.length > 0 ? (
            <EpisodeList
              episodes={episodes}
              projectId={project.id}
              episodeCount={project.episode_count}
              canGenerateMore={canGenerateMore}
              limitReason={limitReason}
            />
          ) : (
            <p className="text-muted-foreground">에피소드 데이터가 없습니다.</p>
          )}
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
                  <CardContent className="text-sm">
                    <CopyPrompt prompt={cp.prompt} negativePrompt={cp.negative_prompt} />
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
