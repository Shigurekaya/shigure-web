# -*- coding: utf-8 -*-
"""Find quiz images that belong to answer reveal (st-slidebox), not the question stem."""
from __future__ import annotations

import json
import re
from pathlib import Path

RAW = Path(__file__).resolve().parent
ROOT = RAW.parent
MAP = RAW / "media_local_map.json"
OUT = RAW / "answer_image_leaks.json"


def parse_html_blocks(path: Path) -> list[dict]:
    html = path.read_text(encoding="utf-8", errors="replace")
    heads = list(re.finditer(r"<h3[^>]*>第(\d+)問", html, re.I))
    blocks = []
    for i, h in enumerate(heads):
        start = h.end()
        end = heads[i + 1].start() if i + 1 < len(heads) else len(html)
        block = html[start:end]
        parts = re.split(r"st-slidebox-c", block, maxsplit=1)
        q_imgs = re.findall(r'<img[^>]+src="([^"]+)"', parts[0])
        a_imgs = re.findall(r'<img[^>]+src="([^"]+)"', parts[1]) if len(parts) > 1 else []
        blocks.append(
            {
                "num": int(h.group(1)),
                "question_images": q_imgs,
                "answer_images": a_imgs,
            }
        )
    return blocks


def url_to_local(url: str, qid: str) -> str | None:
    name = url.rsplit("/", 1)[-1]
    # match by filename under assets/gal-quiz/{qid}/
    base = ROOT / "assets" / "gal-quiz" / qid / "images"
    if not base.is_dir():
        return None
    for p in base.iterdir():
        if p.name == name or name in p.name or p.name in name:
            return f"/assets/gal-quiz/{qid}/images/{p.name}"
    return None


def main() -> None:
    media = json.loads(MAP.read_text(encoding="utf-8"))
    leaks: list[dict] = []

    for src in (2, 3, 4, 5, 1):
        path = RAW / f"q{src}.html"
        if not path.is_file():
            continue
        for b in parse_html_blocks(path):
            qid = f"s{src}-{b['num']:02d}"
            if qid not in media:
                continue
            allowed = set()
            for u in b["question_images"]:
                loc = url_to_local(u, qid)
                if loc:
                    allowed.add(loc)
            current = media[qid].get("images", [])
            leaked = [x for x in current if x not in allowed]
            if leaked:
                leaks.append(
                    {
                        "id": qid,
                        "leaked": leaked,
                        "keep": [x for x in current if x in allowed],
                        "answer_only_urls": b["answer_images"],
                    }
                )

    OUT.write_text(json.dumps(leaks, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Found {len(leaks)} questions with answer-reveal images in bank")
    for x in leaks:
        print(f"  {x['id']}: remove {len(x['leaked'])} image(s)")


if __name__ == "__main__":
    main()
