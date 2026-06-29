#!/usr/bin/env python3
from pathlib import Path
import re

files = [
    Path(__file__).resolve().parent.parent / "fuyuu/js/fuyulev-image-fix.js",
    Path(__file__).resolve().parent.parent / "fuyuu/js/site.js",
    Path(__file__).resolve().parent.parent / "fuyuu/js/site-data.js",
    Path(__file__).resolve().parent.parent / "fuyuu/data/profile.json",
]

for f in files:
    text = f.read_text(encoding="utf-8")
    new_text = re.sub(r"(image/[^\"']+?)\.png", r"\1.jpg", text)
    new_text = re.sub(r"(assets/images/pendant)\.png", r"\1.jpg", new_text)
    new_text = re.sub(r"(data/images/pendant)\.png", r"\1.jpg", new_text)
    if new_text != text:
        f.write_text(new_text, encoding="utf-8")
        print(f"Updated {f}")
    else:
        print(f"No change {f}")
