/**
 * 晴天：切后台 + 模拟 resize 风暴后，visibility 处理是否卡主线程
 */
import { chromium } from "playwright";

const URL = process.env.RAIN_URL || "http://127.0.0.1:3000/?rain=sunny";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(
  () => document.body.classList.contains("sunny-sky")
    && (document.body.classList.contains("home-ready") || document.body.classList.contains("home-revealed")),
  { timeout: 25000 },
);
await page.waitForFunction(
  () => {
    const s = document.querySelector(".site-bg__sunny-scene");
    return s && s.classList.contains("is-on") && (s.currentSrc || s.src || "").length > 32;
  },
  { timeout: 20000 },
);
await page.waitForTimeout(800);

const before = await page.evaluate(() => ({
  bodyClass: document.body.className,
  sceneOn: document.querySelector(".site-bg__sunny-scene")?.classList.contains("is-on"),
  srcLen: (document.querySelector(".site-bg__sunny-scene")?.src || "").length,
}));

// 切后台
await page.evaluate(() => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
});
await page.waitForTimeout(2500);

// 切回 + 立刻打一串 resize（复现浏览器行为）
const resume = await page.evaluate(() => {
  const t0 = performance.now();
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
  for (let i = 0; i < 8; i += 1) {
    window.dispatchEvent(new Event("resize"));
    window.visualViewport?.dispatchEvent?.(new Event("resize"));
  }
  const syncMs = performance.now() - t0;
  return new Promise((resolve) => {
    // 等 sunny 内部 debounce(120) + guard
    setTimeout(() => {
      let frames = 0;
      let maxGap = 0;
      let last = performance.now();
      const start = performance.now();
      const tick = (now) => {
        frames += 1;
        maxGap = Math.max(maxGap, now - last);
        last = now;
        if (now - start > 1500) {
          resolve({
            syncMs: Math.round(syncMs),
            frames,
            fps: +(frames / 1.5).toFixed(1),
            maxGap: Math.round(maxGap),
            sceneOn: document.querySelector(".site-bg__sunny-scene")?.classList.contains("is-on"),
            srcLen: (document.querySelector(".site-bg__sunny-scene")?.src || "").length,
            bodyClass: document.body.className,
          });
        } else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 400);
  });
});

await browser.close();

const stuck = resume.syncMs > 800 || resume.maxGap > 900 || !resume.sceneOn || resume.frames < 20;
const out = { url: URL, before, resume, errors: errors.slice(0, 8), stuck };
console.log(JSON.stringify(out, null, 2));
process.exit(stuck ? 2 : 0);
