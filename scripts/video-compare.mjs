#!/usr/bin/env node
/**
 * 표지 이미지 → 영상(image-to-video) 모델 비교 스크립트
 *
 * 같은 표지 이미지를 여러 영상 모델에 넣어 결과 mp4와 비교용 HTML 페이지를 만든다.
 * 실제 API를 호출하므로 과금된다 — 실행 전 출력되는 예상 비용을 확인할 것.
 *
 * 사용법:
 *   npm run video:compare -- --images cover1.png,https://.../cover2.png
 *   npm run video:compare -- --images cover.png --models grok-imagine-video-1.5-lite --duration 5
 *   npm run video:compare -- --images cover.png --dry-run      # 요청 본문만 출력 (과금 없음)
 *
 * 옵션:
 *   --images      쉼표로 구분한 이미지 경로 또는 URL (필수)
 *   --models      쉼표로 구분한 모델 ID (기본: 아래 MODELS 전체)
 *   --duration    영상 길이(초, 기본 6)
 *   --resolution  해상도 (기본 720p)
 *   --prompt      움직임 지시문 직접 지정 (기본: 아래 DEFAULT_PROMPT)
 *   --mood        분위기 힌트 (예: "다크", "달달") — 기본 지시문에 덧붙임
 *   --out         출력 폴더 (기본 scripts/output/video-compare/<시각>)
 *   --dry-run     API를 호출하지 않고 요청 본문만 출력
 *   --yes         비용 확인 프롬프트 생략
 *
 * 환경변수 (.env.local):
 *   XAI_API_KEY, GEMINI_API_KEY
 *   XAI_VIDEO_EXTRA / GEMINI_VIDEO_EXTRA  — 요청 본문에 병합할 JSON (파라미터 이름이 문서와 다를 때 조정용)
 *   XAI_BASE_URL / GEMINI_BASE_URL        — 기본 API 주소 덮어쓰기 (테스트용)
 *
 * API 형식 근거 (2026-11 기준, 공식 문서를 직접 열람하지 못해 검색 결과·SDK 타입으로 확인):
 *   - xAI: POST /v1/videos/generations {model, prompt, image:{url}, duration} → request_id
 *          GET /v1/videos/{request_id} → status pending|done|failed|expired, 완료 시 video.url
 *   - Gemini Omni: POST /v1beta/interactions {model, input:[text, image], background:true}
 *          GET /v1beta/interactions/{id} → status in_progress|completed|failed…, outputs[]의 video(data 또는 uri)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

// ---------------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------------

/** 비교 대상 모델. pricePerSec는 720p 기준 추정 단가(USD) — 서드파티 자료라 공식 요금표로 재확인 필요 */
const MODELS = {
  "grok-imagine-video-1.5": { provider: "xai", pricePerSec: 0.14, note: "xAI 공식 표기 $0.08/s~, 서드파티 720p $0.14/s" },
  "grok-imagine-video-1.5-lite": { provider: "xai", pricePerSec: 0.02, note: "가장 저렴" },
  "gemini-omni-1.1-flash": { provider: "gemini", pricePerSec: 0.1, note: "Google 권장 영상 모델" },
};

const DEFAULT_PROMPT = [
  "Animate this Korean web novel cover illustration into a subtle, seamless looping video.",
  "Keep the composition, art style, and the characters' faces exactly as in the image.",
  "Use gentle ambient motion only: hair and clothing swaying softly in the breeze,",
  "drifting petals or light particles, flickering candlelight, slow shimmering highlights.",
  "Camera stays almost still (at most a very slow push-in). No scene cuts.",
  "Do not add any text, letters, logos, or watermarks.",
].join(" ");

const POLL_INTERVAL_MS = 5_000;
const JOB_TIMEOUT_MS = 15 * 60_000;

// ---------------------------------------------------------------------------
// 인자 파싱
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { duration: 6, resolution: "720p", dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${key} 값이 필요합니다`);
      return v;
    };
    switch (key) {
      case "--images": args.images = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--models": args.models = next().split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--duration": args.duration = Number(next()); break;
      case "--resolution": args.resolution = next(); break;
      case "--prompt": args.prompt = next(); break;
      case "--mood": args.mood = next(); break;
      case "--out": args.out = next(); break;
      case "--dry-run": args.dryRun = true; break;
      case "--yes": case "-y": args.yes = true; break;
      case "--help": case "-h": args.help = true; break;
      default: throw new Error(`알 수 없는 옵션: ${key}`);
    }
  }
  return args;
}

function parseExtra(name) {
  const raw = process.env[name];
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name}가 올바른 JSON이 아닙니다: ${raw}`);
  }
}

