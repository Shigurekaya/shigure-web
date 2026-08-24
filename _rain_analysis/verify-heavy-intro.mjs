/**
 * 带开场动画 + 大雨：验证 intro 结束后正文可见
 */
import { chromium, devices } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({ ...devices["Pixel 5"] });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));

await page.addInitScript(() => {
  /* 0.25 → rollHomeWeather 抽到 heavy（0.2~0.3 区间） */
  Math.random = () => 0.25;
});

await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });

await page.waitForFunction(() => document.body.classList.contains("home-intro-playing"), {
  timeout: 8000,
}).catch(() => null);

await page.waitForFunction(() => {
  const b = document.body;
  return b.classList.contains("home-ready")
    && !b.classList.contains("home-intro-playing");
}, { timeout: 15000 });

await page.waitForTimeout(4000);

const diag = await page.evaluate(() => {
  const header = document.querySelector(".site-header");
  const name = document.querySelector(".profile-name");
  const hs = header ? getComputedStyle(header) : null;
  const ns = name ? getComputedStyle(name) : null;
  return {
    bodyClass: document.body.className,
    headerOpacity: hs?.opacity ?? null,
    nameOpacity: ns?.opacity ?? null,
    hadIntro: !document.getElementById("home-intro"),
    fxActive: document.querySelector(".site-fx")?.classList.contains("is-active") ?? false,
  };
});

await browser.close();

const ok = diag.bodyClass.includes("heavy-rain")
  && Number(diag.headerOpacity) > 0.5
  && Number(diag.nameOpacity) > 0.5;
console.log(JSON.stringify({ ok, errors, diag }, null, 2));
process.exit(ok ? 0 : 1);
