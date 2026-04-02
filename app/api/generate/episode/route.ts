import { createServiceClient, createClient } from "@/lib/supabase/server";
import { streamAI } from "@/lib/ai/providers";
import { getNextEpisodePrompt } from "@/lib/ai/prompts";
import type {
  AIProvider,
  Tier,
  GenerationInput,
  OutlineData,
  StreamEvent,
} from "@/types";
import { AI_MODELS } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const FREE_EPISODE_LIMIT = 3;

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

  // 무료 제한 체크
  if (tier === "free" && currentEpisodes.length >= FREE_EPISODE_LIMIT) {
    return new Response(
      `무료 플랜에서는 프로젝트당 ${FREE_EPISODE_LIMIT}화까지 생성 가능합니다. Pro로 업그레이드하세요.`,
      { status: 403 }
    );
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

  const model =
    tier === "pro" || tier === "enterprise"
      ? AI_MODELS[provider].heavy
      : AI_MODELS[provider].heavy; // 에피소드 본문은 항상 heavy 모델

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

        await streamAI(
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

        // 실패 → status 업데이트
        await serviceClient
          .from("episodes")
          .update({ status: "failed" })
          .eq("id", newEpisode.id);

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
