/** 截图小雨雨层并统计雨丝长度分布 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const base = process.argv[2] || "http://127.0.0.1:3010";
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "local");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${base}/?rain=light`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  document.getElementById("home-intro")?.remove();
  document.body.classList.add("home-ready");
});
await page.waitForTimeout(2800);

const metrics = await page.evaluate(() => {
  const H = window.innerHeight;
  const canvas = document.querySelector(".site-bg__rain");
  const lens = [];
  if (window.__KayaLightRainProbe) {
    return window.__KayaLightRainProbe();
  }
  return {
    stats: window.__KayaLightRainStats?.(),
    viewportH: H,
    canvas: !!canvas,
  };
});

const shot = path.join(outDir, "light-rain-ref-match.png");
await page.locator(".site-bg").screenshot({ path: shot });
const rainShot = path.join(outDir, "light-rain-canvas-only.png");
const rain = page.locator(".site-bg__rain");
if (await rain.count()) await rain.screenshot({ path: rainShot });

writeFileSync(path.join(outDir, "light-rain-ref-match.json"), JSON.stringify({
  at: new Date().toISOString(),
  metrics,
  shots: { bg: shot, rain: rainShot },
  expectedLenPx720: { far: "3-6", mid: "4-9", near: "6-13" },
}, null, 2));
console.log(JSON.stringify({ metrics, shot }, null, 2));
await browser.close();
