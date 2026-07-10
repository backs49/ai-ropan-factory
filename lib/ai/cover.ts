export interface CoverPromptInput {
  title: string;
  genre: string;
  mood: string;
  logline?: string;
  heroineAppearance?: string;
}

export function buildCoverPrompt(input: CoverPromptInput): string {
  const parts = [
    `한국 웹소설 "${input.genre}" 장르의 표지 일러스트를 그려주세요.`,
    `분위기: ${input.mood}.`,
  ];
  if (input.logline) parts.push(`줄거리: ${input.logline}`);
  if (input.heroineAppearance) parts.push(`주인공 외형: ${input.heroineAppearance}`);
  parts.push(
    "스타일: 고품질 디지털 일러스트, 로맨스 판타지 웹소설 표지, 화려한 색감, 세로 구도.",
    "중요: 이미지에 어떤 글자나 텍스트도 넣지 마세요. 인물과 배경만 그려주세요."
  );
  return parts.join("\n");
}

export async function generateCoverImage(prompt: string): Promise<Buffer> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "2:3" },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, "base64");
    }
  }
  throw new Error("이미지가 생성되지 않았습니다. 잠시 후 다시 시도해주세요.");
}
