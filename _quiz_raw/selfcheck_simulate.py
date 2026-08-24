# -*- coding: utf-8 -*-
"""Simulate answering every question with correct answers."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from quiz_match import check_text

ROOT = Path(__file__).resolve().parents[1]


def load_bank() -> list[dict]:
    js = (ROOT / "js/gal-quiz-data.js").read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", js, re.S).group(1))


def main() -> int:
    bank = load_bank()
    fails = []
    for q in bank:
        if q["type"] == "choice":
            ans = q["answer"]
            idx = ans[0] if isinstance(ans, list) else ans
            ok = idx == ans if not isinstance(ans, list) else idx in ans
        else:
            user = q["answers"][0]
            ok = check_text(user, q["answers"])
        if not ok:
            fails.append(q["id"])

    if fails:
        print("SIMULATION FAILED: correct answers not accepted for:", fails)
        return 1
    print(f"SIMULATION OK: {len(bank)} questions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
