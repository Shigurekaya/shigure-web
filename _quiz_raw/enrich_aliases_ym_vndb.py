# -*- coding: utf-8 -*-
"""
第二轮：按月幕 Galgame / VNDB 批量补全作品简称与别名。

输出：
  ym_vndb_alias_pack.json  — 供 sync_cn_aliases.py 加载
  ym_vndb_fetch_cache.json — 请求缓存（可复跑）

用法：
  py -3 enrich_aliases_ym_vndb.py           # 全量（有缓存则跳过已成功项）
  py -3 enrich_aliases_ym_vndb.py --repair  # 清失败/错配后重拉并重建 pack
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAW = Path(__file__).resolve().parent
CACHE_PATH = RAW / "ym_vndb_fetch_cache.json"
OUT_PATH = RAW / "ym_vndb_alias_pack.json"

YM_TOKEN_URL = (
    "https://www.ymgal.games/oauth/token"
    "?grant_type=client_credentials&client_id=ymgal&client_secret=luna0327&scope=public"
)
YM_SEARCH = "https://www.ymgal.games/open/archive/search-game"
YM_GAME = "https://www.ymgal.games/open/archive"
VNDB_VN = "https://api.vndb.org/kana/vn"

SKIP_JA_PAT = re.compile(
    r"^("
    r"[①-⑨]|NLNS|SHO|SS|"
    r"\d+(\s*/\s*\d+)+|"
    r".{0,40}(声優|CV|役).*"
    r")$",
    re.I,
)

# 非作品检索词（角色名/填空答案等）
SKIP_QUERY_EXACT = {
    "夏野イオ",
    "なかむらたけし",
    "モンキホーテ",
    "桜爛ロマンシア",
    "Path to glory",
    "無気力ナース",
    "DEARDROPS",  # 乐队/作品边界，题库里多为角色乐器对应
    "柳ひとみ",
    "蒼乃むすび",
    "AIR",  # 太短易误匹配，单独用书名表
}

NOISE_ALIAS = {
    "富婆妹",
    "雪冰城",
}

# 强制检索词（中文书名 → 更易命中的关键词）
FORCE_QUERY: dict[str, list[str]] = {
    "有个真妹妹的大泉君": ["リアル妹がいる大泉くんのばあい", "大泉くんのばあい"],
    "创造世界的空想理论": ["はじめるセカイの理想論", "goodbye world index"],
    "创造世界的空想理论 -goodbye world index-": [
        "はじめるセカイの理想論",
        "goodbye world index",
    ],
    "起始世界的理想论 -goodbye world index-": ["はじめるセカイの理想論"],
    "恋岚Spirichu": ["恋嵐スピリッチュ"],
    "恋岚 Spirit": ["恋嵐スピリッチュ"],
    "恋爱×决胜战": ["恋愛×ロワイアル"],
    "恋爱× Royale": ["恋愛×ロワイアル"],
    "创作少女的恋爱公式": ["創作彼女の恋愛公式"],
    "创作彼女的恋爱公式": ["創作彼女の恋愛公式"],
    "甜蜜女友 3": ["アマカノ3", "アマカノ３"],
    "逐光柠檬协奏曲": ["LimeLight Lemonade Jam", "ライムライト・レモネードジャム"],
    "常轨脱离Creative": ["ハミダシクリエイティブ"],
    "常轨脱离Creative凸": ["ハミダシクリエイティブ凸"],
    "她的圣域": ["彼女のセイイキ"],
    "废村少女［贰］～诱引阴翳的秘姬之匣～": ["廃村少女", "廃村少女［弐］"],
    "查拉图斯特拉如是说": ["ツァラトゥストラはかく語りき", "Also sprach Zarathustra"],
    "种付大叔 VS 迷你裙警察": ["種付おじさんVSミニスカ警察"],
    "大恶党": ["DRACU-RIOT", "ドラクリオット", "Dracu-Riot"],
    "恋之巢": ["こいのす", "こいのす☆イチャコライズ"],
    "不德公会": ["ふとももフェスティバル", "不徳"],
    "Toraware ～被囚的伪妃所梦见的初夜～": ["Toraware", "囚われ"],
    "前辈在我的妄想里打同人？！～小心身体接触～": ["センパレ", "せんぱいがうちにくる"],
}


def http_json(
    url: str,
    *,
    headers: dict | None = None,
    data: bytes | None = None,
    method: str | None = None,
) -> dict:
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers or {},
        method=method or ("POST" if data else "GET"),
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_cache() -> dict:
    if CACHE_PATH.is_file():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {"ym_token": None, "ym_search": {}, "ym_game": {}, "vndb": {}}


def save_cache(cache: dict) -> None:
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def ym_token(cache: dict, *, force: bool = False) -> str:
    tok = cache.get("ym_token")
    if (
        not force
        and tok
        and tok.get("access_token")
        and time.time() < tok.get("expires_at", 0) - 60
    ):
        return tok["access_token"]
    data = http_json(YM_TOKEN_URL)
    cache["ym_token"] = {
        "access_token": data["access_token"],
        "expires_at": time.time() + int(data.get("expires_in", 3600)),
    }
    save_cache(cache)
    return data["access_token"]


def ym_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "version": "1",
        "Accept": "application/json",
        "User-Agent": "shigure-web-alias-enrich/1.1",
    }


def ym_request(cache: dict, url: str) -> dict:
    """带 401 自动刷新的月幕 GET。"""
    token = ym_token(cache)
    try:
        return http_json(url, headers=ym_headers(token))
    except urllib.error.HTTPError as e:
        if e.code == 401:
            token = ym_token(cache, force=True)
            return http_json(url, headers=ym_headers(token))
        raise


def ym_search_list(cache: dict, keyword: str, *, refetch: bool = False) -> list[dict]:
    key = keyword.strip()
    if not key:
        return []
    if not refetch and key in cache["ym_search"]:
        return cache["ym_search"][key]
    qs = urllib.parse.urlencode(
        {"mode": "list", "keyword": key, "pageNum": 1, "pageSize": 8}
    )
    try:
        data = ym_request(cache, f"{YM_SEARCH}?{qs}")
        time.sleep(0.3)
    except urllib.error.HTTPError as e:
        print(f"  ym search fail {key!r}: {e}")
        return cache["ym_search"].get(key) or []
    rows = (data.get("data") or {}).get("result") or []
    cache["ym_search"][key] = rows
    save_cache(cache)
    return rows


def ym_game(cache: dict, gid: int, *, refetch: bool = False) -> dict | None:
    k = str(gid)
    if not refetch and k in cache["ym_game"]:
        return cache["ym_game"][k]
    try:
        data = ym_request(cache, f"{YM_GAME}?gid={gid}")
        time.sleep(0.3)
    except urllib.error.HTTPError as e:
        print(f"  ym game fail {gid}: {e}")
        return cache["ym_game"].get(k)
    game = (data.get("data") or {}).get("game")
    cache["ym_game"][k] = game
    save_cache(cache)
    return game


def vndb_search(cache: dict, keyword: str, *, refetch: bool = False) -> list[dict]:
    key = keyword.strip()
    if not key:
        return []
    if not refetch and key in cache["vndb"]:
        return cache["vndb"][key]
    body = json.dumps(
        {
            "filters": ["search", "=", key],
            "fields": "id, title, alttitle, titles{lang,title,latin,official,main}",
            "results": 5,
        }
    ).encode("utf-8")
    try:
        data = http_json(
            VNDB_VN,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "shigure-web-alias-enrich/1.1",
            },
        )
        time.sleep(0.35)
    except urllib.error.HTTPError as e:
        print(f"  vndb fail {key!r}: {e}")
        return cache["vndb"].get(key) or []
    rows = data.get("results") or []
    cache["vndb"][key] = rows
    save_cache(cache)
    return rows


def clean_alias(s: str) -> str | None:
    t = (s or "").strip().strip("「」『』\"'《》")
    if not t or t in NOISE_ALIAS:
        return None
    if len(t) < 2 or len(t) > 80:
        return None
    if "\n" in t:
        return None
    # 跳过体验版/デモ 发行名（太噪）
    if re.search(r"(体验版|体験版|demo|Demo|DEMO)", t):
        return None
    return t


def dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for x in items:
        k = x.casefold()
        if k in seen:
            continue
        seen.add(k)
        out.append(x)
    return out


def norm_cmp(s: str) -> str:
    s = (s or "").casefold()
    s = re.sub(r"[\s　·・＊*×xＸ～~—\-－_/／|｜\[\]［］()（）「」『』【】★☆]", "", s)
    return s


def has_overlap(a: str, b: str) -> bool:
    na, nb = norm_cmp(a), norm_cmp(b)
    if not na or not nb:
        return False
    if na == nb or na in nb or nb in na:
        return True
    # 共同汉字/假名片段长度≥2
    for i in range(len(na) - 1):
        if na[i : i + 2] in nb and re.search(r"[\u3040-\u30ff\u4e00-\u9fff]", na[i : i + 2]):
            return True
    return False


def aliases_from_ym_game(game: dict) -> list[str]:
    out: list[str] = []
    for k in ("name", "chineseName"):
        raw = game.get(k) or ""
        # 中文名可能含「A / B」
        for part in re.split(r"\s*/\s*", raw):
            a = clean_alias(part)
            if a:
                out.append(a)
        a = clean_alias(raw)
        if a:
            out.append(a)
    for ext in game.get("extensionName") or []:
        a = clean_alias(ext.get("name") or "")
        if a:
            out.append(a)
    for rel in game.get("releases") or []:
        lang = (rel.get("releaseLanguage") or "").lower()
        if lang in {"chinese", "english", "zh", "en", "zh-cn", "zh-tw", "sc", "tc"}:
            a = clean_alias(rel.get("releaseName") or "")
            if a:
                out.append(a)
    return dedupe(out)


def aliases_from_vndb(vn: dict) -> list[str]:
    out: list[str] = []
    for k in ("title", "alttitle"):
        a = clean_alias(vn.get(k) or "")
        if a:
            out.append(a)
    for t in vn.get("titles") or []:
        a = clean_alias(t.get("title") or "")
        if a:
            out.append(a)
        a = clean_alias(t.get("latin") or "")
        if a:
            out.append(a)
    return dedupe(out)


def pick_ym_row(rows: list[dict], keyword: str) -> dict | None:
    if not rows:
        return None
    scored: list[tuple[float, dict]] = []
    for r in rows:
        name = r.get("name") or ""
        cn = r.get("chineseName") or ""
        base = float(r.get("score") or 0)
        bonus = 0.0
        if has_overlap(keyword, name) or has_overlap(keyword, cn):
            bonus += 1.0
        if norm_cmp(keyword) == norm_cmp(name) or norm_cmp(keyword) == norm_cmp(cn):
            bonus += 2.0
        scored.append((base + bonus, r))
    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    # 无字面重叠且分数不高 → 拒收（防「大泉」命中无关妹作）
    name = best.get("name") or ""
    cn = best.get("chineseName") or ""
    if not (has_overlap(keyword, name) or has_overlap(keyword, cn)):
        if best_score < 1.5:
            return None
    return best


def pick_vndb(rows: list[dict], keyword: str) -> dict | None:
    if not rows:
        return None
    for r in rows:
        title = r.get("title") or ""
        alt = r.get("alttitle") or ""
        if has_overlap(keyword, title) or has_overlap(keyword, alt):
            return r
        for t in r.get("titles") or []:
            if has_overlap(keyword, t.get("title") or "") or has_overlap(
                keyword, t.get("latin") or ""
            ):
                return r
    # 无重叠不取首条（避免错配）
    return None


def looks_like_work_title(answer_ja: str) -> bool:
    s = answer_ja.strip()
    if not s or len(s) < 2:
        return False
    if SKIP_JA_PAT.search(s):
        return False
    if s.count("①") + s.count("②") + s.count("③") >= 2:
        return False
    if "→" in s:
        return False
    if s in SKIP_QUERY_EXACT:
        return False
    # 曲名/作品名复合句：仍算作品相关（后面会拆）
    if "曲名" in s and "作品名" in s:
        return True
    # 过像台词/填空
    if re.search(r"(番高い|番低い|左＝|右＝|尽くしたい|お世話好き)", s):
        return False
    if s.startswith("「") and s.endswith("」") and len(s) < 20:
        return False
    return True


def extract_work_from_compound(s: str) -> list[str]:
    """从「曲名「x」or 作品名「y」」拆出可检索作品名。"""
    out: list[str] = []
    for m in re.finditer(r"作品名[：:「『]?\s*[「『]?([^」』」\n]+)[」』]?", s):
        t = m.group(1).strip().rstrip("：:")
        if t:
            out.append(t)
    for m in re.finditer(r"《([^》]+)》", s):
        out.append(m.group(1).strip())
    return out


def collect_queries() -> tuple[list[str], dict[str, list[str]]]:
    zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
    raw = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
    books = [
        ln.strip()
        for ln in (RAW / "_book_titles.txt").read_text(encoding="utf-8").splitlines()
        if ln.strip()
    ]
    qid_queries: dict[str, list[str]] = {}
    all_q: list[str] = []

    def add_q(bucket: list[str], term: str) -> None:
        term = term.strip()
        if not term or term in SKIP_QUERY_EXACT or len(term) < 2:
            return
        bucket.append(term)
        all_q.append(term)
        for alt in FORCE_QUERY.get(term, []):
            bucket.append(alt)
            all_q.append(alt)

    for b in books:
        tmp: list[str] = []
        add_q(tmp, b)

    for q in raw:
        qid = q["id"]
        entry = zh.get(qid) or {}
        if entry.get("type") != "text":
            continue
        qs: list[str] = []
        ja = (q.get("answer_ja") or "").strip()
        if looks_like_work_title(ja):
            ja2 = re.sub(r"^[①-⑨]\s*", "", ja).strip()
            parts = extract_work_from_compound(ja2) or [ja2]
            for part in parts:
                add_q(qs, part)
        for blob in (entry.get("question") or "", entry.get("explain") or ""):
            for t in re.findall(r"《([^》]+)》", blob):
                add_q(qs, t.strip())
        qid_queries[qid] = dedupe(qs)

    return dedupe(all_q), qid_queries


def enrich_one(cache: dict, keyword: str, *, refetch: bool = False) -> dict:
    result: dict = {
        "query": keyword,
        "ym_gid": None,
        "vndb_id": None,
        "aliases": [],
        "sources": {},
    }
    search_terms = [keyword] + FORCE_QUERY.get(keyword, [])
    ym_aliases: list[str] = []
    vn_aliases: list[str] = []

    for term in dedupe(search_terms):
        ym_rows = ym_search_list(cache, term, refetch=refetch)
        ym_row = pick_ym_row(ym_rows, term)
        if ym_row and not result["ym_gid"]:
            gid = ym_row.get("id")
            result["ym_gid"] = gid
            game = ym_game(cache, int(gid), refetch=refetch) if gid else None
            if game:
                ym_aliases = aliases_from_ym_game(game)
                result["sources"]["ym"] = {
                    "name": game.get("name"),
                    "chineseName": game.get("chineseName"),
                    "extension": [e.get("name") for e in (game.get("extensionName") or [])],
                    "matched_by": term,
                }

        vn_rows = vndb_search(cache, term, refetch=refetch)
        vn = pick_vndb(vn_rows, term)
        if vn and not result["vndb_id"]:
            result["vndb_id"] = vn.get("id")
            vn_aliases = aliases_from_vndb(vn)
            result["sources"]["vndb"] = {
                "title": vn.get("title"),
                "alttitle": vn.get("alttitle"),
                "titles": vn.get("titles"),
                "matched_by": term,
            }

        if result["ym_gid"] and result["vndb_id"]:
            break

    result["aliases"] = dedupe(ym_aliases + vn_aliases)
    return result


def build_pack(by_query: dict, qid_queries: dict[str, list[str]]) -> dict:
    by_ja: dict[str, list[str]] = {}
    by_cn: dict[str, list[str]] = {}
    for item in by_query.values():
        aliases = item.get("aliases") or []
        src = item.get("sources") or {}
        ym = src.get("ym") or {}
        ja = ym.get("name")
        cn = ym.get("chineseName")
        if ja:
            by_ja[ja] = dedupe((by_ja.get(ja) or []) + aliases)
        if cn:
            for part in re.split(r"\s*/\s*", cn):
                part = part.strip()
                if part:
                    by_cn[part] = dedupe((by_cn.get(part) or []) + aliases)
            by_cn[cn] = dedupe((by_cn.get(cn) or []) + aliases)
        q = item.get("query") or ""
        if q and aliases:
            by_ja[q] = dedupe((by_ja.get(q) or []) + aliases)

    by_qid: dict[str, list[str]] = {}
    for qid, qs in qid_queries.items():
        merged: list[str] = []
        for q in qs:
            hit = by_query.get(q) or {}
            merged.extend(hit.get("aliases") or [])
            merged.extend(by_cn.get(q) or [])
            merged.extend(by_ja.get(q) or [])
        by_qid[qid] = dedupe(merged)

    return {
        "meta": {
            "source": ["ymgal.games", "api.vndb.org"],
            "query_count": len(by_query),
            "note": "第二轮简称/别名；sync_cn_aliases 加载 by_ja + by_qid",
        },
        "by_ja": by_ja,
        "by_cn": by_cn,
        "by_qid": by_qid,
        "by_query": {
            k: {
                "ym_gid": v.get("ym_gid"),
                "vndb_id": v.get("vndb_id"),
                "aliases": v.get("aliases"),
                "sources": v.get("sources"),
            }
            for k, v in by_query.items()
        },
    }


def clear_bad_cache(cache: dict, queries: list[str]) -> None:
    """清掉失败空结果与已知错配，便于重拉。"""
    bad_queries = {
        "有个真妹妹的大泉君",
        "创造世界的空想理论",
        "创造世界的空想理论 -goodbye world index-",
        "恋岚Spirichu",
        "恋爱×决胜战",
        *FORCE_QUERY.keys(),
    }
    for q in list(queries) + list(bad_queries):
        for alt in [q, *FORCE_QUERY.get(q, [])]:
            if alt in cache.get("ym_search", {}) and not cache["ym_search"][alt]:
                del cache["ym_search"][alt]
            if alt in cache.get("vndb", {}) and not cache["vndb"][alt]:
                del cache["vndb"][alt]
    # 错配：大泉曾命中妹を汚した記憶
    for k, rows in list(cache.get("ym_search", {}).items()):
        if "大泉" in k or "真妹妹" in k:
            cache["ym_search"].pop(k, None)
            cache["vndb"].pop(k, None)
    save_cache(cache)


def main() -> None:
    repair = "--repair" in sys.argv
    cache = load_cache()
    ym_token(cache, force=True)
    queries, qid_queries = collect_queries()
    print(f"queries={len(queries)} text_qids={len(qid_queries)} repair={repair}")

    if repair:
        clear_bad_cache(cache, queries)

    prev = {}
    if OUT_PATH.is_file():
        prev = (json.loads(OUT_PATH.read_text(encoding="utf-8")).get("by_query") or {})

    force_keys = {
        "有个真妹妹的大泉君",
        "リアル妹がいる大泉くんのばあい",
        "大泉くんのばあい",
        "创造世界的空想理论",
        "创造世界的空想理论 -goodbye world index-",
        "起始世界的理想论 -goodbye world index-",
        "はじめるセカイの理想論",
        "goodbye world index",
        "恋岚Spirichu",
        "恋岚 Spirit",
        "恋嵐スピリッチュ",
        "恋爱×决胜战",
        "恋爱× Royale",
        "恋愛×ロワイアル",
        "查拉图斯特拉如是说",
        "种付大叔 VS 迷你裙警察",
        "大恶党",
        "恋之巢",
        "不德公会",
        "Toraware ～被囚的伪妃所梦见的初夜～",
        "前辈在我的妄想里打同人？！～小心身体接触～",
        "彼女のセイイキ",
        "废村少女［贰］～诱引阴翳的秘姬之匣～",
        "同級生２（同級生２リメイク）",
    }

    by_query: dict[str, dict] = {}
    for i, kw in enumerate(queries, 1):
        old = prev.get(kw) or {}
        ym_name = ((old.get("sources") or {}).get("ym") or {}).get("name") or ""
        bad_old = bool(
            ("大泉" in kw or "真妹妹" in kw)
            and ym_name
            and ("大泉" not in ym_name)
            and ("リアル妹" not in ym_name)
        )
        reuse = (
            (not bad_old)
            and (kw not in force_keys)
            and old.get("aliases")
            and (old.get("ym_gid") or old.get("vndb_id"))
        )
        # --repair：仍复用已有成功结果；仅对空结果/force_keys 重拉
        if repair and reuse:
            pass  # keep reuse
        if reuse:
            by_query[kw] = {
                "query": kw,
                "ym_gid": old.get("ym_gid"),
                "vndb_id": old.get("vndb_id"),
                "aliases": old.get("aliases") or [],
                "sources": old.get("sources") or {},
            }
            continue
        print(f"[{i}/{len(queries)}] * {kw}")
        try:
            by_query[kw] = enrich_one(cache, kw, refetch=True)
        except Exception as e:  # noqa: BLE001
            print(f"  ERROR {kw!r}: {e}")
            by_query[kw] = {"query": kw, "aliases": [], "error": str(e)}
        if i % 8 == 0:
            save_cache(cache)

    save_cache(cache)
    pack = build_pack(by_query, qid_queries)
    OUT_PATH.write_text(json.dumps(pack, ensure_ascii=False, indent=2), encoding="utf-8")
    nonempty = sum(1 for a in (pack.get("by_qid") or {}).values() if a)
    empty_q = sum(1 for v in by_query.values() if not v.get("aliases"))
    print(
        f"wrote {OUT_PATH.name}: by_ja={len(pack['by_ja'])} by_cn={len(pack['by_cn'])} "
        f"by_qid_nonempty={nonempty}/{len(pack['by_qid'])} query_empty={empty_q}"
    )


if __name__ == "__main__":
    main()
