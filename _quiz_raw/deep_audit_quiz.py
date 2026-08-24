# -*- coding: utf-8 -*-
"""
Deep audit for gal-quiz leak / mismatch patterns:
- answer-reveal media (by original HTML answer section filenames)
- stem text leaks (full answers / embedded options)
- media prompt vs attached media mismatch
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from quiz_match import normalize as norm

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
JS = ROOT / "js" / "gal-quiz-data.js"
OUT = RAW / "deep_audit_results.json"

# ima-ero 原题在题干中列出全部候选项（含正确答案）
LEAK_EXEMPT = {"s3-05", "s4-08"}

HEADING_RE = re.compile(r"<h3[^>]*>第(\d+)問", re.I)
IMG_PROMPT = re.compile(r"请根据图片|根据图片|图中列举|看[图圖]|图片里|如[图圖]")
AUD_PROMPT = re.compile(r"请根据音频|请听|听音频|音频（体验版）")
VID_PROMPT = re.compile(r"请根据视频|视频|動画")
MEDIA_EXT = re.compile(r"\.(mp3|wav|ogg|m4a|mp4|webm|mkv|jpg|jpeg|png|gif|webp)$", re.I)


def load_bank() -> list[dict]:
    text = JS.read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S).group(1))


def fname(url: str) -> str:
    return url.split("?", 1)[0].rsplit("/", 1)[-1].lower()


def grab_media(part: str) -> dict:
    urls = re.findall(r'(?:src|data-src)="([^"]+)"', part, re.I)
    out = {"images": [], "audio": [], "video": []}
    for u in urls:
        if not MEDIA_EXT.search(u.split("?", 1)[0]):
            continue
        base = fname(u)
        if base.endswith((".mp3", ".wav", ".ogg", ".m4a")):
            out["audio"].append(u)
        elif base.endswith((".mp4", ".webm", ".mkv")):
            out["video"].append(u)
        else:
            out["images"].append(u)
    return out


def parse_html_blocks(path: Path) -> list[dict]:
    html = path.read_text(encoding="utf-8", errors="replace")
    heads = list(HEADING_RE.finditer(html))
    blocks = []
    for i, h in enumerate(heads):
        start = h.end()
        end = heads[i + 1].start() if i + 1 < len(heads) else len(html)
        block = html[start:end]
        parts = re.split(r"st-slidebox-c", block, maxsplit=1)
        q_part = parts[0]
        a_part = parts[1] if len(parts) > 1 else ""
        blocks.append(
            {
                "num": int(h.group(1)),
                "question": grab_media(q_part),
                "answer": grab_media(a_part),
            }
        )
    return blocks


def answer_section_names_by_qid() -> dict[str, set[str]]:
    names: dict[str, set[str]] = {}
    for src in (1, 2, 3, 4, 5):
        path = RAW / f"q{src}.html"
        if not path.is_file():
            continue
        for b in parse_html_blocks(path):
            qid = f"s{src}-{b['num']:02d}"
            bucket = set()
            for kind in ("images", "audio", "video"):
                for u in b["answer"][kind]:
                    bucket.add(fname(u))
            names[qid] = bucket
    return names


def audit_bank_media_in_answer_section(bank: list[dict]) -> list[dict]:
    answer_names = answer_section_names_by_qid()
    issues = []
    for q in bank:
        qid = q["id"]
        ans = answer_names.get(qid, set())
        if not ans:
            continue
        for kind in ("images", "audio", "video"):
            for rel in q.get(kind) or []:
                if fname(rel) in ans:
                    issues.append({"id": qid, "kind": kind, "path": rel})
    return issues


def audit_text_leaks(bank: list[dict]) -> tuple[list[dict], list[dict]]:
    direct = []
    opts_embedded = []
    for q in bank:
        qid = q["id"]
        text = norm(q.get("question", ""))

        if q.get("type") == "choice":
            opts = q.get("options", [])
            ans_idx = q.get("answer", 0)
            ans_list = ans_idx if isinstance(ans_idx, list) else [ans_idx]
            for i in ans_list:
                if i < len(opts):
                    a = norm(opts[i])
                    if a and len(a) >= 3 and a in text:
                        direct.append({"id": qid, "value": opts[i]})
            hits = sum(1 for o in opts if norm(o) and len(norm(o)) >= 3 and norm(o) in text)
            if hits >= 2:
                opts_embedded.append({"id": qid, "hits": hits, "question": q.get("question", "")[:90]})
        else:
            if qid in LEAK_EXEMPT:
                continue
            for a in q.get("answers", []):
                an = norm(a)
                # skip when answer only repeats a name already named in the question (e.g. s1-03)
                if an and len(an) >= 6 and an in text:
                    direct.append({"id": qid, "value": a})
    return direct, opts_embedded


def audit_media_prompt_mismatch(bank: list[dict]) -> list[dict]:
    issues = []
    for q in bank:
        qid = q["id"]
        stem = q.get("question", "")
        imgs = q.get("images") or []
        aud = q.get("audio") or []
        vid = q.get("video") or []

        if IMG_PROMPT.search(stem) and not imgs:
            issues.append({"id": qid, "kind": "image_prompt_no_image", "question": stem[:90]})
        if AUD_PROMPT.search(stem) and not aud and not vid:
            issues.append({"id": qid, "kind": "audio_prompt_no_audio", "question": stem[:90]})
        if VID_PROMPT.search(stem) and not vid:
            issues.append({"id": qid, "kind": "video_prompt_no_video", "question": stem[:90]})
    return issues


def main() -> int:
    bank = load_bank()
    answer_media = audit_bank_media_in_answer_section(bank)
    direct, opts_embedded = audit_text_leaks(bank)
    prompt_mismatch = audit_media_prompt_mismatch(bank)

    report = {
        "total": len(bank),
        "bank_media_in_answer_section": answer_media,
        "text_leaks_direct": direct,
        "choice_options_embedded": opts_embedded,
        "media_prompt_mismatch": prompt_mismatch,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    blocking = answer_media or direct or opts_embedded or prompt_mismatch

    print(f"=== Deep audit ({len(bank)} questions) ===")
    print(f"Bank media in answer-reveal section: {len(answer_media)}")
    for x in answer_media[:10]:
        print(f"  {x['id']} [{x['kind']}]: {x['path']}")
    print(f"Direct text leaks: {len(direct)}")
    for x in direct[:10]:
        print(f"  {x['id']}: {x['value']!r}")
    print(f"Choice options embedded in stem: {len(opts_embedded)}")
    print(f"Media prompt mismatch: {len(prompt_mismatch)}")
    for x in prompt_mismatch[:15]:
        print(f"  [{x['kind']}] {x['id']}")

    print(f"\nWrote {OUT}")
    if blocking:
        print("\nDEEP AUDIT: FAIL")
        return 1
    print("\nDEEP AUDIT: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
