import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = await createServiceClient();

  // 구독 상태를 cancelled로 변경 (현재 기간은 유지)
  const { data: sub } = await serviceClient
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!sub) {
    return NextResponse.json(
      { error: "활성 구독이 없습니다." },
      { status: 400 }
    );
  }

  await serviceClient
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("id", sub.id);

  // 현재 기간 만료까지는 Pro 유지, 크론에서 만료 시 다운그레이드
  return NextResponse.json({
    message: "구독이 해지되었습니다. 현재 결제 기간까지 Pro를 이용할 수 있습니다.",
    period_end: sub.current_period_end,
  });
}
