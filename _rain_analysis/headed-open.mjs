/**
 * 真实弹出 Chrome（有界面）打开本地页并诊断
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "local");
mkdirSync(outDir, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:3000/?sunny";

const browser = await chromium.launch({
  headless: false,
  channel: "chrome",
  args: [
    "--new-window",
    "--disable-background-timer-throttling",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ignoreHTTPSErrors: true,
});
// 强制不走缓存，避免旧 boot
await context.route("**/*", async (route) => {
  const headers = {
    ...route.request().headers(),
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  await route.continue({ headers });
});

const page = await context.newPage();
const errors = [];
const requests = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("request", (req) => {
  const u = req.url();
  if (u.includes("/js/") || u.includes("/css/") || u.includes("127.0.0.1:3000/") && !u.includes(".")) {
    requests.push(u);
  }
});
page.on("requestfailed", (req) => {
  errors.push(`fail ${req.url()} ${req.failure()?.errorText}`);
});

console.log("Opening", url);
let status = null;
try {
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  status = resp?.status() ?? null;
} catch (e) {
  errors.push(`goto: ${e.message}`);
}

await page.waitForTimeout(4000);

const diag = await page.evaluate(() => {
  const scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
  return {
    title: document.title,
    readyState: document.readyState,
    bodyClass: document.body?.className || "",
    hasKaya: !!window.Kaya,
    hasBootError: !!window.__kayaBootError,
    headerOpacity: document.querySelector(".site-header")
      ? getComputedStyle(document.querySelector(".site-header")).opacity
      : null,
    scripts: scripts.map((s) => s.replace(location.origin, "")),
    href: location.href,
  };
});

const shot = join(outDir, "headed-open.png");
await page.screenshot({ path: shot, fullPage: false });

const report = { url, status, errors, diag, shot, sampleRequests: requests.slice(0, 30) };
writeFileSync(join(outDir, "headed-open.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

// 保持浏览器打开一段时间，方便你看到真实窗口
console.log("Chrome will stay open 25s...");
await page.waitForTimeout(25000);
await browser.close();
process.exit(errors.length || !diag.hasKaya || Number(diag.headerOpacity) === 0 ? 1 : 0);
