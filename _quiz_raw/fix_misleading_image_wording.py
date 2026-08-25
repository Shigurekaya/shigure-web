# -*- coding: utf-8 -*-
"""
去掉「请根据图片」误用：原题未要求读图、配图仅为装饰/角色对照的知识题。
真实看图题（制服/图标/圣地/立绘对照等）保留。
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

RAW = Path(__file__).resolve().parent
ROOT = RAW.parent

# 原题不要求读图作答；配图装饰或仅作角色参考
STRIP_IDS = {
    "s1-01",
    "s1-02",
    "s1-03",
    "s2-02",
    "s2-03",
    "s2-08",
    "s3-03",
    "s3-18",
    "s4-10",
    "s4-12",
    "s4-18",
    "s5-04",
    "s5-10",
    "s5-18",
}

PREFIX = re.compile(r"^请根据图片[：:]\s*")
INLINE = re.compile(r"请根据图片[：:]\s*")


def strip_wording(q: str) -> str:
    q2 = PREFIX.sub("", q, count=1)
    if q2 == q:
        q2 = INLINE.sub("", q, count=1)
    return q2


def patch_obj(data: dict, key_field: str = "question") -> int:
    n = 0
    for qid in STRIP_IDS:
        item = data.get(qid)
        if not item:
            continue
        old = item.get(key_field, "")
        if "根据图片" not in old:
            continue
        new = strip_wording(old)
        if new != old:
            item[key_field] = new
            n += 1
    return n


def main() -> None:
    zh_path = RAW / "zh_pack.json"
    zh = json.loads(zh_path.read_text(encoding="utf-8"))
    n1 = patch_obj(zh)
    zh_path.write_text(
        json.dumps(zh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"zh_pack.json updated: {n1}")

    ov_path = RAW / "zh_overlay_v2.json"
    if ov_path.exists():
        ov = json.loads(ov_path.read_text(encoding="utf-8"))
        n2 = patch_obj(ov)
        ov_path.write_text(
            json.dumps(ov, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"zh_overlay_v2.json updated: {n2}")

    # 生成源里的硬编码题干也同步，避免日后重新 make 回滚
    for name in ("make_zh_part1.py", "make_zh_part2.py", "sync_cn_aliases.py"):
        p = RAW / name
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8")
        orig = text
        for qid in STRIP_IDS:
            item = zh.get(qid) or {}
            new_q = item.get("question", "")
            if not new_q:
                continue
            for old in ("请根据图片：" + new_q, "请根据图片:" + new_q):
                if old in text:
                    text = text.replace(old, new_q)
        text = text.replace("请根据图片：《我们没有翅膀》", "《我们没有翅膀》")
        text = text.replace("请根据图片：《我们没翅膀》", "《我们没翅膀》")
        if text != orig:
            p.write_text(text, encoding="utf-8")
            print(f"patched source strings in {name}")

    rc = subprocess.call([sys.executable, str(RAW / "build_bank.py")])
    if rc != 0:
        raise SystemExit(rc)
    print("rebuilt gal-quiz-data.js")


if __name__ == "__main__":
    main()
