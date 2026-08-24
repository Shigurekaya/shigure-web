/**
 * 主页 ?rain=light 但 session 未写入 → 作品集应重抽签（可能变大雨）
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });

let trials = 0;
let heavyCount = 0;
for (let i = 0; i < 30; i += 1) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === "kaya-rain-mode") return;
      return orig.call(this, k, v);
    };
  });
  await page.goto(`${BASE}/?rain=light`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const homeLight = await page.evaluate(() => document.body.classList.contains("light-rain"));
  if (!homeLight) { await ctx.close(); continue; }
  trials += 1;
  await page.click('a.home-card[href="/works/"]');
  await page.waitForURL(/\/works\/?/);
  await page.waitForTimeout(1000);
  const worksHeavy = await page.evaluate(() => document.body.classList.contains("heavy-rain"));
  if (worksHeavy) heavyCount += 1;
  await ctx.close();
}

console.log(JSON.stringify({ trials, heavyCount, heavyRate: trials ? heavyCount / trials : 0 }, null, 2));
await browser.close();
