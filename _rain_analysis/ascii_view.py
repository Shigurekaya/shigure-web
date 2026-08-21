"""ASCII visualization of image structure + reference motion analysis.

Usage:
  python ascii_view.py ref2/f_10.png
  python ascii_view.py local/iter7.png
  python ascii_view.py --motion
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent

CHARS = " .:-=+*#%@"


def load(name: str) -> np.ndarray:
    img = cv2.imread(str(ROOT / name))
    if img is None:
        raise SystemExit(f"cannot load {name}")
    return img


def view(name: str, cols: int = 96) -> None:
    img = load(name)
    h, w = img.shape[:2]
    rows = max(4, int(cols * h / w * 0.5))
    small = cv2.resize(img, (cols, rows), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (0, 0), 2.0)
    hi = gray.astype(np.float32) - blur
    out = []
    for r in range(rows):
        line = []
        for c in range(cols):
            lum = gray[r, c]
            hx = hi[r, c]
            if hx > 30:
                ch = "@"
            elif hx > 12:
                ch = "+"
            else:
                ch = CHARS[min(9, int(lum / 256 * 10))]
            line.append(ch)
        out.append("".join(line))
    print(f"--- {name}  ({w}x{h}) ---")
    print("\n".join(out))


def motion(step: int = 1, cols: int = 96) -> None:
    """Frame-diff map of reference video: where things move (rain streaks)."""
    files = sorted((ROOT / "ref2").glob("f_*.png"))
    if not files:
        raise SystemExit("no ref2 frames")
    a = cv2.imread(str(files[0]))
    b = cv2.imread(str(files[min(step, len(files) - 1)]))
    prev = a.astype(np.float32)
    acc = None
    for f in files[1::step]:
        cur = cv2.imread(str(f)).astype(np.float32)
        diff = np.abs(cur - prev).mean(axis=2)
        acc = diff if acc is None else np.maximum(acc, diff)
        prev = cur
    h, w = acc.shape
    rows = max(4, int(cols * h / w * 0.5))
    small = cv2.resize(acc, (cols, rows), interpolation=cv2.INTER_AREA)
    out = []
    for r in range(rows):
        line = []
        for c in range(cols):
            v = small[r, c]
            if v > 22:
                ch = "@"
            elif v > 10:
                ch = "+"
            elif v > 4:
                ch = "."
            else:
                ch = " "
            line.append(ch)
        out.append("".join(line))
    print(f"--- MOTION MAP (max |dt| over ref2, 12fps) ---")
    print("\n".join(out))


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--motion":
        motion()
    else:
        view(args[0] if args else "ref2/f_10.png")
