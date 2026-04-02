"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createProject } from "@/lib/actions/generation";
import { GENRE_OPTIONS, MOOD_OPTIONS, TARGET_AGE_OPTIONS } from "@/types";
import type { GenerationInput } from "@/types";
import { Sparkles, X } from "lucide-react";

export function GenerationForm({ variationOf }: { variationOf?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [targetAge, setTargetAge] = useState("");
  const [episodeCount, setEpisodeCount] = useState(50);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");

  function addKeyword() {
    const trimmed = keywordInput.trim();
    if (trimmed && keywords.length < 5 && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
      setKeywordInput("");
    }
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter((k) => k !== kw));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!genre || !mood || !targetAge || keywords.length === 0) {
      setError("모든 필수 항목을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    const input: GenerationInput = {
      genre,
      keywords,
      target_age: targetAge,
      mood,
      episode_count: episodeCount,
      variation_of: variationOf,
    };

    const result = await createProject(input);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/projects/${result.projectId}`);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">장르</CardTitle>
            <CardDescription>작품의 장르를 선택하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {GENRE_OPTIONS.map((g) => (
                <Button key={g} type="button" variant={genre === g ? "default" : "outline"} size="sm" onClick={() => setGenre(g)}>
                  {g}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">분위기</CardTitle>
            <CardDescription>작품의 전체적인 톤을 선택하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map((m) => (
                <Button key={m} type="button" variant={mood === m ? "default" : "outline"} size="sm" onClick={() => setMood(m)}>
                  {m}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">키워드 (최대 5개)</CardTitle>
            <CardDescription>작품의 핵심 소재나 클리셰를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addKeyword(); } }}
                placeholder="예: 계약 결혼, 냉혈 공작, 전생 기억"
                disabled={keywords.length >= 5}
              />
              <Button type="button" variant="secondary" onClick={addKeyword} disabled={keywords.length >= 5}>추가</Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1 pr-1">
                    {kw}
                    <button type="button" onClick={() => removeKeyword(kw)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">세부 설정</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>타겟 연령</Label>
              <div className="flex flex-wrap gap-2">
                {TARGET_AGE_OPTIONS.map((age) => (
                  <Button key={age} type="button" variant={targetAge === age ? "default" : "outline"} size="sm" onClick={() => setTargetAge(age)}>
                    {age}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="episodeCount">원하는 화수</Label>
              <Input id="episodeCount" type="number" min={10} max={200} value={episodeCount} onChange={(e) => setEpisodeCount(Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? "생성 시작 중..." : (
            <><Sparkles className="mr-2 h-5 w-5" />AI 생성 시작</>
          )}
        </Button>
      </div>
    </form>
  );
}
