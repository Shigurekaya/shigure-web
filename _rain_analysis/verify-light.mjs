/**
 * 小雨页面自动化检验：无 JS 错误 + FPS 采样 + 截图
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3000/?rain=light";
const headed = process.argv.includes("--headed");

const browser = await chromium.launch({
  headless: !headed,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1.5,
});

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => {
  document.body.classList.remove("is-intro", "home-intro-playing");
  document.documentElement.classList.remove("is-intro");
  const intro = document.getElementById("home-intro");
  if (intro) intro.style.display = "none";
});

await page.waitForTimeout(2500);

  const diag = await page.evaluate(async () => {
    const canvas = document.querySelector(".site-bg__rain");
    const hasFx = !!window.KayaLightRain;
    const tier = window.KayaPerfGovernor?.detectRainTier?.() ?? "?";
    const weak = window.KayaPerfGovernor?.isWeakGpu?.() ?? false;
    const frameMs = [];
    const samples = [];
    let last = performance.now();
    await new Promise((resolve) => {
      const t0 = performance.now();
      const loop = (now) => {
        const dt = now - last;
        last = now;
        if (dt > 0 && dt < 200) samples.push(1000 / dt);
        const st = window.__KayaLightRainStats?.();
        if (st?.frameMs > 0) frameMs.push(st.frameMs);
        if (now - t0 > 3500 || samples.length > 150) resolve();
        else requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    samples.sort((a, b) => a - b);
    frameMs.sort((a, b) => a - b);
    const avg = samples.reduce((s, v) => s + v, 0) / Math.max(1, samples.length);
    const jank = samples.filter((f) => f < 24).length / Math.max(1, samples.length);
    const rainAvg = frameMs.reduce((s, v) => s + v, 0) / Math.max(1, frameMs.length);
    const rainP50 = frameMs[Math.floor(frameMs.length * 0.5)] || 0;
    const rainJank = frameMs.filter((f) => f > 42).length / Math.max(1, frameMs.length);
    return {
      canvas: canvas ? { w: canvas.width, h: canvas.height, css: `${canvas.clientWidth}x${canvas.clientHeight}` } : null,
      bodyClass: document.body.className,
      hasFx,
      tier,
      weakGpu: weak,
      stats: window.__KayaLightRainStats?.() ?? null,
      fps: { avg: Math.round(avg * 10) / 10, p50: Math.round((samples[Math.floor(samples.length * 0.5)] || 0) * 10) / 10, jankPct: Math.round(jank * 1000) / 10 },
      rainFrame: {
        n: frameMs.length,
        avgMs: Math.round(rainAvg * 10) / 10,
        p50Ms: Math.round(rainP50 * 10) / 10,
        slowPct: Math.round(rainJank * 1000) / 10,
      },
    };
  });

const shot = join(outDir, "light-verify.png");
await page.screenshot({ path: shot, fullPage: false });

const report = { url, errors, diag, shot };
writeFileSync(join(outDir, "light-verify.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
