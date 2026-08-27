#!/usr/bin/env python3
"""Fetch tags for all gal-sedai titles from VNDB / Bangumi / CnGal.

Usage (workspace uv + proxy):
  . ..\\gal-\\ops\\proxy.ps1; Enable-RepoProxy
  uv run --with httpx python _sedai_raw/fetch_sedai_tags.py
  uv run --with httpx python _sedai_raw/fetch_sedai_tags.py --limit 20   # smoke
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

from pick_tag_axes import (
    derive_axes_from_raw_tags,
)
import time
import urllib.parse
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
SEDAI_JS = ROOT / "js" / "gal-sedai-data.js"
GETCHU = Path(__file__).with_name("getchu_rankings.json")
GETCHU_SUPP = Path(__file__).with_name("getchu_supplement.json")
CACHE = Path(__file__).with_name("sedai_tags_cache.json")
OUT = Path(__file__).with_name("sedai_tags.json")
SUPPLEMENT_OUT = Path(__file__).with_name("pick_supplement_tags.json")
RETRY_OUT = Path(__file__).with_name("pick_retry_tags.json")
ALIASES_JSON = Path(__file__).with_name("pick_title_aliases.json")
POPULAR_SEED = Path(__file__).with_name("pick_popular_seed.json")

UA = "shigure-web-pick/0.2 (local tag enrich; contact: local)"
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or "http://127.0.0.1:7890"

BRAND_NOISE = {
    "Eushully", "KeroQ", "NekoNeko Soft", "Bonbee!", "AliceSoft", "FrontWing",
    "戏画", "F&C", "Circus", "HOOKSOFT", "NITRO PLUS", "Purple software",
    "feng", "Clochette", "ASa Project", "MOONSTONE", "Silky's Plus WASABI",
    "CUBE", "PULLTOP", "PULLTOP 20周年Project",
}

# Hard CN sedai titles → better search keys (JP/EN)
TITLE_ALIASES: dict[str, list[str]] = {
    "永远的艾塞莉娅": ["Ever17 -the out of infinity-", "Ever17", "永远的艾塞莉娅"],
    "幻燐的姬将军2：引导灵魂的族谱": ["幻燐の姫将軍2", "幻燐の姫将軍II", "Genrin no Kishougun 2"],
    "大番长": ["大番長", "Daibanchou -Big Bang Age-", "大番長 -Big Bang Age-"],
    "你所期望的永远": ["君が望む永遠", "Kimi ga Nozomu Eien"],
    "SNOW": ["SNOW", "スノー"],
    "Muv-Luv": ["マブラヴ", "Muv-Luv"],
    "斩魔大圣Demonbane": ["斬魔大聖デモンベイン", "Demonbane"],
    "樱之诗": ["サクラノ詩", "Sakura no Uta"],
    "樱之刻": ["サクラノ刻", "Sakura no Toki"],
    "多娜多娜 一起来干坏事吧": ["ドーナドーナ", "Dohna Dohna"],
    "青鸟": ["青い鳥", "Aoi Tori"],
    "天津罪": ["アマツツミ", "Amatsutsumi"],
    "片羽": ["カケラ", "Kakera"],
    "水葬银币的伊斯特里亚": ["水葬銀貨のイストリア", "Suizokukan no Istoria"],
    "12月的夏娃": ["12月のイヴ", "December's Eve"],
}


def load_title_aliases() -> dict[str, list[str]]:
    merged = {k: list(v) for k, v in TITLE_ALIASES.items()}
    if ALIASES_JSON.exists():
        extra = json.loads(ALIASES_JSON.read_text(encoding="utf-8"))
        for k, vals in extra.items():
            merged.setdefault(k, [])
            for v in vals:
                if v not in merged[k]:
                    merged[k].append(v)
    return merged


TITLE_ALIASES_MAP = load_title_aliases()

# Re-exported from pick_tag_axes for scripts that import fetch_sedai_tags
__all__ = ["VNDB_MAP", "CN_MAP", "derive_axes", "derive_axes_from_raw_tags"]


def client() -> httpx.Client:
    kw: dict = {
        "timeout": httpx.Timeout(40.0, connect=20.0),
        "follow_redirects": True,
        "headers": {"User-Agent": UA},
    }
    if PROXY and PROXY.lower() not in {"", "none", "off", "0"}:
        kw["proxy"] = PROXY
    return httpx.Client(**kw)


def clean_title(title: str) -> str:
    t = title.strip()
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s*XRATED$", "", t, flags=re.I)
    if " DVD " in t:
        t = t.split(" DVD ")[0].strip()
    if t.startswith("|"):
        parts = [p.strip() for p in t.strip("|").split("|") if p.strip()]
        t = parts[0] if parts else ""
    return t


def is_noise(title: str) -> bool:
    if not title or title in BRAND_NOISE:
        return True
    if re.fullmatch(r"[A-Za-z][A-Za-z0-9 .+'&-]{0,24}", title) and title in BRAND_NOISE:
        return True
    # bare studio-like short latin without CJK and without digits often brand
    if title in BRAND_NOISE:
        return True
    return False


def norm_cmp(s: str) -> str:
    s = (s or "").casefold()
    return re.sub(
        r"[\s　·・•†‡＊*×xＸ～~—\-－_/／|｜\[\]［］()（）「」『』【】★☆!！?？:'\"‘’“”]",
        "",
        s,
    )


def overlap(a: str, b: str) -> bool:
    return match_score(a, b) >= 45


def match_score(query: str, candidate: str) -> float:
    """Higher is better. Exact normalized match=100; weak substring for short Latin is low."""
    nq, nc = norm_cmp(query), norm_cmp(candidate)
    if not nq or not nc:
        return 0.0
    if nq == nc:
        return 100.0
    # prefix / subtitle: "Ever17" vs "Ever17theoutofinfinity"
    if nc.startswith(nq) or nq.startswith(nc):
        ratio = min(len(nq), len(nc)) / max(len(nq), len(nc))
        # strong if query is the shorter head
        if len(nq) <= len(nc):
            return 88.0 + 10.0 * ratio  # ~88-98
        return 70.0 + 20.0 * ratio
    if nq in nc or nc in nq:
        ratio = min(len(nq), len(nc)) / max(len(nq), len(nc))
        base = 55.0 + 40.0 * ratio
        if re.fullmatch(r"[a-z0-9]+", nq) and len(nq) <= 6 and ratio < 0.55:
            return 20.0
        # penalize 外伝 / side story style when query doesn't include it
        if ("外伝" in candidate or "gaiden" in candidate.casefold()) and "外伝" not in query and "gaiden" not in query.casefold():
            base -= 25.0
        return base
    # CJK bigram overlap
    hits = 0
    for i in range(len(nq) - 1):
        frag = nq[i : i + 2]
        if frag in nc and re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", frag):
            hits += 1
    if hits:
        return min(70.0, 25.0 + hits * 8.0)
    return 0.0


def bangumi_matches_vndb(vndb_title: str, bgm: dict) -> bool:
    """Bangumi 条目是否与 VNDB 主标题同一作品（排除 Starless Abyss 误配 STARLESS 等）。"""
    vtitle = (vndb_title or "").strip()
    vt = norm_cmp(vtitle)
    if not vt or not bgm:
        return False
    for raw in (bgm.get("name"), bgm.get("name_cn")):
        if not raw:
            continue
        nc = norm_cmp(raw)
        if vt == nc:
            return True
        sc = match_score(vtitle, raw)
        if sc < 70:
            continue
        # 英文主标题：拒绝带明显后缀的更长英文名
        if re.search(r"[A-Za-z]", vtitle) and nc.startswith(vt) and len(nc) - len(vt) >= 4:
            continue
        if re.search(r"[\u4e00-\u9fff]", raw) and not re.search(r"[\u4e00-\u9fff]", vtitle):
            if sc < 92:
                continue
        return True
    return False


def query_variants(title: str) -> list[str]:
    """Generate search keywords from a sedai display title."""
    out: list[str] = []
    seen: set[str] = set()
    aliases = TITLE_ALIASES_MAP

    def add(s: str, *, force: bool = False) -> None:
        s = clean_title(s)
        s = re.sub(r"[†‡•·・]", " ", s)
        s = re.sub(r"\s+", " ", s).strip(" ～~-—_|/／")
        if not s or s.casefold() in seen:
            return
        compact = norm_cmp(s)
        if not compact:
            return
        has_cjk = bool(re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", s))
        if not force:
            if len(compact) < 2:
                return
            if len(compact) < 4 and not has_cjk and s.casefold() != title.casefold():
                return
            if re.fullmatch(r"[a-z0-9]+", compact) and len(compact) < 4 and s.casefold() != title.casefold():
                return
        seen.add(s.casefold())
        out.append(s)

    add(title, force=True)
    for alias in aliases.get(title, []):
        add(alias, force=True)
    add(re.sub(r"[＊*†‡]", "", title))
    add(re.split(r"[～~]", title, maxsplit=1)[0])
    add(re.split(r"[•·・]", title, maxsplit=1)[0])
    for m in re.finditer(r"[～~]([^～~]+)[～~]", title):
        add(m.group(1))
    m = re.search(r"([\u3040-\u30ff\u4e00-\u9fff].*?)([A-Za-z][A-Za-z0-9 .:'-]{2,})$", title)
    if m:
        add(m.group(1))
        add(m.group(2))
    return out


def best_hit(fetch_fn, c, cache, queries: list[str], score_key: str = "score"):
    """Try all queries; keep the highest-scoring hit (fetchers may attach score)."""
    best = None
    best_sc = -1.0
    tried: set[str] = set()
    for q in queries:
        k = q.casefold()
        if k in tried:
            continue
        tried.add(k)
        hit = fetch_fn(c, cache, q)
        if not hit:
            continue
        sc = float(hit.get(score_key) or hit.get("_score") or 50.0)
        if sc > best_sc:
            best_sc = sc
            best = hit
    return best


def load_sedai_titles() -> list[tuple[int, int, str]]:
    text = SEDAI_JS.read_text(encoding="utf-8")
    m = re.search(r"=\s*(\{[\s\S]*\})\s*;?\s*$", text.strip())
    if not m:
        raise SystemExit("cannot parse gal-sedai-data.js")
    data = json.loads(m.group(1))
    rows: list[tuple[int, int, str]] = []
    seen: set[str] = set()
    for year_s, games in sorted(data.items()):
        year = int(year_s)
        for i, g in enumerate(games):
            title = clean_title(g.get("title", ""))
            if not title or is_noise(title):
                continue
            key = title.casefold()
            if key in seen:
                continue
            seen.add(key)
            rows.append((year, i + 1, title))
    return rows


def load_getchu_candidates(exclude: set[str]) -> list[tuple[int, int, str]]:
    """Popular titles from Getchu rankings not already in pool (newer years first)."""
    seen: set[str] = set()
    rows: list[tuple[int, int, str]] = []
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
                if not title or is_noise(title):
                    continue
                key = title.casefold()
                if key in seen or key in exclude:
                    continue
                seen.add(key)
                rows.append((year, rank, title))
    return rows


def fetch_title_row(c: httpx.Client, cache: dict, year: int, rank: int, title: str) -> dict:
    variants = query_variants(title)
    vndb = best_hit(vndb_fetch, c, cache, variants)
    extra: list[str] = []
    if vndb:
        for t in vndb.get("titles") or []:
            for v in query_variants(t):
                if v.casefold() not in {x.casefold() for x in variants + extra}:
                    extra.append(v)
    bgm = best_hit(bangumi_fetch, c, cache, variants + extra[:8])
    cng = best_hit(cngal_fetch, c, cache, variants + extra[:8])
    axes = derive_axes(vndb, bgm, cng, year, rank)
    return {
        "name": title,
        "year": year,
        "rank": rank,
        "vndb_id": (vndb or {}).get("id"),
        "bangumi_id": (bgm or {}).get("id"),
        "cngal_id": (cng or {}).get("id"),
        **axes,
    }


def run_fetch_loop(
    titles: list[tuple[int, int, str]],
    out_path: Path,
    refetch: bool = False,
) -> list[dict]:
    cache = load_cache()
    done: dict[str, dict] = {}
    if out_path.exists() and not refetch:
        try:
            for row in json.loads(out_path.read_text(encoding="utf-8")):
                done[row["name"].casefold()] = row
            _log(f"resume from {out_path.name}: {len(done)} rows")
        except Exception as e:
            _log(f"resume skipped: {e}")

    out_rows: list[dict] = []
    with client() as c:
        for i, (year, rank, title) in enumerate(titles, 1):
            key = title.casefold()
            if key in done and not refetch:
                out_rows.append(done[key])
                if i % 50 == 0:
                    _log(f"[{i}/{len(titles)}] skip-cached {title}")
                continue
            _log(f"[{i}/{len(titles)}] {title}")
            row = fetch_title_row(c, cache, year, rank, title)
            out_rows.append(row)
            done[key] = row
            if i % 5 == 0 or i == len(titles):
                out_path.write_text(json.dumps(out_rows, ensure_ascii=False, indent=2), encoding="utf-8")
                _log(f"  checkpoint {i} tagged={sum(1 for r in out_rows if r.get('tag_source')!='none')}")

    out_path.write_text(json.dumps(out_rows, ensure_ascii=False, indent=2), encoding="utf-8")
    matched = sum(1 for r in out_rows if r.get("tag_source") != "none")
    _log(f"done wrote {out_path} rows={len(out_rows)} tagged={matched}")
    return out_rows


def load_cache() -> dict:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))
    return {"vndb": {}, "bangumi": {}, "cngal": {}}


def save_cache(cache: dict) -> None:
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _log(msg: str) -> None:
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("utf-8", "replace").decode("ascii", "replace"), flush=True)


def _cache_hit(bucket: dict, key: str):
    if key not in bucket:
        return False
    return bucket[key] is not None


def vndb_fetch(c: httpx.Client, cache: dict, keyword: str) -> dict | None:
    if keyword in cache["vndb"]:
        return cache["vndb"][keyword]
    body = {
        "filters": ["search", "=", keyword],
        "fields": "id,title,alttitle,titles{title,lang,main,official},tags{name,rating}",
        "results": 8,
    }
    try:
        r = c.post(
            "https://api.vndb.org/kana/vn",
            json=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        r.raise_for_status()
        rows = r.json().get("results") or []
    except Exception as e:
        _log(f"  vndb err {keyword!r}: {e}")
        time.sleep(0.4)
        return None

    alias_keys = TITLE_ALIASES_MAP.get(keyword, [])
    best = None
    best_score = 0.0
    best_titles: list[str] = []
    for row in rows:
        titles = [row.get("title") or "", row.get("alttitle") or ""]
        for t in row.get("titles") or []:
            if isinstance(t, dict) and t.get("title"):
                titles.append(t["title"])
        sc = max((match_score(keyword, t) for t in titles if t), default=0.0)
        for alias in alias_keys:
            sc = max(sc, max((match_score(alias, t) for t in titles if t), default=0.0))
        # prefer shorter main title when scores close (avoid 外伝 / remakes)
        main = row.get("title") or ""
        if best and abs(sc - best_score) <= 8:
            if len(main) < len(best.get("title") or ""):
                sc += 1.5
        if sc > best_score:
            best_score = sc
            best = row
            best_titles = titles
    if not best or best_score < 55:
        cache["vndb"][keyword] = None
        save_cache(cache)
        time.sleep(0.3)
        return None

    tags = sorted(best.get("tags") or [], key=lambda t: -(t.get("rating") or 0))[:40]
    alt_titles = []
    seen_t: set[str] = set()
    for t in [best.get("title"), best.get("alttitle"), *best_titles]:
        if not t:
            continue
        k = t.casefold()
        if k in seen_t:
            continue
        seen_t.add(k)
        alt_titles.append(t)
    pick = {
        "id": best.get("id"),
        "title": best.get("title"),
        "alttitle": best.get("alttitle"),
        "titles": alt_titles[:12],
        "tags": [{"name": t.get("name"), "rating": t.get("rating")} for t in tags],
        "score": best_score,
    }
    cache["vndb"][keyword] = pick
    save_cache(cache)
    time.sleep(0.35)
    return pick


def vndb_fetch_by_id(c: httpx.Client, cache: dict, vn_id: str) -> dict | None:
    """Fetch VN by exact VNDB id (e.g. v906). Cached separately from keyword search."""
    cache_key = f"id:{vn_id}"
    if cache_key in cache["vndb"]:
        return cache["vndb"][cache_key]
    try:
        r = c.post(
            "https://api.vndb.org/kana/vn",
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
        time.sleep(0.35)
        return None
    if not row:
        cache["vndb"][cache_key] = None
        save_cache(cache)
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
    cache["vndb"][cache_key] = pick
    save_cache(cache)
    time.sleep(0.35)
    return pick


def bangumi_fetch_by_id(c: httpx.Client, cache: dict, subject_id: int) -> dict | None:
    cache_key = f"id:{subject_id}"
    if cache_key in cache["bangumi"]:
        return cache["bangumi"][cache_key]
    try:
        r = c.get(f"https://api.bgm.tv/v0/subjects/{subject_id}")
        if r.status_code == 404:
            cache["bangumi"][cache_key] = None
            save_cache(cache)
            return None
        r.raise_for_status()
        detail = r.json()
        tags = [
            {"name": t.get("name"), "count": t.get("count")}
            for t in (detail.get("tags") or [])[:30]
        ]
        out = {
            "id": subject_id,
            "name": detail.get("name"),
            "name_cn": detail.get("name_cn") or "",
            "tags": tags,
            "score": 100.0,
        }
    except Exception as e:
        _log(f"  bgm id err {subject_id}: {e}")
        out = None
    cache["bangumi"][cache_key] = out
    save_cache(cache)
    time.sleep(0.3)
    return out


def bangumi_fetch(c: httpx.Client, cache: dict, keyword: str) -> dict | None:
    if keyword in cache["bangumi"]:
        return cache["bangumi"][keyword]

    candidates: list[tuple[float, int, str]] = []  # score, id, name
    # v0 search
    try:
        r = c.post(
            "https://api.bgm.tv/v0/search/subjects",
            json={"keyword": keyword, "filter": {"type": [4]}},
            params={"limit": 8},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        if r.status_code == 200:
            for row in (r.json().get("data") or [])[:8]:
                names = [row.get("name") or "", row.get("name_cn") or ""]
                sc = max((match_score(keyword, n) for n in names if n), default=0.0)
                if sc >= 70 and row.get("id"):
                    candidates.append((sc, int(row["id"]), row.get("name_cn") or row.get("name") or ""))
    except Exception as e:
        _log(f"  bgm v0 search err {keyword!r}: {e}")

    # legacy search (often better for CN titles)
    try:
        q = urllib.parse.quote(keyword)
        r = c.get(f"https://api.bgm.tv/search/subject/{q}?type=4&responseGroup=small")
        if r.status_code == 200 and r.text:
            for row in (r.json().get("list") or [])[:8]:
                names = [row.get("name") or "", row.get("name_cn") or ""]
                sc = max((match_score(keyword, n) for n in names if n), default=0.0)
                if sc >= 70 and row.get("id"):
                    candidates.append((sc, int(row["id"]), row.get("name_cn") or row.get("name") or ""))
    except Exception as e:
        _log(f"  bgm legacy search err {keyword!r}: {e}")

    # dedupe by id, keep best score
    by_id: dict[int, tuple[float, str]] = {}
    for sc, sid, name in candidates:
        prev = by_id.get(sid)
        if not prev or sc > prev[0]:
            by_id[sid] = (sc, name)
    ranked = sorted(((sc, sid, name) for sid, (sc, name) in by_id.items()), reverse=True)

    out = None
    for sc, pick_id, pick_name in ranked[:6]:
        try:
            r = c.get(f"https://api.bgm.tv/v0/subjects/{pick_id}")
            if r.status_code == 404:
                continue
            r.raise_for_status()
            detail = r.json()
            tags = [
                {"name": t.get("name"), "count": t.get("count")}
                for t in (detail.get("tags") or [])[:30]
            ]
            # re-score against detail names
            dnames = [detail.get("name") or "", detail.get("name_cn") or "", pick_name]
            dsc = max((match_score(keyword, n) for n in dnames if n), default=sc)
            if dsc < 70:
                continue
            out = {
                "id": pick_id,
                "name": detail.get("name"),
                "name_cn": detail.get("name_cn") or pick_name,
                "tags": tags,
                "score": dsc,
            }
            break
        except Exception as e:
            _log(f"  bgm detail err {pick_id}: {e}")
            continue

    cache["bangumi"][keyword] = out
    save_cache(cache)
    time.sleep(0.3)
    return out


def cngal_fetch(c: httpx.Client, cache: dict, keyword: str) -> dict | None:
    if keyword in cache["cngal"]:
        return cache["cngal"][keyword]
    try:
        r = c.get("https://api.cngal.org/api/home/Search", params={"text": keyword})
        r.raise_for_status()
        data = ((r.json().get("pagedResultDto") or {}).get("data") or [])
    except Exception as e:
        _log(f"  cngal search err {keyword!r}: {e}")
        cache["cngal"][keyword] = None
        save_cache(cache)
        time.sleep(0.25)
        return None

    best = None
    best_score = 0.0
    for it in data:
        e = it.get("entry")
        if not isinstance(e, dict):
            continue
        if e.get("type") not in ("Game", 1, "1"):
            continue
        name = e.get("name") or e.get("displayName") or ""
        sc = match_score(keyword, name)
        if sc > best_score:
            best_score = sc
            best = e
    if not best or best_score < 70:
        cache["cngal"][keyword] = None
        save_cache(cache)
        time.sleep(0.2)
        return None

    entry_id = best.get("id")
    entry_name = best.get("name") or best.get("displayName")
    try:
        r = c.get(f"https://api.cngal.org/api/entries/GetEntryView/{entry_id}")
        r.raise_for_status()
        detail = r.json()
        tags = [t.get("name") for t in (detail.get("tags") or []) if isinstance(t, dict) and t.get("name")]
        out = {"id": entry_id, "name": entry_name or detail.get("name"), "tags": tags[:40], "score": best_score}
    except Exception as e:
        _log(f"  cngal detail err {entry_id}: {e}")
        out = None
    cache["cngal"][keyword] = out
    save_cache(cache)
    time.sleep(0.25)
    return out


def first_hit(fetch_fn, c, cache, queries: list[str]):
    return best_hit(fetch_fn, c, cache, queries)


def derive_axes(vndb: dict | None, bgm: dict | None, cngal: dict | None, year: int, rank: int) -> dict:
    raw_tags: list[str] = []

    if vndb:
        for t in vndb.get("tags") or []:
            name = t.get("name") or ""
            rating = float(t.get("rating") or 1.0)
            if name:
                raw_tags.append(f"vndb:{name}:{rating:.2f}")

    if bgm:
        for t in bgm.get("tags") or []:
            name = t.get("name") or ""
            count = int(t.get("count") or 1)
            if name:
                w = min(3.0, 0.8 + count / 25.0)
                raw_tags.append(f"bgm:{name}:{w:.2f}")

    if cngal:
        for name in cngal.get("tags") or []:
            if name:
                raw_tags.append(f"cngal:{name}:1.20")

    axes = derive_axes_from_raw_tags(raw_tags)
    axes["era"] = "classic" if year <= 2012 else "modern"
    axes["fame"] = "icon" if rank <= 5 else ("hit" if rank <= 12 else "solid")
    axes["tag_source"] = "+".join(
        s for s, obj in (("vndb", vndb), ("bangumi", bgm), ("cngal", cngal)) if obj
    ) or "none"
    axes["raw_tags"] = raw_tags[:36]
    return axes


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--no-proxy", action="store_true")
    ap.add_argument("--refetch", action="store_true", help="ignore existing output rows")
    ap.add_argument(
        "--supplement",
        action="store_true",
        help="fetch tags for Getchu popular titles missing from tagged sedai pool",
    )
    ap.add_argument("--pool-target", type=int, default=500, help="target pool size (supplement mode)")
    args = ap.parse_args()
    global PROXY
    if args.no_proxy:
        PROXY = ""

    if args.supplement:
        tagged_names: set[str] = set()
        if OUT.exists():
            for row in json.loads(OUT.read_text(encoding="utf-8")):
                if row.get("tag_source") not in (None, "none"):
                    tagged_names.add(row["name"].casefold())
        need = max(0, args.pool_target - len(tagged_names))
        cands = load_getchu_candidates(tagged_names)
        fetch_n = need + 20 if need else len(cands)
        if args.limit:
            fetch_n = args.limit
        titles = cands[:fetch_n]
        _log(f"supplement need={need} candidates={len(cands)} fetch={len(titles)} proxy={PROXY or 'off'}")
        run_fetch_loop(titles, SUPPLEMENT_OUT, refetch=args.refetch)
        return

    titles = load_sedai_titles()
    if args.limit:
        titles = titles[: args.limit]
    _log(f"titles={len(titles)} proxy={PROXY or 'off'}")
    run_fetch_loop(titles, OUT, refetch=args.refetch)


if __name__ == "__main__":
    main()
