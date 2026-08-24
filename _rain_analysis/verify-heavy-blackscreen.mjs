/**
 * 复现/验证：大雨开场后正文是否可见（非「只剩雨」黑屏）
 */
import { chromium, devices } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";
const url = `${base}/?rain=heavy&_v=${Date.now()}`;

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});

const page = await browser.newPage({
  ...devices["Pixel 5"],
});

const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

// 等开场结束 + 主雨层启动
await page.waitForFunction(() => {
  const b = document.body;
  return b.classList.contains("home-ready") && !b.classList.contains("home-intro-playing");
}, { timeout: 12000 });

await page.waitForTimeout(3500);

const diag = await page.evaluate(() => {
  const header = document.querySelector(".site-header");
  const name = document.querySelector(".profile-name");
  const fx = document.querySelector(".site-fx");
  const glass = document.querySelector(".site-fx__rain-glass");
  const hs = header ? getComputedStyle(header) : null;
  const ns = name ? getComputedStyle(name) : null;
  const gs = glass ? getComputedStyle(glass) : null;
  return {
    bodyClass: document.body.className,
    headerOpacity: hs?.opacity ?? null,
    nameOpacity: ns?.opacity ?? null,
    nameVisible: ns?.visibility ?? null,
    fxActive: fx?.classList.contains("is-active") ?? false,
    glassOn: glass?.classList.contains("is-on") ?? false,
    glassOpacity: gs?.opacity ?? null,
    hasHeavy: !!window.KayaHeavyRain,
    demoted: !document.querySelector(".site-fx__rain-glass.is-on")
      && !!document.querySelector(".site-bg__heavy"),
  };
});

await browser.close();

const ok = Number(diag.headerOpacity) > 0.5 && Number(diag.nameOpacity) > 0.5;
console.log(JSON.stringify({ ok, url, errors, diag }, null, 2));
process.exit(ok ? 0 : 1);
