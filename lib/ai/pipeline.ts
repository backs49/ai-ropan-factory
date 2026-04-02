import { streamAI } from "./providers";
import {
  getOutlinePrompt,
  getCharacterPrompt,
  getFirstEpisodePrompt,
  getMetaPrompt,
} from "./prompts";
import type {
  AIProvider,
  GenerationStage,
  GenerationInput,
  OutlineData,
  CharacterData,
  StreamEvent,
  Tier,
  TokenUsage,
} from "@/types";
import { AI_MODELS } from "@/types";

type SendEvent = (event: StreamEvent) => void;

function getModelForStage(
  provider: AIProvider,
  tier: Tier,
  stage: GenerationStage
): string {
  const models = AI_MODELS[provider];

  // Pro: 모든 단계에 최신 모델
  if (tier === "pro" || tier === "enterprise") {
    return models.heavy;
  }

  // Free: 1화 완성본만 상위 모델, 나머지는 경량 모델
  if (stage === "first_episode") {
    return models.heavy;
  }
  return models.light;
}

export async function runGenerationPipeline(
  input: GenerationInput,
  sendEvent: SendEvent,
  provider: AIProvider = "gemini",
  tier: Tier = "free"
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
    {
      system: outlinePrompt.system,
      user: outlinePrompt.user,
      maxTokens: 8000,
      model: getModelForStage(provider, tier, "outline"),
    },
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
    {
      system: charPrompt.system,
      user: charPrompt.user,
      maxTokens: 6000,
      model: getModelForStage(provider, tier, "characters"),
    },
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
    {
      system: episodePrompt.system,
      user: episodePrompt.user,
      maxTokens: 8000,
      model: getModelForStage(provider, tier, "first_episode"),
    },
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
    {
      system: metaPrompt.system,
      user: metaPrompt.user,
      maxTokens: 3000,
      model: getModelForStage(provider, tier, "meta"),
    },
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

  // Estimate cost based on provider (blended rate for mixed models)
  tokenUsage.cost_estimate = estimateCost(provider, tier, tokenUsage);

  return { outline, characters, firstEpisode, seo, tokenUsage };
}

function estimateCost(provider: AIProvider, tier: Tier, usage: TokenUsage): number {
  // Pro uses heavy model pricing, Free uses approximate blend
  const rates: Record<AIProvider, { free: { input: number; output: number }; pro: { input: number; output: number } }> = {
    gemini: {
      free: { input: 0.5, output: 2 },      // blended Flash + 3.1 Pro
      pro: { input: 1.25, output: 10 },      // Gemini 3.1 Pro
    },
    grok: {
      free: { input: 0.6, output: 1.9 },     // blended 4.1 Fast + 4.20
      pro: { input: 2, output: 6 },           // Grok 4.20
    },
    anthropic: {
      free: { input: 3, output: 15 },         // blended Sonnet 4 + 4.6
      pro: { input: 3, output: 15 },          // Sonnet 4.6
    },
  };
  const r = tier === "pro" || tier === "enterprise" ? rates[provider].pro : rates[provider].free;
  return (usage.input_tokens / 1_000_000) * r.input +
    (usage.output_tokens / 1_000_000) * r.output;
}
