"use server";

import { createClient } from "@/lib/supabase/server";
import type { AIProvider } from "@/types";

const VALID_PROVIDERS: AIProvider[] = ["anthropic", "gemini", "grok"];

export async function updateAIProvider(provider: AIProvider): Promise<{ error?: string }> {
  if (!VALID_PROVIDERS.includes(provider)) {
    return { error: "지원하지 않는 AI 프로바이더입니다." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("profiles")
    .update({ ai_provider: provider })
    .eq("id", user.id);

  if (error) return { error: error.message };

  return {};
}
