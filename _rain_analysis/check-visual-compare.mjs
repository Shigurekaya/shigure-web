/**
 * 对比主页/作品集小雨视觉（像素均值）
 */
import { chromium } from "playwright";
import fs from "fs";

const BASE = process.argv[2] || "http://127.0.0.1:3010";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

async function snap(path, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const state = await page.evaluate(() => ({
    light: document.body.classList.contains("light-rain"),
    heavy: document.body.classList.contains("heavy-rain"),
    eco: document.body.classList.contains("kaya-ambient-eco"),
    scene: !!document.querySelector(".site-bg__light-scene.is-on"),
    siteFx: !!document.querySelector(".site-fx"),
  }));
  const file = `local/${path}.png`;
  await page.screenshot({ path: file, fullPage: false });
  return { file, state };
}

const home = await snap("nav-home-light", `${BASE}/?rain=light`);
const works = await snap("nav-works-light", `${BASE}/works/?rain=light`);
const worksNoParam = await snap("nav-works-noparam", `${BASE}/works/`);

console.log(JSON.stringify({ home, works, worksNoParam }, null, 2));
await browser.close();
