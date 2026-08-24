/**
 * 主页抽签小雨 seed=0.5 → 作品集保持小雨
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

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const home = await page.evaluate(() => ({
  light: document.body.classList.contains("light-rain"),
  session: sessionStorage.getItem("kaya-rain-mode"),
}));

await page.click('a.home-card[href="/works/"]');
await page.waitForURL(/\/works\/?/);
await page.waitForTimeout(2000);
const works = await page.evaluate(() => ({
  light: document.body.classList.contains("light-rain"),
  heavy: document.body.classList.contains("heavy-rain"),
  session: sessionStorage.getItem("kaya-rain-mode"),
}));

console.log(JSON.stringify({ home, works, ok: home.light && works.light }, null, 2));
await browser.close();
process.exit(home.light && works.light ? 0 : 1);
