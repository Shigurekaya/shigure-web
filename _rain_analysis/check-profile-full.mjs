/** 展开+收回全流程：检测落地/结束时的 Y 轴跳动（阈值 2px） */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3456/?sunny";
const STEP = 20;

function findJumps(arr, threshold = 2) {
  const jumps = [];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].missing || arr[i - 1].missing) continue;
    if (arr[i].h < 8 || arr[i - 1].h < 8) continue;
    const dy = arr[i].y - arr[i - 1].y;
    if (Math.abs(dy) >= threshold) {
      jumps.push({ from: arr[i - 1].ms, to: arr[i].ms, dy: +dy.toFixed(2), before: arr[i - 1], after: arr[i] });
    }
  }
  return jumps;
}

async function sampleAvatar(page, totalMs, startMs = 0) {
  const samples = [];
  for (let ms = startMs; ms <= totalMs; ms += STEP) {
    if (ms > startMs) await page.waitForTimeout(STEP);
    samples.push(await page.evaluate((t) => {
      const av = document.querySelector("#profile-hero .profile-avatar")
        || document.querySelector(".profile-avatar");
      const brand = document.getElementById("brand-avatar");
      if (!av) return { ms: t, missing: true };
      const r = av.getBoundingClientRect();
      const cs = getComputedStyle(av);
      const br = brand?.getBoundingClientRect();
      return {
        ms: t,
        y: Math.round(r.y * 100) / 100,
        cy: Math.round((r.y + r.height / 2) * 100) / 100,
        h: Math.round(r.height * 100) / 100,
        pinned: document.body.classList.contains("is-avatar-pinned"),
        flying: document.body.classList.contains("is-avatar-flying"),
        animating: document.body.classList.contains("profile-animating"),
        open: document.body.classList.contains("profile-open"),
        position: cs.position,
        transition: cs.transitionDuration,
        transitionDur: parseFloat(cs.transitionDuration) || 0,
        transform: cs.transform === "none" ? "none" : cs.transform.slice(0, 48),
        brandY: br ? Math.round(br.y * 100) / 100 : null,
      };
    }, ms));
  }
  return samples;
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.classList.contains("home-ready"), null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(500);

await page.click(".site-header .brand[data-profile-toggle]");
await page.waitForFunction(() => document.body.classList.contains("profile-open"), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(40);
const openSamples = await sampleAvatar(page, 2600);

const releaseMs = openSamples.find((s, i) => i > 0 && openSamples[i - 1].pinned && !s.pinned)?.ms ?? null;
const finishMs = openSamples.find((s, i) => i > 0 && openSamples[i - 1].animating && !s.animating)?.ms ?? null;

const postRelease = openSamples.filter((s) => !s.missing && releaseMs != null && s.ms >= releaseMs && s.ms <= releaseMs + 800);
const postFinish = openSamples.filter((s) => !s.missing && finishMs != null && s.ms >= finishMs - 40 && s.ms <= finishMs + 400);

const openPostReleaseJumps = findJumps(postRelease, 2);
const openPostFinishJumps = findJumps(postFinish, 2);
const openLandingJumps = releaseMs != null
  ? findJumps(openSamples.filter((s) => !s.missing && s.ms >= releaseMs - 60 && s.ms <= releaseMs + 120), 2)
  : [];

await page.waitForTimeout(600);
await page.click(".site-header .brand[data-profile-toggle]");
await page.waitForFunction(() => !document.body.classList.contains("profile-open"), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(40);
const closeSamples = await sampleAvatar(page, 2000);
const closeReleaseMs = closeSamples.find((s, i) => i > 0 && closeSamples[i - 1].pinned && !s.pinned)?.ms ?? null;
const closeFinishMs = closeSamples.find((s, i) => i > 0 && closeSamples[i - 1].animating && !s.animating)?.ms ?? null;
const closeLandingJumps = closeReleaseMs != null
  ? findJumps(closeSamples.filter((s) => !s.missing && s.ms >= closeReleaseMs - 60 && s.ms <= closeReleaseMs + 120), 2)
  : [];
const closePostFinishJumps = closeFinishMs != null
  ? findJumps(closeSamples.filter((s) => !s.missing && s.ms >= closeFinishMs - 40 && s.ms <= closeFinishMs + 400), 2)
  : [];

const report = {
  url,
  open: { releaseMs, finishMs, openLandingJumps, openPostReleaseJumps, openPostFinishJumps, samples: openSamples },
  close: { closeReleaseMs, closeFinishMs, closeLandingJumps, closePostFinishJumps, samples: closeSamples },
};
writeFileSync(join(outDir, "profile-full-diag.json"), JSON.stringify(report, null, 2));

const bad = [
  ...openLandingJumps,
  ...openPostReleaseJumps,
  ...openPostFinishJumps,
  ...closeLandingJumps,
  ...closePostFinishJumps,
];

const openTransitionLeak = openSamples.filter((s) => !s.missing && s.flying && s.transitionDur > 0.01);

console.log(JSON.stringify({
  releaseMs,
  finishMs,
  openLandingJumps,
  openPostReleaseJumps,
  openPostFinishJumps,
  closeReleaseMs,
  closeFinishMs,
  closeLandingJumps,
  closePostFinishJumps,
  failCount: bad.length,
  openTransitionLeak: openTransitionLeak.length,
}, null, 2));

await browser.close();
process.exit(bad.length || openTransitionLeak.length ? 1 : 0);
