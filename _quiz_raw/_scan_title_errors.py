# -*- coding: utf-8 -*-
"""Find likely wrong CN titles / junk aliases for quiz pack."""
import json
import re
from pathlib import Path

RAW = Path(__file__).resolve().parent
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
raw = {q["id"]: q for q in json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))}

# Known confirmed wrong / suspicious pairs to fix
KNOWN_FIXES = [
    ("流景之海", "景之海"),
    ("Happiness Mare", "Hapymaher"),
    ("大恶党", "吸血鬼搞事情"),  # prefer official; also keep 龙骑士骚动
    ("无限轮回", None),  # junk for Muv-Luv
    ("携爱而来", "携爱敬上"),
    ("白羽", "白玉"),
]

# Extract 《》 titles from questions/explains
pat = re.compile(r"《([^》]+)》")
lines = []
for qid, z in zh.items():
    text = (z.get("question") or "") + "\n" + (z.get("explain") or "")
    titles = pat.findall(text)
    answers = []
    if z.get("type") == "choice":
        answers = [z["options"][z["answer"]]]
    else:
        answers = z.get("answers") or []
    for t in titles:
        for bad, good in KNOWN_FIXES:
            if bad and bad in t:
                lines.append(f"{qid}\tTITLE\t{t}\tfix->{good}")
    for a in answers:
        for bad, good in KNOWN_FIXES:
            if bad and bad in a:
                lines.append(f"{qid}\tANS\t{a}\tfix->{good}")

# Also list all 《》 titles for manual scan
all_titles = []
for qid, z in zh.items():
    text = (z.get("question") or "") + "\n" + (z.get("explain") or "")
    for t in pat.findall(text):
        all_titles.append(f"{qid}\t{t}")

(RAW / "_title_scan.txt").write_text(
    "FIXES:\n" + "\n".join(lines) + "\n\nALL_TITLES:\n" + "\n".join(all_titles),
    encoding="utf-8",
)
print("fixes", len(lines))
print("\n".join(lines))
