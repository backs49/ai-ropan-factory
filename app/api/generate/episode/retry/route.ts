import { createServiceClient, createClient } from "@/lib/supabase/server";
import { streamAI } from "@/lib/ai/providers";
import { sseErrorResponse } from "@/lib/sse";
import { getNextEpisodePrompt } from "@/lib/ai/prompts";
import type {
  AIProvider,
  Tier,
  GenerationInput,
  OutlineData,
  StreamEvent,
} from "@/types";
import { AI_MODELS, EPISODE_MONTHLY_LIMIT, EPISODE_RETRY_LIMIT } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episodeId");

  if (!episodeId) return new Response("Missing episodeId", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // 에피소드 + 프로젝트 조회
  const { data: episode } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .single();

  if (!episode) return new Response("Episode not found", { status: 404 });
  if (episode.status !== "failed") {
    return new Response("실패한 에피소드만 재생성할 수 있습니다.", {
      status: 400,
    });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", episode.project_id)
    .eq("user_id", user.id)
    .single();

  if (!project) return new Response("Project not found", { status: 404 });

  const outline = project.outline as OutlineData | null;
  if (!outline) {
    return new Response("아웃라인이 없어 재생성할 수 없습니다.", {
      status: 400,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider, tier")
    .eq("id", user.id)
    .single();

  const provider = (profile?.ai_provider as AIProvider) || "gemini";
  const tier = (profile?.tier as Tier) || "free";

  // 직전 에피소드 조회
  const { data: prevEpisodeData } = await supabase
    .from("episodes")
    .select("content")
    .eq("project_id", episode.project_id)
    .eq("episode_number", episode.episode_number - 1)
    .single();

  const prevEpisodeEnd = prevEpisodeData
    ? prevEpisodeData.content.slice(-1000)
    : "";

  const rawChars = project.characters;
  const charText = Array.isArray(rawChars) ? JSON.stringify(rawChars) : "";

  const input: GenerationInput = {
    genre: project.genre,
    keywords: project.keywords,
    target_age: project.target_age,
    mood: project.mood,
    episode_count: project.episode_count,
  };

  const model = AI_MODELS[provider].heavy; // 에피소드 본문은 항상 heavy 모델

  const serviceClient = await createServiceClient();

  // 월간 에피소드 쿼터 선소비 (실패 시 환불) — 재생성도 원가가 드는 상위 모델 호출
  const { data: consumed, error: consumeError } = await serviceClient.rpc(
    "consume_episode_generation",
    { p_user_id: user.id, p_limit: EPISODE_MONTHLY_LIMIT[tier] }
  );
  if (consumeError) {
    console.error(`[episode-retry] 쿼터 RPC 오류 user=${user.id}`, consumeError);
    return new Response("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", { status: 500 });
  }
  if (!consumed) {
    return sseErrorResponse(`이번 달 에피소드 생성 한도(${EPISODE_MONTHLY_LIMIT[tier]}화)를 모두 사용했습니다.`);
  }

  // failed → generating 원자 전환 + 재생성 횟수 제한 (동시 요청 중복 실행 차단)
  const { data: claimed, error: claimError } = await serviceClient.rpc(
    "claim_episode_retry",
    { p_episode_id: episodeId, p_max: EPISODE_RETRY_LIMIT }
  );
  if (claimError || !claimed) {
    await serviceClient.rpc("refund_episode_generation", { p_user_id: user.id });
    if (claimError) {
      console.error(`[episode-retry] 클레임 RPC 오류 episode=${episodeId}`, claimError);
      return new Response("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", { status: 500 });
    }
    return sseErrorResponse(
      (episode.retry_count ?? 0) >= EPISODE_RETRY_LIMIT
        ? `재생성은 화당 ${EPISODE_RETRY_LIMIT}회까지 가능합니다.`
        : "이미 재생성이 진행 중입니다."
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: StreamEvent) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      try {
        sendEvent({ stage: "first_episode", status: "started" });

        const episodePrompt = getNextEpisodePrompt(
          input,
          outline,
          charText,
          prevEpisodeEnd,
          episode.episode_number,
          project.episode_count
        );

        let episodeText = "";

        const usage = await streamAI(
          provider,
          {
            system: episodePrompt.system,
            user: episodePrompt.user,
            maxTokens: 8000,
            model,
          },
          (text) => {
            episodeText += text;
            sendEvent({
              stage: "first_episode",
              status: "streaming",
              content: text,
            });
          }
        );

        // 잘리거나 비정상적으로 짧은 본문은 실패 처리
        if (usage.finishReason === "length" || episodeText.trim().length < 1000) {
          throw new Error(
            usage.finishReason === "length"
              ? "본문이 길이 제한으로 잘렸습니다. 다시 시도해주세요."
              : "본문이 비정상적으로 짧게 생성됐습니다. 다시 시도해주세요."
          );
        }

        await serviceClient
          .from("episodes")
          .update({ content: episodeText, status: "completed" })
          .eq("id", episodeId);

        sendEvent({ stage: "first_episode", status: "completed" });
        sendEvent({
          stage: "first_episode",
          status: "completed",
          content: "ALL_DONE",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        await serviceClient
          .from("episodes")
          .update({ status: "failed" })
          .eq("id", episodeId);
        await serviceClient.rpc("refund_episode_generation", { p_user_id: user.id });

        sendEvent({
          stage: "first_episode",
          status: "error",
          error: message,
        });
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
