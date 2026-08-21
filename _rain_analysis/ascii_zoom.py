"""Zoomed ASCII view of a region in an image."""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent

CHARS = " .:-=+*#%@"


def view_zoom(name: str, x0: float, y0: float, x1: float, y1: float, cols: int = 110) -> None:
    img = cv2.imread(str(ROOT / name))
    if img is None:
        raise SystemExit(f"cannot load {name}")
    h, w = img.shape[:2]
    xa, xb = int(w * x0), max(int(w * x1), int(w * x0) + 2)
    ya, yb = int(h * y0), max(int(h * y1), int(h * y0) + 2)
    crop = img[ya:yb, xa:xb]
    ch, cw = crop.shape[:2]
    rows = max(4, int(cols * ch / cw * 0.5))
    small = cv2.resize(crop, (cols, rows), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (0, 0), 1.5)
    hi = gray.astype(np.float32) - blur
    out = []
    for r in range(rows):
        line = []
        for c in range(cols):
            lum = gray[r, c]
            hx = hi[r, c]
            if hx > 26:
                ch2 = "@"
            elif hx > 10:
                ch2 = "+"
            else:
                ch2 = CHARS[min(9, int(lum / 256 * 10))]
            line.append(ch2)
        out.append("".join(line))
    print(f"--- {name}  crop=({x0:.2f},{y0:.2f})-({x1:.2f},{y1:.2f})  {cw}x{ch} ---")
    print("\n".join(out))


if __name__ == "__main__":
    args = sys.argv[1:]
    name = args[0] if args else "ref2/f_10.png"
    x0 = float(args[1]) if len(args) > 1 else 0.0
    y0 = float(args[2]) if len(args) > 2 else 0.0
    x1 = float(args[3]) if len(args) > 3 else 1.0
    y1 = float(args[4]) if len(args) > 4 else 1.0
    view_zoom(name, x0, y0, x1, y1)
