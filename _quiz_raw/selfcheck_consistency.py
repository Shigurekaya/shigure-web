# -*- coding: utf-8 -*-
"""Cross-file consistency: questions_raw, zh_pack, gal-quiz-data, media_map."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent


def load_bank() -> list[dict]:
    js = (ROOT / "js/gal-quiz-data.js").read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", js, re.S).group(1))


def main() -> int:
    raw = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
    zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
    bank = load_bank()
    media = json.loads((RAW / "media_local_map.json").read_text(encoding="utf-8"))

    raw_ids = [q["id"] for q in raw]
    bank_ids = [q["id"] for q in bank]
    zh_ids = list(zh.keys())
    media_ids = list(media.keys())

    errors = []
    if raw_ids != bank_ids:
        errors.append("questions_raw ids != gal-quiz-data ids")
    if set(zh_ids) != set(bank_ids):
        missing = set(bank_ids) - set(zh_ids)
        extra = set(zh_ids) - set(bank_ids)
        if missing:
            errors.append(f"zh_pack missing: {sorted(missing)}")
        if extra:
            errors.append(f"zh_pack extra: {sorted(extra)}")
    if set(media_ids) != set(bank_ids):
        errors.append("media_local_map keys mismatch bank ids")

    for q in bank:
        z = zh[q["id"]]
        if q["question"] != z["question"]:
            errors.append(f"{q['id']}: question mismatch zh_pack vs bank")
        if q["type"] != z["type"]:
            errors.append(f"{q['id']}: type mismatch")

    if errors:
        print("CONSISTENCY FAILED:")
        for e in errors:
            print(" ", e)
        return 1

    print(
        f"CONSISTENCY OK: raw={len(raw)} zh={len(zh)} bank={len(bank)} media={len(media)} aligned"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
