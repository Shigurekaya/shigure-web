# -*- coding: utf-8 -*-
"""把所有 gal-quiz 图片复制到单一文件夹，供人工删 R18。文件名：{题号}__{原文件名}"""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "assets" / "gal-quiz" / "_review-delete-r18"
JS = ROOT / "js" / "gal-quiz-data.js"


def load_bank() -> list[dict]:
    text = JS.read_text(encoding="utf-8")
    m = re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S)
    return json.loads(m.group(1))


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
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
    readme = REVIEW / "README.txt"
    readme.write_text(
        "GAL 问答图片审查文件夹\n"
        "====================\n\n"
        "1. 在此文件夹内浏览并删除 R18 / H 场景图片。\n"
        "2. 文件名格式：题号__原文件名（如 s3-14__nijimu-shiri.jpg）\n"
        "3. 删完后在项目根目录执行：\n"
        "   python _quiz_raw/sync_after_image_review.py\n\n"
        "注意：不要删 manifest.json 和本 README。\n"
        "同一题有多张图时，删掉任意一张 R18 图会移除整道题。\n",
        encoding="utf-8",
    )
    print(f"Review folder: {REVIEW}")
    print(f"Copied {copied} images ({len({m['question_id'] for m in manifest})} questions)")
    if skipped:
        print(f"Skipped missing: {skipped}")
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
