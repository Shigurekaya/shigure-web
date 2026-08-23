#!/usr/bin/env python3
"""Capture heavy-rain screenshot via project uv Playwright (no C-drive browsers)."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Must be set before playwright import if not already in env.
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".playwright-browsers"))

from playwright.sync_api import sync_playwright  # noqa: E402

SKIP_INTRO = """
() => {
  document.body.classList.remove('is-intro');
  document.documentElement.classList.remove('is-intro');
  document.querySelectorAll('.home-intro, .intro-overlay').forEach(el => {
    el.style.display = 'none';
    el.style.opacity = '0';
  });
}
"""

PICK_INFO = """
() => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      display: cs.display,
      opacity: cs.opacity,
      isOn: el.classList.contains('is-on'),
      w: el.width,
      h: el.height,
    };
  };
  return {
    body: document.body.className,
    glass: pick('.site-fx__rain-glass'),
    overlay: pick('.site-fx__streak-overlay'),
    splash: pick('.site-fx__splash'),
    drops: pick('.site-fx__glass-drops'),
    heavy: pick('.site-bg__heavy'),
    clouds: pick('.site-bg__clouds'),
    mist: pick('.site-bg__heavy-mist'),
  };
}
"""


def main() -> int:
    url = os.environ.get("RAIN_URL", "http://127.0.0.1:3000/?rain=heavy")
    tag = os.environ.get("RAIN_TAG", "shot")
    width = int(os.environ.get("RAIN_W", "390"))
    height = int(os.environ.get("RAIN_H", "844"))
    out_dir = ROOT / "local"
    out_dir.mkdir(parents=True, exist_ok=True)

    logs: list[str] = []
    status = "timeout"

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
        )
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1.5)

        def on_console(msg):
            line = f"[{msg.type}] {msg.text}"
            logs.append(line)
            print(line)

        def on_page_error(err):
            line = f"[pageerror] {err}"
            logs.append(line)
            print(line)

        page.on("console", on_console)
        page.on("pageerror", on_page_error)

        page.goto(url, wait_until="networkidle", timeout=60_000)
        page.wait_for_timeout(800)
        page.evaluate(SKIP_INTRO)

        for _ in range(48):
            page.wait_for_timeout(250)
            hit = next(
                (
                    l
                    for l in logs
                    if "screen glass ready" in l
                    or "screen glass demoted" in l
                    or "raindrop-fx skipped" in l
                ),
                None,
            )
            if hit:
                status = hit
                break

        page.wait_for_timeout(4000)
        shot_path = out_dir / f"{tag}.png"
        page.screenshot(path=str(shot_path), full_page=False, timeout=90_000)
        info = page.evaluate(PICK_INFO)
        browser.close()

    meta = {
        "status": status,
        "logs": logs,
        "info": info,
        "url": url,
        "width": width,
        "height": height,
        "browsers_path": os.environ.get("PLAYWRIGHT_BROWSERS_PATH"),
    }
    meta_path = out_dir / f"{tag}.json"
    meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")
    print("STATUS", status)
    print("INFO", json.dumps(info, indent=2, ensure_ascii=False))
    print("SHOT", shot_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
