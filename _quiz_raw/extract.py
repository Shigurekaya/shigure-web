# -*- coding: utf-8 -*-
from pathlib import Path
import re

raw = Path(__file__).resolve().parent
out = raw / "extracted.txt"
parts = []
for i in range(1, 6):
    t = (raw / f"q{i}.html").read_text(encoding="utf-8", errors="ignore")
    t2 = re.sub(r"<script[\s\S]*?</script>", "", t, flags=re.I)
    t2 = re.sub(r"<style[\s\S]*?</style>", "", t2, flags=re.I)
    parts.append(f"\n\n===== QUIZ {i} =====\n")
    for m in re.finditer(
        r"<h3[^>]*>\s*(第\s*\d+\s*問)\s*</h3>([\s\S]*?)(?=<h3|以上です|$)",
        t2,
        re.I,
    ):
        title = re.sub(r"\s+", "", m.group(1))
        body = m.group(2)
        imgs = re.findall(r'<img[^>]+src=["\']([^"\']+)["\']', body, re.I)
        body_txt = re.sub(r"<br\s*/?>", "\n", body, flags=re.I)
        body_txt = re.sub(r"</p>|</li>|</div>", "\n", body_txt, flags=re.I)
        body_txt = re.sub(r"<[^>]+>", "", body_txt)
        for a, b in (
            ("&nbsp;", " "),
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&quot;", '"'),
        ):
            body_txt = body_txt.replace(a, b)
        body_txt = re.sub(r"&#\d+;", "", body_txt)
        body_txt = re.sub(r"\n{3,}", "\n\n", body_txt).strip()
        parts.append(f"\n### {title}\n")
        if imgs:
            parts.append("IMGS: " + " | ".join(imgs[:8]) + "\n")
        parts.append(body_txt[:3000] + "\n")

out.write_text("".join(parts), encoding="utf-8")
text = out.read_text(encoding="utf-8")
print("wrote", out, "bytes", out.stat().st_size)
for i in range(1, 6):
    sec = re.search(rf"===== QUIZ {i} =====([\s\S]*?)(?===== QUIZ|\Z)", text)
    n = len(re.findall(r"### 第\d+問", sec.group(1))) if sec else 0
    print(f"quiz{i}: {n}")
