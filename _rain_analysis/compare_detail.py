"""Detailed comparison: reference video frames vs local heavy-rain capture.

Computes per-region luminance / streak / bead stats so we can tune without
eyeballing images.
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent


def load(path: str) -> np.ndarray:
    img = cv2.imread(str(ROOT / path))
    if img is None:
        raise SystemExit(f"cannot load {path}")
    return img


def sky_rgb(img: np.ndarray) -> tuple[int, int, int]:
    h, w = img.shape[:2]
    region = img[int(h * 0.10) : int(h * 0.22), int(w * 0.55) : int(w * 0.98)]
    px = region.reshape(-1, 3).astype(np.float32)
    lum = 0.2126 * px[:, 0] + 0.7152 * px[:, 1] + 0.0722 * px[:, 2]
    dark = px[lum < np.percentile(lum, 45)]
    med = np.median(dark, axis=0)
    return int(med[2]), int(med[1]), int(med[0])  # bgr -> rgb


def streak_stats(img: np.ndarray) -> dict:
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (0, 0), 1.0)
    hi = gray - blur
    # vertical edge energy (rain streaks are near-vertical)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    vert = np.abs(gy) > np.abs(gx) * 1.3
    bright = gray > np.percentile(gray, 86)
    vbe = (vert & bright).mean()

    sky = img[int(h * 0.05) : int(h * 0.30), int(w * 0.5) : int(w * 0.99)]
    g = cv2.cvtColor(sky, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(g, 40, 120)
    lines = cv2.HoughLinesP(e, 1, np.pi / 180, 22, minLineLength=10, maxLineGap=4)
    angles, lengths = [], []
    if lines is not None:
        for line in lines:
            pts = line.reshape(-1)
            if pts.size < 4:
                continue
            x1, y1, x2, y2 = map(float, pts[:4])
            dx, dy = x2 - x1, y2 - y1
            ln = (dx * dx + dy * dy) ** 0.5
            if ln < 8:
                continue
            ang = float(np.degrees(np.arctan2(dx, dy)))
            if abs(ang) > 45:
                continue
            angles.append(ang)
            lengths.append(ln / sky.shape[0])
    return {
        "bright_frac": float(bright.mean()),
        "vert_bright_frac": float(vbe),
        "hi_mean": float(hi.mean()),
        "hi_p95": float(np.percentile(hi, 95)),
        "hough_n": len(angles),
        "hough_ang_mean": float(np.mean(angles)) if angles else 0.0,
        "hough_len_mean_h": float(np.mean(lengths)) if lengths else 0.0,
        "hough_len_p90_h": float(np.percentile(lengths, 90)) if lengths else 0.0,
    }


def bead_stats(img: np.ndarray) -> dict:
    """High-pass small-scale blobs (condensation beads / screen drops)."""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (0, 0), 1.4)
    hi = gray - blur
    mask = (hi > 10) & (gray > 92)
    mid = mask[int(h * 0.35) : int(h * 0.60)].mean()
    bot = mask[int(h * 0.72) : int(h * 0.92)].mean()
    # connected components for bead size distribution
    _, binim = cv2.threshold((hi > 12).astype(np.uint8), 0, 255, cv2.THRESH_BINARY)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binim, 8)
    sizes = [s[cv2.CC_STAT_AREA] for s in stats[1:] if 2 <= s[cv2.CC_STAT_AREA] <= 900]
    sizes.sort()
    return {
        "bead_mid": float(mid),
        "bead_bot": float(bot),
        "bead_cc_n": len(sizes),
        "bead_cc_median_px": float(np.median(sizes)) if sizes else 0.0,
        "bead_cc_p90_px": float(np.percentile(sizes, 90)) if sizes else 0.0,
    }


def lum_hist(img: np.ndarray) -> dict:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    y = gray.astype(np.float32)
    return {
        "mean": float(y.mean()),
        "p10": float(np.percentile(y, 10)),
        "p50": float(np.percentile(y, 50)),
        "p90": float(np.percentile(y, 90)),
        "dark_frac": float((y < 40).mean()),
        "w": w,
        "h": h,
    }


def region_rows(img: np.ndarray) -> list[dict]:
    """Luminance + vertical-edge density per horizontal band."""
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    vert = np.abs(gy) > np.abs(gx) * 1.3
    out = []
    for i in range(8):
        y0 = int(h * i / 8)
        y1 = int(h * (i + 1) / 8)
        band = gray[y0:y1]
        out.append(
            {
                "band": i,
                "lum": float(band.mean()),
                "vert_frac": float(vert[y0:y1].mean()),
            }
        )
    return out


def compare(ref: np.ndarray, loc: np.ndarray) -> None:
    print("=== REFERENCE (frame) ===")
    r = {
        "sky_rgb": sky_rgb(ref),
        "streak": streak_stats(ref),
        "bead": bead_stats(ref),
        "lum": lum_hist(ref),
        "rows": region_rows(ref),
    }
    print("sky_rgb:", r["sky_rgb"])
    print("lum:", {k: round(v, 1) for k, v in r["lum"].items() if k != "w" and k != "h"})
    print("streak:", {k: round(v, 3) for k, v in r["streak"].items()})
    print("bead:", {k: round(v, 3) for k, v in r["bead"].items()})
    print("rows:", [round(x["lum"], 0) for x in r["rows"]])
    print("rows_vert:", [round(x["vert_frac"], 4) for x in r["rows"]])

    print("\n=== LOCAL (capture) ===")
    l = {
        "sky_rgb": sky_rgb(loc),
        "streak": streak_stats(loc),
        "bead": bead_stats(loc),
        "lum": lum_hist(loc),
        "rows": region_rows(loc),
    }
    print("sky_rgb:", l["sky_rgb"])
    print("lum:", {k: round(v, 1) for k, v in l["lum"].items() if k != "w" and k != "h"})
    print("streak:", {k: round(v, 3) for k, v in l["streak"].items()})
    print("bead:", {k: round(v, 3) for k, v in l["bead"].items()})
    print("rows:", [round(x["lum"], 0) for x in l["rows"]])
    print("rows_vert:", [round(x["vert_frac"], 4) for x in l["rows"]])


if __name__ == "__main__":
    ref_path = sys.argv[1] if len(sys.argv) > 1 else "ref2/f_10.png"
    loc_path = sys.argv[2] if len(sys.argv) > 2 else "local/iter7.png"
    compare(load(ref_path), load(loc_path))
