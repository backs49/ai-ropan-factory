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
  /** 생성 종료 사유 — "length"면 토큰 한도로 잘린 응답 */
  finishReason: "stop" | "length" | "other";
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
          : "other",
  };
}

// --- Google Gemini ---
async function streamGemini(
  params: AIStreamParams,
  onChunk: (text: string) => void
): Promise<AIStreamResult> {
  const { GoogleGenAI } = await import("@google/genai");
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
      thinkingConfig: { includeThoughts: false },
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
      geminiFinish === "STOP" ? "stop" : geminiFinish === "MAX_TOKENS" ? "length" : "other",
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
    finishReason: grokFinish === "stop" ? "stop" : grokFinish === "length" ? "length" : "other",
  };
}
