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

  const model =
    tier === "pro" || tier === "enterprise"
      ? AI_MODELS[provider].heavy
      : AI_MODELS[provider].heavy;

  const serviceClient = await createServiceClient();

  // status를 generating으로 변경
  await serviceClient
    .from("episodes")
    .update({ status: "generating", content: "" })
    .eq("id", episodeId);

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
