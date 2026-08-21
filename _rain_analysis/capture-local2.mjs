import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.env.RAIN_URL || "http://127.0.0.1:3000/?rain=heavy";
const tag = process.env.RAIN_TAG || "shot";
const width = Number(process.env.RAIN_W || 1280);
const height = Number(process.env.RAIN_H || 900);

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
/* 等珠 spawn / 下滑积累，再截图 */
await page.waitForTimeout(3500);

const shotPath = join(outDir, `${tag}.png`);
await page.screenshot({ path: shotPath, fullPage: false });

/* 单独截玻璃层（WebGL canvas 元素） */
let glassShot = null;
try {
  const glass = page.locator(".site-fx__rain-glass");
  if (await glass.count()) {
    glassShot = join(outDir, `${tag}_glass.png`);
    await glass.screenshot({ path: glassShot });
  }
} catch (err) {
  console.log("glass screenshot failed", String(err).slice(0, 200));
}

/* 单独截背景层（DOM + 天空，隐藏全部雨效层） */
let bgShot = null;
try {
  await page.evaluate(() => {
    window.__kayaFreezeFx = true;
    document.querySelectorAll(
      ".site-fx__rain-glass, .site-fx__glass-drops, .site-fx__splash, .site-fx__streak-overlay, .site-bg__heavy, .site-bg__heavy-mist, .site-bg__glass, .site-fx__lightning, .site-fx__thunder-flash"
    ).forEach((el) => {
      el.style.setProperty("display", "none", "important");
      el.style.setProperty("opacity", "0", "important");
      el.style.setProperty("visibility", "hidden", "important");
    });
  });
  await page.waitForTimeout(300);
  bgShot = join(outDir, `${tag}_bg.png`);
  await page.screenshot({ path: bgShot });
} catch (err) {
  console.log("bg screenshot failed", String(err).slice(0, 200));
}

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

writeFileSync(
  join(outDir, `${tag}.json`),
  JSON.stringify({ status, logs, info, url, width, height, glassShot, bgShot }, null, 2),
);
console.log("STATUS", status);
console.log("INFO", JSON.stringify(info, null, 2));
console.log("SHOT", shotPath);
console.log("GLASS", glassShot);
console.log("BG", bgShot);
await browser.close();
