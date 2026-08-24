/**
 * 自检：主页小雨 → 点击作品集 → 应保持小雨
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();

const rainState = async (label) => {
  return page.evaluate((lbl) => {
    const b = document.body;
    return {
      label: lbl,
      href: location.href,
      light: b.classList.contains("light-rain"),
      heavy: b.classList.contains("heavy-rain"),
      storm: b.classList.contains("storm-rain"),
      sunny: b.classList.contains("sunny-sky"),
      eco: b.classList.contains("kaya-ambient-eco"),
      siteFx: !!document.querySelector(".site-fx"),
      lightScene: !!document.querySelector(".site-bg__light-scene"),
      session: sessionStorage.getItem("kaya-rain-mode"),
      legacy: sessionStorage.getItem("kaya-rain-heavy"),
    };
  }, label);
};

// 1) 强制小雨进主页
await page.goto(`${BASE}/?rain=light`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const home = await rainState("home");

// 2) 点作品集卡片
await page.click('a.home-card[href="/works/"]');
await page.waitForURL(/\/works\/?/, { timeout: 10000 });
await page.waitForTimeout(2000);
const works = await rainState("works");

// 3) 导航栏「作品」
await page.goto(`${BASE}/?rain=light`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.click('nav a[href="/works/"]');
await page.waitForURL(/\/works\/?/, { timeout: 10000 });
await page.waitForTimeout(2000);
const worksNav = await rainState("works-nav");

const ok = home.light && works.light && !works.heavy && worksNav.light && !worksNav.heavy;
console.log(JSON.stringify({ ok, home, works, worksNav }, null, 2));
await browser.close();
process.exit(ok ? 0 : 1);
