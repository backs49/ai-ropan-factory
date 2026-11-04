import type { GenerationStage } from "@/types";

/**
 * 생성 요청을 거절할 때 쓰는 SSE 응답.
 * EventSource는 4xx/5xx 응답 본문을 읽을 수 없어 사용자에게 "연결 끊김"으로만 보이므로,
 * 거절 사유를 error 이벤트 하나로 담아 200으로 보낸다.
 */
export function sseErrorResponse(
  message: string,
  stage: GenerationStage = "first_episode"
): Response {
  const body = `data: ${JSON.stringify({ stage, status: "error", error: message })}\n\n`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
