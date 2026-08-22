"""Per-10% band metrics to localize b150 hotspots."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent


def load(p: Path) -> np.ndarray:
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)


def luma(img: np.ndarray) -> np.ndarray:
    return 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]


if __name__ == "__main__":
    ref = load(ROOT / "frame_010.png")
    loc = load(ROOT / "local" / (sys.argv[1] if len(sys.argv) > 1 else "probe.png"))
    for tag, img in [("REF", ref), ("LOC", loc)]:
        y = luma(img)
        h, w = y.shape
        print(f"== {tag} per-10% band ==")
        parts = []
        for i in range(10):
            a = i / 10
            b = (i + 1) / 10
            band = y[int(h * a):int(h * b), :]
            parts.append(
                f"{int(a*100)}-{int(b*100)}%: mean={band.mean():.1f} "
                f"b150={(band>150).mean()*100:.2f}% b200={(band>200).mean()*100:.2f}% "
                f"p90={np.percentile(band,90):.0f}"
            )
        for line in parts:
            print(line)
