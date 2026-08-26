/** 实时检测：profile-avatar 展开过程位置 / 缩放 */
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
await page.waitForTimeout(600);

const pre = await page.evaluate(() => {
  const brand = document.getElementById("brand-avatar");
  const av = document.querySelector("#profile-hero .profile-avatar");
  const img = document.getElementById("hero-avatar");
  return {
    brand: brand?.getBoundingClientRect().toJSON(),
    avatar: av?.getBoundingClientRect().toJSON(),
    img: img?.getBoundingClientRect().toJSON(),
  };
});

await page.click(".site-header .brand[data-profile-toggle]");

const samples = [];
for (let i = 0; i <= 20; i++) {
  if (i > 0) await page.waitForTimeout(i <= 16 ? 50 : 100);
  samples.push(await page.evaluate((ms) => {
    const av = document.querySelector("#profile-hero .profile-avatar");
    const img = document.getElementById("hero-avatar");
    const brand = document.getElementById("brand-avatar");
    const hero = document.getElementById("profile-hero");
    if (!av) return null;
    const cs = getComputedStyle(av);
    const m = cs.transform !== "none" ? new DOMMatrixReadOnly(cs.transform) : null;
    const r = av.getBoundingClientRect();
    const ir = img?.getBoundingClientRect();
    return {
      ms,
      pinned: document.body.classList.contains("is-avatar-pinned"),
      flying: document.body.classList.contains("is-avatar-flying"),
      heroH: hero ? Math.round(hero.getBoundingClientRect().height) : 0,
      wrap: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      img: ir ? { x: Math.round(ir.x), y: Math.round(ir.y), w: Math.round(ir.width), h: Math.round(ir.height) } : null,
      brandVis: brand ? Math.round(brand.getBoundingClientRect().width) : 0,
      position: cs.position,
      left: cs.left,
      top: cs.top,
      transform: cs.transform,
      tx: m ? Math.round(m.m41) : 0,
      ty: m ? Math.round(m.m42) : 0,
      scale: m ? +m.a.toFixed(3) : 1,
    };
  }, i <= 16 ? 50 : 100));
  samples.push(await page.evaluate((ms) => {
    const name = document.querySelector(".profile-name");
    const roman = document.querySelector(".profile-roman");
    const av = document.querySelector("#profile-hero .profile-avatar");
    const ph = document.querySelector(".profile-avatar-placeholder");
    const ncs = name ? getComputedStyle(name) : null;
    return {
      ms,
      pinned: document.body.classList.contains("is-avatar-pinned"),
      placeholder: !!ph,
      nameOpacity: ncs ? ncs.opacity : null,
      nameVis: ncs ? ncs.visibility : null,
      nameY: name ? Math.round(name.getBoundingClientRect().y) : null,
      avatarY: av ? Math.round(av.getBoundingClientRect().y) : null,
    };
  }, 400));
}

const post = await page.evaluate(() => {
  const av = document.querySelector("#profile-hero .profile-avatar");
  const hero = document.getElementById("profile-hero");
  const main = document.querySelector(".home-main");
  const r = av?.getBoundingClientRect();
  const cs = av ? getComputedStyle(av) : null;
  const heroR = hero?.getBoundingClientRect();
  const mainR = main?.getBoundingClientRect();
  const centerX = mainR ? mainR.left + mainR.width / 2 : 640;
  return {
    open: document.body.classList.contains("profile-open"),
    pinned: document.body.classList.contains("is-avatar-pinned"),
    wrap: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    position: cs?.position,
    transform: cs?.transform,
    heroCenter: heroR ? Math.round(heroR.left + heroR.width / 2) : null,
    wrapCenter: r ? Math.round(r.x + r.width / 2) : null,
    pageCenter: Math.round(centerX),
    centerDelta: r ? Math.round((r.x + r.width / 2) - centerX) : null,
  };
});

const report = { pre, samples, post };
writeFileSync(join(outDir, "profile-pin-diag.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ pre, post, mid: samples[8], last: samples[samples.length - 1] }, null, 2));

await browser.close();
const ok = post.centerDelta != null && Math.abs(post.centerDelta) < 40;
process.exit(ok ? 0 : 1);
