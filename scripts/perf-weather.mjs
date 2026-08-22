/**
 * 天气特效 FPS 基准：sunny / light / heavy
 * 用法：node scripts/perf-weather.mjs [baseUrl]
 */
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
const modes = [
  { name: "sunny", path: "/?rain=sunny" },
  { name: "light", path: "/?rain=light" },
  { name: "heavy", path: "/?rain=heavy" },
];

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
});

const results = [];

for (const mode of modes) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
  });
  const url = `${base}${mode.path}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    document.body.classList.remove("is-intro", "home-intro-playing");
    document.documentElement.classList.remove("is-intro");
    document.querySelectorAll(".home-intro, .intro-overlay").forEach((el) => {
      el.style.display = "none";
    });
  });
  await page.waitForTimeout(mode.name === "heavy" ? 6000 : 2500);

  const stats = await page.evaluate(async () => {
    const samples = [];
    let frames = 0;
    let last = performance.now();
    const budget = 3500;
    await new Promise((resolve) => {
      const tick = (now) => {
        frames += 1;
        const dt = now - last;
        last = now;
        if (dt > 0 && dt < 200) samples.push(1000 / dt);
        if (now - performance.timing.navigationStart > budget || frames > 180) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    samples.sort((a, b) => a - b);
    const avg = samples.reduce((s, v) => s + v, 0) / Math.max(1, samples.length);
    const p50 = samples[Math.floor(samples.length * 0.5)] || 0;
    const p10 = samples[Math.floor(samples.length * 0.1)] || 0;
    const jank = samples.filter((f) => f < 24).length;
    return {
      frames,
      avg: Math.round(avg * 10) / 10,
      p50: Math.round(p50 * 10) / 10,
      p10: Math.round(p10 * 10) / 10,
      jankPct: Math.round((jank / Math.max(1, samples.length)) * 1000) / 10,
    };
  });

  results.push({ mode: mode.name, ...stats });
  console.log(`[${mode.name}] avg=${stats.avg} p50=${stats.p50} p10=${stats.p10} jank<24fps=${stats.jankPct}%`);
  await page.close();
}

await browser.close();
console.log("\n--- summary ---");
for (const r of results) {
  console.log(`${r.mode.padEnd(6)} avg ${String(r.avg).padStart(5)} fps | p50 ${String(r.p50).padStart(5)} | jank ${r.jankPct}%`);
}
