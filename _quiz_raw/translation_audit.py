# -*- coding: utf-8 -*-
"""Full translation audit: zh_pack vs questions_raw + alias coverage."""
from __future__ import annotations

import json
import re
from pathlib import Path

from quiz_match import check_text, normalize

RAW = Path(__file__).resolve().parent
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
raw = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
raw_by = {q["id"]: q for q in raw}

WORK_Q = re.compile(
    r"作品|校服|曲名|标题|广告语|类型名|开篇|哪部|Galgame|OP|ED|启动图标|圣地|包装|模仿|填什么|哪部作品"
)

# 已知需人工跳过的 explain 引用（非本题答案）
SKIP_EXPLAIN = {
    "s1-10": {"学园催眠隶奴"},
    "s3-05": {
        "绽放★青春全力向前冲！",
        "在这苍穹展翅",
        "无人知晓的天体之泪",
        "纯白交响曲",
        "乙女剑与秘密协奏曲",
    },
    "s3-06": {"纯白交响曲", "大图书馆的牧羊人", "喜欢我的话就要说出来！"},
    "s3-08": {"乙女剑与秘密协奏曲", "Liminal Border", "巨乳飞机杯妖怪与乡下生活"},
    "s3-11": {"Fate/stay night"},
    "s4-10": {"种付大叔 VS 迷你裙警察"},
    "s5-12": {"恋岚Spirichu", "恋岚 Spirit"},
}

SUSPECT_PATTERNS = [
    (re.compile(r"拔作创意"), "误译作品名（应为常轨脱离Creative）"),
    (re.compile(r"从吻开始的自我中心"), "作品名可能误译（应为从Kiss开始的自我主义）"),
    (re.compile(r"《搾精"), "题干用日文旧字搾，explain 应用统一译名「榨精病栋」"),
]

issues: list[dict] = []

for qid in sorted(zh.keys(), key=lambda x: (int(x.split("-")[0][1:]), int(x.split("-")[1]))):
    z = zh[qid]
    r = raw_by.get(qid, {})
    blob = (z.get("question", "") + z.get("explain", "")).strip()

    for pat, msg in SUSPECT_PATTERNS:
        if pat.search(blob):
            issues.append({"id": qid, "kind": "suspect_translation", "detail": msg, "text": pat.search(blob).group(0)})

    if z.get("type") == "text":
        answers = z.get("answers", [])
        explain = z.get("explain", "")
        skip = SKIP_EXPLAIN.get(qid, set())

        for title in re.findall(r"《([^》]+)》", explain):
            if title in skip:
                continue
            if WORK_Q.search(z.get("question", "")) or WORK_Q.search(explain):
                if not check_text(title, answers):
                    issues.append(
                        {
                            "id": qid,
                            "kind": "explain_title_not_answer",
                            "detail": title,
                        }
                    )

        # explain 引用但答案未收录的常见作品（多题引用）
        for title in re.findall(r"《([^》]+)》", explain):
            if title in skip:
                continue
            if not check_text(title, answers) and len(title) >= 4:
                if not any(i["id"] == qid and i.get("detail") == title for i in issues):
                    issues.append(
                        {
                            "id": qid,
                            "kind": "explain_ref_not_in_answers",
                            "detail": title,
                        }
                    )

    # 日文 answer_ja 与首条中文答案是否明显脱节（作品题）
    ans_ja = (r.get("answer_ja") or "").strip()
    if z.get("type") == "text" and ans_ja and len(ans_ja) > 2 and ans_ja[0] not in "①②③123":
        if not check_text(ans_ja, z.get("answers", [])):
            issues.append(
                {
                    "id": qid,
                    "kind": "answer_ja_not_accepted",
                    "detail": ans_ja[:80],
                }
            )

out = RAW / "translation_audit.json"
out.write_text(json.dumps(issues, ensure_ascii=False, indent=2), encoding="utf-8")

by_kind: dict[str, int] = {}
for i in issues:
    by_kind[i["kind"]] = by_kind.get(i["kind"], 0) + 1

print(f"Translation audit: {len(issues)} issues")
for k, n in sorted(by_kind.items()):
    print(f"  {k}: {n}")
print()
for i in issues:
    print(f"{i['id']} [{i['kind']}] {i['detail']}")
print(f"\nWrote {out}")
