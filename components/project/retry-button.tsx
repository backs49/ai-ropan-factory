"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

export function RetryButton({ projectId }: { projectId: string }) {
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();

  async function handleRetry() {
    setRetrying(true);

    try {
      const eventSource = new EventSource(`/api/generate/retry?projectId=${projectId}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.content === "ALL_DONE") {
          eventSource.close();
          router.refresh();
          setRetrying(false);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
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
