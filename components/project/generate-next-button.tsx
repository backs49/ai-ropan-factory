"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Crown } from "lucide-react";

export function GenerateNextButton({
  projectId,
  nextEpisodeNumber,
  disabled,
  disabledReason,
}: {
  projectId: string;
  nextEpisodeNumber: number;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setStreamText("");
    setError(null);

    try {
      const eventSource = new EventSource(
        `/api/generate/episode?projectId=${projectId}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.status === "streaming" && data.content) {
          setStreamText((prev) => prev + data.content);
        }

        if (data.status === "error") {
          setError(data.error || "생성 중 오류가 발생했습니다.");
          eventSource.close();
          setGenerating(false);
        }

        if (data.content === "ALL_DONE") {
          eventSource.close();
          setGenerating(false);
          router.refresh();
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setError("연결이 끊어졌습니다.");
        setGenerating(false);
      };
    } catch {
      setError("생성 요청에 실패했습니다.");
      setGenerating(false);
    }
  }

  if (generating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {nextEpisodeNumber}화 생성 중...
        </div>
        {streamText && (
          <div className="rounded border p-4 max-h-96 overflow-y-auto">
            <div className="prose prose-invert max-w-none">
              {streamText.split("\n\n").map((p, i) => (
                <p key={i} className="text-sm leading-relaxed mb-4">
                  {p}
                </p>
              ))}
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>
    );
  }

  if (disabled) {
    return (
      <Button size="sm" render={<Link href="/pricing" />}>
        <Crown className="mr-1 h-3.5 w-3.5" />
        Pro로 계속 생성
      </Button>
    );
  }

  return (
    <div>
      <Button
        onClick={handleGenerate}
        size="sm"
        variant="outline"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        {nextEpisodeNumber}화 생성
      </Button>
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
    </div>
  );
}
