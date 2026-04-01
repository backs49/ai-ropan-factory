"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StageCard } from "./stage-card";
import type { GenerationStage, StreamEvent } from "@/types";

type StageStatus = "pending" | "started" | "streaming" | "completed" | "error";

interface StageState {
  status: StageStatus;
  content: string;
  error?: string;
}

const STAGES: GenerationStage[] = ["outline", "characters", "first_episode", "meta"];

export function GenerationStream({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [stages, setStages] = useState<Record<GenerationStage, StageState>>(
    () =>
      Object.fromEntries(
        STAGES.map((s) => [s, { status: "pending" as StageStatus, content: "" }])
      ) as Record<GenerationStage, StageState>
  );
  const [done, setDone] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/generate?projectId=${projectId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data: StreamEvent = JSON.parse(event.data);

      if (data.content === "ALL_DONE") {
        setDone(true);
        es.close();
        router.refresh();
        return;
      }

      setStages((prev) => {
        const current = prev[data.stage];
        const updated = { ...current };

        if (data.status === "started") {
          updated.status = "started";
        } else if (data.status === "streaming") {
          updated.status = "streaming";
          updated.content += data.content || "";
        } else if (data.status === "completed") {
          updated.status = "completed";
        } else if (data.status === "error") {
          updated.status = "error";
          updated.error = data.error;
        }

        return { ...prev, [data.stage]: updated };
      });
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [projectId, router]);

  return (
    <div className="space-y-4">
      {!done && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-primary">
            AI가 작품을 생성하고 있습니다. 이 페이지를 벗어나지 마세요.
          </p>
        </div>
      )}
      {STAGES.map((stage) => (
        <StageCard
          key={stage}
          stage={stage}
          status={stages[stage].status}
          content={stages[stage].content}
          error={stages[stage].error}
        />
      ))}
    </div>
  );
}