// ---------------------------------------------------------------------------
// 이미지 로드
// ---------------------------------------------------------------------------

const MIME_BY_EXT = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** 경로 또는 URL → { label, url?(원격이면), mime, base64 } */
async function loadImage(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`이미지 다운로드 실패 (${res.status}): ${src}`);
    const mime = (res.headers.get("content-type") ?? "image/png").split(";")[0];
    const buf = Buffer.from(await res.arrayBuffer());
    const label = basename(new URL(src).pathname).replace(extname(new URL(src).pathname), "") || "image";
    return { label, url: src, mime, base64: buf.toString("base64") };
  }
  const path = resolve(src);
  const mime = MIME_BY_EXT[extname(path).toLowerCase()];
  if (!mime) throw new Error(`지원하지 않는 이미지 형식: ${src} (png/jpg/webp)`);
  const buf = await readFile(path);
  return { label: basename(path, extname(path)), mime, base64: buf.toString("base64") };
}

// ---------------------------------------------------------------------------
// 공통 유틸
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function apiError(provider, res, body) {
  // 오류 본문을 그대로 보여줘 파라미터 이름 등을 바로 조정할 수 있게 함
  return new Error(`[${provider}] HTTP ${res.status}: ${JSON.stringify(body).slice(0, 2000)}`);
}

/** base64 본문을 로그에 찍지 않도록 축약 */
function redact(body) {
  return JSON.parse(
    JSON.stringify(body, (_k, v) => (typeof v === "string" && v.length > 200 ? `${v.slice(0, 40)}…(${v.length}자)` : v))
  );
}

// ---------------------------------------------------------------------------
// xAI (Grok Imagine Video)
// ---------------------------------------------------------------------------

const XAI_BASE = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";

function xaiRequestBody(model, image, opts) {
  return {
    model,
    prompt: opts.prompt,
    // 원격 이미지는 URL 그대로, 로컬 파일은 data URL로 전달
    image: { url: image.url ?? `data:${image.mime};base64,${image.base64}` },
    duration: opts.duration,
    resolution: opts.resolution,
    ...parseExtra("XAI_VIDEO_EXTRA"),
  };
}

