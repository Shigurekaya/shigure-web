# -*- coding: utf-8 -*-
"""Audit choice questions for answer leaks in question stem."""
import json
import re
from pathlib import Path

RAW = Path(__file__).resolve().parent


def normalize(s: str) -> str:
    s = str(s or "")
    for ch in "「」『』【】[]()（）\"'""''.,。，!！?？~～・·♥♡★☆†‡=＝:：;；":
        s = s.replace(ch, "")
    return re.sub(r"[\s\u3000]", "", s).lower()


bank_path = RAW.parent / "js" / "gal-quiz-data.js"
text = bank_path.read_text(encoding="utf-8")
bank = json.loads(text.split("window.GAL_QUIZ_BANK = ", 1)[1].rsplit(";", 1)[0])

leaks = []
for q in bank:
    if q.get("type") != "choice":
        continue
    stem = normalize(q["question"])
    idxs = q["answer"] if isinstance(q["answer"], list) else [q["answer"]]
    for i in idxs:
        a = normalize(q["options"][i])
        if len(a) >= 3 and a in stem:
            leaks.append(f"{q['id']}:{q['options'][i]}")
    hits = [o for o in q["options"] if len(normalize(o)) >= 3 and normalize(o) in stem]
    if len(hits) >= 2:
        leaks.append(f"{q['id']}:multi_opts ({len(hits)})")

print("leaks", len(leaks))
for x in leaks:
    print(x)
