#!/usr/bin/env python3
"""Parse 美少女游戏大赏 综合部门 top-20 from moegirl markdown export."""
from __future__ import annotations

import json
import re
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "agent-tools" / "71241f68-5348-4bcb-8ec4-1b04b0836d0f.txt"
OUT = Path(__file__).resolve().parent / "getchu_rankings.json"

YEAR_RE = re.compile(r"^### (\d{4})年$")
RANK_RE = re.compile(r"^\|第(\d+)名$")
LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")


def clean_title(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return raw
    m = LINK_RE.search(raw)
    if m:
        title = m.group(1)
    else:
        title = raw
    title = title.replace("\\*", "*")
    title = re.sub(r"\s+", " ", title).strip()
    # Prefer shorter Chinese alias when link text is long JP edition name
    if " DVD " in title or " specification" in title:
        title = title.split(" DVD ")[0].split(" specification")[0].strip()
    return title


def parse_section(text: str) -> dict[str, list[dict]]:
    lines = text.splitlines()
    years: dict[str, list[dict]] = {}
    current_year: str | None = None
    in_sogo = False
    pending_rank: int | None = None
    title_buf: list[str] = []

    def flush_title() -> None:
        nonlocal pending_rank, title_buf
        if current_year is None or pending_rank is None:
            title_buf = []
            pending_rank = None
            return
        title = clean_title(" ".join(title_buf))
        if title:
            years.setdefault(current_year, []).append(
                {"rank": pending_rank, "title": title}
            )
        title_buf = []
        pending_rank = None

    for line in lines:
        ym = YEAR_RE.match(line.strip())
        if ym:
            flush_title()
            current_year = ym.group(1)
            in_sogo = False
            continue

        stripped = line.strip()
        if stripped == "综合部门":
            flush_title()
            in_sogo = True
            continue

        if not in_sogo or current_year is None:
            continue

        if stripped.endswith("部门") and stripped != "综合部门":
            flush_title()
            in_sogo = False
            continue

        if stripped.startswith("|排名|"):
            continue
        if stripped == "|":
            continue

        rm = RANK_RE.match(stripped)
        if rm:
            flush_title()
            pending_rank = int(rm.group(1))
            continue

        if pending_rank is not None:
            if stripped.startswith("|") and "|" in stripped[1:]:
                # table row with title|company
                cell = stripped.strip("|").split("|")[0].strip()
                if cell:
                    title_buf.append(cell)
            elif stripped and not stripped.startswith("["):
                title_buf.append(stripped)
            elif stripped.startswith("["):
                title_buf.append(stripped)

    flush_title()
    return years


def main() -> None:
    # Try workspace-relative path first, then agent-tools under cursor project
    candidates = [
        SRC,
        Path(r"C:\Users\22050\.cursor\projects\d-gamedev\agent-tools\71241f68-5348-4bcb-8ec4-1b04b0836d0f.txt"),
    ]
    src = next((p for p in candidates if p.is_file()), None)
    if not src:
        raise SystemExit("moegirl export not found")

    text = src.read_text(encoding="utf-8")
    years = parse_section(text)

    report = {}
    for year in sorted(years, key=int):
        items = sorted(years[year], key=lambda x: x["rank"])
        report[year] = {
            "count": len(items),
            "titles": [x["title"] for x in items[:20]],
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    for year, data in report.items():
        flag = "OK" if data["count"] >= 20 else f"NEED {20 - data['count']}"
        print(f"{year}: {data['count']} {flag}")


if __name__ == "__main__":
    main()
