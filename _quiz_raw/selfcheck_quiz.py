# -*- coding: utf-8 -*-
"""Self-check gal-quiz bank + runtime invariants."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from quiz_match import check_text, normalize as norm

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "js" / "gal-quiz-data.js"
HTML = ROOT / "gal-quiz.html"
QUIZ_JS = ROOT / "js" / "gal-quiz.js"

# ima-ero 原题在题干中列出全部候选项（含正确答案），属正常题型
LEAK_EXEMPT = {"s3-05", "s4-08"}


def load_bank() -> list[dict]:
    text = JS.read_text(encoding="utf-8")
    m = re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S)
    return json.loads(m.group(1))


def main() -> int:
    bank = load_bank()
    errors = []

    # count in html
    html = HTML.read_text(encoding="utf-8")
    m = re.search(r"共\s*(\d+)\s*题", html)
    html_count = int(m.group(1)) if m else 0
    if html_count != len(bank):
        errors.append(f"HTML says {html_count} questions, bank has {len(bank)}")

    ids = [q["id"] for q in bank]
    if len(ids) != len(set(ids)):
        errors.append("Duplicate question ids")

    for q in bank:
        qid = q["id"]
        text = norm(q.get("question", ""))

        if q.get("type") == "choice":
            opts = q.get("options", [])
            if not opts:
                errors.append(f"{qid}: choice without options")
            ans = q.get("answer", 0)
            ans_list = ans if isinstance(ans, list) else [ans]
            for i in ans_list:
                if i >= len(opts):
                    errors.append(f"{qid}: answer index out of range")
                elif norm(opts[i]) in text and len(norm(opts[i])) >= 3:
                    errors.append(f"{qid}: correct option in question: {opts[i]}")
            hits = sum(1 for o in opts if norm(o) and len(norm(o)) >= 3 and norm(o) in text)
            if hits >= 2:
                errors.append(f"{qid}: {hits} options embedded in question stem")
        else:
            if not q.get("answers"):
                errors.append(f"{qid}: text question without answers")
            if qid not in LEAK_EXEMPT:
                for a in q.get("answers", []):
                    if norm(a) in text and len(norm(a)) >= 3:
                        errors.append(f"{qid}: text answer in question: {a}")

        for rel in q.get("images", []) + q.get("audio", []) + q.get("video", []):
            if not (ROOT / rel.lstrip("/")).is_file():
                errors.append(f"{qid}: missing media {rel}")

    quiz_src = QUIZ_JS.read_text(encoding="utf-8")
    if "recordCurrent" not in quiz_src:
        errors.append("gal-quiz.js missing recordCurrent (deferred review)")
    if "mountMedia" not in quiz_src:
        errors.append("gal-quiz.js missing mountMedia (question media)")
    if 'loading="lazy"' in quiz_src:
        errors.append("gal-quiz.js uses lazy loading for quiz media")
    if "renderLiveReview" in quiz_src:
        errors.append("gal-quiz.js still has per-question live review")

    # simulate canonical answers
    import subprocess
    _sub_kw = {"capture_output": True, "text": True, "encoding": "utf-8", "errors": "replace"}
    r = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "selfcheck_simulate.py")],
        **_sub_kw,
    )
    if r.returncode != 0:
        errors.append(f"answer simulation failed: {(r.stdout or '').strip() or (r.stderr or '').strip()}")

    r2 = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "audit_answer_images.py")],
        **_sub_kw,
    )
    if "Found 0 questions" not in (r2.stdout or ""):
        errors.append(f"answer-reveal image leak: {(r2.stdout or '').strip() or (r2.stderr or '').strip()}")

    r3 = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "deep_audit_quiz.py")],
        **_sub_kw,
    )
    if r3.returncode != 0:
        errors.append(f"deep audit failed: {(r3.stdout or '').strip() or (r3.stderr or '').strip()}")

    if errors:
        print("SELF-CHECK FAILED:")
        for e in errors:
            print(" ", e)
        return 1

    print(f"SELF-CHECK OK: {len(bank)} questions, 0 leaks, all media present, UX hooks present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
