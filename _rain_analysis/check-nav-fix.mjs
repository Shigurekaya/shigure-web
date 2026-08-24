/**
 * 回归：session 未写入时同站导航不应重抽签变大雨
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });

async function trial(blockModeKey) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  if (blockModeKey) {
    await page.addInitScript(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === "kaya-rain-mode") return;
        return orig.call(this, k, v);
      };
    });
  }
  await page.goto(`${BASE}/?rain=light`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const home = await page.evaluate(() => ({
    light: document.body.classList.contains("light-rain"),
    session: sessionStorage.getItem("kaya-rain-mode"),
    legacy: sessionStorage.getItem("kaya-rain-heavy"),
  }));
  await page.click('a.home-card[href="/works/"]');
  await page.waitForURL(/\/works\/?/);
  await page.waitForTimeout(1500);
  const works = await page.evaluate(() => ({
    light: document.body.classList.contains("light-rain"),
    heavy: document.body.classList.contains("heavy-rain"),
    session: sessionStorage.getItem("kaya-rain-mode"),
    legacy: sessionStorage.getItem("kaya-rain-heavy"),
  }));
  await ctx.close();
  return { home, works, ok: home.light && works.light && !works.heavy };
}

const blocked = await trial(true);
const normal = await trial(false);
console.log(JSON.stringify({ blocked, normal, pass: blocked.ok && normal.ok }, null, 2));
await browser.close();
process.exit(blocked.ok && normal.ok ? 0 : 1);
