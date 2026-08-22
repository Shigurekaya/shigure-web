/**
 * 导出彩虹图层（黑底）用于与参考图对比弧线路径
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3000/?sunny";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => {
  document.getElementById("home-intro")?.remove();
  document.body.classList.add("home-ready");
});
await page.waitForTimeout(2800);

const diag = await page.evaluate(() => {
  const c = document.querySelector(".site-bg__sunny");
  if (!c) return { ok: false };
  const ctx = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  const sky = ctx.getImageData(0, 0, w, h);
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const o = off.getContext("2d");
  o.fillStyle = "#000";
  o.fillRect(0, 0, w, h);
  o.putImageData(sky, 0, 0);
  const id = "rainbow-shape-export";
  let ex = document.getElementById(id);
  if (!ex) {
    ex = document.createElement("canvas");
    ex.id = id;
    ex.style.cssText = "position:fixed;inset:0;z-index:99999;pointer-events:none";
    document.body.appendChild(ex);
  }
  ex.width = w;
  ex.height = h;
  ex.style.width = `${c.clientWidth}px`;
  ex.style.height = `${c.clientHeight}px`;
  ex.getContext("2d").drawImage(off, 0, 0);
  return { ok: true, w, h };
});

const shot = join(outDir, "rainbow-on-black.png");
await page.screenshot({ path: shot, fullPage: false });
writeFileSync(join(outDir, "rainbow-shape.json"), JSON.stringify({ url, diag, shot }, null, 2));
console.log(JSON.stringify({ url, diag, shot }, null, 2));
await browser.close();
