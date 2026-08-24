/**
 * 小雨全页截图 + 雨层像素统计（用于自检观感）
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";

const base = process.argv[2] || "http://127.0.0.1:3010";
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "local");

async function prepLightPage(page) {
  await page.goto(`${base}/?rain=light`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    document.body.classList.remove("home-intro-playing");
    document.getElementById("home-intro")?.remove();
    document.body.classList.add("home-ready");
  });
  await page.waitForTimeout(2800);
}

function imageStats(file) {
  if (!existsSync(file)) return null;
  const buf = readFileSync(file);
  const png = PNG.sync.read(buf);
  let r = 0; let g = 0; let b = 0; let n = 0;
  let bright = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const pr = png.data[i];
    const pg = png.data[i + 1];
    const pb = png.data[i + 2];
    const pa = png.data[i + 3];
    if (pa < 8) continue;
    r += pr; g += pg; b += pb; n += 1;
    if (pr + pg + pb > 600) bright += 1;
  }
  if (!n) return null;
  return {
    mean: [r / n, g / n, b / n].map((v) => Math.round(v * 10) / 10),
    brightRatio: Math.round((bright / n) * 1000) / 1000,
    pixels: n,
  };
}

function diffStats(a, b) {
  if (!a || !b) return null;
  const dr = Math.abs(a.mean[0] - b.mean[0]);
  const dg = Math.abs(a.mean[1] - b.mean[1]);
  const db = Math.abs(a.mean[2] - b.mean[2]);
  return {
    deltaRgb: [dr, dg, db].map((v) => Math.round(v * 10) / 10),
    maxDelta: Math.round(Math.max(dr, dg, db) * 10) / 10,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await prepLightPage(page);

const state = await page.evaluate(() => ({
  light: document.body.classList.contains("light-rain"),
  mode: window.__KayaLightRainStats?.()?.mode,
  canvas: !!document.querySelector(".site-bg__rain:not(.site-bg__rain--css-idle)"),
  cssRain: document.querySelectorAll(".site-bg__light-rain-css.is-on").length,
  scene: !!document.querySelector(".site-bg__light-scene.is-on"),
}));

const fullShot = path.join(outDir, "light-rain-full.png");
const rainShot = path.join(outDir, "light-rain-canvas.png");
await page.screenshot({ path: fullShot });
const rainEl = page.locator(".site-bg__rain");
if (await rainEl.count()) {
  await rainEl.screenshot({ path: rainShot });
}

const refShot = path.join(outDir, "light-rain-reference.png");
const hasRef = existsSync(refShot);
const fullStats = imageStats(fullShot);
const rainStats = imageStats(rainShot);
const refStats = hasRef ? imageStats(refShot) : null;

const report = {
  at: new Date().toISOString(),
  base,
  state,
  shots: { full: fullShot, rain: rainShot, reference: hasRef ? refShot : null },
  stats: { full: fullStats, rain: rainStats, reference: refStats },
  vsReference: hasRef ? diffStats(fullStats, refStats) : null,
  ok: state.mode?.startsWith("canvas-rain") && state.canvas && state.cssRain === 0,
};

writeFileSync(path.join(outDir, "light-rain-compare.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
