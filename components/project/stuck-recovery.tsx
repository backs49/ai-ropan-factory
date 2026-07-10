"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { recoverStuckProject } from "@/lib/actions/projects";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function StuckRecovery({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRecover() {
    setLoading(true);
    const result = await recoverStuckProject(projectId);
    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else if (result.warning) {
      toast.warning(result.warning);
      router.refresh();
    } else {
      toast.success("초기화됐습니다. 사용 횟수는 차감되지 않았어요.");
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
      <p className="text-sm text-destructive">
        생성이 중단된 것 같습니다. 초기화 후 다시 생성할 수 있습니다.
      </p>
      <Button variant="outline" size="sm" onClick={handleRecover} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        생성 초기화
      </Button>
    </div>
  );
}
