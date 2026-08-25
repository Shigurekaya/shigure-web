# -*- coding: utf-8 -*-
"""
Build gal-quiz-data.js from questions_raw.json + media_local_map.json + zh_pack.json
zh_pack.json holds human Chinese translations / answer aliases / choice options.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
VID_EXT = {".mp4", ".webm", ".mkv", ".mov"}


def clean_media(m: dict) -> dict:
    """Drop misfiled audio from video; dedupe by basename (audio/ vs video/ copies)."""
    out = {"images": [], "audio": [], "video": []}
    seen_img = set()
    seen_aud = set()
    seen_vid = set()

    def base(src: str) -> str:
        return Path(src.split("?", 1)[0]).name.lower()

    for src in m.get("images") or []:
        k = base(src)
        if k in seen_img:
            continue
        seen_img.add(k)
        out["images"].append(src)
    for src in m.get("audio") or []:
        k = base(src)
        if k in seen_aud:
            continue
        seen_aud.add(k)
        out["audio"].append(src)
    for src in m.get("video") or []:
        ext = Path(src.split("?", 1)[0]).suffix.lower()
        if ext not in VID_EXT:
            k = base(src)
            if k not in seen_aud:
                seen_aud.add(k)
                out["audio"].append(src)
            continue
        k = base(src)
        if k in seen_vid:
            continue
        seen_vid.add(k)
        out["video"].append(src)
    return out


def main():
    qs = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
    media_map = {}
    map_path = RAW / "media_local_map.json"
    if map_path.exists():
        media_map = json.loads(map_path.read_text(encoding="utf-8"))
    zh_path = RAW / "zh_pack.json"
    if not zh_path.exists():
        raise SystemExit("missing zh_pack.json — generate translations first")
    zh_pack = json.loads(zh_path.read_text(encoding="utf-8"))

    bank = []
    missing = []
    for q in qs:
        z = zh_pack.get(q["id"])
        if not z:
            missing.append(q["id"])
            continue
        m = clean_media(media_map.get(q["id"]) or q["media"])
        item = {
            "id": q["id"],
            "source": q["source"],
            "num": q["num"],
            "type": z.get("type", "text"),
            "question": z["question"],
            "explain": z.get("explain", ""),
            "images": m.get("images") or [],
            "audio": m.get("audio") or [],
            "video": m.get("video") or [],
        }
        if item["type"] == "choice":
            item["options"] = z["options"]
            item["answer"] = z["answer"]
        else:
            item["answers"] = z["answers"]
            item["placeholder"] = z.get("placeholder", "输入答案…")
        bank.append(item)

    if missing:
        print("MISSING translations:", ", ".join(missing))
        raise SystemExit(1)

    out_js = ROOT / "js" / "gal-quiz-data.js"
    header = (
        "/**\n"
        " * Gal 水平测试题库\n"
        " * 题目来源：ima-ero「エロゲクイズ」第1–5弹（AI 汉化校对；含原题图片/音频/视频）。\n"
        " * 仅供本站娱乐测验。\n"
        " */\n"
        "window.GAL_QUIZ_BANK = "
    )
    body = json.dumps(bank, ensure_ascii=False, indent=2)
    out_js.write_text(header + body + ";\n", encoding="utf-8")
    print("wrote", out_js, "questions", len(bank))


if __name__ == "__main__":
    main()
