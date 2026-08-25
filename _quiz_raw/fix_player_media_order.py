# -*- coding: utf-8 -*-
"""
玩家视角修复：
1) media_local_map 配图顺序对齐 questions_raw 原站顺序
2) 音频按文件名去重（避免 audio/ 与 video/ 双播放器）
3) 清除明显错误的答案别名（含声优题作品名污染）
4) 重建 gal-quiz-data.js
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent

JUNK_ALIASES = {
    "s1-10": {"催眠"},
    "s3-08": {"屎"},
    "s3-09": {
        "妻の媚肉を弄る父の太い指 ～知らぬ間に父のモノになっていた愛妻は、悦びの喘ぎとともに腰をうねらせていた～"
    },
}


def fname(url: str) -> str:
    path = unquote(url.split("?", 1)[0])
    return Path(path).name.lower()


def reorder_images_from_raw(media: dict, raw_list: list) -> dict[str, dict]:
    changes = {}
    for q in raw_list:
        qid = q["id"]
        remote = (q.get("media") or {}).get("images") or []
        remote_names = []
        for u in remote:
            n = fname(u)
            if n.endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp")):
                remote_names.append(n)
        if not remote_names:
            continue
        local = list((media.get(qid) or {}).get("images") or [])
        if not local:
            continue
        by_name = {fname(p): p for p in local}
        if not all(n in by_name for n in remote_names):
            continue
        new_order = [by_name[n] for n in remote_names]
        extras = [p for p in local if fname(p) not in set(remote_names)]
        new_order.extend(extras)
        if new_order != local:
            changes[qid] = {"old": local, "new": new_order}
    return changes


def dedupe_audio_in_map(media: dict) -> int:
    n = 0
    for qid, m in media.items():
        audio = list(m.get("audio") or [])
        video = list(m.get("video") or [])
        keep_v = []
        for src in video:
            ext = Path(src.split("?", 1)[0]).suffix.lower()
            if ext in {".mp4", ".webm", ".mkv", ".mov"}:
                keep_v.append(src)
            else:
                audio.append(src)
        seen = set()
        new_a = []
        for src in audio:
            key = fname(src)
            if key in seen:
                n += 1
                continue
            seen.add(key)
            new_a.append(src)
        m["audio"] = new_a
        m["video"] = keep_v
    return n


def looks_like_person_name(a: str) -> bool:
    s = a.strip()
    if not s or len(s) > 24:
        return False
    if re.search(r"[~～!！?？\[\]【】]|Download|Edition|Trial|Package|Android", s, re.I):
        return False
    if "与" in s and len(s) > 8:
        return False
    if re.search(r"[のをがへ]|シリーズ", s) and len(s) > 10:
        return False
    return True


def scrub_cv_answers(zh: dict, raw_by: dict) -> int:
    """声优题只保留与原答人名相关的别名，去掉作品标题污染。"""
    n = 0
    for qid, item in zh.items():
        q = item.get("question") or ""
        if "声优" not in q and "声優" not in q:
            continue
        answers = item.get("answers")
        if not answers:
            continue
        ja = ((raw_by.get(qid) or {}).get("answer_ja") or answers[0]).strip()
        ja_n = re.sub(r"\s+", "", ja)
        kept = []
        for a in answers:
            s = a.strip()
            sn = re.sub(r"\s+", "", s)
            if not s:
                continue
            # 与日文原答相同/包含关系
            if sn == ja_n or (len(sn) >= 2 and (sn in ja_n or ja_n in sn)):
                kept.append(s)
                continue
            # 短人名：不含作品常见标点/助词串
            if len(s) <= 10 and not re.search(
                r"[~～!！?？\[\]【】（）()・/／]|Download|Edition|の|を|が|へ|与|様",
                s,
            ):
                kept.append(s)
                continue
            # 纯假名短读音
            if re.fullmatch(r"[\u3040-\u309f\u30a0-\u30ff]+", s) and len(s) <= 12:
                kept.append(s)
        seen = set()
        final = []
        for a in kept:
            if a in seen:
                continue
            seen.add(a)
            final.append(a)
        if not final:
            final = [ja]
        if final != answers:
            item["answers"] = final
            n += 1
            print(f"  CV scrub {qid}: {answers} -> {final}")
    return n


def strip_junk(zh: dict) -> int:
    n = 0
    for qid, bad in JUNK_ALIASES.items():
        item = zh.get(qid)
        if not item or "answers" not in item:
            continue
        before = item["answers"]
        after = [a for a in before if a not in bad]
        if after != before:
            item["answers"] = after
            n += 1
    return n


def main() -> None:
    media_path = RAW / "media_local_map.json"
    media = json.loads(media_path.read_text(encoding="utf-8"))
    raw_list = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
    raw_by = {q["id"]: q for q in raw_list}

    changes = reorder_images_from_raw(media, raw_list)
    for qid, ch in changes.items():
        media[qid]["images"] = ch["new"]
        print(f"reorder {qid}:")
        for i, p in enumerate(ch["new"], 1):
            print(f"  {i}. {Path(p).name}")

    dropped = dedupe_audio_in_map(media)
    print(f"audio basename dupes removed: {dropped}")

    media_path.write_text(
        json.dumps(media, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    zh_path = RAW / "zh_pack.json"
    zh = json.loads(zh_path.read_text(encoding="utf-8"))
    nj = strip_junk(zh)
    nc = scrub_cv_answers(zh, raw_by)
    zh_path.write_text(json.dumps(zh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"junk aliases stripped from {nj} questions; CV scrubbed {nc}")

    rc = subprocess.call([sys.executable, str(RAW / "build_bank.py")])
    if rc != 0:
        raise SystemExit(rc)
    print(f"reordered {len(changes)} questions; rebuilt bank")


if __name__ == "__main__":
    main()
