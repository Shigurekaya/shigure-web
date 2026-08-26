# -*- coding: utf-8 -*-
import json
from pathlib import Path

RAW = Path(__file__).resolve().parent
raw = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
lines = []
for q in raw:
    z = zh.get(q["id"], {})
    if z.get("type") != "text":
        continue
    lines.append(f"=== {q['id']} ===")
    lines.append("JA_Q: " + (q.get("question_ja") or "").replace("\n", " / ")[:240])
    lines.append("JA_A: " + (q.get("answer_ja") or "")[:160])
    lines.append("ZH_Q: " + z["question"].replace("\n", " / ")[:180])
    lines.append("")
(RAW / "_text_qs_ja.txt").write_text("\n".join(lines), encoding="utf-8")
print("ok", sum(1 for q in raw if zh.get(q["id"], {}).get("type") == "text"))
