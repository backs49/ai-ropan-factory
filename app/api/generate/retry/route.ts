import { createServiceClient, createClient } from "@/lib/supabase/server";
import { streamAI } from "@/lib/ai/providers";
import {
  getCharacterPrompt,
  getFirstEpisodePrompt,
  getMetaPrompt,
} from "@/lib/ai/prompts";
import type { AIProvider, Tier, GenerationInput, OutlineData, StreamEvent } from "@/types";
import { AI_MODELS } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function extractJSON(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

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

function getModel(provider: AIProvider, tier: Tier, isHeavy: boolean): string {
  const models = AI_MODELS[provider];
  if (tier === "pro" || tier === "enterprise") return models.heavy;
  return isHeavy ? models.heavy : models.light;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) return new Response("Missing projectId", { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return new Response("Project not found", { status: 404 });

  const outline = project.outline as OutlineData | null;
  if (!outline) return new Response("아웃라인이 없어 재시도할 수 없습니다.", { status: 400 });

  // 빠진 단계 확인
  const missingStages: string[] = [];
  if (!project.characters) missingStages.push("characters");
  if (!project.first_episode) missingStages.push("first_episode");
  if (!project.seo && !project.cover_prompts) missingStages.push("meta");

  if (missingStages.length === 0) {
    return new Response("모든 단계가 이미 완료되었습니다.", { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider, tier")
    .eq("id", user.id)
    .single();

  const provider = (profile?.ai_provider as AIProvider) || "gemini";
  const tier = (profile?.tier as Tier) || "free";
  const serviceClient = await createServiceClient();

  const input: GenerationInput = {
    genre: project.genre,
    keywords: project.keywords,
    target_age: project.target_age,
    mood: project.mood,
    episode_count: project.episode_count,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: StreamEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        const updates: Record<string, unknown> = {};
        let charText = project.characters ? JSON.stringify(project.characters) : "";

        // --- 캐릭터 재시도 ---
        if (missingStages.includes("characters")) {
          sendEvent({ stage: "characters", status: "started" });
          const charPrompt = getCharacterPrompt(input, outline);
          charText = "";

          await streamAI(
            provider,
            {
              system: charPrompt.system,
              user: charPrompt.user,
              maxTokens: 6000,
              model: getModel(provider, tier, false),
              expectsJSON: true,
            },
            (text) => {
              charText += text;
              sendEvent({ stage: "characters", status: "streaming", content: text });
            }
          );

          try {
            updates.characters = JSON.parse(extractJSON(charText));
            sendEvent({ stage: "characters", status: "completed" });
          } catch {
            sendEvent({ stage: "characters", status: "error", error: "캐릭터 파싱 실패" });
          }
        } else {
          sendEvent({ stage: "characters", status: "completed" });
        }

        // --- 1화 재시도 ---
        if (missingStages.includes("first_episode")) {
          sendEvent({ stage: "first_episode", status: "started" });
          const episodePrompt = getFirstEpisodePrompt(input, outline, charText);
          let episodeText = "";

          await streamAI(
            provider,
            {
              system: episodePrompt.system,
              user: episodePrompt.user,
              maxTokens: 8000,
              model: getModel(provider, tier, true),
            },
            (text) => {
              episodeText += text;
              sendEvent({ stage: "first_episode", status: "streaming", content: text });
            }
          );

          updates.first_episode = episodeText;
          sendEvent({ stage: "first_episode", status: "completed" });
        } else {
          sendEvent({ stage: "first_episode", status: "completed" });
        }

        // --- 메타 재시도 ---
        if (missingStages.includes("meta")) {
          sendEvent({ stage: "meta", status: "started" });
          const metaPrompt = getMetaPrompt(input, outline);
          let metaText = "";

          await streamAI(
            provider,
            {
              system: metaPrompt.system,
              user: metaPrompt.user,
              maxTokens: 3000,
              model: getModel(provider, tier, false),
              expectsJSON: true,
            },
            (text) => {
              metaText += text;
              sendEvent({ stage: "meta", status: "streaming", content: text });
            }
          );

          try {
            const seo = JSON.parse(extractJSON(metaText));
            updates.cover_prompts = seo.cover_prompts || null;
            updates.seo = {
              titles: seo.titles,
              hashtags: seo.hashtags,
              description: seo.description,
            };
            sendEvent({ stage: "meta", status: "completed" });
          } catch {
            sendEvent({ stage: "meta", status: "error", error: "메타 파싱 실패" });
          }
        } else {
          sendEvent({ stage: "meta", status: "completed" });
        }

        // DB 업데이트
        if (Object.keys(updates).length > 0) {
          await serviceClient
            .from("projects")
            .update(updates)
            .eq("id", projectId);
        }

        sendEvent({ stage: "meta", status: "completed", content: "ALL_DONE" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        sendEvent({ stage: "outline", status: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
