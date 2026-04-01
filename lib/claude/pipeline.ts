import { getClaudeClient } from "./client";
import {
  getOutlinePrompt,
  getCharacterPrompt,
  getFirstEpisodePrompt,
  getMetaPrompt,
} from "./prompts";
import type {
  GenerationInput,
  GenerationStage,
  OutlineData,
  CharacterData,
  StreamEvent,
  TokenUsage,
} from "@/types";

type SendEvent = (event: StreamEvent) => void;

export async function runGenerationPipeline(
  input: GenerationInput,
  sendEvent: SendEvent
): Promise<{
  outline: OutlineData | null;
  characters: CharacterData[] | null;
  firstEpisode: string | null;
  seo: Record<string, unknown> | null;
  tokenUsage: TokenUsage;
}> {
  const client = getClaudeClient();
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

  const outlineStream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: outlinePrompt.system,
    messages: [{ role: "user", content: outlinePrompt.user }],
  });

  for await (const event of outlineStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      outlineText += event.delta.text;
      sendEvent({
        stage: "outline",
        status: "streaming",
        content: event.delta.text,
      });
    }
  }

  const outlineResult = await outlineStream.finalMessage();
  tokenUsage.input_tokens += outlineResult.usage.input_tokens;
  tokenUsage.output_tokens += outlineResult.usage.output_tokens;

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

  const charStream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    system: charPrompt.system,
    messages: [{ role: "user", content: charPrompt.user }],
  });

  for await (const event of charStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      charText += event.delta.text;
      sendEvent({
        stage: "characters",
        status: "streaming",
        content: event.delta.text,
      });
    }
  }

  const charResult = await charStream.finalMessage();
  tokenUsage.input_tokens += charResult.usage.input_tokens;
  tokenUsage.output_tokens += charResult.usage.output_tokens;

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

  const episodeStream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: episodePrompt.system,
    messages: [{ role: "user", content: episodePrompt.user }],
  });

  for await (const event of episodeStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      episodeText += event.delta.text;
      sendEvent({
        stage: "first_episode",
        status: "streaming",
        content: event.delta.text,
      });
    }
  }

  const episodeResult = await episodeStream.finalMessage();
  tokenUsage.input_tokens += episodeResult.usage.input_tokens;
  tokenUsage.output_tokens += episodeResult.usage.output_tokens;
  firstEpisode = episodeText;
  sendEvent({ stage: "first_episode", status: "completed" });

  // --- Stage 4: Meta (SEO + Cover Prompts) ---
  sendEvent({ stage: "meta", status: "started" });
  const metaPrompt = getMetaPrompt(input, outline!);
  let metaText = "";

  const metaStream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    system: metaPrompt.system,
    messages: [{ role: "user", content: metaPrompt.user }],
  });

  for await (const event of metaStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      metaText += event.delta.text;
      sendEvent({
        stage: "meta",
        status: "streaming",
        content: event.delta.text,
      });
    }
  }

  const metaResult = await metaStream.finalMessage();
  tokenUsage.input_tokens += metaResult.usage.input_tokens;
  tokenUsage.output_tokens += metaResult.usage.output_tokens;

  try {
    seo = JSON.parse(
      metaText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    );
  } catch {
    sendEvent({ stage: "meta", status: "error", error: "메타 데이터 파싱 실패" });
    return { outline, characters, firstEpisode, seo, tokenUsage };
  }
  sendEvent({ stage: "meta", status: "completed" });

  // Estimate cost (Claude Sonnet pricing: $3/1M input, $15/1M output)
  tokenUsage.cost_estimate =
    (tokenUsage.input_tokens / 1_000_000) * 3 +
    (tokenUsage.output_tokens / 1_000_000) * 15;

  return { outline, characters, firstEpisode, seo, tokenUsage };
}
