/**
 * 自检：主页抽签小雨（无 URL 参数）→ 作品集应保持小雨
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:3010";

const browser = await chromium.launch({ headless: true });

async function runOnce(seed) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  await page.addInitScript((s) => {
    let n = 0;
    const orig = Math.random;
    Math.random = () => {
      n += 1;
      if (n === 1) return s; // rollHomeWeather first call
      return orig();
    };
  }, seed);

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

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
    href: location.href,
  }));

  await ctx.close();
  return { seed, home, works, ok: home.light && works.light && !works.heavy };
}

// rollHomeWeather: r<0.2 sunny, r<0.3 heavy, else light
const seeds = {
  light: 0.25,
  heavy: 0.25, // should roll heavy on home - user wouldn't say 小雨 though
  sunny: 0.1,
};

const results = {};
for (const [name, seed] of Object.entries(seeds)) {
  results[name] = await runOnce(seed);
}

console.log(JSON.stringify(results, null, 2));
const failed = Object.entries(results).filter(([, r]) => !r.ok);
await browser.close();
process.exit(failed.length ? 1 : 0);
