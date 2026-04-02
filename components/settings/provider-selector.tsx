"use client";

import { useState } from "react";
import { updateAIProvider } from "@/lib/actions/settings";
import { Button } from "@/components/ui/button";
import type { AIProvider, Tier } from "@/types";
import { AI_PROVIDER_OPTIONS } from "@/types";
import { toast } from "sonner";
import { Check, Lock } from "lucide-react";

export function ProviderSelector({
  current,
  tier,
  enabledProviders,
}: {
  current: AIProvider;
  tier: Tier;
  enabledProviders: AIProvider[];
}) {
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

  const isPro = tier === "pro" || tier === "enterprise";

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {AI_PROVIDER_OPTIONS.map((opt) => {
          const enabled = enabledProviders.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={!enabled}
              onClick={() => enabled && setSelected(opt.value)}
              className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                !enabled
                  ? "border-border opacity-50 cursor-not-allowed"
                  : selected === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <div>
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground">
                  {enabled
                    ? isPro ? `모델: ${opt.proModel}` : `모델: ${opt.freeModel}`
                    : "API 키 미설정"}
                </div>
              </div>
              {enabled && selected === opt.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
              {!enabled && (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>
      {!isPro && (
        <p className="text-xs text-muted-foreground">
          Free: 1화 완성본에만 상위 모델 적용 · Pro: 전 단계 최신 모델
        </p>
      )}
      {selected !== current && (
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "저장 중..." : "변경 저장"}
        </Button>
      )}
    </div>
  );
}
