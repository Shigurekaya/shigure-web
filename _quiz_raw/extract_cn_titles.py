# -*- coding: utf-8 -*-
"""Extract unique Chinese work titles from quiz pack for Moegirl audit."""
from __future__ import annotations

import json
import re
from pathlib import Path

RAW = Path(__file__).resolve().parent
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
raw = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
raw_by = {q["id"]: q for q in raw}

titles: dict[str, list[str]] = {}  # title -> [qid:field, ...]

def add(title: str, where: str) -> None:
    t = title.strip()
    if not t or len(t) < 2:
        return
    # skip pure JP/EN short tokens without CJK
    if not re.search(r"[\u4e00-\u9fff]", t):
        return
    titles.setdefault(t, []).append(where)

for qid, z in zh.items():
    for t in re.findall(r"《([^》]+)》", z.get("question", "") + z.get("explain", "")):
        add(t, f"{qid}:《》")
    if z.get("type") == "text":
        for a in z.get("answers", []):
            if re.search(r"[\u4e00-\u9fff]", a) and len(a) >= 3:
                # likely work/song CN alias
                add(a, f"{qid}:answer")
    for o in z.get("options") or []:
        if re.search(r"[\u4e00-\u9fff]", o):
            add(o, f"{qid}:option")

# pair with ja answer when work-like
pairs = []
for qid, z in zh.items():
    r = raw_by.get(qid, {})
    ja = (r.get("answer_ja") or "").strip()
    if z.get("type") != "text":
        continue
    cn_from_explain = re.findall(r"《([^》]+)》", z.get("explain", ""))
    if ja and cn_from_explain:
        pairs.append({"id": qid, "answer_ja": ja, "explain_titles": cn_from_explain, "answers": z.get("answers", [])})

out = {
    "unique_cn_titles": sorted(titles.keys()),
    "title_usage": {k: v for k, v in sorted(titles.items())},
    "work_pairs": pairs,
}
(RAW / "moegirl_audit_extract.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"unique CN titles: {len(titles)}")
for t in sorted(titles.keys()):
    print(t)
