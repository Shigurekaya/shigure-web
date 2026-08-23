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

const url = process.argv[2] || "http://127.0.0.1:3000/?rain=sunny";

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
  const scene = document.querySelector(".site-bg__sunny-scene");
  const mist = document.querySelector(".site-bg__light-mist");
  const bg = document.querySelector(".site-bg");
  const before = bg ? getComputedStyle(bg, "::before") : null;
  const bar = document.querySelector(".site-bar");
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const bgFill = bg ? getComputedStyle(bg).backgroundColor : null;
  const mistOn = mist ? getComputedStyle(mist).opacity : null;
  const sceneBlend = scene ? getComputedStyle(scene).mixBlendMode : null;
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
    scene: scene ? { on: scene.classList.contains("is-on"), src: !!scene.src, blend: sceneBlend } : null,
    mist: !!mist,
    mistOpacity: mistOn,
    bodyBg,
    bgFill,
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

const pixels = await page.evaluate(() => {
  const pts = [
    [64, 64],
    [200, 180],
    [640, 120],
    [1100, 200],
    [640, 360],
  ];
  const out = [];
  for (const [x, y] of pts) {
    const el = document.elementFromPoint(x, y);
    out.push({
      x,
      y,
      top: el?.className || el?.tagName || null,
      body: getComputedStyle(document.body).backgroundColor,
    });
  }
  return out;
});

const shot = join(outDir, "sunny-verify.png");
const shotBuf = await page.screenshot({ path: shot, fullPage: false, type: "png" });

/* 像素自检：不依赖 sharp，把截图喂给页面 canvas 采样 */
let bgCheck = null;
try {
  bgCheck = await page.evaluate(async (pngBase64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + pngBase64;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const cv = document.createElement("canvas");
    cv.width = iw;
    cv.height = ih;
    const cx = cv.getContext("2d");
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, iw, ih).data;
    const at = (x, y) => {
      const i = (y * iw + x) * 4;
      return { r: d[i], g: d[i + 1], b: d[i + 2] };
    };
    const lum = (p) => Math.round(0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b);
    const chroma = (p) => Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);

    const corner = at(40, 40);

    /* 上半屏天空区找最彩点（排除两侧 sun 过曝区影响不大，sun 是暖白） */
    let best = { chroma: 0 };
    for (let y = 60; y < Math.round(ih * 0.62); y += 4) {
      for (let x = 80; x < iw - 80; x += 8) {
        const p = at(x, y);
        const ch = chroma(p);
        if (ch > best.chroma) best = { chroma: ch, p, x, y };
      }
    }

    const cb = best.p || corner;
    const center = at(Math.round(iw / 2), Math.round(ih / 2));
    return {
      corner,
      rainbow: cb,
      center,
      rainbowPos: best.p ? { x: best.x, y: best.y } : null,
      lightBgOk: lum(corner) >= 210,
      rainbowOk: best.p
        && best.chroma >= 45
        && Math.abs(lum(cb) - lum(corner)) >= 8,
      notBlackBg: lum(corner) >= 180,
      maxChroma: Math.round(best.chroma),
    };
  }, shotBuf.toString("base64"));
} catch (err) {
  bgCheck = { error: String(err?.message || err) };
}

const report = { url, errors, diag, pixels, bgCheck, shot };
writeFileSync(join(outDir, "sunny-verify.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
await browser.close();
const checksFail = errors.length
  || (bgCheck && (!bgCheck.lightBgOk || !bgCheck.notBlackBg || !bgCheck.rainbowOk));
process.exit(checksFail ? 1 : 0);
