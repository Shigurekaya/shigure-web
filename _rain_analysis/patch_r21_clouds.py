# -*- coding: utf-8 -*-
"""R21: Gap B — brighter mid seams + cooler blue sat, keep mean."""
from pathlib import Path
import re

p = Path(r"E:\网站\测试框架\shigure-web\js\heavy-rain.js")
t = p.read_text(encoding="utf-8")

# Higher-res FBM field
t2 = t.replace(
    "const cw = Math.max(48, Math.floor(tw / 3));\n"
    "      const ch = Math.max(64, Math.floor(th / 3));",
    "const cw = Math.max(64, Math.floor(tw / 2.2));\n"
    "      const ch = Math.max(88, Math.floor(th / 2.2));",
)

# Stronger mid bright envelope (REF has lit mid band)
t2 = t2.replace(
    """          const envelope = 0.52
            + 0.2 * Math.sin(ny * Math.PI)
            + 0.14 * Math.sin((nx * 2.4 + ny * 0.8) * Math.PI * 2);
          d = d * 0.9 + envelope * 0.28;""",
    """          const envelope = 0.5
            + 0.28 * Math.sin(ny * Math.PI) /* mid bright band */
            + 0.12 * Math.sin((nx * 2.2 + ny * 0.7) * Math.PI * 2);
          d = d * 0.82 + envelope * 0.38;""",
)

pat = re.compile(
    r"let dens = Math\.max\(0, Math\.min\(1, \(d - 0\.42\) / 0\.4\)\);.*?"
    r"data\[i \+ 3\] = Math\.max\(26, Math\.min\(170, a\)\);",
    re.S,
)
new = """let dens = Math.max(0, Math.min(1, (d - 0.45) / 0.38));
          dens = dens * dens * (3 - 2 * dens);
          const gap = Math.pow(Math.max(0, 1 - dens * 1.02), 1.12);
          /* R21: cooler blue gaps (sat) + brighter seams (sky); cores stay dark */
          const r = Math.round(18 * dens + 148 * gap + 58 * (1 - dens) * (1 - gap));
          const gch = Math.round(32 * dens + 176 * gap + 78 * (1 - dens) * (1 - gap));
          const b = Math.round(58 * dens + 228 * gap + 118 * (1 - dens) * (1 - gap));
          const a = Math.round(255 * (0.15 + 0.46 * dens + 0.42 * gap));
          const i = (y * cw + x) * 4;
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, gch));
          data[i + 2] = Math.max(0, Math.min(255, b));
          data[i + 3] = Math.max(28, Math.min(175, a));"""

m = pat.search(t2)
if not m:
    raise SystemExit("dens block not found")
t2 = t2[: m.start()] + new + t2[m.end() :]

t2 = t2.replace("ctx.globalAlpha = 0.78;", "ctx.globalAlpha = 0.8;")

# Stronger volumetric anchors: dark flanks + mid bright seam
old_blobs = """      /* 大团锚点：稳住积雨坨（中等力度） */
      blob(0.18, 0.14, 0.38, 0.09, "rgba(10,22,40,0.34)", 0.3);
      blob(0.8, 0.18, 0.36, 0.1, "rgba(8,20,38,0.36)", 0.28);
      blob(0.48, 0.26, 0.44, 0.07, "rgba(186,208,234,0.26)", 0.34);
      blob(0.28, 0.5, 0.42, 0.12, "rgba(12,26,46,0.32)", 0.3);
      blob(0.74, 0.56, 0.4, 0.11, "rgba(14,28,50,0.3)", 0.3);
      blob(0.5, 0.88, 0.72, 0.13, "rgba(10,22,40,0.32)", 0.38);"""

new_blobs = """      /* R21 anchors: dark flanks + mid cool seam (alpha < 0.5) */
      blob(0.16, 0.12, 0.4, 0.1, "rgba(8,20,42,0.4)", 0.28);
      blob(0.82, 0.16, 0.38, 0.1, "rgba(6,18,40,0.42)", 0.26);
      blob(0.5, 0.24, 0.48, 0.08, "rgba(168,196,232,0.34)", 0.32);
      blob(0.32, 0.36, 0.28, 0.07, "rgba(150,180,220,0.22)", 0.3);
      blob(0.22, 0.52, 0.44, 0.12, "rgba(10,24,48,0.38)", 0.28);
      blob(0.78, 0.54, 0.4, 0.11, "rgba(12,26,50,0.36)", 0.28);
      blob(0.5, 0.42, 0.36, 0.06, "rgba(176,204,236,0.2)", 0.34);
      blob(0.5, 0.9, 0.75, 0.14, "rgba(8,20,40,0.34)", 0.38);"""

if old_blobs not in t2:
    raise SystemExit("blob block not found")
t2 = t2.replace(old_blobs, new_blobs)

# Base slightly cooler blue
t2 = t2.replace(
    """      base.addColorStop(0, "#546e8a");
      base.addColorStop(0.35, "#5e7c98");
      base.addColorStop(0.65, "#567494");
      base.addColorStop(1, "#4c6882");""",
    """      base.addColorStop(0, "#4e6a8c");
      base.addColorStop(0.35, "#5a7aa0");
      base.addColorStop(0.65, "#526e94");
      base.addColorStop(1, "#486288");""",
)

p.write_text(t2, encoding="utf-8")
print("js ok")

css = Path(r"E:\网站\测试框架\shigure-web\css\style.css")
c = css.read_text(encoding="utf-8")
c2 = c.replace(
    """body.heavy-rain .site-bg {
  background: #455f7a;
}

body.heavy-rain .site-bg::before {
  filter: blur(48px) brightness(1.02) saturate(0.98);
  opacity: 0.12;
  animation: heavy-sky-drift 48s ease-in-out infinite alternate;
  background:
    radial-gradient(ellipse 110% 26% at 50% 18%, rgba(158, 184, 218, 0.28) 0%, transparent 72%),
    radial-gradient(ellipse 80% 36% at 18% 58%, rgba(28, 44, 72, 0.26) 0%, transparent 70%),
    radial-gradient(ellipse 80% 36% at 88% 72%, rgba(24, 40, 66, 0.22) 0%, transparent 70%);
}""",
    """body.heavy-rain .site-bg {
  background: #4a6482;
}

body.heavy-rain .site-bg::before {
  filter: blur(44px) brightness(1.04) saturate(1.08);
  opacity: 0.16;
  animation: heavy-sky-drift 48s ease-in-out infinite alternate;
  background:
    radial-gradient(ellipse 100% 28% at 50% 28%, rgba(150, 186, 230, 0.38) 0%, transparent 70%),
    radial-gradient(ellipse 80% 36% at 18% 58%, rgba(24, 42, 72, 0.28) 0%, transparent 70%),
    radial-gradient(ellipse 80% 36% at 88% 72%, rgba(20, 38, 68, 0.24) 0%, transparent 70%);
}""",
)
c2 = c2.replace("body.heavy-rain {\n  --bg: #455f7a;", "body.heavy-rain {\n  --bg: #4a6482;")
css.write_text(c2, encoding="utf-8")
print("css ok")

idx = Path(r"E:\网站\测试框架\shigure-web\index.html")
it = idx.read_text(encoding="utf-8").replace("202608221315", "202608221340")
idx.write_text(it, encoding="utf-8")
print("ver", "202608221340" in it)
