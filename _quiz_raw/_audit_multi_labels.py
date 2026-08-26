# -*- coding: utf-8 -*-
"""Find multi-image questions that need numbered labels but UI won't attach them."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
js = (ROOT / "js" / "gal-quiz-data.js").read_text(encoding="utf-8")
bank = json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", js, re.S).group(1))

LR_Q = re.compile(r"左.*右|右.*左|哪边")
DUAL_Q = re.compile(r"①与②|①.*②")
TRIPLE = re.compile(r"①.*②.*③|①～③|①②③|三句|三张|3张")
NUM_ASK = re.compile(r"①～[④⑤⑥⑦⑧]|①〜[④⑤⑥⑦⑧]|①～④|①～⑥|①～⑧|①～⑦|①～⑤|几号|编号|①～③")


def compare_layout(q):
    imgs = q.get("images") or []
    text = q.get("question") or ""
    n = len(imgs)
    if n == 2:
        if LR_Q.search(text):
            return "lr"
        if DUAL_Q.search(text):
            return "dual"
        if re.search(r"提示图|ヒント|参考にして|可参考", text):
            return "hint2"
    if n == 3 and TRIPLE.search(text):
        return "triple"
    if n == 4 and re.search(r"①～④|①〜④", text):
        return "quad"
    if n == 7 and re.search(r"①～⑦|①〜⑦", text):
        return "sept"
    if n == 6 and re.search(r"T\s*恤|Ｔシャツ", text) and re.search(
        r"①.*②.*③|①②③|①～③", text
    ):
        return "tee"
    if n == 6 and re.search(r"乐器|楽器", text) and re.search(r"A/B/C|Ａ|①", text):
        return "instrument"
    if (
        n == 6
        and re.search(r"下方|下３|下3|候选", text)
        and not re.search(r"T\s*恤|Ｔシャツ|乐器|楽器", text)
    ):
        return "ref6"
    return None


rows = []
for q in bank:
    imgs = q.get("images") or []
    n = len(imgs)
    if n < 2:
        continue
    layout = compare_layout(q)
    stem = q["question"]
    needs_num = bool(NUM_ASK.search(stem)) or bool(re.search(r"[①②③④⑤⑥⑦⑧]", stem))
    problem = needs_num and layout is None
    rows.append(
        {
            "id": q["id"],
            "n": n,
            "layout": layout,
            "needs_num": needs_num,
            "problem": problem,
            "stem": stem.replace("\n", " / ")[:120],
            "images": imgs,
        }
    )

out = ROOT / "_quiz_raw/_multi_image_label_audit.txt"
lines = []
probs = [r for r in rows if r["problem"]]
ok = [r for r in rows if not r["problem"]]
lines.append(f"multi-image questions: {len(rows)}")
lines.append(f"PROBLEM (need numbers, no UI labels): {len(probs)}")
for r in probs:
    lines.append(f"\n!! {r['id']} n={r['n']} layout={r['layout']}")
    lines.append(f"   {r['stem']}")
    for i, p in enumerate(r["images"], 1):
        lines.append(f"   [{i}] {p}")
lines.append("\n--- OK / labeled ---")
for r in ok:
    lines.append(f"ok {r['id']} n={r['n']} layout={r['layout']} needs_num={r['needs_num']}")
    lines.append(f"   {r['stem']}")

out.write_text("\n".join(lines), encoding="utf-8")
print(f"problems {len(probs)}")
