"""Detailed region comparison: REF frame vs local shot.

Regions (relative to screen height):
  R0 0.00-0.32  sky/clouds (uses metrics like quant_pair sky band)
  R1 0.32-0.50  mid (streak band over cards)
  R2 0.50-0.80  mid-low (dense rain + droplets)
  R3 0.80-1.00  bottom

For each: mean luma, sat, bright(>150) fraction, and a 3x finer ascii of the
top region to eyeball cloud structure.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent


def load(p: Path) -> np.ndarray:
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)


def luma(img: np.ndarray) -> np.ndarray:
    return 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]


def sat_of(img: np.ndarray) -> np.ndarray:
    mx = img.max(axis=2)
    mn = img.min(axis=2)
    return np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1.0), 0.0)


def regions_metrics(img: np.ndarray) -> list[dict]:
    y = luma(img)
    s = sat_of(img)
    h, w = y.shape
    out = []
    for name, a, b in [("sky", 0.00, 0.32), ("mid", 0.32, 0.55), ("low", 0.55, 0.80), ("bot", 0.80, 1.00)]:
        band = y[int(h * a):int(h * b), :]
        sband = s[int(h * a):int(h * b), :]
        out.append({
            "name": name,
            "mean": float(band.mean()),
            "sat": float(sband.mean()),
            "b150": float((band > 150).mean()),
            "b200": float((band > 200).mean()),
            "p90": float(np.percentile(band, 90)),
        })
    return out


def ascii_region(img: np.ndarray, ya: float, yb: float, cols: int = 110) -> None:
    y = luma(img)
    h, w = y.shape
    r0, r1 = int(h * ya), int(h * yb)
    crop = y[r0:r1, :]
    crop_u8 = np.uint8(np.clip(crop, 0, 255))
    rows = max(4, int(cols * crop.shape[0] / crop.shape[1] * 0.5))
    small = Image.fromarray(crop_u8).resize((cols, rows), Image.Resampling.BILINEAR)
    a = np.asarray(small, dtype=np.float32)
    blur = np.asarray(
        Image.fromarray(crop_u8).filter(ImageFilter.GaussianBlur(2.0)).resize((cols, rows), Image.Resampling.BILINEAR),
        dtype=np.float32,
    )
    hi = a - blur
    ch = " .:-=+*#%@"
    for r in range(rows):
        line = []
        for c in range(cols):
            hx = hi[r, c]
            if hx > 30:
                line.append("@")
            elif hx > 12:
                line.append("+")
            else:
                line.append(ch[min(9, int(a[r, c] / 256 * 10))])
        print("".join(line))


if __name__ == "__main__":
    ref_p = ROOT / "frame_010.png"
    loc_p = ROOT / "local" / (sys.argv[1] if len(sys.argv) > 1 else "probe.png")
    ref = load(ref_p)
    loc = load(loc_p)
    print("== REF frame_010 ==")
    for m in regions_metrics(ref):
        print(m)
    print("== LOC", loc_p.name, "==")
    for m in regions_metrics(loc):
        print(m)

    print("\n== SKY BAND (0.00-0.32): REF ==")
    ascii_region(ref, 0.00, 0.32)
    print("\n== SKY BAND (0.00-0.32): LOC ==")
    ascii_region(loc, 0.00, 0.32)
