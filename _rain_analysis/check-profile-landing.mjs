/** 严格检测头像落地窗口（680–800ms）中心点位移，阈值 1px */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3456/?sunny";
const modes = process.argv.slice(3);

async function sampleOpen(page) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.body.classList.contains("home-ready"), null, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.click(".site-header .brand[data-profile-toggle]");

  const samples = [];
  for (let ms = 0; ms <= 2400; ms += 20) {
    if (ms > 0) await page.waitForTimeout(20);
    samples.push(await page.evaluate((t) => {
      const av = document.querySelector("#profile-hero .profile-avatar");
      if (!av) return { ms: t, missing: true };
      const r = av.getBoundingClientRect();
      return {
        ms: t,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        pinned: document.body.classList.contains("is-avatar-pinned"),
        flying: document.body.classList.contains("is-avatar-flying"),
        animating: document.body.classList.contains("profile-animating"),
        position: getComputedStyle(av).position,
        transform: getComputedStyle(av).transform,
      };
    }, ms));
  }

  await page.click(".site-header .brand[data-profile-toggle]");
  await page.waitForTimeout(900);

  const closed = await page.evaluate(() => {
    const av = document.querySelector("#profile-hero .profile-avatar");
    const brand = document.getElementById("brand-avatar");
    const ar = av?.getBoundingClientRect();
    const br = brand?.getBoundingClientRect();
    return {
      open: document.body.classList.contains("profile-open"),
      avatar: ar ? { w: ar.width, h: ar.height, x: ar.x, y: ar.y } : null,
      brand: br ? { w: br.width, h: br.height, x: br.x, y: br.y } : null,
    };
  });

  return { samples, closed };
}

function findJumps(arr, threshold = 1, fromMs = 0, toMs = Infinity) {
  const jumps = [];
  for (let i = 1; i < arr.length; i++) {
    const a = arr[i - 1];
    const b = arr[i];
    if (a.missing || b.missing) continue;
    if (a.ms < fromMs || b.ms > toMs) continue;
    if (a.h < 8 || b.h < 8) continue;
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    if (Math.abs(dx) >= threshold || Math.abs(dy) >= threshold) {
      jumps.push({ from: a.ms, to: b.ms, dx: +dx.toFixed(2), dy: +dy.toFixed(2), before: a, after: b });
    }
  }
  return jumps;
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const { samples, closed } = await sampleOpen(page);

const landing = findJumps(samples, 1, 680, 820);
const postStable = findJumps(samples, 1, 720, 2400);
const report = { url, landing, postStable, closed, tail: samples.filter((s) => s.ms >= 700 && s.ms <= 1300) };
writeFileSync(join(outDir, "profile-landing.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify({ landing, postStable, closed }, null, 2));

await browser.close();
process.exit(landing.length + postStable.length ? 1 : 0);
