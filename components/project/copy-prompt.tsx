"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function CopyPrompt({ prompt, negativePrompt }: { prompt: string; negativePrompt: string }) {
  const [copied, setCopied] = useState(false);

  const combined = negativePrompt
    ? `${prompt} --no ${negativePrompt}`
    : prompt;

  async function handleCopy() {
    await navigator.clipboard.writeText(combined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <p className="rounded bg-muted p-3 pr-12 text-xs font-mono break-all">{combined}</p>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1.5 right-1.5 h-7 w-7"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
