/** 验证小雨 CSS 合成器雨层已挂载且动画运行 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

await page.goto(`${BASE}/?rain=light`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const state = await page.evaluate(() => {
  const tracks = [...document.querySelectorAll(".site-bg__light-rain-css__track")];
  const transforms = tracks.map((t) => getComputedStyle(t).transform);
  return {
    light: document.body.classList.contains("light-rain"),
    layers: document.querySelectorAll(".site-bg__light-rain-css.is-on").length,
    tracks: tracks.length,
    canvasHidden: document.querySelector(".site-bg__rain")?.classList.contains("site-bg__rain--css-idle"),
    stats: window.__KayaLightRainStats?.(),
    transforms,
    anim: tracks.map((t) => getComputedStyle(t).animationName),
  };
});

await page.waitForTimeout(800);
const moved = await page.evaluate(() => {
  const t = document.querySelector(".site-bg__light-rain-css__track");
  return t ? getComputedStyle(t).transform : null;
});

console.log(JSON.stringify({ state, moved, animOk: state.anim.every((a) => a && a !== "none") }, null, 2));
await browser.close();
process.exit(
  state.light && state.layers === 2 && state.canvasHidden && state.stats?.mode === "css-compositor" ? 0 : 1
);
