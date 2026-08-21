# -*- coding: utf-8 -*-
from pathlib import Path
import re

ver = "202608211640"
root = Path(__file__).resolve().parents[1]
files = ["index.html", "works.html", "links.html"]
insert = '  <script src="js/vendor/html2canvas.min.js"></script>\n'
raindrop = '  <script src="js/vendor/raindrop-fx.js"></script>\n'

for name in files:
    p = root / name
    t = p.read_text(encoding="utf-8")
    if "html2canvas.min.js" not in t:
        t = t.replace(raindrop, insert + raindrop)
    t = re.sub(r"(\?v=)20260821\d+", r"\g<1>" + ver, t)
    p.write_text(t, encoding="utf-8", newline="\n")
    print(name, "html2canvas" in t, ver)
