/**
 * 仅测小雨 / 晴天（真实 Chrome channel）
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const base = process.argv[2] || "http://127.0.0.1:3000";
const cases = [
  { name: "sunny", url: `${base}/?sunny` },
  { name: "light", url: `${base}/?rain=light` },
];

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});

const results = [];

for (const c of cases) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (!u.includes("favicon")) failed.push({ url: u, err: req.failure()?.errorText || "fail" });
  });

  const t0 = Date.now();
  await page.goto(c.url, { waitUntil: "networkidle", timeout: 45000 });
  const navMs = Date.now() - t0;

  try {
    await page.waitForFunction(
      () => document.body.classList.contains("home-ready") || document.body.classList.contains("page-ready"),
      { timeout: 15000 },
    );
  } catch {
    errors.push("timeout waiting for ready class");
  }

  await page.waitForTimeout(2500);

  const diag = await page.evaluate(async () => {
    const samples = [];
    let last = performance.now();
    await new Promise((resolve) => {
      const t0 = performance.now();
      const loop = (now) => {
        const dt = now - last;
        last = now;
        if (dt > 0 && dt < 250) samples.push(1000 / dt);
        if (now - t0 > 2500 || samples.length > 100) resolve();
        else requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    samples.sort((a, b) => a - b);
    const avg = samples.reduce((s, v) => s + v, 0) / Math.max(1, samples.length);
    const jank = samples.filter((f) => f < 24).length / Math.max(1, samples.length);

    const header = document.querySelector(".site-header");
    const headerOp = header ? getComputedStyle(header).opacity : null;
    const scripts = [...document.scripts].map((s) => s.src.replace(location.origin, "")).filter(Boolean);
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href.replace(location.origin, ""));

    return {
      bodyClass: document.body.className,
      hasKaya: !!window.Kaya,
      sessionRain: sessionStorage.getItem("kaya-rain-mode"),
      headerOpacity: headerOp,
      scriptCount: scripts.length,
      scripts,
      styles,
      hasLight: !!window.KayaLightRain,
      hasSunny: !!window.KayaSunnySky,
      hasHeavy: !!window.KayaHeavyRain,
      lightStats: window.__KayaLightRainStats?.() ?? null,
      sunnyStats: window.__KayaSunnyStats?.() ?? null,
      rainEl: (() => {
        const el = document.querySelector(".site-bg__rain, .site-bg__sunny-scene, .site-bg__sunny");
        if (!el) return null;
        return { tag: el.tagName, className: el.className, w: el.width || null, h: el.height || null };
      })(),
      fps: {
        avg: Math.round(avg * 10) / 10,
        p50: Math.round((samples[Math.floor(samples.length * 0.5)] || 0) * 10) / 10,
        jankPct: Math.round(jank * 1000) / 10,
      },
      mem: performance.memory
        ? {
            usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
            totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576),
          }
        : null,
    };
  });

  const shot = join(outDir, `only-${c.name}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  results.push({ name: c.name, url: c.url, navMs, errors, failed, diag, shot });
  await page.close();
}

await browser.close();
writeFileSync(join(outDir, "only-light-sunny.json"), JSON.stringify({ base, at: new Date().toISOString(), results }, null, 2));

for (const r of results) {
  console.log(`\n=== ${r.name} ${r.navMs}ms ===`);
  console.log("errors:", r.errors.length ? r.errors : "none");
  console.log("failed:", r.failed.length ? r.failed : "none");
  console.log("body:", r.diag.bodyClass);
  console.log("header opacity:", r.diag.headerOpacity, "Kaya:", r.diag.hasKaya);
  console.log("has light/sunny/heavy:", r.diag.hasLight, r.diag.hasSunny, r.diag.hasHeavy);
  console.log("scripts:", r.diag.scriptCount, r.diag.scripts.map((s) => s.split("/").pop()).join(", "));
  console.log("fps:", r.diag.fps, "mem:", r.diag.mem);
  console.log("fx:", r.diag.lightStats || r.diag.sunnyStats || null);
  console.log("rainEl:", r.diag.rainEl);
}

const bad = results.some((r) => r.errors.length || !r.diag.hasKaya || Number(r.diag.headerOpacity) === 0);
process.exit(bad ? 1 : 0);
