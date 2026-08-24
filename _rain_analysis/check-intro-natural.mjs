/**
 * 自然进主页（有开场）抽签小雨 → 开场中点击作品集
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.addInitScript(() => {
  let n = 0;
  const orig = Math.random;
  Math.random = () => {
    n += 1;
    if (n === 1) return 0.5; // light
    return orig();
  };
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const during = await page.evaluate(() => ({
  introPlaying: document.body.classList.contains("home-intro-playing"),
  light: document.body.classList.contains("light-rain"),
  heavy: document.body.classList.contains("heavy-rain"),
  session: sessionStorage.getItem("kaya-rain-mode"),
}));

await page.click('a.home-card[href="/works/"]');
await page.waitForURL(/\/works\/?/, { timeout: 15000 });
await page.waitForTimeout(2000);
const works = await page.evaluate(() => ({
  light: document.body.classList.contains("light-rain"),
  heavy: document.body.classList.contains("heavy-rain"),
  siteFx: !!document.querySelector(".site-fx"),
  session: sessionStorage.getItem("kaya-rain-mode"),
}));

console.log(JSON.stringify({ during, works, ok: during.light && works.light && !works.heavy }, null, 2));
await browser.close();
process.exit(during.light && works.light && !works.heavy ? 0 : 1);
