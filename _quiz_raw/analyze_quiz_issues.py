# -*- coding: utf-8 -*-
"""Deep analysis for potential gal-quiz bugs."""
from __future__ import annotations

import json
import re
from pathlib import Path

from quiz_match import check_text, normalize

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "js" / "gal-quiz-data.js"


def load_bank() -> list[dict]:
    text = JS.read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S).group(1))


def main() -> None:
    bank = load_bank()
    raw = json.loads((ROOT / "_quiz_raw/questions_raw.json").read_text(encoding="utf-8"))
    raw_by = {q["id"]: q for q in raw}

    cross_fp = []
    empty_ex = []
    choice_subset = []
    loose_accept = []

    junk_inputs = ["test", "aaa", "fair", "air", "123", "不知道", "随便", "a"]

    for q in bank:
        qid = q["id"]
        if not (q.get("explain") or "").strip():
            empty_ex.append(qid)

        if q.get("type") == "choice":
            if qid == "s1-01":
                choice_subset.append((qid, len(q["options"]), 6))
            if qid == "s5-01":
                choice_subset.append((qid, len(q["options"]), 5))
            continue

        answers = q.get("answers", [])
        norms = [(a, normalize(a)) for a in answers]
        for i, (a1, n1) in enumerate(norms):
            for j, (a2, n2) in enumerate(norms):
                if i >= j or len(n1) < 2 or len(n2) < 2:
                    continue
                if n1 in n2 or n2 in n1:
                    cross_fp.append((qid, a1[:40], a2[:40]))

        for junk in junk_inputs:
            if check_text(junk, answers):
                loose_accept.append((qid, junk, answers[0][:30]))

    for qid in ("s1-05", "s1-06", "s1-07", "s1-08"):
        q = next(x for x in bank if x["id"] == qid)
        choice_subset.append((qid, len(q["options"]), 6))

    full_pts = 100 / len(bank)

    report = {
        "total": len(bank),
        "choice_count": sum(1 for q in bank if q["type"] == "choice"),
        "text_count": sum(1 for q in bank if q["type"] == "text"),
        "empty_explain": empty_ex,
        "answer_cross_substring": cross_fp,
        "choice_option_subset": choice_subset,
        "junk_false_positive": loose_accept,
        "full_mode_pts_per_q": full_pts,
        "full_perfect_score": round(len(bank) * full_pts, 4),
    }
    out = ROOT / "_quiz_raw" / "analyze_issues_report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out} — junk_fp={len(loose_accept)}")


if __name__ == "__main__":
    main()
