"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "로그인이 필요합니다." };

  const serviceClient = await createServiceClient();

  // 유효한 구독이 있으면 먼저 해지 필요
  const { data: sub } = await serviceClient
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .in("status", ["active", "past_due"])
    .maybeSingle();

  if (sub) {
    return { error: "구독이 활성 상태입니다. 설정에서 먼저 구독을 해지한 뒤 탈퇴해주세요." };
  }

  const { error } = await serviceClient.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(`[account] 삭제 실패 user=${user.id}`, error);
    return { error: "탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  await supabase.auth.signOut();
  redirect("/");
}
