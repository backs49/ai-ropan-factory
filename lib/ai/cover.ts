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
    "스타일: 고품질 디지털 일러스트, 로맨스 판타지 웹소설 표지, 화려한 색감, 세로 구도(2:3 비율).",
    "중요: 이미지에 어떤 글자나 텍스트도 넣지 마세요. 인물과 배경만 그려주세요."
  );
  return parts.join("\n");
}

// COVER_IMAGE_PROVIDER 환경 변수로 선택. 상용(Vercel)은 gemini,
// 로컬은 codex(ChatGPT 구독 포함, 무과금) 또는 xai(결제 중인 키 재사용) 사용 가능.
type CoverImageProvider = "gemini" | "xai" | "codex";

export async function generateCoverImage(prompt: string): Promise<Buffer> {
  const provider = (process.env.COVER_IMAGE_PROVIDER ?? "gemini") as CoverImageProvider;
  switch (provider) {
    case "xai":
      return generateWithXai(prompt);
    case "codex":
      return generateWithCodex(prompt);
    default:
      return generateWithGemini(prompt);
  }
}

async function generateWithGemini(prompt: string): Promise<Buffer> {
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

async function generateWithXai(prompt: string): Promise<Buffer> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: process.env.XAI_API_KEY!,
    baseURL: "https://api.x.ai/v1",
  });

  const response = await client.images.generate({
    model: "grok-imagine-image-quality",
    prompt,
    response_format: "b64_json",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("이미지가 생성되지 않았습니다. 잠시 후 다시 시도해주세요.");
  }
  return Buffer.from(b64, "base64");
}

// 로컬 전용: Codex CLI의 $imagegen 스킬 사용 (ChatGPT 구독 사용량에 포함, 별도 과금 없음).
// 서버리스 환경에는 codex 바이너리가 없으므로 배포 환경에서는 선택하지 말 것.
async function generateWithCodex(prompt: string): Promise<Buffer> {
  const { spawn } = await import("node:child_process");
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");

  const workDir = await mkdtemp(path.join(tmpdir(), "cover-"));
  const fileName = "cover.png";

  const instruction =
    `Use $imagegen to generate exactly one image from the prompt below, ` +
    `then save it as ${fileName} in the current working directory. ` +
    `The image must be a vertical 2:3 book cover with no text. Do not do anything else.\n\n` +
    `Prompt:\n${prompt}`;

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "codex",
        ["exec", "--skip-git-repo-check", "--sandbox", "workspace-write", "-C", workDir, instruction],
        // stdin을 닫아야 함 — 파이프로 열어두면 codex가 EOF를 기다리며 멈춤
        { stdio: ["ignore", "ignore", "pipe"] }
      );

      let stderr = "";
      child.stderr.on("data", (d) => (stderr += d));

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("Codex CLI 이미지 생성이 5분을 초과했습니다."));
      }, 300_000);

      child.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (err.code === "ENOENT") {
          reject(new Error("Codex CLI가 설치되어 있지 않습니다. COVER_IMAGE_PROVIDER를 확인하세요."));
        } else {
          reject(err);
        }
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`Codex CLI 오류(exit ${code}): ${stderr.slice(-300)}`));
      });
    });

    return await readFile(path.join(workDir, fileName)).catch(() => {
      throw new Error("Codex CLI가 이미지 파일을 생성하지 못했습니다. 다시 시도해주세요.");
    });
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
