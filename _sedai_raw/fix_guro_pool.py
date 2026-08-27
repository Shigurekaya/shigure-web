#!/usr/bin/env python3
"""修复猎奇向作品：正确 VNDB ID、萌娘/汉化组中文名、完整标签。

Usage:
  . ..\\gal-\\ops\\proxy.ps1; Enable-RepoProxy
  uv run python fix_guro_pool.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fetch_sedai_tags import (
    SUPPLEMENT_OUT,
    best_hit,
    bangumi_fetch,
    bangumi_matches_vndb,
    cngal_fetch,
    client,
    derive_axes,
    load_cache,
    query_variants,
    save_cache,
    vndb_fetch_by_id,
)
from pick_pool_dedupe import canonical_name, dedupe_rows, is_tagged, load_display_overrides, normalize_row

# vndb_id -> (主显示名, year, rank)
GURO_TARGETS: dict[str, tuple[str, int, int]] = {
    "v19233": ("逝去的你，馆里苏醒的罪恶", 2016, 8),
    "v933": ("戈尔尖叫秀", 2006, 9),
    "v26721": ("狂嗜之血", 2019, 10),
    "v119": ("DIVI-DEAD", 1998, 12),
    "v3161": ("STARLESS", 2011, 6),
}

BAD_VNDB_IDS = frozenset(
    {
        "v11459",
        "v9976",
        "v428",
        "v7448",
        "v19234",
        "v1447",  # 错误占位
    }
)


def fetch_row_by_vndb_id(c, cache: dict, vid: str, name: str, year: int, rank: int) -> dict:
    vndb = vndb_fetch_by_id(c, cache, vid)
    if not vndb:
        return {
            "name": name,
            "year": year,
            "rank": rank,
            "vndb_id": vid,
            "tag_source": "none",
            "raw_tags": [],
        }

    titles: list[str] = []
    if vndb.get("title"):
        titles.append(vndb["title"])
    if vndb.get("alttitle"):
        titles.append(vndb["alttitle"])
    for t in vndb.get("titles") or []:
        if isinstance(t, str) and t:
            titles.append(t)

    variants: list[str] = []
    for t in titles[:10]:
        variants.extend(query_variants(t))
    variants.extend(query_variants(name))
    variants = list(dict.fromkeys(v for v in variants if v))[:14]

    bgm = best_hit(bangumi_fetch, c, cache, variants)
    vndb_title = vndb.get("title") or name
    if bgm and not bangumi_matches_vndb(vndb_title, bgm):
        bgm = None
    cng = best_hit(cngal_fetch, c, cache, variants)
    axes = derive_axes(vndb, bgm, cng, year, rank)
    row = {
        "name": name,
        "year": year,
        "rank": rank,
        "vndb_id": vid,
        "bangumi_id": (bgm or {}).get("id"),
        "cngal_id": (cng or {}).get("id"),
        **axes,
    }
    overrides = load_display_overrides()
    forced = overrides.get(f"vndb:{vid}".casefold())
    row["name"] = forced or canonical_name(name, vid, row.get("bangumi_id"))
    return row


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    path = SUPPLEMENT_OUT
    rows: list[dict] = []
    if path.exists():
        rows = json.loads(path.read_text(encoding="utf-8"))

    before = len(rows)
    rows = [r for r in rows if r.get("vndb_id") not in BAD_VNDB_IDS]
    rows = [r for r in rows if r.get("vndb_id") not in GURO_TARGETS]
    rows = [r for r in rows if r.get("vndb_id") != "v6540"]  # sedai 已有 euphoria
    print(f"dropped stale rows: {before - len(rows)}")

    cache = load_cache()
    for vid in list(GURO_TARGETS) + list(BAD_VNDB_IDS):
        cache.get("vndb", {}).pop(f"id:{vid}", None)
        for q in GURO_TARGETS.get(vid, ("",))[0], "死馆", "にくにく", "STARLESS", "Starless":
            if q:
                cache.get("vndb", {}).pop(q, None)
                cache.get("bangumi", {}).pop(q, None)
    cache.get("bangumi", {}).pop("id:555137", None)
    save_cache(cache)

    fetched: list[dict] = []
    with client() as c:
        cache = load_cache()
        for vid, (name, year, rank) in GURO_TARGETS.items():
            row = normalize_row(fetch_row_by_vndb_id(c, cache, vid, name, year, rank))
            fetched.append(row)
            print(
                f"{vid} {row['name']!r} tone={row.get('tone')} "
                f"tags={len(row.get('raw_tags') or [])} ok={is_tagged(row)}"
            )
        save_cache(cache)

    merged = dedupe_rows(rows + fetched)
    path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {path.name}: rows={len(merged)}")


if __name__ == "__main__":
    main()
