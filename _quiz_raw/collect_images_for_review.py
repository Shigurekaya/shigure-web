# -*- coding: utf-8 -*-
"""
把所有 gal-quiz 配图复制到单一文件夹，方便人工删图。
文件名：{题号}__{原文件名}
删完后执行：python _quiz_raw/sync_after_image_review.py
"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "assets" / "gal-quiz" / "_delete-images"
JS = ROOT / "js" / "gal-quiz-data.js"
KEEP = {"manifest.json", "README.txt"}


def load_bank() -> list[dict]:
    text = JS.read_text(encoding="utf-8")
    m = re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S)
    return json.loads(m.group(1))


def clear_old_images() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    for p in REVIEW.iterdir():
        if p.is_file() and p.name not in KEEP:
            p.unlink()


def main() -> None:
    clear_old_images()
    bank = load_bank()
    manifest: list[dict] = []
    copied = 0
    skipped = 0

    for q in bank:
        qid = q["id"]
        for rel in q.get("images") or []:
            rel_path = rel.lstrip("/")
            src = ROOT / rel_path
            if not src.is_file():
                print("MISSING", rel)
                skipped += 1
                continue
            review_name = f"{qid}__{src.name}"
            dst = REVIEW / review_name
            shutil.copy2(src, dst)
            manifest.append(
                {
                    "review_name": review_name,
                    "question_id": qid,
                    "original_rel": rel_path,
                    "original_name": src.name,
                }
            )
            copied += 1

    manifest_path = REVIEW / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (REVIEW / "README.txt").write_text(
        "GAL 水平测试 — 配图删除文件夹\n"
        "============================\n\n"
        "1. 在此文件夹浏览并删除不想保留的图片。\n"
        "2. 文件名格式：题号__原文件名（如 s3-14__foo.jpg）\n"
        "3. 删完后在 shigure-web 目录执行：\n"
        "   python _quiz_raw/sync_after_image_review.py\n\n"
        "规则：同一题任意一张图被删 → 整道题从题库移除。\n"
        "不要删 manifest.json 和本 README。\n",
        encoding="utf-8",
    )
    print(f"Review folder: {REVIEW}")
    print(f"Copied {copied} images ({len({m['question_id'] for m in manifest})} questions)")
    if skipped:
        print(f"Skipped missing: {skipped}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
