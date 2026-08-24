/**
 * 开场动画播放中点击作品集 → 天气应保持一致
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/?rain=light`, { waitUntil: "domcontentloaded" });
// 不等 intro 结束，尽快点作品集
await page.waitForSelector('a.home-card[href="/works/"]', { timeout: 5000 });
const introPlaying = await page.evaluate(() => document.body.classList.contains("home-intro-playing"));
const home = await page.evaluate(() => ({
  light: document.body.classList.contains("light-rain"),
  heavy: document.body.classList.contains("heavy-rain"),
  session: sessionStorage.getItem("kaya-rain-mode"),
}));

await page.click('a.home-card[href="/works/"]');
await page.waitForURL(/\/works\/?/);
await page.waitForTimeout(2000);
const works = await page.evaluate(() => ({
  light: document.body.classList.contains("light-rain"),
  heavy: document.body.classList.contains("heavy-rain"),
  siteFx: !!document.querySelector(".site-fx"),
  session: sessionStorage.getItem("kaya-rain-mode"),
}));

console.log(JSON.stringify({ introPlaying, home, works, ok: home.light && works.light && !works.heavy }, null, 2));
await browser.close();
process.exit(home.light && works.light && !works.heavy ? 0 : 1);
