#!/usr/bin/env python3
"""天气特效 FPS 基准：sunny / light / heavy。依赖本地 uv + 项目内 Playwright 浏览器。"""
from __future__ import annotations

import argparse
import statistics
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
MODES = [
    ("sunny", "/?rain=sunny", 2.5),
    ("light", "/?rain=light", 2.5),
    ("heavy", "/?rain=heavy", 6.0),
]

SKIP_INTRO = """
() => {
  document.body.classList.remove('is-intro', 'home-intro-playing');
  document.documentElement.classList.remove('is-intro');
  document.querySelectorAll('.home-intro, .intro-overlay').forEach(el => {
    el.style.display = 'none';
  });
}
"""

MEASURE_JS = """
async () => {
  const samples = [];
  let frames = 0;
  let last = performance.now();
  const start = performance.now();
  const budget = 3500;
  await new Promise(resolve => {
    const tick = now => {
      frames += 1;
      const dt = now - last;
      last = now;
      if (dt > 0 && dt < 200) samples.push(1000 / dt);
      if (now - start > budget || frames > 180) {
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
  const jank = samples.filter(f => f < 24).length;
  return {
    frames,
    avg: Math.round(avg * 10) / 10,
    p50: Math.round(p50 * 10) / 10,
    p10: Math.round(p10 * 10) / 10,
    jankPct: Math.round((jank / Math.max(1, samples.length)) * 1000) / 10,
  };
}
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("base", nargs="?", default="http://127.0.0.1:3000")
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    args = parser.parse_args()
    base = args.base.rstrip("/")

    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
        )
        for name, path, warm in MODES:
            page = browser.new_page(
                viewport={"width": args.width, "height": args.height},
                device_scale_factor=1.5,
            )
            page.goto(f"{base}{path}", wait_until="networkidle", timeout=60_000)
            page.evaluate(SKIP_INTRO)
            time.sleep(warm)
            stats = page.evaluate(MEASURE_JS)
            results.append((name, stats))
            print(
                f"[{name}] avg={stats['avg']} p50={stats['p50']} "
                f"p10={stats['p10']} jank<24fps={stats['jankPct']}%"
            )
            page.close()
        browser.close()

    print("\n--- summary ---")
    for name, s in results:
        print(
            f"{name:<6} avg {s['avg']:>5} fps | p50 {s['p50']:>5} | jank {s['jankPct']}%"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
