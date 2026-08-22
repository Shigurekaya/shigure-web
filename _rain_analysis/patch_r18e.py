# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"E:\网站\测试框架\shigure-web\js\heavy-rain.js")
t = p.read_text(encoding="utf-8")

subs = [
    (
        'base.addColorStop(0, "#4a6480");\n'
        '      base.addColorStop(0.35, "#54728e");\n'
        '      base.addColorStop(0.65, "#4c6a86");\n'
        '      base.addColorStop(1, "#425c78");',
        'base.addColorStop(0, "#506a86");\n'
        '      base.addColorStop(0.35, "#5a7894");\n'
        '      base.addColorStop(0.65, "#527090");\n'
        '      base.addColorStop(1, "#48647e");',
    ),
    (
        "let dens = Math.max(0, Math.min(1, (d - 0.38) / 0.4));\n"
        "          dens = dens * dens * (3 - 2 * dens);\n"
        "          dens = dens * dens;",
        "let dens = Math.max(0, Math.min(1, (d - 0.44) / 0.4));\n"
        "          dens = dens * dens * (3 - 2 * dens);",
    ),
    (
        "const gap = Math.pow(Math.max(0, 1 - dens * 1.05), 1.35);",
        "const gap = Math.pow(Math.max(0, 1 - dens * 1.1), 1.2);",
    ),
    (
        "const r = Math.round(18 * dens + 152 * gap + 64 * (1 - dens) * (1 - gap));\n"
        "          const gch = Math.round(30 * dens + 172 * gap + 80 * (1 - dens) * (1 - gap));\n"
        "          const b = Math.round(48 * dens + 212 * gap + 108 * (1 - dens) * (1 - gap));\n"
        "          const a = Math.round(255 * (0.2 + 0.58 * dens + 0.36 * gap));",
        "const r = Math.round(26 * dens + 156 * gap + 70 * (1 - dens) * (1 - gap));\n"
        "          const gch = Math.round(40 * dens + 176 * gap + 86 * (1 - dens) * (1 - gap));\n"
        "          const b = Math.round(60 * dens + 208 * gap + 110 * (1 - dens) * (1 - gap));\n"
        "          const a = Math.round(255 * (0.16 + 0.5 * dens + 0.34 * gap));",
    ),
    (
        "data[i + 3] = Math.max(30, Math.min(190, a));",
        "data[i + 3] = Math.max(26, Math.min(168, a));",
    ),
    ("ctx.globalAlpha = 0.82;", "ctx.globalAlpha = 0.76;"),
    ('"rgba(10,22,40,0.38)"', '"rgba(12,26,46,0.3)"'),
    ('"rgba(8,20,38,0.4)"', '"rgba(10,24,44,0.32)"'),
    ('"rgba(12,26,46,0.34)"', '"rgba(14,28,50,0.28)"'),
    ('"rgba(14,28,50,0.32)"', '"rgba(16,30,52,0.26)"'),
]

n = 0
for a, b in subs:
    c = t.count(a)
    if c:
        t = t.replace(a, b, 1)
        n += 1
        print("OK", a[:48].replace("\n", " "), "count", c)
    else:
        print("MISS", a[:64].replace("\n", " "))

p.write_text(t, encoding="utf-8")
print("done", n)

idx = Path(r"E:\网站\测试框架\shigure-web\index.html")
it = idx.read_text(encoding="utf-8").replace("202608221030", "202608221045")
idx.write_text(it, encoding="utf-8")
print("ver", "202608221045" in it)
