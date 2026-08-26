/**
 * 大雨冷凝溅冠深度自检：层叠、opts、canvas 像素、聚簇、无大透镜 2D 珠
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3456/?rain=heavy";
const CACHE_TAG = "202608262050";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
const logs = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  const line = `[${msg.type()}] ${msg.text()}`;
  logs.push(line);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForFunction(
  () => document.body.classList.contains("heavy-rain"),
  { timeout: 30000 },
);
await page.evaluate(() => {
  document.body.classList.remove("home-intro-playing");
  document.body.classList.add("home-ready");
  const intro = document.getElementById("home-intro");
  if (intro) intro.remove();
});
await page.waitForTimeout(9000);

const diag = await page.evaluate(() => {
  const layer = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      isOn: el.classList.contains("is-on"),
      w: el.width || el.clientWidth,
      h: el.height || el.clientHeight,
    };
  };

  const analyzeDropsCanvas = () => {
    const el = document.querySelector(".site-fx__glass-drops");
    if (!el || el.width < 2) {
      return { bright: 0, samples: 0, largeBlobs: 0, splashLike: 0 };
    }
    const ctx = el.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { bright: 0, samples: 0, largeBlobs: 0, splashLike: 0 };

    const w = el.width;
    const h = el.height;
    let bright = 0;
    let samples = 0;
    let largeBlobs = 0;
    let splashLike = 0;
    const step = 6;
    const seen = new Uint8Array(w * h);

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        if (d[3] <= 8) continue;
        bright += (d[0] + d[1] + d[2]) / 3;
        samples += 1;
        const idx = y * w + x;
        if (seen[idx]) continue;
        let q = [[x, y]];
        let area = 0;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        while (q.length && area < 800) {
          const [cx, cy] = q.pop();
          const id = cy * w + cx;
          if (cx < 0 || cy < 0 || cx >= w || cy >= h || seen[id]) continue;
          const p = ctx.getImageData(cx, cy, 1, 1).data;
          if (p[3] <= 40) continue;
          seen[id] = 1;
          area += 1;
          minX = Math.min(minX, cx);
          maxX = Math.max(maxX, cx);
          minY = Math.min(minY, cy);
          maxY = Math.max(maxY, cy);
          q.push([cx + step, cy], [cx - step, cy], [cx, cy + step], [cx, cy - step]);
        }
        const bw = maxX - minX;
        const bh = maxY - minY;
        if (area >= 2 && bw <= 42 && bh <= 42) splashLike += 1;
        if (bw > 48 || bh > 48) largeBlobs += 1;
      }
    }
    return {
      bright: samples ? bright / samples : 0,
      samples,
      largeBlobs,
      splashLike,
    };
  };

  const columnCluster = (sel) => {
    const el = document.querySelector(sel);
    if (!el || el.width < 2) return { maxCol: 0, med: 0, ratio: 0 };
    const ctx = el.getContext("2d", { willReadFrequently: true });
    const w = el.width;
    const h = el.height;
    const y0 = Math.floor(h * 0.55);
    const y1 = Math.floor(h * 0.92);
    const colW = 16;
    const cols = [];
    for (let cx = 0; cx < w; cx += colW) {
      let n = 0;
      for (let y = y0; y < y1; y += 4) {
        for (let x = cx; x < Math.min(cx + colW, w); x += 4) {
          if (ctx.getImageData(x, y, 1, 1).data[3] > 40) n += 1;
        }
      }
      cols.push(n);
    }
    const maxCol = Math.max(...cols, 0);
    const med = cols.slice().sort((a, b) => a - b)[Math.floor(cols.length / 2)] || 0;
    return { maxCol, med, ratio: med > 0 ? maxCol / med : maxCol };
  };

  const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);

  return {
    bodyClass: document.body.className,
    scripts: scripts.filter((s) => /glass-drops|heavy-rain|kaya-boot|style-weather/i.test(s)),
    rainGlass: layer(".site-fx__rain-glass"),
    glassDrops: layer(".site-fx__glass-drops"),
    dropsPx: analyzeDropsCanvas(),
    dropsCluster: columnCluster(".site-fx__glass-drops"),
  };
});

const shot = join(outDir, "heavy-splash-verify.png");
await page.screenshot({ path: shot, fullPage: false });

const kayaLogs = logs.filter((l) => /kaya|glass|error|warn|screen glass/i.test(l));

const report = {
  url,
  errors,
  logs: kayaLogs.slice(-40),
  diag,
  checks: {
    heavyRain: diag.bodyClass.includes("heavy-rain"),
    dropsAboveGlass: Number(diag.glassDrops?.zIndex || 0) > Number(diag.rainGlass?.zIndex || 0),
    dropsVisible: Number(diag.glassDrops?.opacity || 0) > 0.05
      && diag.glassDrops?.display !== "none",
    dropsHasPixels: diag.dropsPx.samples >= 4 && diag.dropsPx.bright > 20,
    splashLike: diag.dropsPx.splashLike >= 1 || diag.dropsPx.samples >= 15,
    noLarge2dDrops: diag.dropsPx.largeBlobs <= 2,
    noCluster: diag.dropsCluster.med <= 0 ? diag.dropsCluster.maxCol < 40 : diag.dropsCluster.ratio < 4.5,
    glassOn: diag.rainGlass?.isOn === true,
    notDemoted: !kayaLogs.some((l) => /demoted/i.test(l)),
    freshJs: diag.scripts.some((s) => s.includes(CACHE_TAG)),
  },
  shot,
};

report.ok = Object.values(report.checks).every(Boolean) && errors.length === 0;

writeFileSync(join(outDir, "heavy-splash-verify.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
