"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/lib/actions/account";
import { Loader2 } from "lucide-react";

export function DeleteAccount() {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const result = await deleteAccount();
    // 성공 시 redirect되므로 여기 도달하면 실패
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        탈퇴하면 모든 프로젝트와 에피소드가 즉시 삭제되며 복구할 수 없습니다.
      </p>
      <div className="flex gap-2">
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={'"탈퇴"를 입력하세요'}
          className="max-w-[200px]"
        />
        <Button
          variant="destructive"
          disabled={confirmText !== "탈퇴" || loading}
          onClick={handleDelete}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          계정 삭제
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
