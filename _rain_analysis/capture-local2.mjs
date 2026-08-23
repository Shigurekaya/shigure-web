import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.env.RAIN_URL || "http://127.0.0.1:3000/?rain=heavy";
const tag = process.env.RAIN_TAG || "shot";
const width = Number(process.env.RAIN_W || 390);
const height = Number(process.env.RAIN_H || 844);

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1.5,
});

const logs = [];
page.on("console", (msg) => {
  const t = `[${msg.type()}] ${msg.text()}`;
  logs.push(t);
  console.log(t);
});
page.on("pageerror", (err) => {
  const t = `[pageerror] ${err.message}`;
  logs.push(t);
  console.log(t);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  document.body.classList.remove("is-intro");
  document.documentElement.classList.remove("is-intro");
  document.querySelectorAll(".home-intro, .intro-overlay").forEach((el) => {
    el.style.display = "none";
    el.style.opacity = "0";
  });
});

let status = "timeout";
for (let i = 0; i < 48; i += 1) {
  await page.waitForTimeout(250);
  const hit = logs.find((l) =>
    l.includes("screen glass ready")
    || l.includes("screen glass demoted")
    || l.includes("raindrop-fx skipped")
  );
  if (hit) {
    status = hit;
    break;
  }
}
await page.waitForTimeout(4000);

const shotPath = join(outDir, `${tag}.png`);
await page.screenshot({ path: shotPath, fullPage: false, timeout: 90000 });

const info = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      opacity: cs.opacity,
      isOn: el.classList.contains("is-on"),
      w: el.width,
      h: el.height,
    };
  };
  return {
    body: document.body.className,
    glass: pick(".site-fx__rain-glass"),
    overlay: pick(".site-fx__streak-overlay"),
    splash: pick(".site-fx__splash"),
    drops: pick(".site-fx__glass-drops"),
    heavy: pick(".site-bg__heavy"),
    clouds: pick(".site-bg__clouds"),
    mist: pick(".site-bg__heavy-mist"),
  };
});

writeFileSync(join(outDir, `${tag}.json`), JSON.stringify({ status, logs, info, url, width, height }, null, 2));
console.log("STATUS", status);
console.log("INFO", JSON.stringify(info, null, 2));
console.log("SHOT", shotPath);
await browser.close();
