# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(r"E:\网站\测试框架\shigure-web\js\heavy-rain.js")
t = p.read_text(encoding="utf-8")

pat = re.compile(
    r"let dens = Math\.max\(0, Math\.min\(1, \(d - 0\.4\) / 0\.38\)\);.*?"
    r"data\[i \+ 3\] = Math\.max\(30, Math\.min\(185, a\)\);",
    re.S,
)
new = """let dens = Math.max(0, Math.min(1, (d - 0.42) / 0.4));
          dens = dens * dens * (3 - 2 * dens);
          const gap = Math.pow(Math.max(0, 1 - dens * 1.08), 1.18);
          /* R20b: keep contrast but restore mean ~86-90 */
          const r = Math.round(22 * dens + 164 * gap + 68 * (1 - dens) * (1 - gap));
          const gch = Math.round(34 * dens + 184 * gap + 84 * (1 - dens) * (1 - gap));
          const b = Math.round(52 * dens + 214 * gap + 108 * (1 - dens) * (1 - gap));
          const a = Math.round(255 * (0.16 + 0.48 * dens + 0.36 * gap));
          const i = (y * cw + x) * 4;
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, gch));
          data[i + 2] = Math.max(0, Math.min(255, b));
          data[i + 3] = Math.max(26, Math.min(170, a));"""

m = pat.search(t)
if not m:
    raise SystemExit("dens block not found")
t = t[: m.start()] + new + t[m.end() :]
t = t.replace("ctx.globalAlpha = 0.84;", "ctx.globalAlpha = 0.78;")
# soften blobs back a bit
subs = [
    ('"rgba(8,20,38,0.42)"', '"rgba(10,22,40,0.34)"'),
    ('"rgba(6,18,36,0.44)"', '"rgba(8,20,38,0.36)"'),
    ('"rgba(190,212,238,0.32)"', '"rgba(186,208,234,0.26)"'),
    ('"rgba(10,24,44,0.4)"', '"rgba(12,26,46,0.32)"'),
    ('"rgba(12,26,48,0.38)"', '"rgba(14,28,50,0.3)"'),
]
for a, b in subs:
    t = t.replace(a, b, 1) if a in t else t
# lift base slightly
t = t.replace(
    """      base.addColorStop(0, "#506a86");
      base.addColorStop(0.35, "#5a7894");
      base.addColorStop(0.65, "#527090");
      base.addColorStop(1, "#48647e");""",
    """      base.addColorStop(0, "#546e8a");
      base.addColorStop(0.35, "#5e7c98");
      base.addColorStop(0.65, "#567494");
      base.addColorStop(1, "#4c6882");""",
)
p.write_text(t, encoding="utf-8")
print("ok")

idx = Path(r"E:\网站\测试框架\shigure-web\index.html")
it = idx.read_text(encoding="utf-8").replace("202608221300", "202608221315")
idx.write_text(it, encoding="utf-8")
print("ver", "221315" in it)
