"""Analyze rain-glass canvas pixels via Playwright + uv."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".playwright-browsers"))

from playwright.sync_api import sync_playwright  # noqa: E402

URL = os.environ.get("RAIN_URL", "http://127.0.0.1:3012/?rain=heavy")
W = int(os.environ.get("RAIN_W", "1280"))
H = int(os.environ.get("RAIN_H", "800"))

GLASS_PROBE = """
async () => {
  const glass = document.querySelector('.site-fx__rain-glass');
  if (!glass) return { err: 'no glass el' };
  const ctx = glass.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { err: 'no 2d ctx' };
  const w = glass.width, h = glass.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  let n = 0, sumA = 0, sumL = 0, dark = 0, bright = 0, mid = 0;
  const samples = [];
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 8) continue;
    n += 1;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sumA += a;
    sumL += l;
    if (l < 40) dark += 1;
    else if (l > 200) bright += 1;
    else mid += 1;
  }
  const pick = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const cx = Math.floor(w * 0.5), cy = Math.floor(h * 0.45);
  return {
    w, h, pixels: n, frac: n / (w * h),
    meanA: n ? sumA / n : 0,
    meanL: n ? sumL / n : 0,
    darkFrac: n ? dark / n : 0,
    brightFrac: n ? bright / n : 0,
    midFrac: n ? mid / n : 0,
    center: pick(cx, cy),
    opts: window.__kayaGlassOpts || null,
  };
}
"""

SKIP = "() => { document.body.classList.add('home-ready'); document.getElementById('home-intro')?.remove(); }"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
    )
    page = browser.new_page(viewport={"width": W, "height": H})
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.evaluate(SKIP)
    page.wait_for_timeout(9000)
    stats = page.evaluate(GLASS_PROBE)
    out = ROOT / "local" / f"glass-stats-{W}.json"
    out.write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(json.dumps(stats, indent=2))
    browser.close()
