#!/usr/bin/env python3
"""Re-fetch weak-tag pool entries from VNDB / Bangumi / CnGal with cross-platform aliases."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from fetch_sedai_tags import (
    OUT,
    SUPPLEMENT_OUT,
    TITLE_ALIASES_MAP,
    bangumi_fetch,
    bangumi_fetch_by_id,
    client,
    cngal_fetch,
    derive_axes,
    load_cache,
    query_variants,
    vndb_fetch,
    vndb_fetch_by_id,
)
from pick_tag_axes import count_meaningful_tag_hits, rederive_row_axes

# Known weak rows: force VNDB id + extra JP/EN/CN queries + optional BGM id override
WEAK_REFETCH: dict[str, dict] = {
    "Reminiscence": {
        "vndb_id": "v906",
        "bangumi_id": 384270,
        "queries": ["Reminiscence", "回想録", "Team Device"],
    },
    "Deep One 堕欲魔导书": {
        "vndb_id": "v22499",
        "bangumi_id": 350300,
        "queries": ["Deep One", "Deep onE", "堕欲魔导书"],
    },
    "恋爱，我借走了": {
        "vndb_id": "v25366",
        "queries": [
            "Ren'ai, Karichaimashita",
            "Renai Karichaimashita",
            "恋、借りちゃいました",
            "Koi, Karichaimashita",
        ],
    },
    "猫附，樱舞": {
        "vndb_id": "v28130",
        "queries": [
            "Nekotsuku, Sakura.",
            "Nekotsuku Sakura",
            "ねこツク、さくら。",
            "猫附，樱舞",
        ],
    },
    "アリス2010": {
        "bangumi_id": 406566,
        "allow_vndb_search": False,
        "queries": ["アリス×・・・！", "Alice 2010", "Alice Soft 2010", "アリス2010"],
    },
}

SUPPLEMENT_DROP = {"CUBE", "PULLTOP 20周年Project"}


def _log(msg: str) -> None:
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("utf-8", "replace").decode("ascii", "replace"), flush=True)


def build_queries(name: str, spec: dict) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []

    def add(q: str) -> None:
        k = q.casefold()
        if q and k not in seen:
            seen.add(k)
            out.append(q)

    for q in spec.get("queries") or []:
        add(q)
    for q in query_variants(name):
        add(q)
    for q in TITLE_ALIASES_MAP.get(name, []):
        add(q)
    return out


def merge_platform_hits(
    c,
    cache: dict,
    name: str,
    spec: dict,
) -> tuple[dict | None, dict | None, dict | None]:
    queries = build_queries(name, spec)
    vndb = None
    if spec.get("vndb_id"):
        vndb = vndb_fetch_by_id(c, cache, spec["vndb_id"])
    elif spec.get("allow_vndb_search", True):
        for q in queries:
            cand = vndb_fetch(c, cache, q)
            if not cand:
                continue
            if not vndb or len(cand.get("tags") or []) > len(vndb.get("tags") or []):
                vndb = cand

    bgm = None
    if spec.get("bangumi_id"):
        bgm = bangumi_fetch_by_id(c, cache, int(spec["bangumi_id"]))
    elif not spec.get("vndb_id"):
        for q in queries:
            cand = bangumi_fetch(c, cache, q)
            if not cand:
                continue
            if not bgm or len(cand.get("tags") or []) > len(bgm.get("tags") or []):
                bgm = cand

    cngal = None
    for q in queries:
        cand = cngal_fetch(c, cache, q)
        if not cand:
            continue
        if not cngal or len(cand.get("tags") or []) > len(cngal.get("tags") or []):
            cngal = cand

    if vndb:
        for t in vndb.get("titles") or []:
            for v in query_variants(t)[:6]:
                cand = cngal_fetch(c, cache, v)
                if cand and (not cngal or len(cand.get("tags") or []) > len(cngal.get("tags") or [])):
                    cngal = cand
    return vndb, bgm, cngal


def enrich_row(c, cache: dict, row: dict, spec: dict) -> dict:
    name = row["name"]
    vndb, bgm, cngal = merge_platform_hits(c, cache, name, spec)
    axes = derive_axes(vndb, bgm, cngal, row.get("year") or 2010, row.get("rank") or 99)
    out = dict(row)
    out["vndb_id"] = spec.get("vndb_id") or (vndb or {}).get("id")
    if spec.get("bangumi_id") or bgm:
        out["bangumi_id"] = (bgm or {}).get("id") or spec.get("bangumi_id")
    else:
        out["bangumi_id"] = (bgm or {}).get("id")
    out["cngal_id"] = (cngal or {}).get("id")
    for k in ("tone", "setting", "pace", "era", "fame", "tag_source", "raw_tags"):
        if k in axes:
            out[k] = axes[k]
    out = rederive_row_axes(out)
    hits = count_meaningful_tag_hits(out.get("raw_tags") or [])
    _log(
        f"  {name}: vndb={out.get('vndb_id')} bgm={out.get('bangumi_id')} "
        f"cngal={out.get('cngal_id')} meaningful={hits} tone={out.get('tone')}"
    )
    return out


def patch_file(path: Path, names: set[str]) -> int:
    if not path.exists():
        return 0
    rows = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    cache = load_cache()
    with client() as c:
        new_rows = []
        for row in rows:
            name = row.get("name") or ""
            if name in SUPPLEMENT_DROP and path == SUPPLEMENT_OUT:
                _log(f"drop brand noise: {name}")
                changed += 1
                continue
            if name in names:
                spec = WEAK_REFETCH[name]
                row = enrich_row(c, cache, row, spec)
                changed += 1
            new_rows.append(row)
    path.write_text(json.dumps(new_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return changed


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    names = set(WEAK_REFETCH)
    _log(f"enrich weak tags: {sorted(names)}")
    n1 = patch_file(OUT, names)
    n2 = patch_file(SUPPLEMENT_OUT, names)
    _log(f"done sedai={n1} supplement={n2}")


if __name__ == "__main__":
    main()
