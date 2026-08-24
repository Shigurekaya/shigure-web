# -*- coding: utf-8 -*-
"""Remove answer-reveal images from media_local_map.json and rebuild bank."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

RAW = Path(__file__).resolve().parent
ROOT = RAW.parent
MAP = RAW / "media_local_map.json"
LEAKS = RAW / "answer_image_leaks.json"
RAW_Q = RAW / "questions_raw.json"


def main() -> None:
    leaks = json.loads(LEAKS.read_text(encoding="utf-8"))
    media = json.loads(MAP.read_text(encoding="utf-8"))
    qs = json.loads(RAW_Q.read_text(encoding="utf-8"))
    by_id = {q["id"]: q for q in qs}

    changed = 0
    for entry in leaks:
        qid = entry["id"]
        keep = entry["keep"]
        if qid not in media:
            continue
        old = media[qid].get("images") or []
        if old == keep:
            continue
        media[qid]["images"] = keep
        changed += 1

        q = by_id.get(qid)
        if q and "media" in q:
            keep_names = {Path(p).name for p in keep}
            urls = q["media"].get("images") or []
            q["media"]["images"] = [u for u in urls if Path(u.split("?", 1)[0]).name in keep_names]

    MAP.write_text(json.dumps(media, ensure_ascii=False, indent=2), encoding="utf-8")
    RAW_Q.write_text(json.dumps(qs, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Updated {changed} questions in media_local_map.json")

    subprocess.run([sys.executable, str(RAW / "build_bank.py")], check=True)


if __name__ == "__main__":
    main()
