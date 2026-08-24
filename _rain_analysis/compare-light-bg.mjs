/**
 * 对比小雨静态背景与原版 CSS 背景的亮度/色差
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const base = process.argv[2] || "http://127.0.0.1:3000";
const outDir = path.dirname(fileURLToPath(import.meta.url));

const sampleBg = async (page, label) => {
  await page.goto(`${base}/?rain=light&homeintro=0`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    document.body.classList.remove("home-intro-playing");
    document.getElementById("home-intro")?.remove();
  });
  await page.waitForTimeout(2500);

  if (label === "reference") {
    await page.evaluate(() => {
      document.body.classList.remove("kaya-ambient-eco");
      document.querySelector(".site-bg__light-scene")?.remove();
      const host = document.querySelector(".site-bg");
      const rain = document.querySelector(".site-bg__rain");
      if (rain) rain.style.visibility = "hidden";
      if (host && !host.querySelector(".site-bg__light-mist")) {
        const mist = document.createElement("div");
        mist.className = "site-bg__light-mist";
        mist.setAttribute("aria-hidden", "true");
        mist.style.opacity = "1";
        host.appendChild(mist);
      }
    });
  } else {
    await page.evaluate(() => {
      const rain = document.querySelector(".site-bg__rain");
      if (rain) rain.style.visibility = "hidden";
    });
  }

  await page.waitForTimeout(500);
  const shot = path.join(outDir, "local", `light-bg-${label}.png`);
  await page.locator(".site-bg").screenshot({ path: shot });

  const stats = await page.evaluate(() => {
    const host = document.querySelector(".site-bg");
    if (!host) return null;
    const r = host.getBoundingClientRect();
    const c = document.createElement("canvas");
    const w = Math.min(320, Math.floor(r.width));
    const h = Math.min(180, Math.floor(r.height));
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    // html2canvas 不可用，用背景色近似：读 computed style 采样点
    const pts = [
      [0.5, 0.2], [0.2, 0.5], [0.8, 0.4], [0.5, 0.75],
    ];
    const samples = pts.map(([px, py]) => {
      const el = document.elementFromPoint(r.left + r.width * px, r.top + r.height * py);
      const bg = el ? getComputedStyle(el).backgroundColor : "rgba(0,0,0,0)";
      return { px, py, bg, tag: el?.className || el?.tagName };
    });
    return { w, h, samples };
  });

  return { label, shot, stats };
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const current = await sampleBg(page, "current");
const reference = await sampleBg(await browser.newPage({ viewport: { width: 1280, height: 720 } }), "reference");

await browser.close();

const report = { at: new Date().toISOString(), current, reference };
const out = path.join(outDir, "local", "light-bg-compare.json");
writeFileSync(out, JSON.stringify(report, null, 2));
console.log("Report:", out);
console.log("Screenshots:", current.shot, reference.shot);
