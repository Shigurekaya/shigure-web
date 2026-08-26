# -*- coding: utf-8 -*-
"""Find suspiciously short / junk answer aliases that would false-accept player typos."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
js = (ROOT / "js/gal-quiz-data.js").read_text(encoding="utf-8")
bank = json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", js, re.S).group(1))
raw = {
    q["id"]: q
    for q in json.loads((ROOT / "_quiz_raw/questions_raw.json").read_text(encoding="utf-8"))
}

# Primary JA answer (first)
lines = []
junk_hits = []
for q in bank:
    if q.get("type") != "text":
        continue
    answers = q.get("answers") or []
    if not answers:
        continue
    primary = answers[0]
    ja = (raw.get(q["id"], {}).get("answer_ja") or "").strip()
    for a in answers[1:]:
        an = a.strip()
        # very short CJK junk unrelated to numbering
        if an in ("屎", "催眠", "随便", "不知道", "はい", "是", "对", "错"):
            junk_hits.append((q["id"], an, primary[:40]))
        # single char that's not ①-⑧ 左 右 A-C
        if len(an) == 1 and an not in "①②③④⑤⑥⑦⑧左右ABCabcＡＢＣ一二三四":
            junk_hits.append((q["id"], an, "single-char"))
        # answer that is substring of explain only (heuristic): length 2-4 CJK and not in JA answer
        if 1 <= len(an) <= 2 and an not in ja and an not in "①②③④⑤⑥⑦⑧左右":
            # skip if primary contains it as number alias
            if an.isdigit() or an in "一二三四五六七八":
                continue
            junk_hits.append((q["id"], an, f"short? ja={ja[:30]}"))

out = ROOT / "_quiz_raw/_junk_alias_scan.txt"
lines = [f"{qid}\t{a!r}\t{note}" for qid, a, note in junk_hits]
out.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {out} hits={len(junk_hits)}")
