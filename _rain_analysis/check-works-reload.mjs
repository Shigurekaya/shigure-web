/**
 * 主页小雨 → 作品集 F5 刷新 → 可能重抽签变大雨（已知行为）
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });

let heavyAfterReload = 0;
const N = 40;
for (let i = 0; i < N; i += 1) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?rain=light`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.click('a.home-card[href="/works/"]');
  await page.waitForURL(/\/works\/?/);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const heavy = await page.evaluate(() => document.body.classList.contains("heavy-rain"));
  if (heavy) heavyAfterReload += 1;
  await ctx.close();
}

console.log(JSON.stringify({ trials: N, heavyAfterReload, rate: heavyAfterReload / N }, null, 2));
await browser.close();
