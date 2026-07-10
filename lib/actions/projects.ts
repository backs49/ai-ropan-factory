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

export async function recoverStuckProject(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "로그인이 필요합니다." };

  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

  const { data, error } = await supabase
    .from("projects")
    .update({ status: "failed" })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "generating")
    .lt("updated_at", cutoff)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "아직 생성이 진행 중입니다. 잠시 후 다시 시도해주세요." };

  // 고착된 생성은 서버가 중단돼 환불이 실행되지 못한 케이스 — 쿼터 환불
  const serviceClient = await createServiceClient();
  await serviceClient.rpc("refund_generation", { p_user_id: user.id });

  return {};
}
