# -*- coding: utf-8 -*-
"""Audit gal-quiz bank for answer leaks and data issues."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "js" / "gal-quiz-data.js"


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKC", str(s or "")).lower()
    for ch in " \u3000「」『』【】[]()（）\"'""''.,。，!！?？~～・·♥♡★☆†‡=＝:：;；/、-—":
        s = s.replace(ch, "")
    return s.replace("ー", "").replace("〜", "")


def load_bank() -> list[dict]:
    text = JS.read_text(encoding="utf-8")
    m = re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S)
    return json.loads(m.group(1))


def main() -> None:
    bank = load_bank()
    leaks = []
    choice_opts_in_q = []
    missing_media = []
    empty_answers = []
    short_text_answers = []

    for q in bank:
        qid = q["id"]
        text = norm(q.get("question", ""))
        raw_q = q.get("question", "")

        if q.get("type") == "choice":
            opts = q.get("options", [])
            ans_idx = q.get("answer", 0)
            ans_list = ans_idx if isinstance(ans_idx, list) else [ans_idx]
            for i in ans_list:
                if i < len(opts):
                    a = norm(opts[i])
                    if a and len(a) >= 2 and a in text:
                        leaks.append(
                            {
                                "id": qid,
                                "kind": "choice_correct_in_question",
                                "value": opts[i],
                                "question": raw_q[:100],
                            }
                        )
            # options listed verbatim in question (odd-one-out style)
            hits = sum(1 for o in opts if norm(o) and len(norm(o)) >= 3 and norm(o) in text)
            if hits >= len(opts) - 1 and len(opts) >= 3:
                choice_opts_in_q.append({"id": qid, "hits": hits, "total": len(opts), "question": raw_q[:80]})
        else:
            for a in q.get("answers", []):
                an = norm(a)
                if an and len(an) >= 3 and an in text:
                    leaks.append(
                        {
                            "id": qid,
                            "kind": "text_answer_in_question",
                            "value": a,
                            "question": raw_q[:100],
                        }
                    )
                if not an:
                    empty_answers.append(qid)
                elif len(an) < 2:
                    short_text_answers.append({"id": qid, "answer": a})

        for rel in q.get("images", []) + q.get("audio", []) + q.get("video", []):
            p = ROOT / rel.lstrip("/")
            if not p.is_file():
                missing_media.append({"id": qid, "path": rel})

    print(f"Total: {len(bank)}")
    print(f"Direct answer leaks: {len(leaks)}")
    for x in leaks:
        print(f"  [{x['id']}] {x['kind']}: {x['value']!r}")
        print(f"    Q: {x['question']}")

    print(f"\nChoice questions with options embedded in stem: {len(choice_opts_in_q)}")
    for x in choice_opts_in_q:
        print(f"  [{x['id']}] {x['hits']}/{x['total']} options in question")

    print(f"\nMissing media: {len(missing_media)}")
    for x in missing_media[:20]:
        print(f"  [{x['id']}] {x['path']}")
    if len(missing_media) > 20:
        print(f"  ... and {len(missing_media)-20} more")

    out = Path(__file__).parent / "audit_results.json"
    out.write_text(
        json.dumps(
            {
                "leaks": leaks,
                "choice_opts_in_q": choice_opts_in_q,
                "missing_media": missing_media,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
