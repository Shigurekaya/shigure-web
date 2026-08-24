# -*- coding: utf-8 -*-
"""
根据 _review-delete-r18 中已删除的图片，移除对应题目并清理资源。
规则：某题任意一张审查图被删掉 → 移除整道题。
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
REVIEW = ROOT / "assets" / "gal-quiz" / "_review-delete-r18"
MANIFEST = REVIEW / "manifest.json"


def load_manifest() -> list[dict]:
    if not MANIFEST.is_file():
        raise SystemExit(f"manifest not found: {MANIFEST}")
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def remove_question_assets(qid: str) -> None:
    qdir = ROOT / "assets" / "gal-quiz" / qid
    if qdir.is_dir():
        shutil.rmtree(qdir)


def main() -> None:
    manifest = load_manifest()
    by_q: dict[str, list[dict]] = {}
    for entry in manifest:
        by_q.setdefault(entry["question_id"], []).append(entry)

    # 任意一张审查图被删 → 移除整道题
    remove_ids: set[str] = set()
    for qid, entries in by_q.items():
        any_missing = any(not (REVIEW / e["review_name"]).is_file() for e in entries)
        if any_missing:
            remove_ids.add(qid)

    if not remove_ids:
        print("No deleted review images detected. Nothing to remove.")
        return

    print(f"Removing {len(remove_ids)} questions: {', '.join(sorted(remove_ids))}")

    # questions_raw.json
    raw_path = RAW / "questions_raw.json"
    qs = json.loads(raw_path.read_text(encoding="utf-8"))
    qs = [q for q in qs if q["id"] not in remove_ids]
    raw_path.write_text(json.dumps(qs, ensure_ascii=False, indent=2), encoding="utf-8")

    # zh_pack.json
    zh_path = RAW / "zh_pack.json"
    zh = json.loads(zh_path.read_text(encoding="utf-8"))
    for rid in remove_ids:
        zh.pop(rid, None)
    zh_path.write_text(json.dumps(zh, ensure_ascii=False, indent=2), encoding="utf-8")

    # media_local_map.json
    map_path = RAW / "media_local_map.json"
    if map_path.is_file():
        media_map = json.loads(map_path.read_text(encoding="utf-8"))
        for rid in remove_ids:
            media_map.pop(rid, None)
        map_path.write_text(json.dumps(media_map, ensure_ascii=False, indent=2), encoding="utf-8")

    # 删除原资源目录
    for qid in remove_ids:
        remove_question_assets(qid)

    # 重建 gal-quiz-data.js
    subprocess.run([sys.executable, str(RAW / "build_bank.py")], check=True)

    # 清理审查文件夹中已保留题的副本（可选，减少干扰）
    for entry in manifest:
        if entry["question_id"] not in remove_ids:
            rp = REVIEW / entry["review_name"]
            if rp.is_file():
                rp.unlink()

    print(f"Done. Remaining questions: {len(qs)}")
    print("Rebuilt js/gal-quiz-data.js")


if __name__ == "__main__":
    main()
