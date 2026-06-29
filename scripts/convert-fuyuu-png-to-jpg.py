#!/usr/bin/env python3
"""Convert all PNG images under fuyuu/ to half-size JPG with white background."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "fuyuu"


def convert_png(png_path: Path) -> tuple[str, str, int]:
    jpg_path = png_path.with_suffix(".jpg")
    with Image.open(png_path) as img:
        orig_w, orig_h = img.size
        new_w = max(1, orig_w // 2)
        new_h = max(1, orig_h // 2)

        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            rgba = img.convert("RGBA") if img.mode == "P" else img
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        img = img.resize((new_w, new_h), Image.LANCZOS)
        img.save(jpg_path, "JPEG", quality=85, optimize=True)

    png_path.unlink()
    size_info = f"{orig_w}x{orig_h} -> {new_w}x{new_h}"
    return str(png_path.relative_to(ROOT)), size_info, jpg_path.stat().st_size


def main() -> None:
    png_files = sorted(ROOT.rglob("*.png"))
    print(f"Found {len(png_files)} PNG files")

    for png_path in png_files:
        rel, size_info, size_bytes = convert_png(png_path)
        print(f"{rel} | {size_info} | {size_bytes // 1024}KB")

    remaining = len(list(ROOT.rglob("*.png")))
    print(f"Done: converted {len(png_files)} files, remaining PNG: {remaining}")


if __name__ == "__main__":
    main()
