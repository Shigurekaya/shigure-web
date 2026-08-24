# -*- coding: utf-8 -*-
"""Scan gal-quiz images for likely R18/H-scene CG content."""
from __future__ import annotations

import json
import re
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "js" / "gal-quiz-data.js"
ASSETS = ROOT / "assets" / "gal-quiz"


def load_bank() -> list[dict]:
    text = JS.read_text(encoding="utf-8")
    m = re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S)
    return json.loads(m.group(1))


def is_skin(r, g, b) -> bool:
    # YCbCr skin tone heuristic (works on anime too, imperfect)
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  # anime skin: wider bounds
    return (
        60 <= y <= 245
        and 70 <= cb <= 140
        and 120 <= cr <= 180
        and r > 40
        and g > 20
        and b > 15
        and max(r, g, b) - min(r, g, b) > 15
    )


def analyze_image(path: Path) -> dict:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    pixels = im.resize((min(w, 320), min(h, 320)), Image.Resampling.BILINEAR)
    data = list(pixels.getdata())
    skin = sum(1 for r, g, b in data if is_skin(r, g, b))
    skin_ratio = skin / len(data)
    # pink/flesh saturation heuristic
    warm = sum(
        1
        for r, g, b in data
        if r > 150 and g < r * 0.85 and b < r * 0.75 and r - g > 25
    )
    warm_ratio = warm / len(data)
    return {
        "w": w,
        "h": h,
        "skin_ratio": round(skin_ratio, 4),
        "warm_ratio": round(warm_ratio, 4),
        "area": w * h,
    }


def likely_r18(stats: dict, fname: str) -> tuple[bool, str]:
    fn = fname.lower()
    # Safe patterns: icons, logos, small thumbs, UI
    safe_kw = (
        "btn", "button", "icon", "logo", "face", "avatar", "thumb",
        "150x150", "100x100", "400x400", "speech", "bubble",
    )
    if any(k in fn for k in safe_kw):
        return False, "safe_filename"

    sr = stats["skin_ratio"]
    wr = stats["warm_ratio"]
    w, h = stats["w"], stats["h"]
    aspect = max(w, h) / max(min(w, h), 1)

    # H-scene CG: large landscape, high skin
    if sr >= 0.22 and stats["area"] >= 200_000:
        return True, f"high_skin_large({sr})"
    if sr >= 0.18 and wr >= 0.06 and aspect >= 1.2:
        return True, f"skin_warm_landscape({sr},{wr})"
    if sr >= 0.30:
        return True, f"very_high_skin({sr})"

    # filename hints
    r18_kw = ("hcg", "ero", "sex", "nude", "hscene", "pl.jpg", "cg")
    if any(k in fn for k in r18_kw) and sr >= 0.12:
        return True, f"filename+skin({sr})"

    return False, f"ok({sr})"


def main():
    bank = load_bank()
    results = []
    missing = []

    for q in bank:
        imgs = q.get("images") or []
        if not imgs:
            continue
        for rel in imgs:
            rel_path = rel.lstrip("/")
            path = ROOT / rel_path
            if not path.exists():
                missing.append((q["id"], rel))
                continue
            stats = analyze_image(path)
            fname = path.name
            flagged, reason = likely_r18(stats, fname)
            results.append(
                {
                    "id": q["id"],
                    "question": q["question"][:80],
                    "image": rel,
                    "flagged": flagged,
                    "reason": reason,
                    **stats,
                }
            )

    flagged = [r for r in results if r["flagged"]]
    safe = [r for r in results if not r["flagged"]]

    print(f"Questions with images: {len({r['id'] for r in results})}")
    print(f"Image files scanned: {len(results)}")
    print(f"Likely R18 flagged: {len(flagged)} images, {len({r['id'] for r in flagged})} questions")
    print(f"Safe images: {len(safe)}")
    if missing:
        print(f"Missing files: {len(missing)}")

    print("\n=== FLAGGED (likely R18) ===")
    for r in flagged:
        print(
            f"{r['id']}: {r['reason']} skin={r['skin_ratio']} "
            f"{r['w']}x{r['h']} {Path(r['image']).name}"
        )

    print("\n=== SAFE (sample) ===")
    for r in safe[:15]:
        print(
            f"{r['id']}: {r['reason']} skin={r['skin_ratio']} "
            f"{Path(r['image']).name}"
        )

    out = Path(__file__).parent / "r18_scan_results.json"
    out.write_text(
        json.dumps({"flagged": flagged, "safe": safe, "missing": missing}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
