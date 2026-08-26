# -*- coding: utf-8 -*-
"""Verify choice answers match JA; list remaining title suspects."""
import json
import re
from pathlib import Path

RAW = Path(__file__).resolve().parent
raw = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))

def norm(s):
    s = str(s or "")
    for ch in " 　\t\n「」『』【】[]()（）\"'.,。，!！?？~～・·=＝:：;；①②③④⑤⑥⑦⑧⑨⑩":
        s = s.replace(ch, "")
    return s.lower()

issues = []
for q in raw:
    z = zh[q["id"]]
    ja = q.get("answer_ja") or ""
    if z.get("type") != "choice":
        continue
    opts = z.get("options") or []
    idx = z.get("answer")
    if not isinstance(idx, int) or idx < 0 or idx >= len(opts):
        issues.append(f"{q['id']}: bad index {idx}")
        continue
    chosen = opts[idx]
    # JA often prefixes with ① etc.
    ja_n = norm(ja)
    ch_n = norm(chosen)
    # extract circled number content from JA if present
    m = re.search(r"[①②③④⑤⑥⑦⑧⑨⑩](.+)$", ja.replace(" ", "").replace("　", ""))
    ja_core = norm(m.group(1) if m else ja)
    if ch_n not in ja_n and ja_core not in ch_n and ch_n not in ja_core:
        # soft check: all significant chars of chosen appear in ja
        if len(ch_n) >= 2 and (ch_n[:4] in ja_n or ja_core[:4] in ch_n):
            continue
        issues.append(f"{q['id']}: JA=[{ja}] CHOSEN=[{chosen}]")

# title scan in Q/E
pat = re.compile(r"《([^》]+)》")
suspect_words = ["流景", "大恶党", "携爱而来", "白羽", "无限轮回", "Happiness Mare", "莉奈"]
title_hits = []
for qid, z in zh.items():
    blob = (z.get("question") or "") + "\n" + (z.get("explain") or "") + "\n" + "\n".join(
        (z.get("answers") or []) + (z.get("options") or [])
    )
    for w in suspect_words:
        if w in blob:
            title_hits.append(f"{qid}: still has [{w}]")

out = RAW / "_choice_verify.txt"
out.write_text(
    "CHOICE_MISMATCH:\n" + "\n".join(issues) + "\n\nSUSPECT_LEFT:\n" + "\n".join(title_hits),
    encoding="utf-8",
)
print("mismatch", len(issues))
for x in issues[:30]:
    print(x)
print("suspect_left", len(title_hits))
for x in title_hits:
    print(x)
