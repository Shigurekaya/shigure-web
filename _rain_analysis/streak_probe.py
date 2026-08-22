"""Extract rain-streak signal stats from a band of the frame.

Streak = local highpass response (bright threads on mid-tone bg).
Reports: density of streak pixels, mean width of bright cores, count.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent


def luma(img: np.ndarray) -> np.ndarray:
    return 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]


def streak_stats(p: Path, ya: float, yb: float, label: str) -> None:
    img = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
    y = luma(img)
    h, w = y.shape
    band = y[int(h * ya):int(h * yb), :]
    blur = np.asarray(
        Image.fromarray(np.uint8(np.clip(band, 0, 255))).filter(ImageFilter.GaussianBlur(3.0)),
        dtype=np.float32,
    )
    hi = band - blur
    # vertical streak signal: pixels brighter than local vert blur
    vblur = np.asarray(
        Image.fromarray(np.uint8(np.clip(band, 0, 255))).filter(ImageFilter.GaussianBlur((0, 9))),
        dtype=np.float32,
    )
    vsig = band - vblur
    pos = hi > 14
    vpos = vsig > 10
    print(f"{label} y[{ya:.2f},{yb:.2f}]")
    print(f"  highpass>14: {pos.mean()*100:.2f}%  vstreak>10: {vpos.mean()*100:.2f}%")
    print(f"  band mean={band.mean():.1f}  hi mean={hi.mean():.1f}  hi p99={np.percentile(hi,99):.1f}")
    # core width estimate: for each row, count horizontal runs of pos pixels
    runw = []
    for r in range(0, pos.shape[0], 3):
        row = pos[r]
        x = 0
        while x < w:
            if row[x]:
                s = x
                while x < w and row[x]:
                    x += 1
                if x - s <= 6:
                    runw.append(x - s)
            else:
                x += 1
    if runw:
        runw = np.array(runw)
        print(f"  bright-core run width px: mean={runw.mean():.2f} p50={np.median(runw):.0f} p90={np.percentile(runw,90):.0f} max={runw.max()}")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "probe.png"
    ref = ROOT / "frame_010.png"
    loc = ROOT / "local" / arg
    for name, p in [("REF", ref), ("LOC", loc)]:
        streak_stats(p, 0.42, 0.62, name)
        streak_stats(p, 0.62, 0.82, name)
