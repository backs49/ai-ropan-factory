"use server";

import { createClient } from "@/lib/supabase/server";
import type { GenerationInput, Tier, Profile } from "@/types";
import { TIER_LIMITS } from "@/types";

export async function createProject(input: GenerationInput): Promise<{
  projectId?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, monthly_generations, monthly_reset_at")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "프로필을 찾을 수 없습니다." };

  const p = profile as Pick<Profile, "tier" | "monthly_generations" | "monthly_reset_at">;

  const currentCount = p.monthly_generations;
  const limit = TIER_LIMITS[p.tier as Tier];

  if (currentCount >= limit) {
    return {
      error: `무료 체험 ${limit}회를 모두 사용했습니다. Pro로 업그레이드하면 무제한으로 생성할 수 있습니다.`,
    };
  }

  // 무료 프로젝트 3개 제한
  if (p.tier === "free") {
    const { count } = await supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= 3) {
      return {
        error: "무료 플랜에서는 최대 3개의 프로젝트를 생성할 수 있습니다. 기존 프로젝트를 삭제하거나 Pro로 업그레이드하세요.",
      };
    }
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      genre: input.genre,
      keywords: input.keywords,
      target_age: input.target_age,
      mood: input.mood,
      episode_count: input.episode_count,
      variation_of: input.variation_of || null,
      status: "generating",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // 횟수 차감은 생성 성공 시에만 (API route에서 처리)
  return { projectId: project.id };
}
