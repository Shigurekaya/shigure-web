# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(r"E:\网站\测试框架\shigure-web\js\heavy-rain.js")
t = p.read_text(encoding="utf-8")

t = t.replace(
    """      base.addColorStop(0, "#4e6a8c");
      base.addColorStop(0.35, "#5a7aa0");
      base.addColorStop(0.65, "#526e94");
      base.addColorStop(1, "#486288");""",
    """      base.addColorStop(0, "#547294");
      base.addColorStop(0.32, "#6284a8");
      base.addColorStop(0.55, "#5a7aa0");
      base.addColorStop(0.78, "#526e92");
      base.addColorStop(1, "#4c688a");""",
)

t = t.replace(
    """          const envelope = 0.5
            + 0.28 * Math.sin(ny * Math.PI) /* mid bright band */
            + 0.12 * Math.sin((nx * 2.2 + ny * 0.7) * Math.PI * 2);
          d = d * 0.82 + envelope * 0.38;""",
    """          const envelope = 0.54
            + 0.34 * Math.sin(ny * Math.PI)
            + 0.1 * Math.sin((nx * 2.2 + ny * 0.7) * Math.PI * 2);
          d = d * 0.75 + envelope * 0.45;""",
)

pat = re.compile(
    r"let dens = Math\.max\(0, Math\.min\(1, \(d - 0\.45\) / 0\.38\)\);.*?"
    r"data\[i \+ 3\] = Math\.max\(28, Math\.min\(175, a\)\);",
    re.S,
)
new = """let dens = Math.max(0, Math.min(1, (d - 0.48) / 0.36));
          dens = dens * dens * (3 - 2 * dens);
          const gap = Math.pow(Math.max(0, 1 - dens * 0.98), 1.08);
          /* R21b: lift seam luminance (sky); cool blue sat ~0.42 */
          const r = Math.round(20 * dens + 170 * gap + 72 * (1 - dens) * (1 - gap));
          const gch = Math.round(36 * dens + 190 * gap + 90 * (1 - dens) * (1 - gap));
          const b = Math.round(54 * dens + 218 * gap + 120 * (1 - dens) * (1 - gap));
          const a = Math.round(255 * (0.14 + 0.42 * dens + 0.46 * gap));
          const i = (y * cw + x) * 4;
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, gch));
          data[i + 2] = Math.max(0, Math.min(255, b));
          data[i + 3] = Math.max(24, Math.min(168, a));"""
m = pat.search(t)
if not m:
    raise SystemExit("dens not found")
t = t[: m.start()] + new + t[m.end() :]

reps = [
    ('blob(0.5, 0.24, 0.48, 0.08, "rgba(168,196,232,0.34)", 0.32);',
     'blob(0.5, 0.24, 0.52, 0.09, "rgba(188,210,240,0.4)", 0.3);'),
    ('blob(0.32, 0.36, 0.28, 0.07, "rgba(150,180,220,0.22)", 0.3);',
     'blob(0.34, 0.34, 0.32, 0.08, "rgba(176,202,234,0.28)", 0.3);'),
    ('blob(0.5, 0.42, 0.36, 0.06, "rgba(176,204,236,0.2)", 0.34);',
     'blob(0.5, 0.4, 0.42, 0.07, "rgba(182,208,238,0.26)", 0.32);'),
    ('"rgba(8,20,42,0.4)"', '"rgba(12,26,48,0.34)"'),
    ('"rgba(6,18,40,0.42)"', '"rgba(10,24,46,0.36)"'),
    ('"rgba(10,24,48,0.38)"', '"rgba(14,28,52,0.32)"'),
    ('"rgba(12,26,50,0.36)"', '"rgba(16,30,54,0.3)"'),
]
for a, b in reps:
    if a not in t:
        print("MISS", a[:50])
    else:
        t = t.replace(a, b, 1)
        print("OK", a[:40])

p.write_text(t, encoding="utf-8")

css = Path(r"E:\网站\测试框架\shigure-web\css\style.css")
c = css.read_text(encoding="utf-8")
c = c.replace(
    "body.heavy-rain .site-bg {\n  background: #4a6482;\n}",
    "body.heavy-rain .site-bg {\n  background: #506a88;\n}",
)
c = c.replace(
    "radial-gradient(ellipse 100% 28% at 50% 28%, rgba(150, 186, 230, 0.38) 0%, transparent 70%),",
    "radial-gradient(ellipse 105% 32% at 50% 30%, rgba(168, 198, 236, 0.45) 0%, transparent 68%),",
)
c = c.replace("body.heavy-rain {\n  --bg: #4a6482;", "body.heavy-rain {\n  --bg: #506a88;")
css.write_text(c, encoding="utf-8")

idx = Path(r"E:\网站\测试框架\shigure-web\index.html")
it = idx.read_text(encoding="utf-8").replace("202608221340", "202608221355")
if "202608221355" not in it:
    it = idx.read_text(encoding="utf-8").replace("202608221315", "202608221355")
idx.write_text(it, encoding="utf-8")
print("ver ok", "202608221355" in idx.read_text(encoding="utf-8"))
