import type { AIProvider } from "@/types";

export interface AIStreamParams {
  system: string;
  user: string;
  maxTokens: number;
  model: string;
  expectsJSON?: boolean;
}

export interface AIStreamResult {
  inputTokens: number;
  outputTokens: number;
  /** 생성 종료 사유 — "length"면 토큰 한도로 잘린 응답, "refusal"이면 모델이 안전 정책으로 거절 */
  finishReason: "stop" | "length" | "refusal" | "other";
}

/**
 * 출력 토큰 한도. 현재 모델들은 사고(추론) 토큰도 이 한도에서 소모하므로 본문 길이보다 넉넉히 잡는다.
 * 실제 과금은 생성된 토큰만큼이라 한도를 올려도 비용은 늘지 않는다.
 */
export const MAX_TOKENS = {
  json: 16000, // 아웃라인·캐릭터
  episode: 16000, // 본문 3,000~5,000자
  meta: 6000,
} as const;

/** 잘림·거절·짧은 본문을 사용자 메시지로 변환. 정상이면 null */
export function episodeFailureMessage(result: AIStreamResult, text: string): string | null {
  if (result.finishReason === "refusal") {
    return "AI가 안전 정책에 따라 생성을 거절했습니다. 키워드나 분위기를 바꿔 다시 시도해주세요.";
  }
  if (result.finishReason === "length") {
    return "본문이 길이 제한으로 잘렸습니다. 다시 시도해주세요.";
  }
  if (text.trim().length < 1000) {
    return "본문이 비정상적으로 짧게 생성됐습니다. 다시 시도해주세요.";
  }
  return null;
}

export async function streamAI(
  provider: AIProvider,
  params: AIStreamParams,
  onChunk: (text: string) => void
): Promise<AIStreamResult> {
  switch (provider) {
    case "anthropic":
      return streamAnthropic(params, onChunk);
    case "gemini":
      return streamGemini(params, onChunk);
    case "grok":
      return streamGrok(params, onChunk);
  }
}

// --- Anthropic (Claude) ---
async function streamAnthropic(
  params: AIStreamParams,
  onChunk: (text: string) => void
): Promise<AIStreamResult> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const stream = client.messages.stream({
    model: params.model,
    max_tokens: params.maxTokens,
    // Haiku 5.5는 thinking이 기본으로 켜져 max_tokens를 소모하므로 명시적으로 끈다
    // (disabled는 effort high 이하에서 허용 — 기본 effort는 medium)
    ...(params.model.startsWith("claude-haiku-5")
      ? { thinking: { type: "disabled" as const } }
      : {}),
    // Sonnet 5.5는 thinking을 끌 수 없고(disabled는 400) 기본 effort가 high —
    // 소설 생성은 깊은 추론보다 속도가 중요하고 maxDuration(300초) 안에 끝나야 하므로 medium으로 낮춘다
    // Opus 5.5도 thinking을 끌 수 없음 — 기본 effort가 medium이지만 명시해 둔다 (Pro 1화 전용)
    ...(params.model.startsWith("claude-sonnet-5") || params.model.startsWith("claude-opus-5")
      ? {
          thinking: { type: "adaptive" as const },
          output_config: { effort: "medium" as const },
        }
      : {}),
    system: params.system,
    messages: [{ role: "user", content: params.user }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      onChunk(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  return {
    inputTokens: final.usage.input_tokens,
    outputTokens: final.usage.output_tokens,
    finishReason:
      final.stop_reason === "end_turn" || final.stop_reason === "stop_sequence"
        ? "stop"
        : final.stop_reason === "max_tokens"
          ? "length"
          : final.stop_reason === "refusal"
            ? "refusal"
            : "other",
  };
}

// --- Google Gemini ---
async function streamGemini(
  params: AIStreamParams,
  onChunk: (text: string) => void
): Promise<AIStreamResult> {
  const { GoogleGenAI, ThinkingLevel } = await import("@google/genai");
  // Gemini 3.x Flash는 thinking이 기본으로 켜져 출력 한도를 소모 — 경량 단계는 LOW로 제한
  const isGemini3Flash = params.model.startsWith("gemini-3") && params.model.includes("flash");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const response = await ai.models.generateContentStream({
    model: params.model,
    contents: [{ role: "user", parts: [{ text: params.user }] }],
    config: {
      systemInstruction: params.system,
      maxOutputTokens: params.maxTokens,
      ...(params.expectsJSON
        ? { responseMimeType: "application/json" }
        : { responseModalities: ["TEXT"] }),
      thinkingConfig: {
        includeThoughts: false,
        ...(isGemini3Flash ? { thinkingLevel: ThinkingLevel.LOW } : {}),
      },
    },
  });

  let outputText = "";
  let geminiFinish: string | undefined;
  for await (const chunk of response) {
    const text = chunk.text ?? "";
    if (text) {
      outputText += text;
      onChunk(text);
    }
    const reason = chunk.candidates?.[0]?.finishReason;
    if (reason) geminiFinish = String(reason);
  }

  // Gemini doesn't provide exact token counts in streaming; estimate
  const inputEstimate = Math.ceil((params.system.length + params.user.length) / 4);
  const outputEstimate = Math.ceil(outputText.length / 4);

  return {
    inputTokens: inputEstimate,
    outputTokens: outputEstimate,
    finishReason:
      geminiFinish === "STOP"
        ? "stop"
        : geminiFinish === "MAX_TOKENS"
          ? "length"
          : geminiFinish === "SAFETY" || geminiFinish === "PROHIBITED_CONTENT"
            ? "refusal"
            : "other",
  };
}

// --- Grok (xAI, OpenAI-compatible) ---
async function streamGrok(
  params: AIStreamParams,
  onChunk: (text: string) => void
): Promise<AIStreamResult> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY!,
    baseURL: "https://api.x.ai/v1",
  });

  const stream = await client.chat.completions.create({
    model: params.model,
    max_tokens: params.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    ...(params.expectsJSON ? { response_format: { type: "json_object" as const } } : {}),
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });

  let inputTokens = 0;
  let outputTokens = 0;
  let grokFinish: string | null = null;

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) {
      onChunk(text);
    }
    const reason = chunk.choices?.[0]?.finish_reason;
    if (reason) grokFinish = reason;
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? 0;
      outputTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  return {
    inputTokens,
    outputTokens,
    finishReason:
      grokFinish === "stop"
        ? "stop"
        : grokFinish === "length"
          ? "length"
          : grokFinish === "content_filter"
            ? "refusal"
            : "other",
  };
}
