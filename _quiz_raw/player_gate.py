# -*- coding: utf-8 -*-
"""Final player-perspective gate: media, labels, answer leaks."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = Path(__file__).resolve().parent
JS = ROOT / "js" / "gal-quiz-data.js"
OUT = RAW / "player_gate_report.md"

CIRC = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"]
LR_Q = re.compile(r"左.*右|右.*左|哪边")
DUAL_Q = re.compile(r"①与②|①.*②")
TRIPLE = re.compile(r"①.*②.*③|①～③|①②③|三句|三张|3张")
NUM_PICK = re.compile(r"①～④|①〜④|几号|哪一个|编号|①～⑦|①～⑧|左/右|左／右")
ICON_NUM_PICK = re.compile(r"启动图标是①|アイコンは①|图标是①")
BAD_JUNK = {"催眠", "屎", "随便", "不知道"}


def load_bank():
    text = JS.read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.GAL_QUIZ_BANK = (\[.*\]);", text, re.S).group(1))


def compare_layout(q: dict) -> str | None:
    imgs = q.get("images") or []
    text = q.get("question") or ""
    n = len(imgs)
    if n == 2:
        if LR_Q.search(text):
            return "lr"
        if DUAL_Q.search(text):
            return "dual"
        if re.search(r"提示图|ヒント|参考にして|可参考", text):
            return "hint2"
    if n == 3 and TRIPLE.search(text):
        return "triple"
    if n == 4 and re.search(r"①～④|①〜④", text):
        return "quad"
    if n == 7 and re.search(r"①～⑦|①〜⑦", text):
        return "sept"
    if n == 6 and re.search(r"T\s*恤|Ｔシャツ", text) and re.search(
        r"①.*②.*③|①②③|①～③", text
    ):
        return "tee"
    if n == 6 and re.search(r"乐器|楽器", text) and re.search(r"A/B/C|Ａ|①", text):
        return "instrument"
    if (
        n == 6
        and re.search(r"下方|下３|下3|候选", text)
        and not re.search(r"T\s*恤|Ｔシャツ|乐器|楽器", text)
    ):
        return "ref6"
    return None


def media_exists(rel: str) -> bool:
    return (ROOT / rel.lstrip("/")).is_file()


def main() -> int:
    bank = load_bank()
    errors: list[str] = []
    warns: list[str] = []

    for q in bank:
        qid = q["id"]
        stem = q.get("question") or ""
        imgs = q.get("images") or []
        aud = q.get("audio") or []

        for rel in imgs + aud + (q.get("video") or []):
            if not media_exists(rel):
                errors.append(f"{qid}: missing media {rel}")

        # duplicate audio basename
        bases = [Path(a.split("?", 1)[0]).name.lower() for a in aud]
        if len(bases) != len(set(bases)):
            errors.append(f"{qid}: duplicate audio player")

        if q.get("type") == "text":
            answers = q.get("answers") or []
            if not answers:
                errors.append(f"{qid}: empty answers")
            for j in BAD_JUNK:
                if j in answers:
                    errors.append(f"{qid}: junk alias {j!r}")

            # 选图标编号（①～④）不得接受作品名别名
            if ICON_NUM_PICK.search(stem):
                for a in answers:
                    if a in {"①", "②", "③", "④", "1", "2", "3", "4", "一", "二", "三", "四"}:
                        continue
                    if len(a) > 2:
                        errors.append(f"{qid}: icon-number pick leaks via alias {a!r}")

            # 选编号题：题干已出现作品全名时不应再接受该作品名
            if re.search(r"哪一个是《.+》|几号女主|负责的是几号", stem):
                for a in answers:
                    if a in stem and len(a) >= 4 and a not in {"①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"}:
                        warns.append(f"{qid}: stem contains answer alias {a!r}")

        # multi-image needs labels when numbers asked
        if len(imgs) >= 2 and re.search(r"①|几号|左.*右|A/B/C|乐器", stem):
            layout = compare_layout(q)
            if not layout and not re.search(r"提示图可选|单张|合成", stem):
                # single composite with baked numbers OK
                if len(imgs) == 1:
                    pass
                elif len(imgs) >= 2:
                    warns.append(
                        f"{qid}: {len(imgs)} imgs, asks numbers, layout={layout}"
                    )

    lines = [
        f"# Player gate ({len(bank)} questions)",
        "",
        f"## Errors ({len(errors)})",
    ]
    lines.extend(f"- {e}" for e in errors) or lines.append("(none)")
    lines += ["", f"## Warns ({len(warns)})"]
    lines.extend(f"- {w}" for w in warns) or lines.append("(none)")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {OUT} errors={len(errors)} warns={len(warns)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
