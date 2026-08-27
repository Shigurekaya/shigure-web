#!/usr/bin/env python3
"""Retry untagged sedai titles + expand popular supplement to fill pick pool to 500.

Usage:
  . ..\\gal-\\ops\\proxy.ps1; Enable-RepoProxy
  uv run python _sedai_raw/fill_pick_pool.py
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

# ensure import of sibling module
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fetch_sedai_tags import (  # noqa: E402
    OUT,
    SUPPLEMENT_OUT,
    RETRY_OUT,
    ALIASES_JSON,
    POPULAR_SEED,
    PROXY,
    client,
    load_cache,
    save_cache,
    load_getchu_candidates,
    fetch_title_row,
    run_fetch_loop,
    query_variants,
    clean_title,
    is_noise,
    _log,
)
from pick_pool_dedupe import (  # noqa: E402
    candidate_score,
    clean_supplement_file,
    filter_new_candidates,
    load_alias_to_cn,
    normalize_row,
    pool_id_sets,
    sedai_pool_ids,
    dedupe_rows,
    is_tagged as row_is_tagged,
)

POOL_TARGET = 600
POPULAR_SEED_EXTRA = Path(__file__).with_name("pick_popular_seed_extra.json")
POPULAR_SEED_FILL600 = Path(__file__).with_name("pick_popular_seed_fill600.json")

# Extra mainstream / iconic titles often missing from sedai+getchu gaps
POPULAR_DEFAULT: list[tuple[int, int, str]] = [
    (2004, 1, "Fate/stay night"),
    (2005, 1, "CLANNAD"),
    (2006, 1, "Fate/stay night Réalta Nua"),
    (2007, 1, "Little Busters!"),
    (2008, 1, "G-senjou no Maou"),
    (2009, 1, "Rewrite"),
    (2010, 1, "WHITE ALBUM2"),
    (2011, 1, "Steins;Gate"),
    (2012, 1, "Hapymaher"),
    (2013, 1, "Aiyoku no Eustia"),
    (2014, 1, "Baldr Sky Dive1"),
    (2015, 1, "Sakura no Uta"),
    (2016, 1, "Summer Pockets"),
    (2017, 1, "Aokana -EXTRA1-"),
    (2018, 1, "Aokana -EXTRA2-"),
    (2000, 1, "Kanon"),
    (2000, 2, "AIR"),
    (2002, 1, "Muv-Luv Alternative"),
    (2003, 1, "CROSS†CHANNEL"),
    (2004, 2, "Katawa Shoujo"),
    (2005, 2, "Yosuga no Sora"),
    (2006, 2, "ef - a fairy tale of the two."),
    (2007, 2, "Higurashi no Naku Koro ni"),
    (2008, 2, "Umineko no Naku Koro ni"),
    (2009, 2, "Baldr Sky"),
    (2010, 2, "Grisaia no Kajitsu"),
    (2011, 2, "Nekopara Vol.1"),
    (2012, 2, "Hatsuyuki Sakura"),
    (2013, 2, "Senren * Banka"),
    (2014, 2, "Amakano"),
    (2015, 2, "9-nine-"),
    (2016, 2, "Hoshizora no Memoria Eternal Heart"),
    (2017, 2, "Aokana"),
    (2018, 2, "Making*Lovers"),
    (2019, 1, "Amakano 2"),
    (2020, 1, "Dohna Dohna"),
    (2021, 1, "Amakano 3"),
    (2001, 1, "Ever17"),
    (2002, 2, "Remember11"),
    (2004, 3, "Tsukihime"),
    (2008, 3, "G-senjou no Maou"),
    (2011, 3, "Rewrite Harvest festa!"),
    (2012, 3, "Fureraba"),
    (2013, 3, "Koiiro Soramoyou"),
    (2014, 3, "SakuSaku"),
    (2015, 3, "Primal×Hearts"),
    (2016, 3, "Wagamama High Spec"),
    (2017, 3, "Tropical Liquor"),
    (2018, 3, "Sugar*Style"),
    (2019, 2, "Renai, Karichaimashita"),
    (2020, 2, "ATRI -My Dear Moments-"),
    (2021, 2, "LOOPERS"),
    (2022, 1, "Maitetsu Last Run!!"),
    (2005, 3, "ToHeart2"),
    (2006, 3, "School Days"),
    (2007, 3, "Shuffle!"),
    (2008, 4, "G-senjou no Maou"),
    (2009, 3, "Edelweiss"),
    (2010, 3, "Hoshimemo"),
    (2011, 4, "Karakara"),
    (2012, 4, "Koi to Senkyo to Chocolate"),
    (2013, 4, "Koi ga Saku Koro Sakura Doki"),
    (2014, 4, "Sanoba Witch"),
    (2015, 4, "Karakara2"),
    (2016, 4, "Tricolour Lovestory"),
    (2017, 4, "Golden Marriage"),
    (2018, 4, "IxSHE Tell"),
    (2019, 3, "HaremKingdom"),
    (2020, 3, "Mamaholic"),
    (2003, 2, "Da Capo"),
    (2004, 4, "Shuffle!"),
    (2010, 4, "Baldr Sky Dive2"),
    (2011, 5, "Hatsukoi 1/1"),
    (2012, 5, "Nekopara Vol.0"),
    (2014, 5, "Chrono Clock"),
    (2015, 5, "Primal×Hearts2"),
    (2016, 5, "Amairo Chocolate"),
    (2017, 5, "Sugar Style"),
    (2018, 5, "Karakara"),
]


def tagged_names_from(path: Path) -> set[str]:
    if not path.exists():
        return set()
    rows = json.loads(path.read_text(encoding="utf-8"))
    return {r["name"].casefold() for r in rows if r.get("tag_source") not in (None, "none")}


def all_pool_names() -> set[str]:
    names = tagged_names_from(OUT)
    names |= tagged_names_from(SUPPLEMENT_OUT)
    names |= tagged_names_from(RETRY_OUT)
    return names


def clear_null_cache_for(queries: list[str]) -> None:
    cache = load_cache()
    cleared = 0
    for bucket in ("vndb", "bangumi", "cngal"):
        for q in queries:
            if q in cache.get(bucket, {}) and cache[bucket][q] is None:
                del cache[bucket][q]
                cleared += 1
            # also clear variant keys
            for v in query_variants(q):
                if v in cache.get(bucket, {}) and cache[bucket][v] is None:
                    del cache[bucket][v]
                    cleared += 1
    if cleared:
        save_cache(cache)
        _log(f"cleared {cleared} null cache entries")


def load_popular_seed(
    pool_vndb: set[str],
    pool_bgm: set[int],
    pool_names: set[str],
) -> list[tuple[int, int, str]]:
    seed_items: list[tuple[int, int, str]] = list(POPULAR_DEFAULT)
    if POPULAR_SEED.exists():
        for item in json.loads(POPULAR_SEED.read_text(encoding="utf-8")):
            if isinstance(item, str):
                seed_items.append((2015, 5, item))
            else:
                seed_items.append((int(item.get("year", 2015)), int(item.get("rank", 5)), item["name"]))
    if POPULAR_SEED_EXTRA.exists():
        for item in json.loads(POPULAR_SEED_EXTRA.read_text(encoding="utf-8")):
            if isinstance(item, str):
                seed_items.append((2015, 5, item))
            else:
                seed_items.append((int(item.get("year", 2015)), int(item.get("rank", 5)), item["name"]))
    if POPULAR_SEED_FILL600.exists():
        for item in json.loads(POPULAR_SEED_FILL600.read_text(encoding="utf-8")):
            if isinstance(item, str):
                seed_items.append((2015, 5, item))
            else:
                seed_items.append((int(item.get("year", 2015)), int(item.get("rank", 5)), item["name"]))
    alias_to_cn = load_alias_to_cn()
    normalized: list[tuple[int, int, str]] = []
    for year, rank, title in seed_items:
        title = clean_title(title)
        if not title or is_noise(title):
            continue
        title = alias_to_cn.get(title.casefold()) or title
        normalized.append((year, rank, title))
    return filter_new_candidates(normalized, pool_vndb, pool_bgm, pool_names)


def merge_update(path: Path, new_rows: list[dict]) -> None:
    """按 vndb/名称合并；规范化中文名。"""
    existing: list[dict] = []
    if path.exists():
        existing = json.loads(path.read_text(encoding="utf-8"))
    merged = dedupe_rows(existing + [normalize_row(r) for r in new_rows])
    path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    tagged = sum(1 for r in merged if row_is_tagged(r))
    _log(f"merged {path.name}: rows={len(merged)} tagged={tagged}")


def retry_untagged_sedai() -> int:
    if not OUT.exists():
        return 0
    rows = json.loads(OUT.read_text(encoding="utf-8"))
    untagged = [(r["year"], r["rank"], r["name"]) for r in rows if r.get("tag_source") in (None, "none")]
    if not untagged:
        _log("no untagged sedai titles")
        return 0
    _log(f"retry untagged sedai: {len(untagged)}")
    clear_null_cache_for([t for _, _, t in untagged])
    fetched = run_fetch_loop(untagged, RETRY_OUT, refetch=True)
    # merge hits back into sedai_tags.json
    hit_map = {r["name"].casefold(): r for r in fetched if r.get("tag_source") not in (None, "none")}
    updated = 0
    for i, r in enumerate(rows):
        hit = hit_map.get(r["name"].casefold())
        if hit:
            rows[i] = {**r, **{k: hit[k] for k in hit if k != "name"}, "name": r["name"]}
            updated += 1
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    _log(f"updated sedai_tags.json hits={updated}")
    return updated


def fill_supplement(need: int) -> int:
    if need <= 0:
        return 0
    pool_v, pool_b, pool_n = sedai_pool_ids()
    if SUPPLEMENT_OUT.exists():
        sv, sb, sn = pool_id_sets(json.loads(SUPPLEMENT_OUT.read_text(encoding="utf-8")))
        pool_v |= sv
        pool_b |= sb
        pool_n |= sn

    alias_to_cn = load_alias_to_cn()
    getchu_pref: list[tuple[int, int, str]] = []
    for year, rank, title in load_getchu_candidates(set()):
        cn = alias_to_cn.get(title.casefold())
        getchu_pref.append((year, rank, cn or title))
    getchu = filter_new_candidates(getchu_pref, pool_v, pool_b, pool_n)
    getchu.sort(key=lambda t: candidate_score(t[2]) + (t[0],), reverse=True)

    seed = load_popular_seed(pool_v, pool_b, pool_n)
    seed.sort(key=lambda t: candidate_score(t[2]) + (t[0],), reverse=True)

    # 中文种子优先，再 getchu
    combined = seed + getchu
    fetch_list = combined[: max(need + 200, need + 80)]
    clear_null_cache_for([t for _, _, t in fetch_list])
    _log(f"supplement fetch={len(fetch_list)} need={need} seed={len(seed)} getchu={len(getchu)}")
    existing: list[dict] = []
    if SUPPLEMENT_OUT.exists():
        existing = json.loads(SUPPLEMENT_OUT.read_text(encoding="utf-8"))
    fetched = run_fetch_loop(fetch_list, SUPPLEMENT_OUT, refetch=False)
    fetched = [normalize_row(r) for r in fetched]
    merged = dedupe_rows(existing + fetched)
    sv, sb, _sn = sedai_pool_ids()
    kept: list[dict] = []
    seen_v: set[str] = set(sv)
    seen_b: set[int] = set(sb)
    for r in merged:
        if not row_is_tagged(r):
            kept.append(r)
            continue
        vid = r.get("vndb_id")
        bid = r.get("bangumi_id")
        if vid and vid in seen_v:
            continue
        if bid and int(bid) in seen_b:
            continue
        kept.append(r)
        if vid:
            seen_v.add(vid)
        if bid:
            seen_b.add(int(bid))
    SUPPLEMENT_OUT.write_text(json.dumps(kept, ensure_ascii=False, indent=2), encoding="utf-8")
    tagged = sum(1 for r in kept if row_is_tagged(r))
    _log(f"supplement total tagged={tagged} (from {len(merged)} after id-dedupe)")
    return tagged


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    _log(f"proxy={PROXY or 'off'} aliases={ALIASES_JSON.exists()}")

    retry_untagged_sedai()

    # 先按 vndb 清理一遍，避免英文重复占位
    stats0 = clean_supplement_file()
    _log(f"pre-clean supplement: {stats0}")

    pool_v, pool_b, pool_n = sedai_pool_ids()
    if SUPPLEMENT_OUT.exists():
        sv, sb, sn = pool_id_sets(json.loads(SUPPLEMENT_OUT.read_text(encoding="utf-8")))
        pool_v |= sv
        pool_b |= sb
        pool_n |= sn
    have = len(pool_v) if pool_v else len(pool_n)
    _log(f"current unique pool estimate: vndb={len(pool_v)} names≈{len(pool_n)//2} have={have}")
    need = max(0, POOL_TARGET - have)
    if need:
        fill_supplement(need)
    else:
        _log("already at target")

    pool_v, _, _ = sedai_pool_ids()
    if SUPPLEMENT_OUT.exists():
        sv, _, _ = pool_id_sets(json.loads(SUPPLEMENT_OUT.read_text(encoding="utf-8")))
        pool_v |= sv
    _log(f"final tagged pool estimate={len(pool_v)} (target {POOL_TARGET})")
    stats = clean_supplement_file()
    _log(f"supplement cleanup: {stats}")


if __name__ == "__main__":
    main()
