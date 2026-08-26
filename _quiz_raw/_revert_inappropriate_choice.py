# -*- coding: utf-8 -*-
"""Revert open-recall questions from choice back to text in zh_pack.json."""
from __future__ import annotations

import json
from pathlib import Path

RAW = Path(__file__).resolve().parent

# Open recall: identification, audio, catchcopy, long names, artist names
REVERT_IDS = {
    # uniform / room / pilgrimage / icon / parody
    "s1-16",
    "s1-17",
    "s1-18",
    "s1-19",
    "s1-20",
    "s2-01",
    "s2-14",
    "s2-20",
    "s3-02",
    "s3-21",
    "s4-13",
    "s4-14",
    "s4-19",
    "s4-20",
    "s5-14",
    "s5-19",
    "s5-20",
    # multi-part open (mecha names)
    "s1-11",
    # long name / artist
    "s1-12",
    "s1-13",
    "s3-19",
    # catchcopy / genre / synopsis / opening line / warning
    "s2-16",
    "s2-17",
    "s3-11",
    "s3-12",
    "s4-05",
    "s4-06",
    "s4-18",
    "s5-02",
    "s5-05",
    "s5-06",
    # audio (seiyuu / song / bgm)
    "s1-21",
    "s1-22",
    "s1-23",
    "s1-24",
    "s1-25",
    "s2-21",
    "s2-22",
    "s2-23",
    "s2-24",
    "s2-25",
    "s3-22",
    "s3-23",
    "s3-24",
    "s3-25",
    "s4-21",
    "s4-22",
    "s4-23",
    "s4-24",
    "s4-25",
    "s5-21",
    "s5-22",
    "s5-23",
    "s5-24",
    "s5-25",
}


def main() -> None:
    zh_path = RAW / "zh_pack.json"
    dump_path = RAW / "_text_qs_dump.json"
    zh = json.loads(zh_path.read_text(encoding="utf-8"))
    dump = {row["id"]: row for row in json.loads(dump_path.read_text(encoding="utf-8"))}

    missing_dump = sorted(REVERT_IDS - set(dump))
    missing_zh = sorted(REVERT_IDS - set(zh))
    if missing_dump:
        raise SystemExit(f"missing in dump: {missing_dump}")
    if missing_zh:
        raise SystemExit(f"missing in zh_pack: {missing_zh}")

    reverted = []
    for qid in sorted(REVERT_IDS):
        cur = zh[qid]
        if cur.get("type") != "choice":
            print("skip (already text):", qid)
            continue
        src = dump[qid]
        zh[qid] = {
            "type": "text",
            "question": src.get("q") or cur["question"],
            "answers": src["answers"],
            "explain": cur.get("explain", ""),
            "placeholder": "输入答案…",
        }
        reverted.append(qid)

    zh_path.write_text(json.dumps(zh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    text_n = sum(1 for v in zh.values() if v.get("type") == "text")
    choice_n = sum(1 for v in zh.values() if v.get("type") == "choice")
    print("reverted", len(reverted))
    print("text", text_n, "choice", choice_n)
    print("reverted ids:", ", ".join(reverted))


if __name__ == "__main__":
    main()
