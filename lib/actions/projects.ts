"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Project } from "@/types";

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data as Project;
}

export async function deleteProject(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // maxDuration(300s)의 2배

export async function recoverStuckProject(
  id: string
): Promise<{ error?: string; warning?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

  // 상태 컬럼은 service role만 쓸 수 있다 (009) — 소유권은 user_id 조건으로 보장
  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("projects")
    .update({ status: "failed" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "generating")
    .lt("updated_at", cutoff)
    .select("id, generation_started_at");

  if (error) return { error: error.message };
  if (!data?.length)
    return {
      error: "아직 생성이 진행 중입니다. 잠시 후 다시 시도해주세요.",
    };

  // 쿼터가 실제로 소비된 경우(생성이 시작된 경우)에만 환불 — 미소비 상태를 잘못 환불하지 않도록
  if (data[0].generation_started_at) {
    // 고착된 생성은 서버가 중단돼 환불이 실행되지 못한 케이스 — 쿼터 환불
    const { error: refundError } = await serviceClient.rpc("refund_generation", {
      p_user_id: user.id,
    });
    if (refundError) {
      console.error(
        `[recover] 쿼터 환불 실패 user=${user.id} project=${id}`,
        refundError
      );
      return {
        warning:
          "프로젝트는 초기화됐지만 사용 횟수 복구에 실패했습니다. 반복되면 문의해주세요.",
      };
    }
  }

  return {};
}
