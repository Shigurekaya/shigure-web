# -*- coding: utf-8 -*-
from pathlib import Path
import json
import re

RAW = Path(__file__).resolve().parent
qs = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
lines = []
for q in qs:
    lines.append(f"=== {q['id']} ===")
    lines.append("Q: " + q["question_ja"][:600].replace("\n", " / "))
    lines.append("A: " + q["answer_ja"][:300])
    m = q["media"]
    lines.append(
        f"media: img={len(m['images'])} aud={len(m['audio'])} vid={len(m['video'])} emb={len(m['embeds'])}"
    )
    lines.append("")
(RAW / "compact.txt").write_text("\n".join(lines), encoding="utf-8")
print("ok", len(qs))
