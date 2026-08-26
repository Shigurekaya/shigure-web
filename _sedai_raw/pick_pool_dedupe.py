#!/usr/bin/env python3
"""作品池去重与中文名规范化（补位 / 建池共用）。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEDAI_RAW = Path(__file__).resolve().parent
TAGS_JSON = SEDAI_RAW / "sedai_tags.json"
SUPPLEMENT_JSON = SEDAI_RAW / "pick_supplement_tags.json"
CACHE_JSON = SEDAI_RAW / "sedai_tags_cache.json"
ALIASES_JSON = SEDAI_RAW / "pick_title_aliases.json"
YM_PACK = ROOT / "_quiz_raw" / "ym_vndb_alias_pack.json"
DISPLAY_OVERRIDES = SEDAI_RAW / "pick_display_overrides.json"


def _has_han(s: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", s))


def _han_count(s: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", s))


def is_tagged(row: dict) -> bool:
    return row.get("tag_source") not in (None, "none", "heuristic")


def load_rows(*paths: Path) -> list[dict]:
    out: list[dict] = []
    for path in paths:
        if not path.exists():
            continue
        out.extend(json.loads(path.read_text(encoding="utf-8")))
    return out


def load_cache() -> dict:
    if not CACHE_JSON.exists():
        return {"vndb": {}, "bangumi": {}, "cngal": {}}
    try:
        text = CACHE_JSON.read_text(encoding="utf-8").strip()
        if not text:
            return {"vndb": {}, "bangumi": {}, "cngal": {}}
        data = json.loads(text)
        if not isinstance(data, dict):
            return {"vndb": {}, "bangumi": {}, "cngal": {}}
        data.setdefault("vndb", {})
        data.setdefault("bangumi", {})
        data.setdefault("cngal", {})
        return data
    except (json.JSONDecodeError, OSError):
        return {"vndb": {}, "bangumi": {}, "cngal": {}}


# 简繁/异体字归一（用于 norm_key 比对）
_SCRIPT_MAP = str.maketrans(
    {
        "廃": "废",
        "弐": "贰",
        "陰": "阴",
        "誘": "诱",
        "姫": "姬",
        "覚": "觉",
        "観": "观",
        "楽": "乐",
        "戯": "戏",
        "図": "图",
        "記": "记",
        "憶": "忆",
        "願": "愿",
        "戀": "恋",
        "戰": "战",
        "館": "馆",
        "島": "岛",
        "聖": "圣",
        "織": "织",
        "輪": "轮",
        "戀": "恋",
        "黒": "黑",
        "歳": "岁",
        "覇": "霸",
        "龍": "龙",
        "學": "学",
        "圓": "圆",
        "靜": "静",
        "實": "实",
        "寶": "宝",
        "戀": "恋",
        "與": "与",
        "後": "后",
        "裡": "里",
        "體": "体",
        "發": "发",
        "聲": "声",
        "視": "视",
        "說": "说",
        "話": "话",
        "這": "这",
        "還": "还",
        "進": "进",
        "過": "过",
        "達": "达",
        "開": "开",
        "關": "关",
        "門": "门",
        "無": "无",
        "時": "时",
        "間": "间",
        "氣": "气",
        "電": "电",
        "風": "风",
        "雲": "云",
        "夢": "梦",
        "愛": "爱",
        "戀": "恋",
        "萬": "万",
        "華": "华",
        "鏡": "镜",
        "詩": "诗",
        "櫻": "樱",
        "輝": "辉",
        "燿": "耀",
        "讀": "读",
        "聽": "听",
        "見": "见",
        "親": "亲",
        "兒": "儿",
        "變": "变",
        "應": "应",
        "對": "对",
        "從": "从",
        "來": "来",
        "個": "个",
        "們": "们",
        "會": "会",
        "業": "业",
        "產": "产",
        "長": "长",
        "車": "车",
        "東": "东",
        "絲": "丝",
        "兩": "两",
        "為": "为",
        "義": "义",
        "藝": "艺",
        "號": "号",
        "國": "国",
        "圖": "图",
        "經": "经",
        "絕": "绝",
        "緣": "缘",
        "續": "续",
        "聯": "联",
        "聰": "聪",
        "聲": "声",
        "聽": "听",
        "舊": "旧",
        "葉": "叶",
        "號": "号",
        "裝": "装",
        "觀": "观",
        "記": "记",
        "誌": "志",
        "課": "课",
        "講": "讲",
        "證": "证",
        "識": "识",
        "護": "护",
        "貝": "贝",
        "負": "负",
        "費": "费",
        "資": "资",
        "賣": "卖",
        "賽": "赛",
        "轉": "转",
        "農": "农",
        "遠": "远",
        "邊": "边",
        "郵": "邮",
        "醫": "医",
        "釋": "释",
        "鋼": "钢",
        "錄": "录",
        "錢": "钱",
        "鐵": "铁",
        "長": "长",
        "門": "门",
        "開": "开",
        "閒": "闲",
        "間": "间",
        "闆": "板",
        "難": "难",
        "雞": "鸡",
        "電": "电",
        "靈": "灵",
        "顯": "显",
        "風": "风",
        "飛": "飞",
        "飯": "饭",
        "養": "养",
        "馬": "马",
        "驗": "验",
        "體": "体",
        "鬥": "斗",
        "魚": "鱼",
        "鳥": "鸟",
        "點": "点",
        "黨": "党",
        "齊": "齐",
        "齒": "齿",
        "龜": "龟",
    }
)


def norm_key(s: str) -> str:
    """与 fetch_sedai_tags.norm_cmp 一致：去标点 + 简繁归一。"""
    s = (s or "").casefold().translate(_SCRIPT_MAP)
    return re.sub(
        r"[\s　·・•†‡＊*×xＸ～~—\-－_/／|｜\[\]［］()（）「」『』【】★☆!！?？:'\"‘’“”、，。]",
        "",
        s,
    )


# 正篇已在池内时，应跳过的分支/FD/番外（非独立续作）
_BRANCH_RE = re.compile(
    r"小故事|番外|FD|After Story|After Story|外传|分支|特典|Side Story|Spin.?off|"
    r"Mini Story|Short Story|Append|附录|后日谈|IF线|IF 线",
    re.I,
)
# 续作后缀：2 / II / Vol.2 等仍视为独立条目
_SEQUEL_RE = re.compile(
    r"^[\s?？!！]*(?:[2２二]|II+|III+|Vol\.?\s*\d+|第[二三四五六七八九十]+|[续後后])",
    re.I,
)


def load_pool_main_titles(rows: list[dict] | None = None) -> list[str]:
    if rows is None:
        rows = load_rows(TAGS_JSON, SUPPLEMENT_JSON)
    titles = [r["name"] for r in rows if is_tagged(r)]
    titles.sort(key=len, reverse=True)
    return titles


def is_subtitle_variant(title: str, main_titles: list[str]) -> bool:
    """主作已在池：「樱之刻-在樱之森下漫步」类副标题变体视为同一作。"""
    for main in main_titles:
        if not title.startswith(main) or title == main:
            continue
        rest = title[len(main) :].lstrip()
        if rest[:1] in "-－—~～":
            if not _SEQUEL_RE.match(rest.lstrip("-－—~～ ")):
                return True
    return False


def is_branch_or_alt_edition(title: str, main_titles: list[str]) -> bool:
    """主作已在池内时，跳过 FD/番外/分支小作品；保留带明确续作标记的条目。"""
    if "番外" in title:
        return True
    if is_subtitle_variant(title, main_titles):
        return True
    t_cf = title.casefold()
    for main in main_titles:
        m_cf = main.casefold()
        if len(m_cf) < 4 or not t_cf.startswith(m_cf) or t_cf == m_cf:
            continue
        suffix = title[len(main) :].strip()
        if not suffix:
            continue
        if _SEQUEL_RE.match(suffix):
            continue
        if _BRANCH_RE.search(title):
            return True
        # 「主标题 + 角色名&…」类分支
        if "&" in suffix or "＆" in suffix:
            return True
        # 主标题后还有较长副标题，且不像续作编号
        if len(suffix) >= 6 and not re.match(r"^[\s?？!！]*\d", suffix):
            return True
    return False


def load_alias_to_cn() -> dict[str, str]:
    """别名（小写）-> 权威中文主名。"""
    m: dict[str, str] = {}
    if not ALIASES_JSON.exists():
        return m
    data = json.loads(ALIASES_JSON.read_text(encoding="utf-8"))
    for cn, aliases in data.items():
        if not _has_han(cn) or _han_count(cn) < 2:
            continue
        m[cn.casefold()] = cn
        for alias in aliases or []:
            if isinstance(alias, str) and alias.strip():
                m[alias.strip().casefold()] = cn
    return m


def load_ym_maps() -> tuple[dict[str, str], dict[str, str]]:
    """vndb_id -> 中文名；别名 -> vndb_id。"""
    vndb_cn: dict[str, str] = {}
    alias_vndb: dict[str, str] = {}
    if not YM_PACK.exists():
        return vndb_cn, alias_vndb
    pack = json.loads(YM_PACK.read_text(encoding="utf-8"))
    for query, entry in (pack.get("by_query") or {}).items():
        vid = entry.get("vndb_id")
        ym = (entry.get("sources") or {}).get("ym") or {}
        cn = ym.get("chineseName") or (query if _has_han(query) and _han_count(query) >= 2 else None)
        if vid and cn and _has_han(cn):
            vndb_cn[vid] = cn.strip()
        keys = [query] + list(entry.get("aliases") or [])
        if ym.get("name"):
            keys.append(ym["name"])
        for ext in ym.get("extension") or []:
            keys.append(ext)
        if vid:
            for k in keys:
                if isinstance(k, str) and k.strip():
                    alias_vndb[k.strip().casefold()] = vid
    for cn_key, aliases in (pack.get("by_cn") or {}).items():
        if not (_has_han(cn_key) and _han_count(cn_key) >= 2):
            continue
        for alias in aliases or []:
            if isinstance(alias, str) and alias.strip():
                alias_vndb.setdefault(alias.strip().casefold(), "")
    return vndb_cn, alias_vndb


def load_display_overrides() -> dict[str, str]:
    out: dict[str, str] = {}
    if DISPLAY_OVERRIDES.exists():
        for k, v in json.loads(DISPLAY_OVERRIDES.read_text(encoding="utf-8")).items():
            if v:
                out[k.casefold()] = v.strip()
    return out


def pool_id_sets(rows: list[dict] | None = None) -> tuple[set[str], set[int], set[str]]:
    """已收录 vndb_id / bangumi_id / 名称键（含规范化键）。"""
    if rows is None:
        rows = load_rows(TAGS_JSON, SUPPLEMENT_JSON)
    vndb: set[str] = set()
    bgm: set[int] = set()
    names: set[str] = set()
    for r in rows:
        if not is_tagged(r):
            continue
        if r.get("vndb_id"):
            vndb.add(r["vndb_id"])
        if r.get("bangumi_id"):
            bgm.add(int(r["bangumi_id"]))
        name = r["name"]
        names.add(name.casefold())
        nk = norm_key(name)
        if nk:
            names.add(nk)
    return vndb, bgm, names


def sedai_pool_ids() -> tuple[set[str], set[int], set[str]]:
    return pool_id_sets(load_rows(TAGS_JSON))


def lookup_cached_vndb(title: str, cache: dict | None = None) -> str | None:
    from fetch_sedai_tags import query_variants

    cache = cache or load_cache()
    bucket = cache.get("vndb") or {}
    for v in query_variants(title):
        hit = bucket.get(v)
        if isinstance(hit, dict) and hit.get("id"):
            return hit["id"]
    return None


def lookup_cached_bgm(title: str, cache: dict | None = None) -> int | None:
    from fetch_sedai_tags import query_variants

    cache = cache or load_cache()
    bucket = cache.get("bangumi") or {}
    for v in query_variants(title):
        hit = bucket.get(v)
        if isinstance(hit, dict) and hit.get("id"):
            return int(hit["id"])
    return None


def title_known_in_pool(
    title: str,
    pool_vndb: set[str],
    pool_bgm: set[int],
    pool_names: set[str],
    cache: dict | None = None,
    alias_to_cn: dict[str, str] | None = None,
) -> bool:
    """名称或缓存解析出的 ID 是否已在池内。"""
    key = title.casefold()
    nk = norm_key(title)
    if key in pool_names or (nk and nk in pool_names):
        return True
    alias_to_cn = alias_to_cn or load_alias_to_cn()
    cn = alias_to_cn.get(key)
    if cn:
        if cn.casefold() in pool_names or norm_key(cn) in pool_names:
            return True
    # 别名表反向：若 title 是某中文主名的别名，也算已收录
    for alias_key, main in alias_to_cn.items():
        if main.casefold() == key or norm_key(main) == nk:
            if alias_key in pool_names or norm_key(alias_key) in pool_names:
                return True
            if main.casefold() in pool_names or norm_key(main) in pool_names:
                return True
    cache = cache or load_cache()
    for q in (title, cn) if cn else (title,):
        if not q:
            continue
        vid = lookup_cached_vndb(q, cache)
        if vid and vid in pool_vndb:
            return True
        bid = lookup_cached_bgm(q, cache)
        if bid and bid in pool_bgm:
            return True
    return False


def canonical_name(
    name: str,
    vndb_id: str | None = None,
    bangumi_id: int | None = None,
    *,
    alias_to_cn: dict[str, str] | None = None,
    vndb_cn: dict[str, str] | None = None,
    overrides: dict[str, str] | None = None,
    cache: dict | None = None,
) -> str:
    alias_to_cn = alias_to_cn or load_alias_to_cn()
    vndb_cn = vndb_cn or load_ym_maps()[0]
    overrides = overrides or load_display_overrides()
    cache = cache or load_cache()

    if overrides.get(name.casefold()) and _han_count(overrides[name.casefold()]) >= 2:
        return overrides[name.casefold()]
    if vndb_id:
        ov = overrides.get(f"vndb:{vndb_id}".casefold())
        if ov and _han_count(ov) >= 2:
            return ov
        if vndb_id in vndb_cn:
            return vndb_cn[vndb_id]
    cn = alias_to_cn.get(name.casefold())
    if cn:
        return cn
    if _has_han(name) and _han_count(name) >= 2:
        return name
    if bangumi_id:
        hit = (cache.get("bangumi") or {}).get(str(bangumi_id))
        if not hit:
            for v in (cache.get("bangumi") or {}).values():
                if isinstance(v, dict) and v.get("id") == bangumi_id:
                    hit = v
                    break
        if hit:
            for t in (hit.get("name_cn"), hit.get("name")):
                if t and _has_han(t) and _han_count(t) >= 2:
                    return t.strip()
    if vndb_id:
        vhit = None
        for v in (cache.get("vndb") or {}).values():
            if isinstance(v, dict) and v.get("id") == vndb_id:
                vhit = v
                break
        if vhit:
            for t in [vhit.get("alttitle")] + list(vhit.get("titles") or []):
                if t and _has_han(t) and _han_count(t) >= 2:
                    return t.strip()
    return name


def row_in_pool(row: dict, pool_vndb: set[str], pool_bgm: set[int], pool_names: set[str]) -> bool:
    if not is_tagged(row):
        return False
    vid = row.get("vndb_id")
    bid = row.get("bangumi_id")
    if vid and vid in pool_vndb:
        return True
    if bid and int(bid) in pool_bgm:
        return True
    if row["name"].casefold() in pool_names:
        return True
    return False


def _row_rank(row: dict) -> tuple:
    name = row.get("name") or ""
    han = 1 if _has_han(name) and _han_count(name) >= 2 else 0
    cngal = 1 if row.get("cngal_id") else 0
    tagged = 1 if is_tagged(row) else 0
    return (tagged, han, cngal, row.get("year", 0))


def dedupe_rows(rows: list[dict], *, prefer_han: bool = True) -> list[dict]:
    """按 vndb / bangumi / 名称合并；保留中文名与较完整条目。"""
    groups: dict[str, list[dict]] = {}
    for r in rows:
        if r.get("vndb_id"):
            gk = f"v:{r['vndb_id']}"
        elif r.get("bangumi_id"):
            gk = f"b:{r['bangumi_id']}"
        else:
            gk = f"n:{r['name'].casefold()}"
        groups.setdefault(gk, []).append(r)
    out: list[dict] = []
    for grp in groups.values():
        best = grp[0]
        for r in grp[1:]:
            if _row_rank(r) > _row_rank(best):
                best = r
        if prefer_han and is_tagged(best):
            best = dict(best)
            best["name"] = canonical_name(
                best["name"],
                best.get("vndb_id"),
                best.get("bangumi_id"),
            )
        out.append(best)
    return out


def normalize_row(row: dict) -> dict:
    """抓取后规范化：中文名 + 标记是否重复池内。"""
    r = dict(row)
    if is_tagged(r):
        r["name"] = canonical_name(r["name"], r.get("vndb_id"), r.get("bangumi_id"))
    return r


def filter_new_candidates(
    candidates: list[tuple[int, int, str]],
    pool_vndb: set[str],
    pool_bgm: set[int],
    pool_names: set[str],
    cache: dict | None = None,
    main_titles: list[str] | None = None,
) -> list[tuple[int, int, str]]:
    cache = cache or load_cache()
    alias_to_cn = load_alias_to_cn()
    main_titles = main_titles if main_titles is not None else load_pool_main_titles()
    seen_vndb: set[str] = set()
    seen_bgm: set[int] = set()
    seen_name: set[str] = set()
    out: list[tuple[int, int, str]] = []
    for year, rank, title in candidates:
        if title_known_in_pool(title, pool_vndb, pool_bgm, pool_names, cache, alias_to_cn):
            continue
        cn = alias_to_cn.get(title.casefold())
        use = cn or title
        if is_branch_or_alt_edition(use, main_titles):
            continue
        vid = lookup_cached_vndb(title, cache) or (lookup_cached_vndb(use, cache) if cn else None)
        bid = lookup_cached_bgm(title, cache) or (lookup_cached_bgm(use, cache) if cn else None)
        if vid and (vid in pool_vndb or vid in seen_vndb):
            continue
        if bid and (bid in pool_bgm or bid in seen_bgm):
            continue
        nk = use.casefold()
        nrm = norm_key(use)
        if nk in seen_name or (nrm and nrm in seen_name):
            continue
        seen_name.add(nk)
        if nrm:
            seen_name.add(nrm)
        if vid:
            seen_vndb.add(vid)
        if bid:
            seen_bgm.add(bid)
        out.append((year, rank, use))
    return out


def candidate_score(title: str) -> tuple:
    """排序：有汉字 > 有别名映射 > 较新年份优先（由调用方传 year）。"""
    han = _han_count(title)
    alias = 1 if load_alias_to_cn().get(title.casefold()) else 0
    return (1 if han >= 2 else 0, han, alias)


def clean_supplement_file() -> dict:
    """清理 supplement：去掉与 sedai 重复的 vndb，合并同名，统一中文名。"""
    sedai = load_rows(TAGS_JSON)
    supp_path = SUPPLEMENT_JSON
    if not supp_path.exists():
        return {"before": 0, "after": 0, "dropped": 0}
    supplement = json.loads(supp_path.read_text(encoding="utf-8"))
    before = len(supplement)
    pool_v, pool_b, pool_n = pool_id_sets(sedai)
    cleaned: list[dict] = []
    dropped = 0
    for r in supplement:
        r = normalize_row(r)
        if not is_tagged(r):
            cleaned.append(r)
            continue
        if row_in_pool(r, pool_v, pool_b, pool_n):
            dropped += 1
            continue
        cleaned.append(r)
        if r.get("vndb_id"):
            pool_v.add(r["vndb_id"])
        if r.get("bangumi_id"):
            pool_b.add(int(r["bangumi_id"]))
        pool_n.add(r["name"].casefold())
    merged = dedupe_rows(cleaned)
    supp_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    tagged = sum(1 for r in merged if is_tagged(r))
    return {"before": before, "after": len(merged), "dropped_dup": dropped, "tagged": tagged}


if __name__ == "__main__":
    stats = clean_supplement_file()
    print(json.dumps(stats, ensure_ascii=False))
