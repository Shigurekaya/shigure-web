"""Find reference frames matching checklist REF metrics + baseline iter shots."""
from __future__ import annotations

import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def metrics(img: np.ndarray) -> dict:
    y = 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]
    h, w = y.shape
    sky = y[int(h * 0.05):int(h * 0.32), :]
    mx = img.max(axis=2)
    mn = img.min(axis=2)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1.0), 0.0)
    beads = y[int(h * 0.22):int(h * 0.88), :]
    return {
        "mean": float(y.mean()),
        "sky": float(sky.mean()),
        "sat": float(sat.mean()),
        "b150": float((beads > 150).mean()),
    }


def load(p: Path) -> np.ndarray:
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)


if __name__ == "__main__":
    cands = sorted((ROOT / "frames").glob("f*.jpg")) + sorted(ROOT.glob("frame_*.png"))
    print("== REF candidates ==")
    for p in cands:
        m = metrics(load(p))
        print(f"{p.name}: mean={m['mean']:.1f} sky={m['sky']:.1f} sat={m['sat']:.3f} b150={m['b150']:.3f}")

    print("== LOCAL iterations ==")
    for name in ["iter55.png", "iter56.png", "iter57.png", "iter58.png", "iter58b.png"]:
        p = ROOT / "local" / name
        if not p.exists():
            continue
        m = metrics(load(p))
        print(f"{name}: mean={m['mean']:.1f} sky={m['sky']:.1f} sat={m['sat']:.3f} b150={m['b150']:.3f}")
