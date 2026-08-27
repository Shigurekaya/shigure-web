#!/usr/bin/env python3
"""从 VNDB 按人气/评分批量补位到 pick 作品池（绕过名称搜索失败）。

Usage:
  . ..\\gal-\\ops\\proxy.ps1; Enable-RepoProxy
  uv run python import_vndb_popular.py
  uv run python import_vndb_popular.py --need 140 --workers 8
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx

from fetch_sedai_tags import (  # noqa: E402
    SUPPLEMENT_OUT,
    best_hit,
    bangumi_fetch,
    cngal_fetch,
    client,
    derive_axes,
    load_cache,
    query_variants,
    save_cache,
    _log,
)
from pick_pool_dedupe import (  # noqa: E402
    canonical_name,
    dedupe_rows,
    is_tagged,
    load_alias_to_cn,
    normalize_row,
    pool_id_sets,
    sedai_pool_ids,
)

POOL_TARGET = 600
VNDB_URL = "https://api.vndb.org/kana/vn"
_MISSING = object()


class SharedCache:
    """线程安全缓存：并行抓取时合并读写，结束时一次性落盘。"""

    def __init__(self, cache: dict):
        self.cache = cache
        self.lock = threading.Lock()

    def get_vndb(self, key: str):
        with self.lock:
            if key not in self.cache["vndb"]:
                return _MISSING
            return self.cache["vndb"][key]

    def set_vndb(self, key: str, value) -> None:
        with self.lock:
            self.cache["vndb"][key] = value

    def flush(self) -> None:
        with self.lock:
            save_cache(self.cache)


def _year_from_released(s: str | None) -> int:
    if not s:
        return 2010
    m = re.match(r"(\d{4})", s)
    return int(m.group(1)) if m else 2010


def _rank_from_popularity(pop: float | None) -> int:
    if pop is None:
        return 15
    if pop >= 50:
        return 1
    if pop >= 25:
        return 3
    if pop >= 12:
        return 6
    if pop >= 6:
        return 9
    return 12


def fetch_vndb_by_id(c: httpx.Client, shared: SharedCache, vn_id: str) -> dict | None:
    cache_key = f"id:{vn_id}"
    hit = shared.get_vndb(cache_key)
    if hit is not _MISSING:
        return hit if hit else None
    try:
        r = c.post(
            VNDB_URL,
            json={
                "filters": ["id", "=", vn_id],
                "fields": "id,title,alttitle,titles{title,lang,main,official},tags{name,rating}",
                "results": 1,
            },
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        r.raise_for_status()
        row = (r.json().get("results") or [None])[0]
    except Exception as e:
        _log(f"  vndb id err {vn_id!r}: {e}")
        shared.set_vndb(cache_key, None)
        return None
    if not row:
        shared.set_vndb(cache_key, None)
        return None
    tags = sorted(row.get("tags") or [], key=lambda t: -(t.get("rating") or 0))[:40]
    titles = [row.get("title") or "", row.get("alttitle") or ""]
    for t in row.get("titles") or []:
        if isinstance(t, dict) and t.get("title"):
            titles.append(t["title"])
    pick = {
        "id": row.get("id"),
        "title": row.get("title"),
        "alttitle": row.get("alttitle"),
        "titles": list(dict.fromkeys(t for t in titles if t))[:12],
        "tags": [{"name": t.get("name"), "rating": t.get("rating")} for t in tags],
        "score": 100.0,
    }
    shared.set_vndb(cache_key, pick)
    return pick


def fetch_vndb_batch(
    c: httpx.Client,
    ids: list[str],
    cache: dict,
    lock: threading.Lock,
) -> dict[str, dict]:
    out: dict[str, dict] = {}
    missing: list[str] = []
    for vid in ids:
        key = f"id:{vid}"
        with lock:
            hit = cache.get("vndb", {}).get(key)
        if isinstance(hit, dict) and hit.get("id"):
            out[vid] = hit
        else:
            missing.append(vid)

    for i in range(0, len(missing), 50):
        chunk = missing[i : i + 50]
        filt = ["or"] + [["id", "=", vid] for vid in chunk]
        try:
            r = c.post(
                VNDB_URL,
                json={
                    "filters": filt,
                    "fields": "id,title,alttitle,released,rating,popularity,titles{title,lang,official}",
                    "results": len(chunk),
                },
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            r.raise_for_status()
            for row in r.json().get("results") or []:
                vid = row.get("id")
                if vid:
                    out[vid] = row
            time.sleep(0.2)
        except Exception as e:
            _log(f"vndb batch err: {e}")
    return out


def list_vndb_candidates(
    c: httpx.Client,
    *,
    exclude: set[str],
    limit: int,
    min_rating: int,
    min_popularity: float,
) -> list[dict]:
    """分页拉取 VNDB 高人气/高评分条目。"""
    out: list[dict] = []
    page = 1
    while len(out) < limit:
        body = {
            "filters": [
                "and",
                ["rating", ">=", min_rating],
                ["popularity", ">=", min_popularity],
                ["released", ">=", "1998-01-01"],
            ],
            "sort": "popularity",
            "reverse": True,
            "fields": "id,title,released,rating,popularity,titles{title,lang,main,official}",
            "results": 100,
            "page": page,
        }
        r = c.post(
            VNDB_URL,
            json=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        rows = data.get("results") or []
        if not rows:
            break
        for row in rows:
            vid = row.get("id")
            if not vid or vid in exclude:
                continue
            exclude.add(vid)
            out.append(row)
            if len(out) >= limit:
                break
        if not data.get("more"):
            break
        page += 1
        time.sleep(0.2)
    return out


def build_row_from_vndb(
    c: httpx.Client,
    shared: SharedCache,
    stub: dict,
    alias_to_cn: dict[str, str],
    *,
    vndb_only: bool,
) -> dict:
    vid = stub["id"]
    vndb = fetch_vndb_by_id(c, shared, vid)
    if not vndb:
        year = _year_from_released(stub.get("released"))
        rank = _rank_from_popularity(stub.get("popularity"))
        title = stub.get("title") or vid
        return {
            "name": title,
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
        if isinstance(t, dict) and t.get("title"):
            titles.append(t["title"])
        elif isinstance(t, str) and t:
            titles.append(t)

    display = vndb.get("title") or vid
    for t in titles:
        cn = alias_to_cn.get(t.casefold())
        if cn:
            display = cn
            break
    for t in titles:
        if re.search(r"[\u4e00-\u9fff]", t):
            display = t
            break

    year = _year_from_released(stub.get("released"))
    rank = _rank_from_popularity(stub.get("popularity"))

    bgm = None
    cng = None
    if not vndb_only:
        variants: list[str] = []
        for t in titles[:10]:
            variants.extend(query_variants(t))
        variants = list(dict.fromkeys(v for v in variants if v))[:12]
        bgm = best_hit(bangumi_fetch, c, shared.cache, variants)
        cng = best_hit(cngal_fetch, c, shared.cache, variants)

    axes = derive_axes(vndb, bgm, cng, year, rank)
    row = {
        "name": display,
        "year": year,
        "rank": rank,
        "vndb_id": vid,
        "bangumi_id": (bgm or {}).get("id"),
        "cngal_id": (cng or {}).get("id"),
        **axes,
    }
    row["name"] = canonical_name(row["name"], vid, row.get("bangumi_id"))
    return row


def _worker(
    stub: dict,
    alias_to_cn: dict[str, str],
    shared: SharedCache,
    vndb_only: bool,
) -> dict:
    with client() as c:
        return normalize_row(build_row_from_vndb(c, shared, stub, alias_to_cn, vndb_only=vndb_only))


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--need", type=int, default=0, help="how many new vndb ids to import")
    ap.add_argument("--min-rating", type=int, default=65, help="VNDB rating 0-100")
    ap.add_argument("--min-popularity", type=float, default=5.0)
    ap.add_argument("--workers", type=int, default=8, help="parallel fetch workers")
    ap.add_argument(
        "--ids",
        type=str,
        default="",
        help="comma-separated vndb ids to import directly (e.g. v19233,v11459)",
    )
    ap.add_argument(
        "--vndb-only",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="skip Bangumi/CnGal (much faster; VNDB tags alone are enough)",
    )
    args = ap.parse_args()

    pool_v, pool_b, pool_n = sedai_pool_ids()
    if SUPPLEMENT_OUT.exists():
        sv, sb, sn = pool_id_sets(json.loads(SUPPLEMENT_OUT.read_text(encoding="utf-8")))
        pool_v |= sv
        pool_b |= sb
        pool_n |= sn

    have = len(pool_v) if pool_v else len(pool_n)
    id_list: list[str] = []
    if args.ids.strip():
        id_list = [x.strip() for x in args.ids.split(",") if x.strip()]
        id_list = [x if x.startswith("v") else f"v{x}" for x in id_list]
        id_list = [x for x in id_list if x not in pool_v]
    else:
        need = args.need or max(0, POOL_TARGET - have)
        if need <= 0:
            _log(f"pool already {have} >= {POOL_TARGET}")
            return

    workers = max(1, min(args.workers, 16))
    alias_to_cn = load_alias_to_cn()
    shared = SharedCache(load_cache())

    stubs: list[dict] = []
    if id_list:
        _log(f"import by ids={len(id_list)} workers={workers} vndb_only={args.vndb_only}")
        with client() as c:
            for i in range(0, len(id_list), 50):
                chunk = id_list[i : i + 50]
                batch = fetch_vndb_batch(c, chunk, shared.cache, shared.lock)
                for vid in chunk:
                    if vid in batch:
                        stubs.append(batch[vid])
    else:
        fetch_n = (args.need or max(0, POOL_TARGET - have)) + 80
        _log(
            f"pool={have} need={args.need or max(0, POOL_TARGET - have)} "
            f"fetch_candidates={fetch_n} workers={workers} vndb_only={args.vndb_only}"
        )
        with client() as c:
            stubs = list_vndb_candidates(
                c,
                exclude=set(pool_v),
                limit=fetch_n,
                min_rating=args.min_rating,
                min_popularity=args.min_popularity,
            )
        _log(f"vndb candidates={len(stubs)}")

    if not stubs:
        _log("nothing to import")
        return

    existing: list[dict] = []
    if SUPPLEMENT_OUT.exists():
        existing = json.loads(SUPPLEMENT_OUT.read_text(encoding="utf-8"))

    new_rows: list[dict] = [None] * len(stubs)  # type: ignore[list-item]
    done = 0
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {
            ex.submit(_worker, stub, alias_to_cn, shared, args.vndb_only): i
            for i, stub in enumerate(stubs)
        }
        for fut in as_completed(futures):
            idx = futures[fut]
            try:
                new_rows[idx] = fut.result()
            except Exception as e:
                stub = stubs[idx]
                _log(f"  err {stub.get('id')}: {e}")
                new_rows[idx] = {
                    "name": stub.get("title") or stub.get("id"),
                    "year": _year_from_released(stub.get("released")),
                    "rank": _rank_from_popularity(stub.get("popularity")),
                    "vndb_id": stub.get("id"),
                    "tag_source": "none",
                    "raw_tags": [],
                }
            done += 1
            if done % 20 == 0 or done == len(stubs):
                tagged = sum(1 for r in new_rows[:done] if r and is_tagged(r))
                elapsed = time.time() - t0
                rate = done / elapsed if elapsed > 0 else 0
                _log(f"  [{done}/{len(stubs)}] tagged={tagged} ({rate:.1f}/s)")

    shared.flush()
    new_rows = [r for r in new_rows if r]
    merged = dedupe_rows(existing + new_rows)
    tagged_n = sum(1 for r in merged if is_tagged(r))
    SUPPLEMENT_OUT.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")

    pool_v2, _, _ = sedai_pool_ids()
    if SUPPLEMENT_OUT.exists():
        sv, _, _ = pool_id_sets(json.loads(SUPPLEMENT_OUT.read_text(encoding="utf-8")))
        pool_v2 |= sv
    elapsed = time.time() - t0
    _log(
        f"done supplement rows={len(merged)} tagged={tagged_n} "
        f"pool_vndb≈{len(pool_v2)} elapsed={elapsed:.0f}s"
    )


if __name__ == "__main__":
    main()
