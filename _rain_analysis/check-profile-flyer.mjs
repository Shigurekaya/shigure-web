/**
 * 自检：主页「榧」展开时 avatar-flyer 是否真正移动
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3456/?rain=storm";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

// 跳过开场
await page.waitForFunction(() => document.body.classList.contains("home-ready"), null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(800);

const pre = await page.evaluate(() => ({
  hasReveal: !!window.KayaProfileReveal,
  isLite: (() => {
    if (window.KayaPerfGovernor?.isPhoneLike?.()) return "phone";
    if (window.matchMedia("(max-width: 720px)").matches) return "width";
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return "data";
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return "cores";
    return false;
  })(),
  cores: navigator.hardwareConcurrency,
  reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  bodyClass: document.body.className,
}));

await page.click(".site-header .brand[data-profile-toggle]");
await page.waitForTimeout(50);

const samples = [];
for (let t = 0; t <= 800; t += 50) {
  if (t > 0) await page.waitForTimeout(50);
  samples.push(await page.evaluate(() => {
    const flyer = document.getElementById("avatar-flyer");
    const brand = document.getElementById("brand-avatar");
    const hero = document.querySelector("#profile-hero .profile-avatar");
    const fr = flyer?.getBoundingClientRect();
    const br = brand?.getBoundingClientRect();
    const hr = hero?.getBoundingClientRect();
    const cs = flyer ? getComputedStyle(flyer) : null;
    return {
      t: performance.now(),
      flying: document.body.classList.contains("is-avatar-flying"),
      animating: document.body.classList.contains("profile-animating"),
      flyer: fr ? {
        x: Math.round(fr.left),
        y: Math.round(fr.top),
        w: Math.round(fr.width),
        h: Math.round(fr.height),
        opacity: cs?.opacity,
        visibility: cs?.visibility,
        transform: cs?.transform,
      matrixTx: cs?.transform && cs.transform !== "none"
        ? Math.round(new DOMMatrixReadOnly(cs.transform).m41)
        : 0,
        display: cs?.display,
        isOn: flyer.classList.contains("is-on"),
      } : null,
      brand: br ? { x: Math.round(br.left), y: Math.round(br.top), w: Math.round(br.width), opacity: getComputedStyle(brand).opacity } : null,
      hero: hr ? { x: Math.round(hr.left), y: Math.round(hr.top), w: Math.round(hr.width), opacity: getComputedStyle(hero).opacity, vis: getComputedStyle(hero).visibility } : null,
    };
  }));
}

const post = await page.evaluate(() => ({
  bodyClass: document.body.className,
  busy: window.KayaProfileReveal?.isBusy?.(),
  open: window.KayaProfileReveal?.isOpen?.(),
}));

const report = { url, pre, samples, post, errors };
writeFileSync(join(outDir, "profile-flyer-diag.json"), JSON.stringify(report, null, 2));

const flyerSamples = samples.filter((s) => s.flyer?.isOn);
const xs = flyerSamples.map((s) => s.flyer?.x).filter((v) => v != null);
const ys = flyerSamples.map((s) => s.flyer?.y).filter((v) => v != null);
const txs = flyerSamples.map((s) => s.flyer?.matrixTx).filter((v) => v != null);
const moved = (xs.length >= 2 && (Math.max(...xs) - Math.min(...xs) > 8 || Math.max(...ys) - Math.min(...ys) > 8))
  || (txs.length >= 2 && Math.max(...txs) - Math.min(...txs) > 8);

console.log(JSON.stringify({
  pre,
  post,
  errors,
  flyerVisibleFrames: flyerSamples.length,
  xRange: xs.length ? [Math.min(...xs), Math.max(...xs)] : null,
  yRange: ys.length ? [Math.min(...ys), Math.max(...ys)] : null,
  moved,
  firstSample: samples[0],
  midSample: samples[4],
  lastSample: samples[samples.length - 1],
}, null, 2));

await browser.close();
process.exit(moved ? 0 : 1);
