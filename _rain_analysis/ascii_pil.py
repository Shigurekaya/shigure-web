"""ASCII visualization using PIL (unicode-path safe)."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

CHARS = " .:-=+*#%@"


def view(name: str, cols: int = 88) -> None:
    p = Path(name)
    if not p.is_absolute():
        p = Path(__file__).resolve().parent / name
    img = Image.open(p).convert("L")
    w, h = img.size
    rows = max(4, int(cols * h / w * 0.5))
    small = img.resize((cols, rows), Image.Resampling.BILINEAR)
    a = np.asarray(small, dtype=np.float32)
    blur = np.asarray(small.filter(ImageFilter.GaussianBlur(2.0)), dtype=np.float32)
    hi = a - blur
    out = []
    for r in range(rows):
        line = []
        for c in range(cols):
            lum = a[r, c]
            hx = hi[r, c]
            if hx > 30:
                ch = "@"
            elif hx > 12:
                ch = "+"
            else:
                ch = CHARS[min(9, int(lum / 256 * 10))]
            line.append(ch)
        out.append("".join(line))
    print(f"--- {p}  ({w}x{h}) ---")
    print("\n".join(out))


if __name__ == "__main__":
    view(sys.argv[1] if len(sys.argv) > 1 else "local/iter58b.png")
