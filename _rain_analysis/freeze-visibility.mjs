/**
 * 复现：切后台再回来，主线程是否卡死
 * 用法：
 *   node _rain_analysis/freeze-visibility.mjs
 *   $env:RAIN_URL="http://127.0.0.1:3000/?rain=heavy"; node ...
 */
import { chromium } from "playwright";

const BASE = process.env.RAIN_URL || "http://127.0.0.1:3000/?rain=heavy";
const HIDDEN_MS = Number(process.env.HIDDEN_MS || 3000);
const modes = (process.env.RAIN_MODES || "light,heavy,storm").split(",").map((s) => s.trim());

function urlFor(mode) {
  const u = new URL(BASE);
  u.searchParams.set("rain", mode);
  return u.toString();
}

async function probeClickable(page) {
  return page.evaluate(async () => {
    const t0 = performance.now();
    let longTasks = 0;
    let maxBlock = 0;
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks += 1;
        maxBlock = Math.max(maxBlock, e.duration);
      }
    });
    try { obs.observe({ type: "longtask", buffered: false }); } catch { /* ignore */ }

    // 主线程心跳：若 2s 内 rAF 几乎不动 → 卡死
    let frames = 0;
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        frames += 1;
        if (now - start > 2000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const brand = document.querySelector(".brand, .menu-toggle, a");
    let clickOk = false;
    if (brand) {
      const before = performance.now();
      brand.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      clickOk = performance.now() - before < 500;
    }

    obs.disconnect();
    const elapsed = performance.now() - t0;
    return {
      frames,
      fps: frames / 2,
      elapsed: Math.round(elapsed),
      longTasks,
      maxBlock: Math.round(maxBlock),
      clickOk,
      bodyClass: document.body.className,
      hidden: document.hidden,
      hasSiteFx: !!document.querySelector(".site-fx"),
      glassOn: !!document.querySelector(".site-fx__rain-glass.is-on"),
    };
  });
}

async function runMode(browser, mode) {
  const page = await browser.newPage();
  const url = urlFor(mode);
  const log = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || /kaya|watchdog|context/i.test(msg.text())) {
      log.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => log.push(`[pageerror] ${err.message}`));

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => document.body.classList.contains("home-ready")
      || document.body.classList.contains("page-ready")
      || document.body.classList.contains("home-revealed"),
    { timeout: 15000 },
  ).catch(() => {});
  await page.waitForTimeout(2500);

  const before = await probeClickable(page);

  // 模拟切到其它标签
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(HIDDEN_MS);

  // 切回来
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  // 恢复后立刻测 + 再等 2s 测（覆盖 1.5s 后重启 capture 的窗口）
  const after0 = await probeClickable(page);
  await page.waitForTimeout(2000);
  const after2 = await probeClickable(page);

  // 真实 CDP 后台（更接近浏览器）
  const client = await page.context().newCDPSession(page);
  await client.send("Page.setWebLifecycleState", { state: "frozen" }).catch(async () => {
    await page.evaluate(() => document.dispatchEvent(new Event("freeze")));
  });
  await page.waitForTimeout(1500);
  await client.send("Page.setWebLifecycleState", { state: "active" }).catch(async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("resume"));
    });
  });
  await page.waitForTimeout(800);
  const afterCdp = await probeClickable(page);

  await page.close();

  const stuck = (p) => p.frames < 20 || p.fps < 8 || p.maxBlock > 1200 || !p.clickOk;
  return {
    mode,
    url,
    before,
    after0,
    after2,
    afterCdp,
    stuck: stuck(after0) || stuck(after2) || stuck(afterCdp),
    log: log.slice(-20),
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const mode of modes) {
  try {
    results.push(await runMode(browser, mode));
  } catch (err) {
    results.push({ mode, error: String(err), stuck: true });
  }
}
await browser.close();

console.log(JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.stuck);
process.exit(bad.length ? 2 : 0);
