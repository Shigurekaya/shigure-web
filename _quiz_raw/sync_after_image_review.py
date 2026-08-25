# -*- coding: utf-8 -*-
"""
检测 _delete-images 中被删掉的图片，移除对应题目并清理资源。
规则：某题任意一张审查图被删掉 → 移除整道题。
完成后自动重建审查文件夹。
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
REVIEW = ROOT / "assets" / "gal-quiz" / "_delete-images"
# 兼容旧目录名
LEGACY_REVIEW = ROOT / "assets" / "gal-quiz" / "_review-delete-r18"
MANIFEST = REVIEW / "manifest.json"


def resolve_review() -> Path:
    if MANIFEST.is_file():
        return REVIEW
    if (LEGACY_REVIEW / "manifest.json").is_file():
        return LEGACY_REVIEW
    raise SystemExit(f"manifest not found: {MANIFEST}")


def update_html_count(n: int) -> None:
    html = ROOT / "gal-quiz.html"
    text = html.read_text(encoding="utf-8")
    text2 = re.sub(r"共 \d+ 题", f"共 {n} 题", text)
    if text2 != text:
        html.write_text(text2, encoding="utf-8")
        print("updated", html.name, f"→ 共 {n} 题")


def remove_question_assets(qid: str) -> None:
    qdir = ROOT / "assets" / "gal-quiz" / qid
    if qdir.is_dir():
        shutil.rmtree(qdir)


def main() -> None:
    review = resolve_review()
    manifest_path = review / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    by_q: dict[str, list[dict]] = {}
    for entry in manifest:
        by_q.setdefault(entry["question_id"], []).append(entry)

    remove_ids: set[str] = set()
    for qid, entries in by_q.items():
        any_missing = any(not (review / e["review_name"]).is_file() for e in entries)
        if any_missing:
            remove_ids.add(qid)

    if not remove_ids:
        print("No deleted review images detected. Nothing to remove.")
        return

    print(f"Removing {len(remove_ids)} questions: {', '.join(sorted(remove_ids))}")

    raw_path = RAW / "questions_raw.json"
    qs = json.loads(raw_path.read_text(encoding="utf-8"))
    qs = [q for q in qs if q["id"] not in remove_ids]
    raw_path.write_text(json.dumps(qs, ensure_ascii=False, indent=2), encoding="utf-8")

    zh_path = RAW / "zh_pack.json"
    zh = json.loads(zh_path.read_text(encoding="utf-8"))
    for rid in remove_ids:
        zh.pop(rid, None)
    zh_path.write_text(json.dumps(zh, ensure_ascii=False, indent=2), encoding="utf-8")

    map_path = RAW / "media_local_map.json"
    if map_path.is_file():
        media_map = json.loads(map_path.read_text(encoding="utf-8"))
        for rid in remove_ids:
            media_map.pop(rid, None)
        map_path.write_text(json.dumps(media_map, ensure_ascii=False, indent=2), encoding="utf-8")

    for qid in remove_ids:
        remove_question_assets(qid)

    subprocess.run([sys.executable, str(RAW / "build_bank.py")], check=True)
    update_html_count(len(qs))

    # 重建审查文件夹（只保留仍在题库中的图）
    subprocess.run([sys.executable, str(RAW / "collect_images_for_review.py")], check=True)

    # 清理旧目录（若存在）
    if LEGACY_REVIEW.is_dir() and LEGACY_REVIEW.resolve() != REVIEW.resolve():
        shutil.rmtree(LEGACY_REVIEW, ignore_errors=True)

    print(f"Done. Remaining questions: {len(qs)}")


if __name__ == "__main__":
    main()
