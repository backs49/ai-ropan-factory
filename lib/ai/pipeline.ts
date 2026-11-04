import { streamAI, MAX_TOKENS, episodeFailureMessage } from "./providers";
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

/**
 * AI 응답에서 JSON을 안전하게 추출.
 * Gemini 등이 JSON 앞뒤에 설명 텍스트를 붙이는 경우 처리.
 */
export function extractJSON(text: string): string {
  // 1) 코드블록 안의 JSON 추출
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 2) 첫 번째 { 또는 [ 부터 마지막 } 또는 ] 까지 추출
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");

  let start = -1;
  let endChar = "";

  if (firstBrace === -1 && firstBracket === -1) return text;

  if (firstBracket === -1 || (firstBrace !== -1 && firstBrace < firstBracket)) {
    start = firstBrace;
    endChar = "}";
  } else {
    start = firstBracket;
    endChar = "]";
  }

  const lastEnd = text.lastIndexOf(endChar);
  if (lastEnd <= start) return text;

  return text.substring(start, lastEnd + 1);
}

/**
 * 파싱된 아웃라인의 구조 검증.
 * 문법상 유효하지만 구조가 잘못된 JSON이 이후 단계에서 런타임 예외를 내는 것을 방지.
 */
export function isValidOutline(o: unknown): o is OutlineData {
  if (!o || typeof o !== "object") return false;
  const c = o as Record<string, { summary?: unknown; episodes?: unknown }>;
  if (typeof (c as { title?: unknown }).title !== "string") return false;
  return (["act1", "act2", "act3"] as const).every(
    (k) =>
      c[k] &&
      typeof c[k].summary === "string" &&
      Array.isArray(c[k].episodes) &&
      (c[k].episodes as unknown[]).length > 0
  );
}

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
      maxTokens: MAX_TOKENS.json,
      model: getModelForStage(provider, tier, "outline"),
      expectsJSON: true,
    },
    (text) => {
      outlineText += text;
      sendEvent({ stage: "outline", status: "streaming", content: text });
    }
  );
  tokenUsage.input_tokens += outlineUsage.inputTokens;
  tokenUsage.output_tokens += outlineUsage.outputTokens;

  try {
    const parsed = JSON.parse(extractJSON(outlineText));
    if (!isValidOutline(parsed)) {
      throw new Error("invalid outline structure");
    }
    outline = parsed;
  } catch {
    sendEvent({
      stage: "outline",
      status: "error",
      error:
        outlineUsage.finishReason === "length"
          ? "아웃라인 응답이 길이 제한으로 잘렸습니다. 화수를 줄여 다시 시도해주세요."
          : outlineUsage.finishReason === "refusal"
            ? "AI가 안전 정책에 따라 생성을 거절했습니다. 키워드나 분위기를 바꿔 다시 시도해주세요."
            : "아웃라인 파싱 실패",
    });
    tokenUsage.cost_estimate = estimateCost(provider, tier, tokenUsage);
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
      maxTokens: MAX_TOKENS.json,
      model: getModelForStage(provider, tier, "characters"),
      expectsJSON: true,
    },
    (text) => {
      charText += text;
      sendEvent({ stage: "characters", status: "streaming", content: text });
    }
  );
  tokenUsage.input_tokens += charUsage.inputTokens;
  tokenUsage.output_tokens += charUsage.outputTokens;

  try {
    const parsed = JSON.parse(extractJSON(charText));
    // Grok 등이 {"characters": [...]} 형태로 감쌀 수 있음
    characters = Array.isArray(parsed) ? parsed : Array.isArray(parsed.characters) ? parsed.characters : null;
    if (characters) {
      sendEvent({ stage: "characters", status: "completed" });
    } else {
      sendEvent({ stage: "characters", status: "error", error: "캐릭터 배열 추출 실패 (계속 진행)" });
    }
  } catch {
    sendEvent({
      stage: "characters",
      status: "error",
      error:
        charUsage.finishReason === "length"
          ? "캐릭터 응답이 길이 제한으로 잘렸습니다 (계속 진행)"
          : "캐릭터 파싱 실패 (계속 진행)",
    });
  }

  // --- Stage 3: First Episode ---
  sendEvent({ stage: "first_episode", status: "started" });
  // 파싱 성공한 캐릭터만 전달 — 파싱 실패 시 깨진 원문 대신 빈 값 (프롬프트가 대체 지침 제공)
  const charContext = characters ? JSON.stringify(characters) : "";
  const episodePrompt = getFirstEpisodePrompt(input, outline!, charContext);
  let episodeText = "";

  const episodeUsage = await streamAI(
    provider,
    {
      system: episodePrompt.system,
      user: episodePrompt.user,
      maxTokens: MAX_TOKENS.episode,
      model: getModelForStage(provider, tier, "first_episode"),
    },
    (text) => {
      episodeText += text;
      sendEvent({ stage: "first_episode", status: "streaming", content: text });
    }
  );
  tokenUsage.input_tokens += episodeUsage.inputTokens;
  tokenUsage.output_tokens += episodeUsage.outputTokens;

  // 잘리거나 비정상적으로 짧은 본문은 실패로 처리 → first_episode가 null이면
  // 프로젝트 페이지의 누락 단계 재시도(RetryButton) 흐름으로 복구 가능
  const episodeError = episodeFailureMessage(episodeUsage, episodeText);
  if (episodeError) {
    sendEvent({ stage: "first_episode", status: "error", error: episodeError });
  } else {
    firstEpisode = episodeText;
    sendEvent({ stage: "first_episode", status: "completed" });
  }

  // --- Stage 4: Meta (SEO + Cover Prompts) ---
  sendEvent({ stage: "meta", status: "started" });
  const metaPrompt = getMetaPrompt(input, outline!);
  let metaText = "";

  const metaUsage = await streamAI(
    provider,
    {
      system: metaPrompt.system,
      user: metaPrompt.user,
      maxTokens: MAX_TOKENS.meta,
      model: getModelForStage(provider, tier, "meta"),
      expectsJSON: true,
    },
    (text) => {
      metaText += text;
      sendEvent({ stage: "meta", status: "streaming", content: text });
    }
  );
  tokenUsage.input_tokens += metaUsage.inputTokens;
  tokenUsage.output_tokens += metaUsage.outputTokens;

  try {
    seo = JSON.parse(extractJSON(metaText));
    sendEvent({ stage: "meta", status: "completed" });
  } catch {
    sendEvent({ stage: "meta", status: "error", error: "메타 데이터 파싱 실패" });
  }

  // Estimate cost based on provider (blended rate for mixed models)
  tokenUsage.cost_estimate = estimateCost(provider, tier, tokenUsage);

  return { outline, characters, firstEpisode, seo, tokenUsage };
}

function estimateCost(provider: AIProvider, tier: Tier, usage: TokenUsage): number {
  // Pro uses heavy model pricing, Free uses approximate blend
  const rates: Record<AIProvider, { free: { input: number; output: number }; pro: { input: number; output: number } }> = {
    gemini: {
      free: { input: 1, output: 5 },         // blended 3.8 Flash ($0.75/$3.75) + 3.1 Pro
      pro: { input: 1.25, output: 10 },      // Gemini 3.1 Pro
    },
    grok: {
      free: { input: 2, output: 6 },         // Grok 4.7 (경량/상위 동일)
      pro: { input: 2, output: 6 },          // Grok 4.7
    },
    anthropic: {
      free: { input: 0.7, output: 3.5 },     // blended Haiku 5.5 ($0.10/$0.50) + Sonnet 5.5
      pro: { input: 2, output: 10 },         // Sonnet 5.5
    },
  };
  const r = tier === "pro" || tier === "enterprise" ? rates[provider].pro : rates[provider].free;
  return (usage.input_tokens / 1_000_000) * r.input +
    (usage.output_tokens / 1_000_000) * r.output;
}
