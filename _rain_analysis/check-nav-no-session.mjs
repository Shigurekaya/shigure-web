/**
 * 自检：主页视觉小雨但 session 缺失 → 作品集会重抽签
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// 模拟 session 写入失败 / 旧版未写 kaya-rain-mode
await page.addInitScript(() => {
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === "kaya-rain-mode") return;
    return orig.call(this, k, v);
  };
});

await page.goto(`${BASE}/?rain=light`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
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

console.log(JSON.stringify({ home, works, mismatch: home.light && works.heavy }, null, 2));
await browser.close();
