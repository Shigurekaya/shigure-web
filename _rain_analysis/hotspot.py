"""Localize very bright pixels in the screenshot by region."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent


def luma(img: np.ndarray) -> np.ndarray:
    return 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]


if __name__ == "__main__":
    name = sys.argv[1] if len(sys.argv) > 1 else "probe.png"
    img = np.asarray(Image.open(ROOT / "local" / name).convert("RGB"), dtype=np.float32)
    y = luma(img)
    h, w = y.shape
    hot = y > 235
    print(f"size {w}x{h}")
    print(f"fraction >235: {hot.mean()*100:.3f}%")
    # column profile of hot pixels
    colsum = hot.sum(axis=0)
    print("hot pixel column distribution (10 col bins):")
    for i in range(10):
        a, b = i * w // 10, (i + 1) * w // 10
        print(f"  x {a}-{b}: {colsum[a:b].sum()}")
    rowsum = hot.sum(axis=1)
    print("hot pixel row distribution (10 row bins):")
    for i in range(10):
        a, b = i * h // 10, (i + 1) * h // 10
        print(f"  y {a}-{b}: {rowsum[a:b].sum()} (mean luma {(y[a:b].mean()):.0f})")
    # find the largest connected hot region
    from scipy import ndimage
    try:
        lab, n = ndimage.label(hot)
        if n:
            sizes = ndimage.sum(hot, lab, range(1, n + 1))
            top = np.argsort(sizes)[::-1][:6]
            for t in top:
                ys, xs = np.where(lab == t + 1)
                print(f"  blob#{t+1}: size={len(ys)} y={ys.min()}-{ys.max()} x={xs.min()}-{xs.max()} meanL={y[lab==t+1].mean():.0f}")
    except ImportError:
        print("(scipy not available)")
