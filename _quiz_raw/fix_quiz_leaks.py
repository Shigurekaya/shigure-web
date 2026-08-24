# -*- coding: utf-8 -*-
"""Expanded audit + auto-fix question leaks in zh_pack.json"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
ZH = RAW / "zh_pack.json"
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


# Manual + rule-based question fixes (zh_pack question field only)
FIXES: dict[str, str] = {
    "s1-05": "下列 Gal 作品有一个共同点（均已动画化）。请从选项中选出唯一没有动画化的那一部。",
    "s1-06": "下列 Gal 作品有一个共同点（均含三角关系）。请从选项中选出唯一不含三角关系的那一部。",
    "s1-07": "下列 Nitro+ 系作品有一个共同点（剧本均与虚渊玄有关）。请从选项中选出唯一与虚渊玄无关的那一部。",
    "s1-08": "下列 Gal 作品有一个共同点（均以夏天为舞台）。请从选项中选出唯一不以夏天为舞台的那一部。",
    "s1-09": "请根据图片：把图中三位人物按年龄从高到低排列，填写编号顺序。",
    "s1-21": "请根据音频（体验版）：这位角色的声优是谁？",
    "s2-05": "《ヘンタイ・プリズン》里外号「ブランコすりの金さん」是因何入狱？",
    "s2-21": "请根据音频（体验版）：这位角色的声优是谁？",
    "s2-22": "请根据音频（体验版）：这位角色的声优是谁？",
    "s3-05": "下列部活中，唯一「从未在エロゲ出现且没有女主所属」的是？",
    "s3-08": "请根据图片：三件 T 恤（A/B/C）分别由哪位女主穿着？按 ①②③ 顺序写出对应字母。",
    "s3-09": "下列多部 Gal 作品有什么共同点？",
    "s3-10": "补全《车轮之国、向日葵的少女》法月将臣的台词——「森田は になるんだ？」",
    "s3-11": "以「それは、一振りのバイブであった。」开篇的作品标题是？",
    "s3-12": "下列注意事项出自哪部作品？",
    "s3-22": "请根据音频（体验版）：这位角色的声优是谁？",
    "s4-02": "「ある/なし」クイズ中，「ある」一侧的共同点是？",
    "s4-03": "补全《景の海のアペイリア》台词黑条部分。",
    "s4-04": "补全《Fate/stay night》无限剑制咏唱最后一句日文。",
    "s4-08": "请根据图片：下方三位角色分别出自哪部作品？",
    "s4-21": "请根据音频（体验版）：这位角色的声优是谁？",
    "s4-22": "请根据音频（体验版）：这位角色的声优是谁？",
    "s5-02": "下列官方梗概出自哪部作品？",
    "s5-03": "补全《义妹达との生活は気持ちいいけど少し疲れる》黑条台词（近义即可）。",
    "s5-21": "请根据音频（体验版）：这位角色的声优是谁？",
    "s5-22": "请根据音频（体验版）：这位角色的声优是谁？",
}


def strip_example_leaks(question: str) -> str:
    """Remove （如 …） / （例：…） segments that look like format hints with concrete values."""
    q = re.sub(r"[（(]如[^）)]*[）)]", "", question)
    q = re.sub(r"[（(]例[：:][^）)]*[）)]", "", q)
    q = re.sub(r"\s{2,}", " ", q).strip()
    return q


def fix_odd_one_out(question: str) -> str | None:
    if "落单" not in question and "共同点" not in question:
        return None
    if "/" not in question and "／" not in question:
        return None
    # already fixed manually for s1-05..08
    return None


def apply_fixes() -> list[str]:
    zh = json.loads(ZH.read_text(encoding="utf-8"))
    changed: list[str] = []

    for qid, new_q in FIXES.items():
        if qid in zh and zh[qid].get("question") != new_q:
            zh[qid]["question"] = new_q
            changed.append(qid)

    for qid, entry in zh.items():
        old = entry.get("question", "")
        new = strip_example_leaks(old)
        if new != old and qid not in FIXES:
            entry["question"] = new
            changed.append(f"{qid}:strip_example")

    ZH.write_text(json.dumps(zh, ensure_ascii=False, indent=2), encoding="utf-8")
    return changed


def audit(bank: list[dict]) -> dict:
    leaks = []
    partial = []
    opts_in_q = []

    for q in bank:
        qid = q["id"]
        text = norm(q.get("question", ""))
        raw = q.get("question", "")

        if q.get("type") == "choice":
            opts = q.get("options", [])
            ans_idx = q.get("answer", 0)
            ans_list = ans_idx if isinstance(ans_idx, list) else [ans_idx]
            for i in ans_list:
                if i < len(opts):
                    a = norm(opts[i])
                    if a and len(a) >= 3 and a in text:
                        leaks.append({"id": qid, "kind": "correct_in_q", "value": opts[i]})
                    elif a and len(a) >= 4:
                        # partial: first 4+ chars of answer in question
                        for n in (4, 5, 6):
                            if len(a) >= n and a[:n] in text:
                                partial.append({"id": qid, "value": opts[i], "frag": a[:n]})
                                break
            hits = sum(1 for o in opts if norm(o) and len(norm(o)) >= 3 and norm(o) in text)
            if hits >= 2:
                opts_in_q.append({"id": qid, "hits": hits, "question": raw[:70]})
        else:
            for a in q.get("answers", []):
                an = norm(a)
                if an and len(an) >= 3 and an in text:
                    leaks.append({"id": qid, "kind": "text_in_q", "value": a})

    return {"leaks": leaks, "partial": partial, "opts_in_q": opts_in_q}


def main() -> None:
    changed = apply_fixes()
    subprocess.run([sys.executable, str(RAW / "build_bank.py")], check=True)
    bank = load_bank()
    report = audit(bank)
    out = RAW / "audit_after_fix.json"
    out.write_text(
        json.dumps({"changed": changed, **report}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("Fixed entries:", len(changed), changed)
    print("Remaining direct leaks:", len(report["leaks"]))
    for x in report["leaks"]:
        print(f"  {x['id']}: {x.get('value','')}")
    print("Partial leaks:", len(report["partial"]))
    for x in report["partial"]:
        print(f"  {x['id']}: {x['value']}")
    print("Options embedded in stem (>=2 hits):", len(report["opts_in_q"]))
    for x in report["opts_in_q"]:
        print(f"  {x['id']}: {x['hits']} hits")


if __name__ == "__main__":
    main()
