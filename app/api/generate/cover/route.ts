import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildCoverPrompt, generateCoverImage } from "@/lib/ai/cover";
import { NextResponse } from "next/server";
import type { OutlineData, CharacterData, Tier } from "@/types";
import { COVER_MONTHLY_LIMIT } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId;
  if (!projectId || typeof projectId !== "string") {
    return NextResponse.json({ error: "projectId가 필요합니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, genre, mood, outline, characters")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const tier = (profile?.tier as Tier) || "free";
  if (tier === "free") {
    return NextResponse.json(
      { error: "표지 생성은 Pro 전용 기능입니다. Pro로 업그레이드하세요." },
      { status: 403 }
    );
  }

  const serviceClient = await createServiceClient();

  // 월 쿼터 원자 소비 (실패 시 환불)
  const { data: consumed, error: consumeError } = await serviceClient.rpc(
    "consume_cover_generation",
    { p_user_id: user.id, p_limit: COVER_MONTHLY_LIMIT }
  );

  if (consumeError || !consumed) {
    return NextResponse.json(
      { error: `이번 달 표지 생성 한도(${COVER_MONTHLY_LIMIT}회)를 모두 사용했습니다.` },
      { status: 429 }
    );
  }

  try {
    const outline = project.outline as OutlineData | null;
    const rawChars = project.characters;
    const characters = Array.isArray(rawChars) ? (rawChars as CharacterData[]) : [];
    const heroine = characters.find((c) => c.role?.includes("주인공")) ?? characters[0];

    const prompt = buildCoverPrompt({
      title: outline?.title ?? project.title ?? "",
      genre: project.genre,
      mood: project.mood,
      logline: outline?.logline,
      heroineAppearance: heroine?.appearance,
    });

    const imageBuffer = await generateCoverImage(prompt);

    const { error: uploadError } = await serviceClient.storage
      .from("covers")
      .upload(`${projectId}.png`, imageBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);

    const {
      data: { publicUrl },
    } = serviceClient.storage.from("covers").getPublicUrl(`${projectId}.png`);

    // 재생성 시 브라우저 캐시 무효화를 위해 버전 쿼리 부착
    const coverUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await serviceClient
      .from("projects")
      .update({ cover_image_url: coverUrl })
      .eq("id", projectId);

    if (updateError) throw new Error(`저장 실패: ${updateError.message}`);

    return NextResponse.json({ coverUrl });
  } catch (error) {
    // 생성/업로드 실패 — 쿼터 환불
    await serviceClient.rpc("refund_cover_generation", { p_user_id: user.id });
    const message = error instanceof Error ? error.message : "표지 생성에 실패했습니다.";
    console.error(`[cover] 생성 실패 project=${projectId}`, error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
