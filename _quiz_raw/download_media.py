# -*- coding: utf-8 -*-
"""Download quiz media into assets/gal-quiz/{id}/"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse, unquote

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
OUT = ROOT / "assets" / "gal-quiz"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def safe_name(url: str, idx: int, kind: str) -> str:
    path = unquote(urlparse(url).path)
    name = Path(path).name.split("?")[0] or f"{kind}-{idx}"
    name = re.sub(r"[^\w.\-]+", "_", name)
    if len(name) > 80:
        stem = Path(name).stem[:60]
        suf = Path(name).suffix or ""
        name = stem + suf
    return name


def download(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.ima-ero.com/"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        dest.write_bytes(data)
        return True
    except Exception as e:
        print("FAIL", url, e)
        return False


def main():
    media = json.loads((RAW / "media_list.json").read_text(encoding="utf-8"))
    # rebuild media list after reparse if needed
    qs = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
    media = []
    for q in qs:
        for kind_key, kind in (("images", "image"), ("audio", "audio"), ("video", "video")):
            for u in q["media"].get(kind_key, []):
                media.append({"id": q["id"], "kind": kind, "url": u})
        for u in q["media"].get("embeds", []):
            media.append({"id": q["id"], "kind": "embed", "url": u})

    mapping = {}  # id -> {images:[], audio:[], video:[], embeds:[]}
    ok = fail = skip = 0
    for item in media:
        qid = item["id"]
        kind = item["kind"]
        url = item["url"]
        mapping.setdefault(qid, {"images": [], "audio": [], "video": [], "embeds": []})
        if kind == "embed" or "youtube.com" in url or "youtu.be" in url:
            mapping[qid]["embeds"].append(url)
            skip += 1
            continue
        # skip external affiliate that may 403 heavily
        ext = Path(urlparse(url).path).suffix.lower()
        if kind == "image":
            folder = "images"
        elif kind == "audio":
            folder = "audio"
        else:
            folder = "video"
        idx = len(mapping[qid][folder if folder != "images" else "images"]) if False else 0
        # count existing
        bucket = mapping[qid]["images" if kind == "image" else ("audio" if kind == "audio" else "video")]
        fname = safe_name(url, len(bucket) + 1, kind)
        if not Path(fname).suffix:
            fname += { "image": ".jpg", "audio": ".mp3", "video": ".mp4" }.get(kind, "")
        dest = OUT / qid / folder / fname
        rel = f"/assets/gal-quiz/{qid}/{folder}/{fname}"
        if download(url, dest):
            bucket.append(rel)
            ok += 1
            print("OK", qid, kind, fname)
        else:
            # keep remote fallback
            bucket.append(url)
            fail += 1
        time.sleep(0.05)

    (RAW / "media_local_map.json").write_text(
        json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("done ok", ok, "fail", fail, "embed_skip", skip)


if __name__ == "__main__":
    main()
