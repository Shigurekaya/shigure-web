#!/usr/bin/env python3
"""从权威源批量拉取中文译名：VNDB official zh + Bangumi name_cn。

权威优先级（写入 pick_authoritative_cn.json）：
  1. pick_display_overrides.json（人工）
  2. VNDB titles.lang=zh 且 official=true（官中/正式译名）
  3. Bangumi name_cn（番组计划社区标准中文名）
  4. VNDB titles.lang=zh 非 official（参考）

Usage:
  . ..\\gal-\\ops\\proxy.ps1; Enable-RepoProxy
  uv run python enrich_authoritative_cn.py
"""
from __future__ import annotations

import json
import re
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fetch_sedai_tags import client, load_cache, save_cache, _log
from pick_pool_dedupe import load_display_overrides, load_rows, sedai_pool_ids

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "pick_authoritative_cn.json"
TAGS_JSON = ROOT / "sedai_tags.json"
SUPPLEMENT_JSON = ROOT / "pick_supplement_tags.json"
VNDB_URL = "https://api.vndb.org/kana/vn"
BGM_UA = "shigure-web-pick/0.3 (local; contact: local)"


def _has_han(s: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", s))


def _han_count(s: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", s))


def collect_pool_rows() -> tuple[set[str], dict[str, int]]:
    ids: set[str] = set()
    bgm_map: dict[str, int] = {}
    for path in (TAGS_JSON, SUPPLEMENT_JSON):
        for row in load_rows(path):
            vid = row.get("vndb_id")
            bid = row.get("bangumi_id")
            if vid:
                ids.add(vid)
                if bid:
                    bgm_map.setdefault(vid, int(bid))
    pv, _, _ = sedai_pool_ids()
    ids |= pv
    return ids, bgm_map


def pick_zh_from_titles(titles: list[dict]) -> tuple[str | None, str]:
    official: str | None = None
    unofficial: str | None = None
    for t in titles or []:
        if not isinstance(t, dict):
            continue
        lang = (t.get("lang") or "").casefold()
        title = (t.get("title") or "").strip()
        if not title or not _has_han(title) or _han_count(title) < 2:
            continue
        if lang in ("zh", "zh-hans", "zh-cn", "zh-tw", "zh-hant"):
            if t.get("official"):
                official = title
            elif not unofficial:
                unofficial = title
    if official:
        return official, "vndb_official"
    if unofficial:
        return unofficial, "vndb_zh"
    return None, ""


def fetch_vndb_batch(c, ids: list[str], cache: dict, lock: threading.Lock) -> dict[str, dict]:
    out: dict[str, dict] = {}
    missing: list[str] = []
    for vid in ids:
        key = f"id:{vid}"
        with lock:
            hit = cache.get("vndb", {}).get(key)
        if isinstance(hit, dict) and hit.get("titles_meta"):
            out[vid] = hit
        elif isinstance(hit, dict) and hit.get("id"):
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
                    "fields": "id,title,alttitle,titles{title,lang,official}",
                    "results": len(chunk),
                },
                headers={"Content-Type": "application/json", "Accept": "application/json"},
            )
            r.raise_for_status()
            for row in r.json().get("results") or []:
                vid = row.get("id")
                if not vid:
                    continue
                titles_meta = row.get("titles") or []
                title_strs = [t.get("title") for t in titles_meta if isinstance(t, dict) and t.get("title")]
                pick = {
                    "id": vid,
                    "title": row.get("title"),
                    "alttitle": row.get("alttitle"),
                    "titles": title_strs,
                    "titles_meta": titles_meta,
                }
                out[vid] = pick
                with lock:
                    cache.setdefault("vndb", {})[f"id:{vid}"] = pick
            time.sleep(0.25)
        except Exception as e:
            _log(f"vndb batch err: {e}")
    return out


def fetch_bgm_name_cn(c, subject_id: int, cache: dict, lock: threading.Lock) -> str | None:
    key = f"id:{subject_id}"
    with lock:
        hit = cache.get("bangumi", {}).get(key)
    if hit is None:
        try:
            r = c.get(
                f"https://api.bgm.tv/v0/subjects/{subject_id}",
                headers={"User-Agent": BGM_UA},
            )
            if r.status_code == 404:
                with lock:
                    cache.setdefault("bangumi", {})[key] = None
                return None
            r.raise_for_status()
            detail = r.json()
            hit = {
                "id": detail.get("id"),
                "name": detail.get("name"),
                "name_cn": detail.get("name_cn"),
            }
            with lock:
                cache.setdefault("bangumi", {})[key] = hit
            time.sleep(0.15)
        except Exception:
            return None
    if isinstance(hit, dict):
        cn = hit.get("name_cn") or ""
        if _has_han(cn) and _han_count(cn) >= 2:
            return cn.strip()
    return None


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    overrides = load_display_overrides()
    vndb_ids, bgm_map = collect_pool_rows()
    _log(f"vndb_ids={len(vndb_ids)} bgm_pairs={len(bgm_map)}")

    cache = load_cache()
    lock = threading.Lock()
    id_list = sorted(vndb_ids)
    vndb_hits: dict[str, dict] = {}

    with client() as c:
        for i in range(0, len(id_list), 50):
            batch = fetch_vndb_batch(c, id_list[i : i + 50], cache, lock)
            vndb_hits.update(batch)
            _log(f"  vndb {min(i + 50, len(id_list))}/{len(id_list)}")

        bgm_cn: dict[str, str] = {}
        for vid, bid in bgm_map.items():
            cn = fetch_bgm_name_cn(c, bid, cache, lock)
            if cn:
                bgm_cn[vid] = cn

    save_cache(cache)

    entries: dict[str, dict] = {}
    stats = {"vndb_official": 0, "bangumi": 0, "vndb_zh": 0, "override": 0}

    for vid in sorted(vndb_ids):
        rec: dict = {"vndb_id": vid}
        ov = overrides.get(f"vndb:{vid}".casefold())
        if ov and _han_count(ov) >= 2:
            rec["name_cn"] = ov
            rec["source"] = "override"
            stats["override"] += 1
            entries[vid] = rec
            continue

        hit = vndb_hits.get(vid) or {}
        zh, src = pick_zh_from_titles(hit.get("titles_meta") or [])
        if zh and src == "vndb_official":
            rec["name_cn"] = zh
            rec["source"] = "vndb_official"
            stats["vndb_official"] += 1
            entries[vid] = rec
            continue

        bid = bgm_map.get(vid)
        if bid and vid in bgm_cn:
            rec["name_cn"] = bgm_cn[vid]
            rec["source"] = "bangumi"
            stats["bangumi"] += 1
            entries[vid] = rec
            continue

        if zh:
            rec["name_cn"] = zh
            rec["source"] = "vndb_zh"
            stats["vndb_zh"] += 1
            entries[vid] = rec

    OUT.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    _log(f"wrote {OUT.name}: {len(entries)} entries stats={stats}")


if __name__ == "__main__":
    main()
