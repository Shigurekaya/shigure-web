/**
 * 晴天/小雨资源占用探测：画布像素、rAF 数量、层数
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:3000";
const modes = [
  { name: "light", path: "/?rain=light" },
  { name: "sunny", path: "/?rain=sunny" },
];

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});

for (const mode of modes) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${base}${mode.path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    document.body.classList.remove("is-intro", "home-intro-playing");
    document.getElementById("home-intro")?.remove();
  });
  await page.waitForTimeout(3000);

  const probe = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll("canvas")].map((c) => ({
      cls: c.className,
      w: c.width,
      h: c.height,
      px: c.width * c.height,
      css: `${c.clientWidth}x${c.clientHeight}`,
    }));
    const totalPx = canvases.reduce((s, c) => s + c.px, 0);
    const animEls = [...document.querySelectorAll("*")].filter((el) => {
      const s = getComputedStyle(el);
      return s.animationName !== "none" || s.filter !== "none" && s.filter !== "";
    }).length;
    const stats = mode => window.__KayaLightRainStats?.() ?? window.__KayaSunnyStats?.();
    const st = window.__KayaLightRainStats?.() ?? window.__KayaSunnyStats?.() ?? null;
    const tier = window.KayaPerfGovernor?.detectRainTier?.() ?? "?";
    let rafTicks = 0;
    return new Promise((resolve) => {
      const t0 = performance.now();
      const hook = () => {
        rafTicks += 1;
        if (performance.now() - t0 < 2000) requestAnimationFrame(hook);
        else resolve({
          canvases,
          totalPx,
          animEls,
          tier,
          stats: st,
          rafPerSec: Math.round(rafTicks / 2),
          bodyClass: document.body.className,
          webglContexts: (() => {
            try {
              const c = document.createElement("canvas");
              return !!(c.getContext("webgl") || c.getContext("webgl2"));
            } catch { return false; }
          })(),
        });
      };
      requestAnimationFrame(hook);
    });
  });

  const targetFps = probe.stats?.frameMs ? Math.round(1000 / probe.stats.frameMs) : "?";
  const fillMPxPerSec = probe.stats?.frameMs
    ? Math.round((probe.totalPx / 1e6) * (1000 / probe.stats.frameMs) * 10) / 10
    : "?";
  console.log(`\n=== ${mode.name} ===`);
  console.log(`tier=${probe.tier} rAF≈${probe.rafPerSec}/s effectFps≈${targetFps}`);
  console.log(`canvas total ${(probe.totalPx / 1e6).toFixed(2)} Mpx | fill-rate≈${fillMPxPerSec} Mpx/s`);
  console.log(`canvases:`, probe.canvases);
  console.log(`stats:`, probe.stats);
  console.log(`animated/filtered elements: ${probe.animEls}`);
  await page.close();
}

await browser.close();
