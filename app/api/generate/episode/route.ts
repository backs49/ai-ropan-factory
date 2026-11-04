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
import { AI_MODELS, EPISODE_MONTHLY_LIMIT, FREE_EPISODE_LIMIT } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) return new Response("Missing projectId", { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) return new Response("Project not found", { status: 404 });

  if (project.status !== "completed") {
    return new Response("완료된 프로젝트에서만 에피소드를 생성할 수 있습니다.", {
      status: 400,
    });
  }

  const outline = project.outline as OutlineData | null;
  if (!outline)
    return new Response("아웃라인이 없어 에피소드를 생성할 수 없습니다.", {
      status: 400,
    });

  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider, tier")
    .eq("id", user.id)
    .single();

  const provider = (profile?.ai_provider as AIProvider) || "gemini";
  const tier = (profile?.tier as Tier) || "free";

  // 현재 에피소드 목록 조회
  const { data: episodes } = await supabase
    .from("episodes")
    .select("*")
    .eq("project_id", projectId)
    .order("episode_number", { ascending: true });

  const currentEpisodes = episodes || [];
  const maxEpisodeNumber = currentEpisodes.reduce(
    (max, ep) => Math.max(max, ep.episode_number),
    0
  );
  const nextNumber = maxEpisodeNumber + 1;

  // 실패/진행 중인 화가 있으면 다음 화로 넘어가지 않음 — 화 번호 누락·동시 생성 방지
  const blocking = currentEpisodes.find(
    (ep) => ep.status === "failed" || ep.status === "generating"
  );
  if (blocking) {
    return sseErrorResponse(
      blocking.status === "failed"
        ? `${blocking.episode_number}화 생성에 실패했습니다. 먼저 재생성해주세요.`
        : `${blocking.episode_number}화를 생성 중입니다. 잠시 후 다시 시도해주세요.`
    );
  }

  // 무료 제한 체크
  if (tier === "free" && currentEpisodes.length >= FREE_EPISODE_LIMIT) {
    return sseErrorResponse(`무료 플랜에서는 프로젝트당 ${FREE_EPISODE_LIMIT}화까지 생성 가능합니다. Pro로 업그레이드하세요.`);
  }

  // episode_count 초과 확인
  if (nextNumber > project.episode_count) {
    return new Response(
      `모든 에피소드(${project.episode_count}화)가 완료되었습니다.`,
      { status: 400 }
    );
  }

  // 직전 에피소드 마지막 부분
  const prevEpisode = currentEpisodes.find(
    (ep) => ep.episode_number === maxEpisodeNumber
  );
  const prevEpisodeEnd = prevEpisode
    ? prevEpisode.content.slice(-1000)
    : "";

  // 캐릭터 정보
  const rawChars = project.characters;
  const charText = Array.isArray(rawChars) ? JSON.stringify(rawChars) : "";

  const serviceClient = await createServiceClient();

  // 월간 에피소드 쿼터 원자적 선소비 (실패 시 환불) — Pro 무제한 생성에 의한 원가 폭주 방지
  const { data: consumed, error: consumeError } = await serviceClient.rpc(
    "consume_episode_generation",
    { p_user_id: user.id, p_limit: EPISODE_MONTHLY_LIMIT[tier] }
  );
  if (consumeError) {
    console.error(`[episode] 쿼터 RPC 오류 user=${user.id}`, consumeError);
    return new Response("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", { status: 500 });
  }
  if (!consumed) {
    return sseErrorResponse(`이번 달 에피소드 생성 한도(${EPISODE_MONTHLY_LIMIT[tier]}화)를 모두 사용했습니다.`);
  }

  // episodes row 삽입 (generating)
  const { data: newEpisode, error: insertError } = await serviceClient
    .from("episodes")
    .insert({
      project_id: projectId,
      episode_number: nextNumber,
      content: "",
      status: "generating",
    })
    .select()
    .single();

  if (insertError) {
    await serviceClient.rpc("refund_episode_generation", { p_user_id: user.id });
    // 동시 요청이 같은 화 번호를 먼저 삽입한 경우 (unique 위반)
    if (insertError.code === "23505") {
      return sseErrorResponse("이미 생성 중인 화입니다. 잠시 후 다시 시도해주세요.");
    }
    return new Response(`에피소드 생성 실패: ${insertError.message}`, {
      status: 500,
    });
  }

  const input: GenerationInput = {
    genre: project.genre,
    keywords: project.keywords,
    target_age: project.target_age,
    mood: project.mood,
    episode_count: project.episode_count,
  };

  const model = AI_MODELS[provider].heavy; // 에피소드 본문은 항상 heavy 모델

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
          nextNumber,
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

        // 잘리거나 비정상적으로 짧은 본문은 실패 처리 (재시도 흐름으로 복구)
        if (usage.finishReason === "length" || episodeText.trim().length < 1000) {
          throw new Error(
            usage.finishReason === "length"
              ? "본문이 길이 제한으로 잘렸습니다. 다시 시도해주세요."
              : "본문이 비정상적으로 짧게 생성됐습니다. 다시 시도해주세요."
          );
        }

        // 완료 → content + status 업데이트
        await serviceClient
          .from("episodes")
          .update({ content: episodeText, status: "completed" })
          .eq("id", newEpisode.id);

        sendEvent({ stage: "first_episode", status: "completed" });
        sendEvent({
          stage: "first_episode",
          status: "completed",
          content: "ALL_DONE",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        // 실패 → status 업데이트 + 쿼터 환불
        await serviceClient
          .from("episodes")
          .update({ status: "failed" })
          .eq("id", newEpisode.id);
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
