import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "unknown";
  const message = searchParams.get("message") || "결제에 실패했습니다";

  redirect(`/pricing?error=${encodeURIComponent(message)}&code=${code}`);
}
