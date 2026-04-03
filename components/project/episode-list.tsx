"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateNextButton } from "./generate-next-button";
import { updateEpisodeContent } from "@/lib/actions/episodes";
import { Loader2, RotateCcw, Pencil, Save, X } from "lucide-react";
import type { Episode } from "@/types";

export function EpisodeList({
  episodes,
  projectId,
  episodeCount,
  canGenerateMore,
  limitReason,
}: {
  episodes: Episode[];
  projectId: string;
  episodeCount: number;
  canGenerateMore: boolean;
  limitReason?: string;
}) {
  const router = useRouter();
  const [selectedNumber, setSelectedNumber] = useState(
    episodes.length > 0 ? episodes[0].episode_number : 1
  );
  const [retrying, setRetrying] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = episodes.find((ep) => ep.episode_number === selectedNumber);
  const maxEpisodeNumber = episodes.reduce(
    (max, ep) => Math.max(max, ep.episode_number),
    0
  );
  const nextNumber = maxEpisodeNumber + 1;
  const allDone = maxEpisodeNumber >= episodeCount;

  async function handleRetry(episodeId: string) {
    setRetrying(episodeId);

    try {
      const eventSource = new EventSource(
        `/api/generate/episode/retry?episodeId=${episodeId}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.content === "ALL_DONE" || data.status === "error") {
          eventSource.close();
          setRetrying(null);
          router.refresh();
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setRetrying(null);
      };
    } catch {
      setRetrying(null);
    }
  }

  function startEdit() {
    if (selected?.content) {
      setEditContent(selected.content);
      setEditing(true);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const result = await updateEpisodeContent(selected.id, editContent);
    setSaving(false);
    if (!result.error) {
      setEditing(false);
      router.refresh();
    }
  }

  if (episodes.length === 0) {
    return <p className="text-muted-foreground">에피소드 데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {/* 에피소드 서브탭 */}
      <div className="flex flex-wrap items-center gap-2">
        {episodes.map((ep) => (
          <Button
            key={ep.episode_number}
            variant={
              selectedNumber === ep.episode_number ? "default" : "outline"
            }
            size="sm"
            onClick={() => setSelectedNumber(ep.episode_number)}
            className="relative"
          >
            {ep.episode_number}화
            {ep.status === "failed" && (
              <Badge
                variant="destructive"
                className="absolute -top-1.5 -right-1.5 h-4 px-1 text-[10px]"
              >
                실패
              </Badge>
            )}
            {ep.status === "generating" && (
              <Loader2 className="ml-1 h-3 w-3 animate-spin" />
            )}
          </Button>
        ))}

        {/* 다음 화 생성 버튼 */}
        {!allDone && (
          <GenerateNextButton
            projectId={projectId}
            nextEpisodeNumber={nextNumber}
            disabled={!canGenerateMore}
            disabledReason={limitReason}
          />
        )}
        {allDone && (
          <Badge variant="secondary" className="text-xs">
            전체 {episodeCount}화 완료
          </Badge>
        )}
      </div>

      {/* 선택된 에피소드 본문 */}
      {selected && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {selected.episode_number}화
            </CardTitle>
            <div className="flex gap-1">
              {selected.status === "completed" && !editing && (
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  편집
                </Button>
              )}
              {editing && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="mr-1 h-3.5 w-3.5" />
                    )}
                    저장
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {selected.status === "failed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRetry(selected.id)}
                  disabled={retrying === selected.id}
                >
                  {retrying === selected.id ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  )}
                  재생성
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <textarea
                className="w-full min-h-[400px] rounded-md border bg-background p-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
            ) : selected.status === "completed" && selected.content ? (
              <div className="prose prose-invert max-w-none">
                {selected.content.split("\n\n").map((paragraph, i) => (
                  <p key={i} className="text-sm leading-relaxed mb-4">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : selected.status === "generating" ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                생성 중...
              </div>
            ) : selected.status === "failed" ? (
              <p className="text-muted-foreground">
                생성에 실패했습니다. 재생성 버튼을 눌러주세요.
              </p>
            ) : (
              <p className="text-muted-foreground">내용이 없습니다.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
