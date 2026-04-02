"use client";

import { useState } from "react";
import { updateAIProvider } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import type { AIProvider } from "@/types";
import { AI_PROVIDER_OPTIONS } from "@/types";
import { toast } from "sonner";
import { Check } from "lucide-react";

export function ProviderSelector({ current }: { current: AIProvider }) {
  const [selected, setSelected] = useState<AIProvider>(current);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (selected === current) return;
    setSaving(true);
    const result = await updateAIProvider(selected);
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("AI 모델이 변경되었습니다.");
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {AI_PROVIDER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSelected(opt.value)}
            className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
              selected === opt.value
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <div>
              <div className="font-medium text-sm">{opt.label}</div>
              <div className="text-xs text-muted-foreground">모델: {opt.model}</div>
            </div>
            {selected === opt.value && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </button>
        ))}
      </div>
      {selected !== current && (
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "저장 중..." : "변경 저장"}
        </Button>
      )}
    </div>
  );
}
