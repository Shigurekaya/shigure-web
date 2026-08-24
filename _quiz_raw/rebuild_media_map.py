# -*- coding: utf-8 -*-
"""Rebuild media_local_map.json from downloaded files; fix mp3 misfiled as video."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
OUT = ROOT / "assets" / "gal-quiz"
AUDIO_EXT = {".mp3", ".ogg", ".wav", ".m4a", ".aac"}
IMG_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
VID_EXT = {".mp4", ".webm", ".mkv"}

qs = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
# re-parse for clean embeds
# use existing questions media embeds


def classify(p: Path) -> str:
    ext = p.suffix.lower()
    if ext in AUDIO_EXT:
        return "audio"
    if ext in VID_EXT:
        return "video"
    if ext in IMG_EXT:
        return "image"
    return "image"


mapping = {}
for q in qs:
    qid = q["id"]
    entry = {"images": [], "audio": [], "video": []}
    base = OUT / qid
    if base.exists():
        for p in sorted(base.rglob("*")):
            if not p.is_file():
                continue
            kind = classify(p)
            rel = "/" + str(p.relative_to(ROOT)).replace("\\", "/")
            if kind == "image":
                entry["images"].append(rel)
            elif kind == "audio":
                entry["audio"].append(rel)
            else:
                entry["video"].append(rel)
    # dedupe preserve order
    for k in ("images", "audio", "video"):
        seen, out = set(), []
        for u in entry[k]:
            if u not in seen:
                seen.add(u)
                out.append(u)
        entry[k] = out
    mapping[qid] = entry

(RAW / "media_local_map.json").write_text(
    json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8"
)
print("mapped", len(mapping))
print(
    "totals",
    sum(len(v["images"]) for v in mapping.values()),
    sum(len(v["audio"]) for v in mapping.values()),
    sum(len(v["video"]) for v in mapping.values()),
)
