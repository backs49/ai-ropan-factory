import { streamAI } from "./providers";
import {
  getOutlinePrompt,
  getCharacterPrompt,
  getFirstEpisodePrompt,
  getMetaPrompt,
} from "./prompts";
import type {
  AIProvider,
  GenerationInput,
  OutlineData,
  CharacterData,
  StreamEvent,
  TokenUsage,
} from "@/types";

type SendEvent = (event: StreamEvent) => void;

export async function runGenerationPipeline(
  input: GenerationInput,
  sendEvent: SendEvent,
  provider: AIProvider = "gemini"
): Promise<{
  outline: OutlineData | null;
  characters: CharacterData[] | null;
  firstEpisode: string | null;
  seo: Record<string, unknown> | null;
  tokenUsage: TokenUsage;
}> {
  const tokenUsage: TokenUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cost_estimate: 0,
  };

  let outline: OutlineData | null = null;
  let characters: CharacterData[] | null = null;
  let firstEpisode: string | null = null;
  let seo: Record<string, unknown> | null = null;

  // --- Stage 1: Outline ---
  sendEvent({ stage: "outline", status: "started" });
  const outlinePrompt = getOutlinePrompt(input);
  let outlineText = "";

  const outlineUsage = await streamAI(
    provider,
    { system: outlinePrompt.system, user: outlinePrompt.user, maxTokens: 8000 },
    (text) => {
      outlineText += text;
      sendEvent({ stage: "outline", status: "streaming", content: text });
    }
  );
  tokenUsage.input_tokens += outlineUsage.inputTokens;
  tokenUsage.output_tokens += outlineUsage.outputTokens;

  try {
    outline = JSON.parse(
      outlineText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    );
  } catch {
    sendEvent({ stage: "outline", status: "error", error: "아웃라인 파싱 실패" });
    return { outline, characters, firstEpisode, seo, tokenUsage };
  }
  sendEvent({ stage: "outline", status: "completed" });

  // --- Stage 2: Characters ---
  sendEvent({ stage: "characters", status: "started" });
  const charPrompt = getCharacterPrompt(input, outline!);
  let charText = "";

  const charUsage = await streamAI(
    provider,
    { system: charPrompt.system, user: charPrompt.user, maxTokens: 6000 },
    (text) => {
      charText += text;
      sendEvent({ stage: "characters", status: "streaming", content: text });
    }
  );
  tokenUsage.input_tokens += charUsage.inputTokens;
  tokenUsage.output_tokens += charUsage.outputTokens;

  try {
    characters = JSON.parse(
      charText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    );
  } catch {
    sendEvent({ stage: "characters", status: "error", error: "캐릭터 파싱 실패" });
    return { outline, characters, firstEpisode, seo, tokenUsage };
  }
  sendEvent({ stage: "characters", status: "completed" });

  // --- Stage 3: First Episode ---
  sendEvent({ stage: "first_episode", status: "started" });
  const episodePrompt = getFirstEpisodePrompt(input, outline!, charText);
  let episodeText = "";

  const episodeUsage = await streamAI(
    provider,
    { system: episodePrompt.system, user: episodePrompt.user, maxTokens: 8000 },
    (text) => {
      episodeText += text;
      sendEvent({ stage: "first_episode", status: "streaming", content: text });
    }
  );
  tokenUsage.input_tokens += episodeUsage.inputTokens;
  tokenUsage.output_tokens += episodeUsage.outputTokens;
  firstEpisode = episodeText;
  sendEvent({ stage: "first_episode", status: "completed" });

  // --- Stage 4: Meta (SEO + Cover Prompts) ---
  sendEvent({ stage: "meta", status: "started" });
  const metaPrompt = getMetaPrompt(input, outline!);
  let metaText = "";

  const metaUsage = await streamAI(
    provider,
    { system: metaPrompt.system, user: metaPrompt.user, maxTokens: 3000 },
    (text) => {
      metaText += text;
      sendEvent({ stage: "meta", status: "streaming", content: text });
    }
  );
  tokenUsage.input_tokens += metaUsage.inputTokens;
  tokenUsage.output_tokens += metaUsage.outputTokens;

  try {
    seo = JSON.parse(
      metaText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    );
  } catch {
    sendEvent({ stage: "meta", status: "error", error: "메타 데이터 파싱 실패" });
    return { outline, characters, firstEpisode, seo, tokenUsage };
  }
  sendEvent({ stage: "meta", status: "completed" });

  // Estimate cost based on provider
  tokenUsage.cost_estimate = estimateCost(provider, tokenUsage);

  return { outline, characters, firstEpisode, seo, tokenUsage };
}

function estimateCost(provider: AIProvider, usage: TokenUsage): number {
  const rates: Record<AIProvider, { input: number; output: number }> = {
    anthropic: { input: 3, output: 15 },     // Claude Sonnet: $3/$15 per 1M
    gemini: { input: 0.15, output: 0.6 },    // Gemini 2.5 Flash: $0.15/$0.60 per 1M
    grok: { input: 0.3, output: 0.5 },       // Grok 3 Mini: $0.30/$0.50 per 1M
  };
  const r = rates[provider];
  return (usage.input_tokens / 1_000_000) * r.input +
    (usage.output_tokens / 1_000_000) * r.output;
}
