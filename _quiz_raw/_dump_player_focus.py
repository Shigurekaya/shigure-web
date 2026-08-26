# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
js = (ROOT / "js/gal-quiz-data.js").read_text(encoding="utf-8")
bank = json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", js, re.S).group(1))
raw = {
    q["id"]: q
    for q in json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
}

lines = []
for q in bank:
    stem = q["question"]
    imgs = q.get("images") or []
    aud = q.get("audio") or []
    vid = q.get("video") or []
    tags = []
    if re.search(r"①～[④⑤⑥⑦⑧]|①〜", stem):
        tags.append(f"numbered imgs={len(imgs)}")
    if re.search(r"左.*右|右.*左|哪边", stem):
        tags.append(f"lr imgs={len(imgs)}")
    if re.search(r"三句|①～③|①②③", stem):
        tags.append(f"triple-ish imgs={len(imgs)}")
    if aud:
        tags.append(f"aud={len(aud)}")
    if vid:
        tags.append(f"vid={len(vid)}")
    # icon quiz with few images
    if "启动图标" in stem or "アイコン" in (raw.get(q["id"], {}).get("question_ja") or ""):
        tags.append(f"icon imgs={len(imgs)}")
    if not tags and not (imgs and "根据图片" in stem):
        continue
    if not tags and imgs and "根据图片" in stem:
        tags.append("img-prompt")
    lines.append(
        f"{q['id']}|{q['type']}|img={len(imgs)} aud={len(aud)} vid={len(vid)}|{' '.join(tags)}"
    )
    lines.append(f"  Q: {stem.replace(chr(10), ' / ')[:180]}")
    if q["type"] == "choice":
        lines.append(f"  opts={q.get('options')} ans={q.get('answer')}")
    else:
        lines.append(f"  answers={q.get('answers')}")
    if imgs:
        lines.append(f"  images={imgs}")
    if aud:
        lines.append(f"  audio={aud}")
    if vid:
        lines.append(f"  video={vid}")
    # JA snippet
    qj = (raw.get(q["id"], {}).get("question_ja") or "").replace("\n", " / ")[:160]
    lines.append(f"  JA: {qj}")

(RAW / "_player_media_focus.txt").write_text("\n".join(lines), encoding="utf-8")

# all image questions compact
vis = []
for q in bank:
    if q.get("images"):
        vis.append(
            "\t".join(
                [
                    q["id"],
                    str(len(q["images"])),
                    q["question"].replace("\n", " ")[:90],
                    q["images"][0],
                ]
            )
        )
(RAW / "_all_image_qs.txt").write_text("\n".join(vis), encoding="utf-8")
print(f"focus lines={len(lines)} image_qs={len(vis)}")
