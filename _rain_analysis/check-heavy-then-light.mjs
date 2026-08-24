/**
 * 先大雨再小雨 → 作品集（bfcache / 历史栈场景）
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/?rain=heavy`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await page.goto(`${BASE}/?rain=light`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
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

// 浏览器后退再前进
await page.goBack({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.goForward({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
const worksBf = await page.evaluate(() => ({
  light: document.body.classList.contains("light-rain"),
  heavy: document.body.classList.contains("heavy-rain"),
  siteFx: !!document.querySelector(".site-fx"),
}));

console.log(JSON.stringify({ home, works, worksBf }, null, 2));
await browser.close();
