"use server";

import { createClient } from "@/lib/supabase/server";
import type { Episode } from "@/types";

export async function getEpisodes(projectId: string): Promise<Episode[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("project_id", projectId)
    .order("episode_number", { ascending: true });

  if (error) return [];
  return data as Episode[];
}

export async function updateEpisodeContent(
  episodeId: string,
  content: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const { error } = await supabase
    .from("episodes")
    .update({ content })
    .eq("id", episodeId);

  if (error) return { error: error.message };
  return {};
}

export async function getEpisode(episodeId: string): Promise<Episode | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .single();

  if (error) return null;
  return data as Episode;
}
