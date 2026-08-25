# -*- coding: utf-8 -*-
"""按题号从题库与资源中移除题目，并重建 gal-quiz-data.js / 页面题数。"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent


def update_html_count(n: int) -> None:
    html = ROOT / "gal-quiz.html"
    text = html.read_text(encoding="utf-8")
    text2 = re.sub(r"共 \d+ 题", f"共 {n} 题", text)
    if text2 != text:
        html.write_text(text2, encoding="utf-8")
        print("updated", html.name, f"→ 共 {n} 题")


def remove_ids(ids: set[str]) -> None:
    if not ids:
        print("No ids to remove.")
        return

    raw_path = RAW / "questions_raw.json"
    qs = json.loads(raw_path.read_text(encoding="utf-8"))
    before = len(qs)
    qs = [q for q in qs if q["id"] not in ids]
    raw_path.write_text(json.dumps(qs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"questions_raw: {before} → {len(qs)}")

    zh_path = RAW / "zh_pack.json"
    zh = json.loads(zh_path.read_text(encoding="utf-8"))
    for rid in ids:
        zh.pop(rid, None)
    zh_path.write_text(json.dumps(zh, ensure_ascii=False, indent=2), encoding="utf-8")

    map_path = RAW / "media_local_map.json"
    if map_path.is_file():
        media_map = json.loads(map_path.read_text(encoding="utf-8"))
        for rid in ids:
            media_map.pop(rid, None)
        map_path.write_text(json.dumps(media_map, ensure_ascii=False, indent=2), encoding="utf-8")

    for qid in sorted(ids):
        qdir = ROOT / "assets" / "gal-quiz" / qid
        if qdir.is_dir():
            shutil.rmtree(qdir)
            print("removed assets", qid)

    subprocess.run([sys.executable, str(RAW / "build_bank.py")], check=True)
    update_html_count(len(qs))


def main() -> None:
    ids = {a.strip() for a in sys.argv[1:] if a.strip()}
    if not ids:
        raise SystemExit("usage: python remove_question.py <qid> [qid...]")
    remove_ids(ids)


if __name__ == "__main__":
    main()
