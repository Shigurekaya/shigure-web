# -*- coding: utf-8 -*-
"""List choice questions that were converted from text (not originally choice)."""
import json
from pathlib import Path

RAW = Path(__file__).resolve().parent
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
dump_ids = {row["id"] for row in json.loads((RAW / "_text_qs_dump.json").read_text(encoding="utf-8"))}

# Originally choice before the big conversion wave (never in text dump as text at conversion time,
# OR present as choice before). Safer: dump captured all then-text; if now choice AND in dump => converted.
converted = sorted(qid for qid, z in zh.items() if z.get("type") == "choice" and qid in dump_ids)
orig_choice = sorted(qid for qid, z in zh.items() if z.get("type") == "choice" and qid not in dump_ids)
text = sorted(qid for qid, z in zh.items() if z.get("type") == "text")

out = RAW / "_converted_from_text.txt"
lines = [
    f"converted_from_text {len(converted)}",
    ", ".join(converted),
    "",
    f"originally_choice {len(orig_choice)}",
    ", ".join(orig_choice),
    "",
    f"still_text {len(text)}",
]
out.write_text("\n".join(lines), encoding="utf-8")
print("converted", len(converted))
print(",".join(converted))
print("orig_choice", len(orig_choice))
print("text", len(text))
