"""Quantify local shot vs REF frame: mean / sky / sat / b150."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)


def metrics(img: np.ndarray) -> dict[str, float]:
    y = 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]
    h, w = y.shape
    sky = y[int(h * 0.05) : int(h * 0.32), :]
    mx = img.max(axis=2)
    mn = img.min(axis=2)
    sat = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1.0), 0.0)
    beads = y[int(h * 0.22) : int(h * 0.88), :]
    return {
        "mean": float(y.mean()),
        "sky": float(sky.mean()),
        "sat": float(sat.mean()),
        "b150": float((beads > 150).mean()),
    }


def make_compare(ref: Path, loc: Path, out: Path) -> None:
    ri = Image.open(ref).convert("RGB")
    li = Image.open(loc).convert("RGB")
    # align height for side-by-side
    th = 844
    def fit(im: Image.Image) -> Image.Image:
        r = th / im.height
        return im.resize((max(1, int(im.width * r)), th), Image.Resampling.LANCZOS)

    r2, l2 = fit(ri), fit(li)
    pad = 8
    label_h = 36
    canvas = Image.new("RGB", (r2.width + l2.width + pad * 3, th + label_h + pad * 2), (18, 22, 28))
    canvas.paste(r2, (pad, label_h + pad))
    canvas.paste(l2, (pad * 2 + r2.width, label_h + pad))
    draw = ImageDraw.Draw(canvas)
    rm, lm = metrics(load_rgb(ref)), metrics(load_rgb(loc))
    draw.text(
        (pad, 10),
        f"REF  mean={rm['mean']:.1f} sky={rm['sky']:.1f} sat={rm['sat']:.3f} b150={rm['b150']:.3f}",
        fill=(220, 228, 236),
    )
    draw.text(
        (pad * 2 + r2.width, 10),
        f"LOC  mean={lm['mean']:.1f} sky={lm['sky']:.1f} sat={lm['sat']:.3f} b150={lm['b150']:.3f}",
        fill=(220, 228, 236),
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out)
    print(f"wrote {out}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", type=Path, required=True)
    ap.add_argument("--loc", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()
    rm = metrics(load_rgb(args.ref))
    lm = metrics(load_rgb(args.loc))
    print(
        f"REF mean={rm['mean']:.1f} sky={rm['sky']:.1f} sat={rm['sat']:.3f} b150={rm['b150']:.3f}"
    )
    print(
        f"LOC mean={lm['mean']:.1f} sky={lm['sky']:.1f} sat={lm['sat']:.3f} b150={lm['b150']:.3f}"
    )
    if args.out:
        make_compare(args.ref, args.loc, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
