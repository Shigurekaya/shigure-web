/** 检测头像展开全过程 Y 轴是否跳动（含落地后 1.5s） */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3456/?sunny";

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => document.body.classList.contains("home-ready"), null, { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(500);

await page.click(".site-header .brand[data-profile-toggle]");

const samples = [];
for (let ms = 0; ms <= 2000; ms += 40) {
  if (ms > 0) await page.waitForTimeout(40);
  samples.push(await page.evaluate((t) => {
    const av = document.querySelector("#profile-hero .profile-avatar")
      || document.querySelector(".profile-avatar");
    const hero = document.getElementById("profile-hero");
    const name = document.querySelector(".profile-name");
    if (!av) return { ms: t, missing: true };
    const r = av.getBoundingClientRect();
    const cs = getComputedStyle(av);
    const m = cs.transform !== "none" ? new DOMMatrixReadOnly(cs.transform) : null;
    return {
      ms: t,
      pinned: document.body.classList.contains("is-avatar-pinned"),
      flying: document.body.classList.contains("is-avatar-flying"),
      animating: document.body.classList.contains("profile-animating"),
      heroH: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
      y: Math.round(r.y),
      cy: Math.round(r.y + r.height / 2),
      h: Math.round(r.height),
      position: cs.position,
      transform: cs.transform === "none" ? "none" : cs.transform.slice(0, 40),
      tx: m ? Math.round(m.m41) : 0,
      nameY: name ? Math.round(name.getBoundingClientRect().y) : null,
    };
  }, ms));
}

function findJumps(arr, threshold = 6) {
  const jumps = [];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].missing || arr[i - 1].missing) continue;
    if (arr[i].h < 8 || arr[i - 1].h < 8) continue;
    const dy = arr[i].y - arr[i - 1].y;
    if (Math.abs(dy) >= threshold) {
      jumps.push({ from: arr[i - 1].ms, to: arr[i].ms, dy, before: arr[i - 1], after: arr[i] });
    }
  }
  return jumps;
}

const postStable = samples.filter((s) => s.ms >= 720 && s.ms <= 2000 && !s.missing);
const postJumps = findJumps(postStable, 2);
const landingWindow = samples.filter((s) => !s.missing && s.ms >= 620 && s.ms <= 900);
const landingJumps = findJumps(landingWindow, 2);
const allJumps = findJumps(samples.filter((s) => !s.missing), 8);

const report = { url, samples, allJumps, postJumps, landingJumps };
writeFileSync(join(outDir, "profile-y-jumps.json"), JSON.stringify(report, null, 2));

console.log(JSON.stringify({
  totalSamples: samples.length,
  postStableY: postStable.map((s) => ({ ms: s.ms, y: s.y, pinned: s.pinned, animating: s.animating })),
  postJumps,
  landingJumps,
  allJumps: allJumps.slice(0, 8),
}, null, 2));

await browser.close();
const bad = postJumps.length + landingJumps.length;
process.exit(bad ? 1 : 0);
