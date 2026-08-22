/**
 * 晴天页面自动化检验：无 JS 错误 + FPS + 帧耗时 + 截图
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3000/?sunny";

const browser = await chromium.launch({
  headless: true,
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
  const canvas = document.querySelector(".site-bg__sunny");
  const haze = document.querySelector(".site-bg__sunny-haze");
  const bg = document.querySelector(".site-bg");
  const before = bg ? getComputedStyle(bg, "::before") : null;
  const bar = document.querySelector(".site-bar");
  const samples = [];
  let last = performance.now();
  await new Promise((resolve) => {
    const t0 = performance.now();
    const loop = (now) => {
      const dt = now - last;
      last = now;
      if (dt > 0 && dt < 200) samples.push(1000 / dt);
      if (now - t0 > 3500 || samples.length > 150) resolve();
      else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  samples.sort((a, b) => a - b);
  const avg = samples.reduce((s, v) => s + v, 0) / Math.max(1, samples.length);
  const jank = samples.filter((f) => f < 24).length / Math.max(1, samples.length);
  return {
    canvas: canvas ? { w: canvas.width, h: canvas.height, css: `${canvas.clientWidth}x${canvas.clientHeight}` } : null,
    haze: !!haze,
    bodyClass: document.body.className,
    hasFx: !!window.KayaSunnySky,
    stats: window.__KayaSunnyStats?.() ?? null,
    cssOnly: !!document.querySelector(".site-bg.has-sunny-css"),
    pseudo: before
      ? { display: before.display, filter: before.filter, animation: before.animationName }
      : null,
    siteBar: bar
      ? { backdrop: getComputedStyle(bar).backdropFilter || getComputedStyle(bar).webkitBackdropFilter }
      : null,
    fps: {
      avg: Math.round(avg * 10) / 10,
      p50: Math.round((samples[Math.floor(samples.length * 0.5)] || 0) * 10) / 10,
      jankPct: Math.round(jank * 1000) / 10,
    },
  };
});

const shot = join(outDir, "sunny-verify.png");
await page.screenshot({ path: shot, fullPage: false });

const report = { url, errors, diag, shot };
writeFileSync(join(outDir, "sunny-verify.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
