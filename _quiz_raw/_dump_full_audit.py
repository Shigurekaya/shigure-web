# -*- coding: utf-8 -*-
"""Dump JA vs ZH for full quiz audit."""
import json
from pathlib import Path

RAW = Path(__file__).resolve().parent
raw = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))

lines = []
for q in raw:
    z = zh.get(q["id"], {})
    lines.append(f"===== {q['id']} type={z.get('type')} =====")
    lines.append("JA_Q: " + (q.get("question_ja") or "").replace("\n", " / "))
    lines.append("JA_A: " + (q.get("answer_ja") or "").replace("\n", " / "))
    lines.append("JA_E: " + (q.get("explain_ja") or "").replace("\n", " / ")[:300])
    lines.append("ZH_Q: " + (z.get("question") or "").replace("\n", " / "))
    if z.get("type") == "choice":
        opts = z.get("options") or []
        ans = z.get("answer")
        lines.append("ZH_OPTS: " + " | ".join(f"{i}:{o}" for i, o in enumerate(opts)))
        lines.append(f"ZH_ANS_IDX: {ans} => {opts[ans] if isinstance(ans, int) and 0 <= ans < len(opts) else '?'}")
    else:
        lines.append("ZH_A: " + " | ".join(z.get("answers") or []))
        if z.get("match_blanks"):
            lines.append("ZH_BLANKS: " + json.dumps(z["match_blanks"], ensure_ascii=False))
    lines.append("ZH_E: " + (z.get("explain") or "").replace("\n", " / ")[:300])
    lines.append("")

out = RAW / "_full_ja_zh_audit.txt"
out.write_text("\n".join(lines), encoding="utf-8")
print("wrote", out, "qs", len(raw))
