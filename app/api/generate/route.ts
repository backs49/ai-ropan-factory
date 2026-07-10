import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { runGenerationPipeline } from "@/lib/ai/pipeline";
import type { AIProvider, Tier, GenerationInput, StreamEvent } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return new Response("Missing projectId", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  if (project.status !== "generating") {
    return new Response("Project already processed", { status: 400 });
  }

  // Get user's AI provider preference
  const { data: profile } = await supabase
    .from("profiles")
    .select("ai_provider, tier, monthly_generations")
    .eq("id", user.id)
    .single();

  const aiProvider = (profile?.ai_provider as AIProvider) || "gemini";
  const userTier = (profile?.tier as Tier) || "free";

  const serviceClient = await createServiceClient();

  // 쿼터 원자적 선소비 (실패 시 아래에서 환불) — 동시 요청 이중 소비 차단
  const { data: consumed, error: consumeError } = await serviceClient.rpc(
    "consume_generation",
    { p_user_id: user.id, p_limit: 3 }
  );

  if (consumeError || !consumed) {
    return new Response(
      "무료 체험 3회를 모두 사용했습니다. Pro로 업그레이드하면 무제한으로 생성할 수 있습니다.",
      { status: 403 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: StreamEvent) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      try {
        const input: GenerationInput = {
          genre: project.genre,
          keywords: project.keywords,
          target_age: project.target_age,
          mood: project.mood,
          episode_count: project.episode_count,
          variation_of: project.variation_of,
        };

        const result = await runGenerationPipeline(input, sendEvent, aiProvider, userTier);

        // 아웃라인이 있으면 최소한의 성공으로 간주
        const isSuccess = result.outline !== null;

        await serviceClient
          .from("projects")
          .update({
            title: result.outline?.title || null,
            status: isSuccess ? "completed" : "failed",
            outline: result.outline,
            characters: result.characters,
            first_episode: result.firstEpisode,
            cover_prompts: result.seo
              ? (result.seo as Record<string, unknown>).cover_prompts
              : null,
            seo: result.seo
              ? {
                  titles: (result.seo as Record<string, unknown>).titles,
                  hashtags: (result.seo as Record<string, unknown>).hashtags,
                  description: (result.seo as Record<string, unknown>).description,
                }
              : null,
            token_usage: result.tokenUsage,
          })
          .eq("id", projectId);

        // 실패 시 선소비한 쿼터 환불
        if (!isSuccess) {
          await serviceClient.rpc("refund_generation", { p_user_id: user.id });
        }

        if (isSuccess) {
          // 1화를 episodes 테이블에도 저장
          if (result.firstEpisode) {
            await serviceClient
              .from("episodes")
              .upsert(
                {
                  project_id: projectId,
                  episode_number: 1,
                  content: result.firstEpisode,
                  status: "completed",
                },
                { onConflict: "project_id,episode_number" }
              );
          }
        }

        sendEvent({
          stage: "meta",
          status: "completed",
          content: "ALL_DONE",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        sendEvent({ stage: "outline", status: "error", error: message });

        await serviceClient
          .from("projects")
          .update({ status: "failed" })
          .eq("id", projectId);

        await serviceClient.rpc("refund_generation", { p_user_id: user.id });
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
