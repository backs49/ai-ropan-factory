"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export function RetryButton({ projectId }: { projectId: string }) {
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();
  const doneRef = useRef(false);

  async function handleRetry() {
    setRetrying(true);
    doneRef.current = false;

    try {
      const eventSource = new EventSource(`/api/generate/retry?projectId=${projectId}`);

      eventSource.onmessage = (event) => {
        let data: { content?: string; status?: string; stage?: string; error?: string };
        try {
          data = JSON.parse(event.data);
        } catch {
          return; // 손상된 프레임 무시
        }
        // 요청 자체가 거절된 경우(재시도 한도 초과·진행 중) — 서버가 error 이벤트 하나만 보내고 닫음
        if (data.status === "error" && data.stage === "outline") {
          doneRef.current = true;
          eventSource.close();
          toast.error(data.error || "재시도에 실패했습니다.");
          router.refresh();
          setRetrying(false);
          return;
        }
        if (data.content === "ALL_DONE") {
          doneRef.current = true;
          eventSource.close();
          router.refresh();
          setRetrying(false);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        if (!doneRef.current) {
          toast.error("생성 연결이 끊어졌습니다. 새로고침 후 다시 시도해주세요.");
        }
        router.refresh();
        setRetrying(false);
      };
    } catch {
      setRetrying(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleRetry} disabled={retrying}>
      <RotateCcw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
      {retrying ? "재시도 중..." : "실패 단계 재시도"}
    </Button>
  );
}
