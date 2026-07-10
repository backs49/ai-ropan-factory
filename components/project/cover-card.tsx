"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageIcon, Loader2, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function CoverCard({
  projectId,
  coverUrl,
  title,
  isPro,
}: {
  projectId: string;
  coverUrl: string | null;
  title: string;
  isPro: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/generate/cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "표지 생성에 실패했습니다.");
      } else {
        toast.success("표지가 생성됐습니다!");
        router.refresh();
      }
    } catch {
      toast.error("표지 생성 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">AI 표지</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {coverUrl ? (
          <div className="relative mx-auto w-full max-w-[240px] aspect-[2/3] overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt={`${title} 표지`} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-sm font-bold text-white line-clamp-2">{title}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-[240px] aspect-[2/3] items-center justify-center rounded-lg border border-dashed">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {isPro ? (
          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {coverUrl ? "표지 다시 생성" : "표지 생성"}
          </Button>
        ) : (
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="h-3.5 w-3.5" /> 표지 생성은 Pro 전용입니다
            </p>
            <Button variant="outline" className="w-full" render={<Link href="/pricing" />}>
              Pro로 업그레이드
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
