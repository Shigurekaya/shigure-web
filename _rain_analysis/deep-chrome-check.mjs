/**
 * 真机 Chromium 深度检查：多页面 / 多天气 / JS 错误 / 关键资源 / FPS
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
  { name: "home-sunny", url: `${base}/?sunny` },
  { name: "home-light", url: `${base}/?rain=light` },
  { name: "home-heavy", url: `${base}/?rain=heavy` },
  { name: "home-storm", url: `${base}/?rain=storm` },
  { name: "works-light", url: `${base}/works/?rain=light` },
  { name: "links-light", url: `${base}/links/?rain=light` },
  { name: "mv-light", url: `${base}/mv-materials/?rain=light` },
];

const browser = await chromium.launch({
  headless: true,
  channel: process.env.CHROME_CHANNEL || undefined,
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
  const consoleWarn = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
    if (msg.type() === "warning") consoleWarn.push(msg.text());
  });
  page.on("requestfailed", (req) => {
    failed.push({ url: req.url(), err: req.failure()?.errorText || "fail" });
  });

  const t0 = Date.now();
  let gotoOk = true;
  try {
    await page.goto(c.url, { waitUntil: "networkidle", timeout: 45000 });
  } catch (e) {
    gotoOk = false;
    errors.push(`goto: ${e.message}`);
  }
  const navMs = Date.now() - t0;

  // wait for boot + init
  try {
    await page.waitForFunction(() => {
      const b = document.body;
      return b.classList.contains("home-ready")
        || b.classList.contains("page-ready")
        || !!window.__kayaBootError;
    }, { timeout: 15000 });
  } catch {
    errors.push("timeout waiting for home-ready/page-ready");
  }

  await page.waitForTimeout(2200);

  const diag = await page.evaluate(async () => {
    const body = document.body;
    const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    const rainCanvas = document.querySelector(".site-bg__rain, .site-bg__sunny, .site-bg__sunny--dyn, .site-bg__sunny-scene");
    const fx = document.querySelector(".site-fx");
    const intro = document.getElementById("home-intro");

    // sample rAF fps briefly
    const samples = [];
    let last = performance.now();
    await new Promise((resolve) => {
      const t0 = performance.now();
      const loop = (now) => {
        const dt = now - last;
        last = now;
        if (dt > 0 && dt < 250) samples.push(1000 / dt);
        if (now - t0 > 2000 || samples.length > 90) resolve();
        else requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    samples.sort((a, b) => a - b);
    const avg = samples.reduce((s, v) => s + v, 0) / Math.max(1, samples.length);
    const jank = samples.filter((f) => f < 24).length / Math.max(1, samples.length);

    const visibleHeader = (() => {
      const el = document.querySelector(".site-header, .brand");
      if (!el) return null;
      const st = getComputedStyle(el);
      return { opacity: st.opacity, display: st.display, visibility: st.visibility };
    })();

    return {
      bodyClass: body.className,
      hasKaya: !!window.Kaya,
      hasRainMode: !!window.KayaRainMode,
      hasLight: !!window.KayaLightRain,
      hasHeavy: !!window.KayaHeavyRain,
      hasSunny: !!window.KayaSunnySky,
      hasStorm: !!window.KayaStormLightning,
      sessionRain: sessionStorage.getItem("kaya-rain-mode"),
      scriptCount: scripts.length,
      scripts: scripts.map((u) => u.replace(location.origin, "")),
      styleCount: styles.length,
      styles: styles.map((u) => u.replace(location.origin, "")),
      rainCanvas: rainCanvas
        ? {
            tag: rainCanvas.tagName,
            className: rainCanvas.className,
            w: rainCanvas.width || null,
            h: rainCanvas.height || null,
          }
        : null,
      fxActive: fx?.classList.contains("is-active") || false,
      introGone: !intro || intro.classList.contains("is-done") || intro.style.display === "none",
      visibleHeader,
      lightStats: window.__KayaLightRainStats?.() ?? null,
      sunnyStats: window.__KayaSunnyStats?.() ?? null,
      heavyStats: window.__KayaHeavyRainStats?.() ?? null,
      fps: {
        avg: Math.round(avg * 10) / 10,
        p50: Math.round((samples[Math.floor(samples.length * 0.5)] || 0) * 10) / 10,
        jankPct: Math.round(jank * 1000) / 10,
        n: samples.length,
      },
      mem: performance.memory
        ? {
            usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
            totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576),
          }
        : null,
    };
  });

  const shot = join(outDir, `deep-${c.name}.png`);
  await page.screenshot({ path: shot, fullPage: false });

  results.push({
    name: c.name,
    url: c.url,
    gotoOk,
    navMs,
    errors,
    failed: failed.filter((f) => !f.url.includes("favicon")),
    consoleWarn: consoleWarn.slice(0, 8),
    diag,
    shot,
  });

  await page.close();
}

await browser.close();

const report = {
  base,
  at: new Date().toISOString(),
  results,
  summary: {
    cases: results.length,
    withErrors: results.filter((r) => r.errors.length).map((r) => r.name),
    hiddenUi: results.filter((r) => r.diag.visibleHeader && Number(r.diag.visibleHeader.opacity) === 0).map((r) => r.name),
    noKaya: results.filter((r) => !r.diag.hasKaya).map((r) => r.name),
    heavyish: results.filter((r) => /heavy|storm/.test(r.diag.bodyClass)).map((r) => ({
      name: r.name,
      fps: r.diag.fps,
      mem: r.diag.mem,
      scripts: r.diag.scriptCount,
    })),
  },
};

writeFileSync(join(outDir, "deep-chrome-check.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
for (const r of results) {
  console.log(`\n=== ${r.name} (${r.navMs}ms) ===`);
  console.log("errors:", r.errors.length ? r.errors : "none");
  console.log("failed:", r.failed.length ? r.failed : "none");
  console.log("body:", r.diag.bodyClass);
  console.log("Kaya:", r.diag.hasKaya, "session:", r.diag.sessionRain);
  console.log("header opacity:", r.diag.visibleHeader?.opacity);
  console.log("scripts:", r.diag.scriptCount, "styles:", r.diag.styleCount);
  console.log("fps:", r.diag.fps, "mem:", r.diag.mem);
  console.log("rain:", r.diag.rainCanvas, "fx:", r.diag.fxActive);
}

const bad = results.some((r) => r.errors.length || !r.diag.hasKaya || Number(r.diag.visibleHeader?.opacity) === 0);
process.exit(bad ? 1 : 0);
