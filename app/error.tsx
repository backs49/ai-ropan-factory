"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="text-2xl font-bold">문제가 발생했습니다</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        일시적인 오류일 수 있습니다. 다시 시도해도 반복되면 잠시 후에 다시 방문해주세요.
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </div>
  );
}
