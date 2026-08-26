# -*- coding: utf-8 -*-
import json
from pathlib import Path

zh = json.loads(Path(__file__).with_name("zh_pack.json").read_text(encoding="utf-8"))
t = [k for k, v in zh.items() if v.get("type") == "text"]
c = [k for k, v in zh.items() if v.get("type") == "choice"]
lines = [f"{k}\t{zh[k]['question'][:100].replace(chr(10), ' ')}" for k in t]
Path(__file__).with_name("_remain_text.txt").write_text("\n".join(lines), encoding="utf-8")
print("text", len(t), "choice", len(c))
print("remaining:", ", ".join(t))
