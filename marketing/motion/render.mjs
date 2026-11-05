#!/usr/bin/env node
/**
 * promo.html을 프레임 단위로 렌더링해 mp4로 인코딩한다.
 * 필요: Playwright(Chromium), ffmpeg, 인터넷(Google Fonts)
 *
 *   node marketing/motion/render.mjs [출력경로.mp4] [--fps 30]
 */
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

// 전역 설치(NODE_PATH)된 Playwright도 찾도록 require로 로드
const { chromium } = createRequire(import.meta.url)("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const fpsIdx = args.indexOf("--fps");
const fps = fpsIdx >= 0 ? Number(args[fpsIdx + 1]) : 30;
const out = resolve(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--fps") ?? join(here, "promo.mp4"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("페이지 오류:", e.message));
await page.goto(pathToFileURL(join(here, "promo.html")).href + "?render=1", { waitUntil: "networkidle" });
await page.evaluate(() => window.ready);
const duration = await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * fps);

const ff = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  out,
], { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg 종료 코드 ${c}`)))));

for (let i = 0; i < frames; i++) {
  await page.evaluate((t) => window.render(t), i / fps);
  const buf = await page.screenshot({ type: "jpeg", quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % fps === 0) process.stdout.write(`\r렌더링 ${i}/${frames} 프레임`);
}
ff.stdin.end();
await ffDone;
await browser.close();
console.log(`\n완료: ${out} (${duration}초, ${fps}fps, ${frames}프레임)`);
