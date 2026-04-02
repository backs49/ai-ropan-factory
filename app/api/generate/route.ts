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
    .select("ai_provider, tier")
    .eq("id", user.id)
    .single();

  const aiProvider = (profile?.ai_provider as AIProvider) || "gemini";
  const userTier = (profile?.tier as Tier) || "free";

  const serviceClient = await createServiceClient();

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

        await serviceClient
          .from("projects")
          .update({
            title: result.outline?.title || null,
            status: "completed",
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
