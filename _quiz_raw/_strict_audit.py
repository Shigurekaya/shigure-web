# -*- coding: utf-8 -*-
"""Strict JA↔ZH content audit focusing on answer correctness."""
import json
import re
from pathlib import Path

RAW = Path(__file__).resolve().parent
raw = {q["id"]: q for q in json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))}
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))

CIRC = "①②③④⑤⑥⑦⑧⑨⑩"
circ_map = {c: str(i + 1) for i, c in enumerate(CIRC)}


def strip_circ(s: str) -> str:
    for c, n in circ_map.items():
        s = s.replace(c, n)
    return s


def core(s: str) -> str:
    s = strip_circ(str(s or ""))
    s = re.sub(r"\s+", "", s)
    for ch in "「」『』【】[]()（）\"'""''.,。，!！?？~～・·♥♡★☆†‡=＝:：;；→←／/、　":
        s = s.replace(ch, "")
    return s.lower()


rows = []
for qid, q in raw.items():
    z = zh[qid]
    ja = q.get("answer_ja") or ""
    if z.get("type") == "choice":
        ans = z["options"][z["answer"]]
        # For numbered JA like ①xxx, compare body
        m = re.match(r"^[①②③④⑤⑥⑦⑧⑨⑩]\s*(.+)$", ja.strip().replace("　", " "))
        ja_body = m.group(1) if m else ja
        ok = core(ans) in core(ja) or core(ja_body) in core(ans) or core(ans) == core(ja_body)
        # also accept if ja is pure number matching option
        if not ok and core(ja) in {core(ans), strip_circ(ans).strip()}:
            ok = True
        if not ok:
            # semantic paraphrase markers — record for manual
            rows.append(f"MANUAL\t{qid}\tJA={ja}\tZH={ans}")
    else:
        answers = z.get("answers") or []
        ja_c = core(ja)
        hit = any(core(a) and (core(a) in ja_c or ja_c in core(a) or core(a)[:6] in ja_c) for a in answers)
        # blanks questions: check keys appear in JA
        if z.get("match_blanks"):
            hit = True
            for keys in z["match_blanks"]:
                if not any(core(k) in ja_c for k in keys):
                    # left/right order: still ok if any key in ja
                    if not any(core(k) in ja_c for k in keys):
                        hit = False
        if not hit and len(ja_c) >= 2:
            # check first answer is jp original fragment
            first = answers[0] if answers else ""
            if core(first)[:8] not in ja_c and ja_c[:8] not in core(first):
                rows.append(f"TEXT?\t{qid}\tJA={ja[:60]}\tZH0={first[:60]}")

(RAW / "_strict_audit.txt").write_text("\n".join(rows) or "NONE", encoding="utf-8")
print(len(rows))
print("\n".join(rows[:40]))
