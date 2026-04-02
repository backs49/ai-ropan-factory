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
  for await (const chunk of response) {
    const text = chunk.text ?? "";
    if (text) {
      outputText += text;
      onChunk(text);
    }
  }

  // Gemini doesn't provide exact token counts in streaming; estimate
  const inputEstimate = Math.ceil((params.system.length + params.user.length) / 4);
  const outputEstimate = Math.ceil(outputText.length / 4);

  return {
    inputTokens: inputEstimate,
    outputTokens: outputEstimate,
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

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content;
    if (text) {
      onChunk(text);
    }
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? 0;
      outputTokens = chunk.usage.completion_tokens ?? 0;
    }
  }

  return { inputTokens, outputTokens };
}
