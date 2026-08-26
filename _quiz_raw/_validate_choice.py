# -*- coding: utf-8 -*-
"""Validate all choice questions in zh_pack.json."""
import json
from pathlib import Path

zh = json.loads(Path(__file__).with_name("zh_pack.json").read_text(encoding="utf-8"))
issues = []
for qid, z in zh.items():
    if z.get("type") != "choice":
        issues.append(f"{qid}: not choice ({z.get('type')})")
        continue
    opts = z.get("options") or []
    ans = z.get("answer")
    if len(opts) < 2:
        issues.append(f"{qid}: too few options ({len(opts)})")
    if not isinstance(ans, int) or ans < 0 or ans >= len(opts):
        issues.append(f"{qid}: bad answer index {ans}")
    if len(set(opts)) != len(opts):
        issues.append(f"{qid}: duplicate options")
    if any(not str(o).strip() for o in opts):
        issues.append(f"{qid}: empty option")
    if not z.get("question", "").strip():
        issues.append(f"{qid}: empty question")

print("questions", len(zh))
print("choice", sum(1 for v in zh.values() if v.get("type") == "choice"))
print("text", sum(1 for v in zh.values() if v.get("type") == "text"))
print("issues", len(issues))
for i in issues:
    print(i)
