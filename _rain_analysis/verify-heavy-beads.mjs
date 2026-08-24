/**
 * 大雨冷凝珠 + 静态背景自检：无 JS 错误、层挂载、截图
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3012/?rain=heavy";
const headed = process.argv.includes("--headed");

const viewport = process.argv.includes("--mobile")
  ? { width: 390, height: 844, deviceScaleFactor: 2 }
  : { width: 1280, height: 800, deviceScaleFactor: 1 };
const shotName = viewport.width < 500 ? "heavy-beads-verify.png" : "heavy-desktop-verify.png";

const browser = await chromium.launch({
  headless: !headed,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: viewport.width, height: viewport.height },
  deviceScaleFactor: viewport.deviceScaleFactor,
});

const errors = [];
const logs = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (msg) => {
  const line = `[${msg.type()}] ${msg.text()}`;
  logs.push(line);
  if (msg.type() === "error") errors.push(line);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(
  () => document.body.classList.contains("heavy-rain") || document.body.classList.contains("home-ready"),
  { timeout: 30000 },
);

await page.evaluate(() => {
  document.body.classList.remove("home-intro-playing");
  document.body.classList.add("home-ready");
  const intro = document.getElementById("home-intro");
  if (intro) intro.remove();
});

await page.waitForTimeout(6000);

const diag = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      opacity: cs.opacity,
      isOn: el.classList.contains("is-on"),
      w: el.width || el.clientWidth,
      h: el.height || el.clientHeight,
    };
  };
  const mist = document.querySelector(".site-bg__heavy-mist");
  const mistCs = mist ? getComputedStyle(mist) : null;
  return {
    bodyClass: document.body.className,
    eco: document.body.classList.contains("kaya-ambient-eco"),
    hasHeavyRain: !!window.KayaHeavyRain,
    glass: pick(".site-fx__rain-glass"),
    overlay: pick(".site-fx__streak-overlay"),
    splash: pick(".site-fx__splash"),
    drops: pick(".site-fx__glass-drops"),
    heavy: pick(".site-bg__heavy"),
    clouds: pick(".site-bg__clouds"),
    mist: pick(".site-bg__heavy-mist"),
    mistAnimation: mistCs?.animationName || null,
    skyBeforeAnimation: getComputedStyle(document.querySelector(".site-bg") || document.body, "::before").animationName,
    title: document.title,
    hasContent: !!document.querySelector(".profile-name, .home-card, .site-bar"),
  };
});

const shot = join(outDir, shotName);
await page.screenshot({ path: shot, fullPage: false });

const report = {
  url,
  errors,
  logs: logs.filter((l) => /kaya|glass|error|warn/i.test(l)).slice(-30),
  diag,
  shot,
  ok: errors.length === 0
    && diag.bodyClass.includes("heavy-rain")
    && diag.eco
    && (diag.glass?.w > 0 || diag.drops?.w > 0)
    && diag.clouds?.w > 0,
};
writeFileSync(join(outDir, shotName.replace(".png", ".json")), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.ok ? 0 : 1);
