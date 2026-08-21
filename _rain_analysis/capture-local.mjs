import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.env.RAIN_URL || "http://127.0.0.1:3000/?rain=heavy";
const tag = process.env.RAIN_TAG || "shot";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
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
  const wrap = document.querySelector(".home-intro");
  if (wrap) wrap.style.display = "none";
  /* force skip any remaining intro overlay */
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
/* 等珠 spawn / 下滑积累，再截图 */
await page.waitForTimeout(3500);

const shotPath = join(outDir, `${tag}.png`);
await page.screenshot({ path: shotPath, fullPage: false });

const info = await page.evaluate(() => {
  const glass = document.querySelector(".site-fx__rain-glass");
  const drops = document.querySelector(".site-fx__glass-drops");
  const streak = document.querySelector(".site-bg__heavy");
  return {
    body: document.body.className,
    glass: glass
      ? {
          display: getComputedStyle(glass).display,
          opacity: getComputedStyle(glass).opacity,
          on: glass.classList.contains("is-on"),
          w: glass.width,
          h: glass.height,
        }
      : null,
    drops: drops
      ? {
          display: getComputedStyle(drops).display,
          opacity: getComputedStyle(drops).opacity,
        }
      : null,
    streak: streak
      ? { display: getComputedStyle(streak).display, opacity: getComputedStyle(streak).opacity }
      : null,
  };
});

writeFileSync(join(outDir, `${tag}.json`), JSON.stringify({ status, logs, info, url }, null, 2));
console.log("STATUS", status);
console.log("INFO", JSON.stringify(info, null, 2));
console.log("SHOT", shotPath);
await browser.close();
