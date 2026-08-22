/**
 * 小雨优化前后对比：CPU 节流模拟旧机，采样 RAF FPS + jank
 */
import { chromium } from "playwright";
import {
  copyFileSync, readFileSync, writeFileSync, mkdirSync, existsSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const lightPath = join(root, "js", "light-rain.js");
const backupPath = join(__dirname, "local", "light-rain.backup.js");
const originPath = join(__dirname, "local", "light-rain.origin.js");
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3000/?rain=light";
const throttle = Number(process.argv[3] || 4);

const SKIP = () => {
  document.body.classList.remove("is-intro", "home-intro-playing");
  document.documentElement.classList.remove("is-intro");
  const intro = document.getElementById("home-intro");
  if (intro) intro.style.display = "none";
};

const measureFps = async () => {
  const samples = [];
  let last = performance.now();
  await new Promise((resolve) => {
    const t0 = performance.now();
    const loop = (now) => {
      const dt = now - last;
      last = now;
      if (dt > 0 && dt < 250) samples.push(1000 / dt);
      if (now - t0 > 4000 || samples.length > 180) resolve();
      else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  samples.sort((a, b) => a - b);
  const avg = samples.reduce((s, v) => s + v, 0) / Math.max(1, samples.length);
  const p50 = samples[Math.floor(samples.length * 0.5)] || 0;
  const p10 = samples[Math.floor(samples.length * 0.1)] || 0;
  const jank = samples.filter((f) => f < 24).length / Math.max(1, samples.length);
  return {
    n: samples.length,
    avg: Math.round(avg * 10) / 10,
    p50: Math.round(p50 * 10) / 10,
    p10: Math.round(p10 * 10) / 10,
    jankPct: Math.round(jank * 1000) / 10,
  };
};

async function sample(label) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
  });
  await context.route(/light-rain\.js/, (route) => route.fetch({ bypassCache: true }).then((res) => route.fulfill({ response: res })));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`${url}&bench=${label}&t=${Date.now()}`, {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.evaluate(SKIP);
  await page.waitForTimeout(2800);
  let fps = null;
  try {
    fps = await page.evaluate(measureFps);
  } catch (e) {
    errors.push(String(e));
  }
  await browser.close();
  return { label, fps, errors };
}

copyFileSync(lightPath, backupPath);
let hasOrigin = false;
try {
  writeFileSync(
    originPath,
    execSync("git show origin/main:js/light-rain.js", {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
    }),
  );
  hasOrigin = existsSync(originPath);
} catch {
  hasOrigin = false;
}

async function runVariant(label, src) {
  writeFileSync(lightPath, readFileSync(src));
  await new Promise((r) => setTimeout(r, 400));
  return sample(label);
}

const baseline = hasOrigin ? await runVariant("origin-main", originPath) : null;
const optimized = await runVariant("optimized", backupPath);
writeFileSync(lightPath, readFileSync(backupPath));

const report = {
  url,
  cpuThrottle: `${throttle}x`,
  baseline: baseline?.fps ?? null,
  optimized: optimized.fps,
  errors: [...(baseline?.errors || []), ...optimized.errors],
  delta: baseline?.fps && optimized.fps
    ? {
      avg: Math.round((optimized.fps.avg - baseline.fps.avg) * 10) / 10,
      p50: Math.round((optimized.fps.p50 - baseline.fps.p50) * 10) / 10,
      jankPct: Math.round((baseline.fps.jankPct - optimized.fps.jankPct) * 10) / 10,
    }
    : null,
};

writeFileSync(join(outDir, "light-bench.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const ok = optimized.errors.length === 0
  && optimized.fps
  && optimized.fps.avg >= 24
  && optimized.fps.jankPct <= 20
  && (!baseline?.fps || optimized.fps.avg >= baseline.fps.avg * 0.95);
process.exit(ok ? 0 : 1);
