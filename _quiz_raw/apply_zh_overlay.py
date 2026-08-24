# -*- coding: utf-8 -*-
"""Apply zh_overlay_v2.json question/explain onto zh_pack.json and rebuild bank."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

RAW = Path(__file__).resolve().parent
ROOT = RAW.parent


def main() -> None:
    overlay = json.loads((RAW / "zh_overlay_v2.json").read_text(encoding="utf-8"))
    zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
    qs = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
    ids = [q["id"] for q in qs]

    missing = [i for i in ids if i not in overlay]
    extra = [k for k in overlay if k not in ids]
    if missing:
        raise SystemExit(f"overlay missing: {missing}")
    if extra:
        raise SystemExit(f"overlay extra: {extra}")

    for qid in ids:
        o = overlay[qid]
        if qid not in zh:
            raise SystemExit(f"zh_pack missing {qid}")
        zh[qid]["question"] = o["question"]
        zh[qid]["explain"] = o.get("explain", "")

    (RAW / "zh_pack.json").write_text(
        json.dumps({i: zh[i] for i in ids}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print("updated zh_pack.json")

    r = subprocess.run([sys.executable, str(RAW / "build_bank.py")], cwd=ROOT)
    raise SystemExit(r.returncode)


if __name__ == "__main__":
    main()
