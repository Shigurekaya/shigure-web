/** 自检：小雨 WebGL 雨丝 + 2D 溅花层是否挂载、帧耗是否下降 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || "http://127.0.0.1:3000";
const outDir = path.join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-webgl", "--use-gl=angle"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(`${BASE}/?rain=light`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  document.body.classList.remove("home-intro-playing");
  document.getElementById("home-intro")?.remove();
  document.body.classList.add("home-ready");
});
await page.waitForTimeout(2800);

const samples = [];
for (let i = 0; i < 8; i += 1) {
  const s = await page.evaluate(() => window.__KayaLightRainStats?.() || null);
  if (s) samples.push(s);
  await page.waitForTimeout(120);
}

const dom = await page.evaluate(() => ({
  light: document.body.classList.contains("light-rain"),
  rainCanvas: !!document.querySelector(".site-bg__rain"),
  fxLayer: !!document.querySelector(".site-bg__rain-fx"),
  rainW: document.querySelector(".site-bg__rain")?.width || 0,
  rainH: document.querySelector(".site-bg__rain")?.height || 0,
  fxW: document.querySelector(".site-bg__rain-fx")?.width || 0,
  rainPixels: (() => {
    const c = document.querySelector(".site-bg__rain");
    return c ? c.width * c.height : 0;
  })(),
}));

const rainShot = path.join(outDir, "light-rain-gpu-check.png");
await page.screenshot({ path: rainShot, fullPage: false });

const frameMs = samples.map((s) => s.frameMs).filter((n) => n > 0);
const avgFrame = frameMs.length
  ? frameMs.reduce((a, b) => a + b, 0) / frameMs.length
  : 0;
const last = samples[samples.length - 1] || {};
const ok = dom.light
  && (last.mode === "canvas-rain" || last.mode === "canvas-rain+static-dom")
  && dom.rainPixels > 0
  && !dom.fxLayer
  && avgFrame < 20;

const report = {
  at: new Date().toISOString(),
  base: BASE,
  dom,
  samples,
  avgFrameMs: Math.round(avgFrame * 10) / 10,
  ok,
  shot: rainShot,
};

writeFileSync(path.join(outDir, "light-rain-gpu-check.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
