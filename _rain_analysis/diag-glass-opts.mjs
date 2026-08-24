import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:3012/?rain=heavy";
const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => {
  const glass = document.querySelector(".site-fx__rain-glass");
  const opts = window.__kayaGlassOpts || null;
  return {
    glassOn: glass?.classList.contains("is-on"),
    body: document.body.className,
    opts,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "_rain_analysis/local/heavy-desktop-diag.png", fullPage: false });
await browser.close();