async function runXai(model, image, opts, log) {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY가 없습니다");
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  const res = await fetch(`${XAI_BASE}/videos/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify(xaiRequestBody(model, image, opts)),
  });
  const created = await readJson(res);
  if (!res.ok) throw apiError("xai", res, created);
  const id = created.request_id ?? created.id;
  if (!id) throw new Error(`[xai] request_id 없음: ${JSON.stringify(created)}`);
  log(`작업 생성 ${id}`);

  const deadline = Date.now() + JOB_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await fetch(`${XAI_BASE}/videos/${id}`, { headers });
    const job = await readJson(pollRes);
    if (!pollRes.ok) throw apiError("xai", pollRes, job);
    const status = job.status;
    if (status === "done") {
      const url = job.video?.url;
      if (!url) throw new Error(`[xai] 완료됐지만 video.url 없음: ${JSON.stringify(job)}`);
      const vid = await fetch(url);
      if (!vid.ok) throw new Error(`[xai] 영상 다운로드 실패 (${vid.status})`);
      return Buffer.from(await vid.arrayBuffer());
    }
    if (status === "failed" || status === "expired") {
      throw new Error(`[xai] 작업 ${status}: ${JSON.stringify(job.error ?? job)}`);
    }
    log(`진행 중 (${status ?? "unknown"})`);
  }
  throw new Error(`[xai] ${JOB_TIMEOUT_MS / 60000}분 내에 완료되지 않음`);
}

// ---------------------------------------------------------------------------
// Gemini Omni (Interactions API)
// ---------------------------------------------------------------------------

const GEMINI_BASE = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";

function geminiRequestBody(model, image, opts) {
  return {
    model,
    input: [
      // 길이·해상도 파라미터 이름을 공식 문서로 확인하지 못해 지시문에도 명시
      { type: "text", text: `${opts.prompt} Duration: about ${opts.duration} seconds. Resolution: ${opts.resolution}.` },
      { type: "image", data: image.base64, mime_type: image.mime },
    ],
    background: true,
    ...parseExtra("GEMINI_VIDEO_EXTRA"),
  };
}

async function runGemini(model, image, opts, log) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY가 없습니다");
  const headers = { "x-goog-api-key": key, "Content-Type": "application/json" };

  const res = await fetch(`${GEMINI_BASE}/interactions`, {
    method: "POST",
    headers,
    body: JSON.stringify(geminiRequestBody(model, image, opts)),
  });
  let job = await readJson(res);
  if (!res.ok) throw apiError("gemini", res, job);
  const id = job.id;
  if (!id) throw new Error(`[gemini] interaction id 없음: ${JSON.stringify(redact(job))}`);
  log(`작업 생성 ${id}`);

  const deadline = Date.now() + JOB_TIMEOUT_MS;
  while (job.status === "in_progress" || job.status === undefined) {
    if (Date.now() > deadline) throw new Error(`[gemini] ${JOB_TIMEOUT_MS / 60000}분 내에 완료되지 않음`);
    await sleep(POLL_INTERVAL_MS);
    const pollRes = await fetch(`${GEMINI_BASE}/interactions/${id}`, { headers });
    job = await readJson(pollRes);
    if (!pollRes.ok) throw apiError("gemini", pollRes, job);
    if (job.status === "in_progress") log("진행 중 (in_progress)");
  }

  if (job.status !== "completed") {
    throw new Error(`[gemini] 작업 ${job.status}: ${JSON.stringify(redact(job.error ?? job))}`);
  }
  const video = (job.outputs ?? []).find((o) => o.type === "video");
  if (!video) throw new Error(`[gemini] 출력에 video 없음: ${JSON.stringify(redact(job.outputs ?? job))}`);
  if (video.data) return Buffer.from(video.data, "base64");
  if (video.uri) {
    const vid = await fetch(video.uri, { headers: { "x-goog-api-key": key } });
    if (!vid.ok) throw new Error(`[gemini] 영상 다운로드 실패 (${vid.status})`);
    return Buffer.from(await vid.arrayBuffer());
  }
  throw new Error(`[gemini] video에 data/uri 없음: ${JSON.stringify(redact(video))}`);
}

// ---------------------------------------------------------------------------
// 결과 페이지
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function renderHtml(results, images, models, opts) {
  const rows = images
    .map((img) => {
      const cells = models
        .map((m) => {
          const r = results.find((x) => x.image === img.label && x.model === m);
          if (!r) return "<td>-</td>";
          const meta = `${r.seconds}초 소요 · 추정 $${r.estCost.toFixed(2)}`;
          return r.ok
            ? `<td><video src="${escapeHtml(r.file)}" autoplay loop muted playsinline controls></video><div class="meta">${meta}</div></td>`
            : `<td class="err"><div class="meta">실패 · ${meta}</div><pre>${escapeHtml(r.error)}</pre></td>`;
        })
        .join("");
      return `<tr><th><img src="${escapeHtml(img.preview)}" alt=""><div>${escapeHtml(img.label)}</div></th>${cells}</tr>`;
    })
    .join("\n");
  const total = results.reduce((s, r) => s + r.estCost, 0);
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>영상 모델 비교</title>
<style>
  :root { color-scheme: light dark; --bg:#fafafa; --fg:#111; --line:#ddd; --err:#b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111; --fg:#eee; --line:#333; --err:#f97066; } }
  body { margin:0; padding:16px; background:var(--bg); color:var(--fg); font:14px/1.5 system-ui, sans-serif; }
  .wrap { overflow-x:auto; } table { border-collapse:collapse; }
  th, td { border:1px solid var(--line); padding:8px; vertical-align:top; text-align:center; }
  video, th img { width:240px; max-width:60vw; aspect-ratio:2/3; object-fit:contain; background:#000; display:block; }
  .meta { font-size:12px; opacity:.75; margin-top:4px; } .err pre { color:var(--err); white-space:pre-wrap; max-width:240px; text-align:left; font-size:11px; }
</style></head><body>
<h1>표지 → 영상 모델 비교</h1>
<p>${opts.duration}초 · ${escapeHtml(opts.resolution)} · 추정 총비용 $${total.toFixed(2)} (720p 추정 단가 기준)</p>
<details><summary>지시문</summary><p>${escapeHtml(opts.prompt)}</p></details>
<div class="wrap"><table>
<tr><th>원본</th>${models.map((m) => `<th>${escapeHtml(m)}<div class="meta">${escapeHtml(MODELS[m]?.note ?? "")}</div></th>`).join("")}</tr>
${rows}
</table></div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.images?.length) {
    console.log("사용법: npm run video:compare -- --images cover.png[,cover2.png] [--models ...] [--duration 6] [--dry-run]");
    console.log("지원 모델:", Object.keys(MODELS).join(", "));
    process.exit(args.help ? 0 : 1);
  }
  if (!Number.isFinite(args.duration) || args.duration < 1 || args.duration > 15) {
    throw new Error("--duration은 1~15초 사이여야 합니다");
  }

  const models = args.models ?? Object.keys(MODELS);
  for (const m of models) {
    if (!MODELS[m]) throw new Error(`알 수 없는 모델: ${m} (지원: ${Object.keys(MODELS).join(", ")})`);
  }

  const prompt = args.prompt ?? (args.mood ? `${DEFAULT_PROMPT} Overall mood: ${args.mood}.` : DEFAULT_PROMPT);
  const opts = { prompt, duration: args.duration, resolution: args.resolution };

  const images = await Promise.all(args.images.map(loadImage));
  const jobs = images.flatMap((image) => models.map((model) => ({ image, model })));
  const estTotal = jobs.reduce((s, j) => s + MODELS[j.model].pricePerSec * opts.duration, 0);

  console.log(`\n이미지 ${images.length}장 × 모델 ${models.length}개 = 작업 ${jobs.length}개`);
  console.log(`예상 비용: 약 $${estTotal.toFixed(2)} (720p 추정 단가 기준, 실제와 다를 수 있음)\n`);

  if (args.dryRun) {
    for (const { image, model } of jobs) {
      const body = MODELS[model].provider === "xai" ? xaiRequestBody(model, image, opts) : geminiRequestBody(model, image, opts);
      console.log(`--- ${image.label} × ${model}`);
      console.log(JSON.stringify(redact(body), null, 2));
    }
    return;
  }

  if (!args.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("실제 API를 호출해 과금됩니다. 계속할까요? (y/N) ");
    rl.close();
    if (answer.trim().toLowerCase() !== "y") {
      console.log("취소했습니다.");
      return;
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = resolve(args.out ?? join("scripts", "output", "video-compare", stamp));
  await mkdir(outDir, { recursive: true });

  // 원본 미리보기 저장 (결과 페이지에서 나란히 보기)
  for (const img of images) {
    const ext = img.mime === "image/jpeg" ? "jpg" : img.mime.split("/")[1];
    img.preview = `source__${img.label}.${ext}`;
    await writeFile(join(outDir, img.preview), Buffer.from(img.base64, "base64"));
  }

  // 모든 작업을 병렬 실행 — 대부분의 시간은 제공사 쪽 대기
  const results = await Promise.all(
    jobs.map(async ({ image, model }) => {
      const tag = `${image.label} × ${model}`;
      const log = (msg) => console.log(`[${tag}] ${msg}`);
      const started = Date.now();
      const estCost = MODELS[model].pricePerSec * opts.duration;
      try {
        const run = MODELS[model].provider === "xai" ? runXai : runGemini;
        const buf = await run(model, image, opts, log);
        const file = `${image.label}__${model}.mp4`;
        await writeFile(join(outDir, file), buf);
        const seconds = Math.round((Date.now() - started) / 1000);
        log(`완료 (${seconds}초, ${(buf.length / 1024 / 1024).toFixed(1)}MB)`);
        return { image: image.label, model, ok: true, file, seconds, bytes: buf.length, estCost };
      } catch (err) {
        const seconds = Math.round((Date.now() - started) / 1000);
        const error = err instanceof Error ? err.message : String(err);
        log(`실패: ${error}`);
        return { image: image.label, model, ok: false, error, seconds, estCost };
      }
    })
  );

  await writeFile(join(outDir, "results.json"), JSON.stringify({ opts, results }, null, 2));
  await writeFile(join(outDir, "index.html"), renderHtml(results, images, models, opts));

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n완료 ${ok}/${results.length} — 비교 페이지: ${join(outDir, "index.html")}`);
  if (ok < results.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
