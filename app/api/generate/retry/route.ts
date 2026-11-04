import { createServiceClient, createClient } from "@/lib/supabase/server";
import { streamAI } from "@/lib/ai/providers";
import { sseErrorResponse } from "@/lib/sse";
import { extractJSON } from "@/lib/ai/pipeline";
import {
  getCharacterPrompt,
  getFirstEpisodePrompt,
  getMetaPrompt,
} from "@/lib/ai/prompts";
import type { AIProvider, Tier, GenerationInput, OutlineData, StreamEvent } from "@/types";
import { AI_MODELS, PROJECT_RETRY_LIMIT } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

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

  // 빠진 또는 잘못된 단계 확인
  const missingStages: string[] = [];
  if (!Array.isArray(project.characters)) missingStages.push("characters");
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

  // 재시도 클레임: 동시 실행 차단 + 프로젝트당 횟수 제한 (쿼터를 쓰지 않는 경로라 상한 필수)
  const { data: claimed, error: claimError } = await serviceClient.rpc(
    "claim_project_retry",
    { p_project_id: projectId, p_user_id: user.id, p_max: PROJECT_RETRY_LIMIT }
  );
  if (claimError) {
    console.error(`[retry] 클레임 RPC 오류 project=${projectId}`, claimError);
    return new Response("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", { status: 500 });
  }
  if (!claimed) {
    return sseErrorResponse(
      (project.retry_count ?? 0) >= PROJECT_RETRY_LIMIT
        ? `재시도는 프로젝트당 ${PROJECT_RETRY_LIMIT}회까지 가능합니다.`
        : "이미 재시도가 진행 중이거나 재시도할 수 없는 상태입니다.",
      "outline"
    );
  }

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

          const charUsage = await streamAI(
            provider,
            {
              system: charPrompt.system,
              user: charPrompt.user,
              maxTokens: 8000,
              model: getModel(provider, tier, false),
              expectsJSON: true,
            },
            (text) => {
              charText += text;
              sendEvent({ stage: "characters", status: "streaming", content: text });
            }
          );

          try {
            const parsed = JSON.parse(extractJSON(charText));
            const chars = Array.isArray(parsed) ? parsed : Array.isArray(parsed.characters) ? parsed.characters : null;
            if (chars) {
              updates.characters = chars;
              sendEvent({ stage: "characters", status: "completed" });
            } else {
              sendEvent({ stage: "characters", status: "error", error: "캐릭터 배열 추출 실패" });
            }
          } catch {
            sendEvent({
              stage: "characters",
              status: "error",
              error:
                charUsage.finishReason === "length"
                  ? "캐릭터 응답이 길이 제한으로 잘렸습니다. 다시 시도해주세요."
                  : "캐릭터 파싱 실패",
            });
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
        // 진행 중 마커 해제 (횟수는 유지)
        await serviceClient
          .from("projects")
          .update({ retry_started_at: null })
          .eq("id", projectId);
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
