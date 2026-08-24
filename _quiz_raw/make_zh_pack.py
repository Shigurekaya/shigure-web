# -*- coding: utf-8 -*-
"""合并 part1 + part2，写出 zh_pack.json（125 题）。"""
from __future__ import annotations

import json
from pathlib import Path

from make_zh_part1 import PACK as PACK1
from make_zh_part2 import PACK_PART2 as PACK2

RAW = Path(__file__).resolve().parent
EXPECTED = 125


def main() -> None:
    pack = {**PACK1, **PACK2}
    qs = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
    ids = [q["id"] for q in qs]
    missing = [i for i in ids if i not in pack]
    extra = [k for k in pack if k not in ids]
    if missing:
        raise SystemExit(f"missing translations ({len(missing)}): {', '.join(missing)}")
    if extra:
        raise SystemExit(f"extra keys: {', '.join(extra)}")
    if len(pack) != EXPECTED:
        raise SystemExit(f"expected {EXPECTED}, got {len(pack)}")

    out = RAW / "zh_pack.json"
    ordered = {i: pack[i] for i in ids}
    out.write_text(json.dumps(ordered, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out, "entries", len(ordered))


if __name__ == "__main__":
    main()
