#!/usr/bin/env python3
"""生成 pick_popular_seed_extra.json：优先中文名、未收录、有人气的约 100 部。"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from fetch_sedai_tags import GETCHU, GETCHU_SUPP, clean_title, is_noise  # noqa: E402
from merge_cn_aliases import EXTRA as CN_EXTRA  # noqa: E402
from pick_pool_dedupe import (  # noqa: E402
    filter_new_candidates,
    load_alias_to_cn,
    load_cache,
    load_rows,
    norm_key,
    pool_id_sets,
    sedai_pool_ids,
    SUPPLEMENT_JSON,
)

OUT = ROOT / "pick_popular_seed_extra.json"
TARGET = 120


def _has_han(s: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", s))


def _han_count(s: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", s))


def load_getchu_cn() -> list[tuple[int, int, str]]:
    rows: list[tuple[int, int, str]] = []
    seen: set[str] = set()
    for path in (GETCHU, GETCHU_SUPP):
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        for year_s, block in sorted(data.items(), key=lambda x: int(x[0]), reverse=True):
            year = int(year_s)
            titles = block.get("titles") if isinstance(block, dict) else block
            if not isinstance(titles, list):
                continue
            for rank, raw in enumerate(titles, 1):
                title = clean_title(raw if isinstance(raw, str) else str(raw))
                if not title or is_noise(title) or not _has_han(title):
                    continue
                nk = norm_key(title)
                if not nk or nk in seen:
                    continue
                seen.add(nk)
                rows.append((year, rank, title))
    return rows


def load_curated_cn() -> list[tuple[int, int, str]]:
    """权威中文主名（来自别名表 EXTRA）。"""
    # year hints for popularity sort
    year_hint = {
        "天使嚣嚣 RE-BOOT!": 2023,
        "甜蜜女友3": 2023,
        "樱之刻": 2023,
        "Anonymous;Code": 2022,
        "LOOPERS": 2021,
        "金色拉布利切 Golden Time": 2021,
        "月之彼方所及之处": 2021,
        "ATRI -My Dear Moments-": 2020,
        "星光咖啡馆与死神之蝶": 2019,
        "住在拔作岛上的贫乳应该如何是好？2": 2019,
        "格诺西亚": 2019,
        "谜语小丑": 2018,
        "魔女的夜宴": 2018,
        "千恋＊万花": 2018,
        "海市蜃楼之馆": 2012,
        "混沌子": 2014,
        "机器人笔记": 2011,
        "沙耶之歌": 2003,
        "Ever17": 2001,
        "Remember11": 2002,
        "Kanon": 1999,
        "AIR": 2000,
        "秋之回忆": 1999,
    }
    out: list[tuple[int, int, str]] = []
    for i, name in enumerate(CN_EXTRA.keys()):
        if not _has_han(name) and name not in {
            "ATRI -My Dear Moments-",
            "LOOPERS",
            "Anonymous;Code",
            "IxSHE Tell",
            "Chrono Clock",
            "Fureraba",
            "Hapymaher",
            "Kanon",
            "AIR",
            "Remember11",
            "Ever17",
            "Making*Lovers",
            "Sugar*Style",
            "Cafe Stella",
            "WHITE ALBUM2",
            "12Riven",
            "Golden Marriage",
            "Fate/hollow ataraxia",
        }:
            continue
        year = year_hint.get(name, 2015)
        out.append((year, 1 + (i % 20), name))
    return out


def load_ym_cn() -> list[tuple[int, int, str]]:
    ym_path = ROOT.parent / "_quiz_raw" / "ym_vndb_alias_pack.json"
    if not ym_path.exists():
        return []
    pack = json.loads(ym_path.read_text(encoding="utf-8"))
    out: list[tuple[int, int, str]] = []
    for query, entry in (pack.get("by_query") or {}).items():
        if not entry.get("vndb_id"):
            continue
        ym = (entry.get("sources") or {}).get("ym") or {}
        cn = ym.get("chineseName") or query
        if not _has_han(cn) or _han_count(cn) < 2:
            continue
        out.append((2016, 5, cn.strip()))
    return out


def score(title: str, year: int, rank: int) -> tuple:
    han = _han_count(title)
    return (1 if han >= 2 else 0, han, year, -rank)


def main() -> None:
    pool_v, pool_b, pool_n = sedai_pool_ids()
    if SUPPLEMENT_JSON.exists():
        sv, sb, sn = pool_id_sets(load_rows(SUPPLEMENT_JSON))
        pool_v |= sv
        pool_b |= sb
        pool_n |= sn

    alias_to_cn = load_alias_to_cn()
    cache = load_cache()

    raw = load_curated_cn() + load_getchu_cn() + load_ym_cn()
    mapped: list[tuple[int, int, str]] = []
    for year, rank, title in raw:
        cn = alias_to_cn.get(title.casefold()) or title
        mapped.append((year, rank, cn))

    mapped.sort(key=lambda t: score(t[2], t[0], t[1]), reverse=True)
    picked = filter_new_candidates(mapped, pool_v, pool_b, pool_n, cache)
    picked.sort(key=lambda t: score(t[2], t[0], t[1]), reverse=True)
    out = [{"year": y, "rank": r, "name": n} for y, r, n in picked[:TARGET]]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    han_n = sum(1 for x in out if _han_count(x["name"]) >= 2)
    print(f"wrote {OUT.name}: {len(out)} (han={han_n}) pool_vndb={len(pool_v)}")


if __name__ == "__main__":
    main()
