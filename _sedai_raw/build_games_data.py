#!/usr/bin/env python3
"""Build gal-sedai-data.js from moegirl 美少女游戏大赏 export + Getchu fill-ins."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(r"C:\Users\22050\.cursor\projects\d-gamedev\agent-tools\71241f68-5348-4bcb-8ec4-1b04b0836d0f.txt")
SUPPLEMENT = Path(__file__).with_name("getchu_supplement.json")
OUT = ROOT / "js" / "gal-sedai-data.js"
TARGET = 20

YEAR_RE = re.compile(r"^### (\d{4})年")
RANK_RE = re.compile(r"^\|第(\d+)名")
DEPT_RE = re.compile(r"^(综合|剧本|系统|作画|音乐|影片|角色|工口|低价|Vocal|BGM|作品命名|配音)部门")
LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")
DEPT_ORDER = (
    "综合部门",
    "剧本部门",
    "系统部门",
    "作画部门",
    "音乐部门",
    "影片部门",
    "工口部门",
    "低价部门",
    "Vocal部门",
    "BGM部门",
    "作品命名部门",
    "配音部门",
)
STOP_MARKERS = ("[查]", "ACGN重要奖项", "分类：", "外部链接", "* [Getchu")
INVALID_TITLE_RE = re.compile(r"投票结果|^(查|编|论)$")


def clean_title(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    m = LINK_RE.search(raw)
    title = m.group(1) if m else raw
    title = title.replace("\\~", "~").replace("\\_", "_").replace("\\*", "*")
    title = re.sub(r"\s+", " ", title).strip()
    title = re.sub(r"\s+XRATED$", "", title, flags=re.I)
    if " DVD " in title:
        title = title.split(" DVD ")[0].strip()
    if title.endswith(" specification"):
        title = title[: -len(" specification")].strip()
    if INVALID_TITLE_RE.search(title):
        return ""
    return title


def cells_from_line(line: str) -> list[str]:
    s = line.strip()
    if not s or s == "|":
        return []
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|") if c.strip()]


def title_from_block(block: list[str]) -> str:
    for line in block:
        for cell in cells_from_line(line):
            title = clean_title(cell)
            if title:
                return title
    return ""


def source_game_from_character_block(block: list[str]) -> str:
    cells: list[str] = []
    for line in block:
        cells.extend(cells_from_line(line))
    for cell in reversed(cells):
        title = clean_title(cell)
        if title:
            return title
    return ""


def parse_departments(text: str) -> dict[str, dict[str, list[str]]]:
    result: dict[str, dict[str, list[str]]] = {}
    current_year: str | None = None
    current_dept: str | None = None
    pending_rank: int | None = None
    block: list[str] = []

    def flush() -> None:
        nonlocal pending_rank, block
        if not (current_year and current_dept and pending_rank is not None):
            block = []
            pending_rank = None
            return
        if current_dept == "角色部门":
            title = source_game_from_character_block(block)
        else:
            title = title_from_block(block)
        if title:
            bucket = result.setdefault(current_year, {}).setdefault(current_dept, [])
            if title not in bucket:
                bucket.append(title)
        block = []
        pending_rank = None

    for line in text.splitlines():
        ym = YEAR_RE.match(line.strip())
        if ym:
            flush()
            current_year = ym.group(1)
            current_dept = None
            continue

        stripped = line.strip()
        if any(marker in stripped for marker in STOP_MARKERS):
            flush()
            current_year = None
            current_dept = None
            continue

        dm = DEPT_RE.match(stripped)
        if dm and current_year:
            flush()
            current_dept = dm.group(1) + "部门"
            continue

        if not current_year or not current_dept:
            continue
        if stripped.startswith("|排名|"):
            continue

        rm = RANK_RE.match(stripped)
        if rm:
            flush()
            pending_rank = int(rm.group(1))
            continue

        if pending_rank is not None:
            block.append(line)

    flush()
    return result


def dept_fill_order(depts: dict[str, list[str]]) -> list[str]:
    ordered: list[str] = []
    seen_depts = set(DEPT_ORDER)
    for dept in DEPT_ORDER:
        if dept in depts and dept != "角色部门":
            ordered.append(dept)
    for dept in sorted(depts):
        if dept not in seen_depts and dept != "角色部门":
            ordered.append(dept)
    if "角色部门" in depts:
        ordered.append("角色部门")
    return ordered


def build_year_list(depts: dict[str, list[str]], extra: list[str]) -> list[str]:
    titles: list[str] = []
    seen: set[str] = set()

    def add(items: list[str]) -> None:
        for t in items:
            t = clean_title(t)
            if not t or t in seen:
                continue
            seen.add(t)
            titles.append(t)
            if len(titles) >= TARGET:
                return

    add(depts.get("综合部门", [])[:TARGET])
    for dept in dept_fill_order(depts):
        if dept == "综合部门" or len(titles) >= TARGET:
            continue
        add(depts.get(dept, []))
    if len(titles) < TARGET:
        add(extra)
    return titles[:TARGET]


def emit_js(games: dict[str, list[str]]) -> str:
    lines = ["const GAMES = {"]
    years = sorted(games.keys(), key=int)
    for yi, year in enumerate(years):
        lines.append(f'  "{year}": [')
        for gi, title in enumerate(games[year]):
            comma = "," if gi < len(games[year]) - 1 else ""
            esc = json.dumps(title, ensure_ascii=False)
            lines.append(f'    {{ "title": {esc} }}{comma}')
        comma = "," if yi < len(years) - 1 else ""
        lines.append(f"  ]{comma}")
    lines.append("};")
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"source not found: {SRC}")

    supplements = json.loads(SUPPLEMENT.read_text(encoding="utf-8")) if SUPPLEMENT.is_file() else {}
    parsed = parse_departments(SRC.read_text(encoding="utf-8"))
    games: dict[str, list[str]] = {}

    for year in sorted(parsed.keys(), key=int):
        titles = build_year_list(parsed[year], supplements.get(year, []))
        games[year] = titles
        status = "OK" if len(titles) == TARGET else f"ONLY {len(titles)}"
        print(f"{year}: {len(titles)} {status}")

    OUT.write_text(emit_js(games), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
