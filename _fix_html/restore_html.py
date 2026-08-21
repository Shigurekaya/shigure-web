"""Restore HTML from good commit and bump cache-bust versions (UTF-8 safe)."""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GOOD = "e152f0d"
VER = "202608211600"
FILES = ["index.html", "works.html", "links.html"]

REPLACES = [
    ("css/style.css?v=", f"css/style.css?v={VER}"),
    ("js/gpu-streak-rain.js?v=", f"js/gpu-streak-rain.js?v={VER}"),
    ("js/glass-drops.js?v=", f"js/glass-drops.js?v={VER}"),
    ("js/light-rain.js?v=", f"js/light-rain.js?v={VER}"),
    ("js/heavy-rain.js?v=", f"js/heavy-rain.js?v={VER}"),
    ("js/storm-lightning.js?v=", f"js/storm-lightning.js?v={VER}"),
    ("js/main.js?v=", f"js/main.js?v={VER}"),
]

def bump(text: str) -> str:
    import re
    out = text
    for prefix, full in REPLACES:
        # replace whatever version follows the path
        path = prefix.split("?v=")[0]
        out = re.sub(
            rf'{re.escape(path)}\?v=[^"\s]+',
            full,
            out,
        )
    return out

for name in FILES:
    data = subprocess.check_output(["git", "show", f"{GOOD}:{name}"])
    text = data.decode("utf-8")
    text = bump(text)
    path = ROOT / name
    path.write_text(text, encoding="utf-8", newline="\n")
    ok = "时雨榧" in text and "</title>" in text
    print(name, "ok" if ok else "FAIL", "len", len(text.encode("utf-8")))
