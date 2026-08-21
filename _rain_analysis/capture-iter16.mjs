import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = "http://127.0.0.1:3000/?rain=heavy";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});

async function shot(tag, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const logs = [];
  page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.body.classList.remove("is-intro");
    document.querySelectorAll(".home-intro, .intro-overlay").forEach((el) => {
      el.style.display = "none";
    });
  });
  for (let i = 0; i < 48; i++) {
    await page.waitForTimeout(250);
    if (logs.some((l) => l.includes("screen glass ready") || l.includes("demoted"))) break;
  }
  await page.waitForTimeout(4500);
  const opts = await page.evaluate(() => {
    const c = document.querySelector(".site-fx__rain-glass");
    const ov = document.querySelector(".site-fx__streak-overlay");
    // try find raindrop instance via canvas size / dump from window if any
    return {
      body: document.body.className,
      glass: c ? { w: c.width, h: c.height, on: c.classList.contains("is-on"), opacity: getComputedStyle(c).opacity } : null,
      overlay: ov ? { display: getComputedStyle(ov).display, opacity: getComputedStyle(ov).opacity, on: ov.classList.contains("is-on"), w: ov.width, h: ov.height } : null,
    };
  });
  const path = join(outDir, `${tag}.png`);
  await page.screenshot({ path, fullPage: false });
  writeFileSync(join(outDir, `${tag}.json`), JSON.stringify({ logs: logs.slice(0, 20), opts, viewport }, null, 2));
  console.log(tag, opts);
  await page.close();
}

await shot("iter16_desk", { width: 1280, height: 900 });
await shot("iter16_phone", { width: 390, height: 844 });
await browser.close();
