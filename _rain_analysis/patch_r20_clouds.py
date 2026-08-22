# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(r"E:\网站\测试框架\shigure-web\js\heavy-rain.js")
t = p.read_text(encoding="utf-8")

pat = re.compile(
    r"let dens = Math\.max\(0, Math\.min\(1, \(d - 0\.44\) / 0\.4\)\);.*?"
    r"data\[i \+ 3\] = Math\.max\(26, Math\.min\(168, a\)\);",
    re.S,
)
new = """let dens = Math.max(0, Math.min(1, (d - 0.4) / 0.38));
          dens = dens * dens * (3 - 2 * dens);
          const gap = Math.pow(Math.max(0, 1 - dens * 1.05), 1.15);
          /* R20: darker cores + brighter cool gaps */
          const r = Math.round(16 * dens + 172 * gap + 62 * (1 - dens) * (1 - gap));
          const gch = Math.round(28 * dens + 192 * gap + 78 * (1 - dens) * (1 - gap));
          const b = Math.round(46 * dens + 222 * gap + 104 * (1 - dens) * (1 - gap));
          const a = Math.round(255 * (0.18 + 0.55 * dens + 0.4 * gap));
          const i = (y * cw + x) * 4;
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, gch));
          data[i + 2] = Math.max(0, Math.min(255, b));
          data[i + 3] = Math.max(30, Math.min(185, a));"""

m = pat.search(t)
if not m:
    raise SystemExit("dens block not found")
t = t[: m.start()] + new + t[m.end() :]
t = t.replace("ctx.globalAlpha = 0.76;", "ctx.globalAlpha = 0.84;")
subs = [
    ('"rgba(12,26,46,0.3)"', '"rgba(8,20,38,0.42)"'),
    ('"rgba(10,24,44,0.32)"', '"rgba(6,18,36,0.44)"'),
    ('"rgba(180,202,230,0.22)"', '"rgba(190,212,238,0.32)"'),
    ('"rgba(14,28,50,0.28)"', '"rgba(10,24,44,0.4)"'),
    ('"rgba(16,30,52,0.26)"', '"rgba(12,26,48,0.38)"'),
]
for a, b in subs:
    if a in t:
        t = t.replace(a, b, 1)
        print("blob", a, "->", b)
    else:
        print("miss", a)
p.write_text(t, encoding="utf-8")
print("ok globalAlpha", "0.84" in t)

idx = Path(r"E:\网站\测试框架\shigure-web\index.html")
it = idx.read_text(encoding="utf-8").replace("202608221245", "202608221300")
idx.write_text(it, encoding="utf-8")
print("ver", "202608221300" in it)
