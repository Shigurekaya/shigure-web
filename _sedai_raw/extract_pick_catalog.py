#!/usr/bin/env python3
"""Extract ~300 mainstream Gals + build gal-pick-data.js (≤100-question bank)."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEDAI_JS = ROOT / "js" / "gal-sedai-data.js"
GETCHU = Path(__file__).with_name("getchu_rankings.json")
OUT_JSON = Path(__file__).with_name("gal-pick-catalog.json")
OUT_JS = ROOT / "js" / "gal-pick-data.js"

TONES = ("sweet", "heal", "drama", "mindbend", "epic", "hype", "literary", "utsuge")
SETTINGS = ("school", "daily", "fantasy", "scifi", "mystery")
PACES = ("short", "breezy", "slowburn", "dense")


def clean(title: str) -> str:
    t = title.strip()
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s*XRATED$", "", t, flags=re.I)
    if " DVD " in t:
        t = t.split(" DVD ")[0].strip()
    if t in {
        "Eushully", "KeroQ", "NekoNeko Soft", "Bonbee!", "AliceSoft",
        "FrontWing", "戏画", "F&C", "Circus",
    }:
        return ""
    if t.startswith("|"):
        parts = [p.strip() for p in t.strip("|").split("|") if p.strip()]
        t = parts[0] if parts else ""
    return t


def diversified_default(title: str, year: int) -> dict[str, str]:
    h = int(hashlib.md5(title.encode("utf-8")).hexdigest()[:8], 16)
    tone = TONES[h % len(TONES)]
    setting = SETTINGS[(h // 7) % len(SETTINGS)]
    pace = PACES[(h // 13) % len(PACES)]
    if year >= 2016 and tone in {"literary", "epic"} and (h % 3 == 0):
        tone = "sweet"
    if year <= 2008 and pace == "short" and (h % 2 == 0):
        pace = "slowburn"
    return {"tone": tone, "setting": setting, "pace": pace}


def infer_tags(title: str, year: int, rank: int) -> dict:
    tags = diversified_default(title, year)
    tags["era"] = "classic" if year <= 2012 else "modern"
    tags["fame"] = "icon" if rank <= 5 else ("hit" if rank <= 12 else "solid")
    for pat, override in TAG_RULES:
        if pat.search(title):
            tags.update(override)
            break
    return tags


def load_sedai() -> list[tuple[int, int, str]]:
    text = SEDAI_JS.read_text(encoding="utf-8")
    m = re.search(r"=\s*(\{[\s\S]*\})\s*;?\s*$", text.strip())
    if not m:
        raise SystemExit("cannot parse gal-sedai-data.js")
    data = json.loads(m.group(1))
    rows: list[tuple[int, int, str]] = []
    for year_s, games in data.items():
        year = int(year_s)
        for i, g in enumerate(games):
            title = clean(g.get("title", ""))
            if title:
                rows.append((year, i + 1, title))
    return rows


def load_getchu() -> list[tuple[int, int, str]]:
    if not GETCHU.exists():
        return []
    data = json.loads(GETCHU.read_text(encoding="utf-8"))
    rows: list[tuple[int, int, str]] = []
    for year_s, block in data.items():
        year = int(year_s)
        for i, raw in enumerate(block.get("titles") or []):
            title = clean(raw)
            if title:
                rows.append((year, i + 1, title))
    return rows



from pick_question_bank import build_question_bank
from pick_traits import attach_traits
from pick_tag_axes import count_meaningful_tag_hits, is_sweet_incompatible, refine_axes, rederive_row_axes
from pick_title_rules import TAG_RULES, apply_title_rules, has_title_rule

TAGS_JSON = Path(__file__).with_name("sedai_tags.json")
SUPPLEMENT_TAGS_JSON = Path(__file__).with_name("pick_supplement_tags.json")
DISPLAY_OVERRIDES_JSON = Path(__file__).with_name("pick_display_overrides.json")
VNDB_OVERRIDES_JSON = Path(__file__).with_name("pick_vndb_overrides.json")
TAGS_CACHE_JSON = Path(__file__).with_name("sedai_tags_cache.json")
YM_ALIAS_PACK = ROOT / "_quiz_raw" / "ym_vndb_alias_pack.json"
POOL_TARGET = 600
# 猎奇/重口向代表作：dedupe 截断 600 时仍强制保留
POOL_PIN_VNDB = frozenset(
    {
        "v19233",  # 逝去的你，馆里苏醒的罪恶（死馆）
        "v933",  # 戈尔尖叫秀
        "v26721",  # 狂嗜之血
        "v119",  # DIVI-DEAD
        "v6540",  # euphoria
        "v3161",  # STARLESS
    }
)

# 由 tone/setting/pace/fame/raw_tags 推导的可辨识属性（供权重矩阵匹配）
# 参考：Galgame Wiki 基调分类（萌/泣/郁/燃/悬疑/恐怖/Meta）+ 玩法（ADV/VN/SLG/RPG）
PROFILE_FOCUS_BY_TONE = {
    "sweet": "romance",
    "hype": "romance",
    "heal": "story",
    "drama": "story",
    "literary": "story",
    "epic": "world",
    "mindbend": "mystery",
    "utsuge": "story",
}
PROFILE_MOOD_BY_TONE = {
    "sweet": "light",
    "hype": "light",
    "heal": "light",
    "drama": "bittersweet",
    "literary": "heavy",
    "epic": "heavy",
    "mindbend": "heavy",
    "utsuge": "heavy",
}
_ROUTE_HINTS = (
    "multiple route mystery",
    "multiple endings",
    "more than seven endings",
    "route unlock",
    "unlockable routes",
    "time travel",
    "loop",
    "轮回",
    "多周目",
    "拼图",
)
_PLAYSTYLE_HINTS: dict[str, tuple[str, ...]] = {
    "rpg": ("role-playing", "rpg", "turn-based", "dungeon", "srpg", "战棋", "ランス", "rance", "map movement"),
    "sim": ("simulation", "raising sim", "schedule", "养成", "slg", "simulation game", "raising"),
    "vn": ("kinetic novel", "sound novel", "linear plot", "linear", "no branching", "音响小说", "视觉小说"),
    "adv": ("branching", "choices matter", "multiple routes", "branching plot", "adv", "文字冒险"),
}
_CAST_HAREM = ("harem", "multiple heroine", "multiple heroines", "多女主", "heroine routes")
_CAST_SOLO = ("single heroine", "one heroine", "单女主", "kinetic", "single route")
_CAST_ENSEMBLE = ("ensemble cast", "群像", "large cast", "multiple protagonists")
_UTSUGE_HINTS = ("utsuge", "鬱", "郁", "depressing", "tragedy", "dark story", "psychological trauma")
_HORROR_HINTS = ("horror", "恐怖", "psychological horror", "gore", "thriller", "悬疑恐怖")
_DARK_NUKIGE_HINTS = (
    "rape", "mindbreak", "sexual slavery", "bestiality", "gang rape", "torture",
    "guro", "cannibalism", "villainous protagonist", "choukyou", "nukige",
    "high amounts of rape",
)
_META_HINTS = ("meta", "fourth wall", "打破第四面墙", "self-aware", "metafiction")


def _blob_has(blob: str, hints: tuple[str, ...]) -> bool:
    return any(h in blob for h in hints)


def derive_playstyle(raw_blob: str) -> str:
    scores = {k: sum(1 for h in hs if h in raw_blob) for k, hs in _PLAYSTYLE_HINTS.items()}
    if scores["rpg"] >= 2 or (scores["rpg"] >= 1 and scores["sim"] >= 1):
        return "hybrid"
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "adv"


def derive_cast(raw_blob: str, tone: str, pace: str) -> str:
    if _blob_has(raw_blob, _CAST_HAREM):
        return "harem"
    if _blob_has(raw_blob, _CAST_ENSEMBLE):
        return "ensemble"
    if _blob_has(raw_blob, _CAST_SOLO) or pace == "short":
        return "solo"
    if tone in ("sweet", "hype") and pace in ("breezy", "short"):
        return "harem"
    if tone in ("epic", "literary", "mindbend"):
        return "ensemble"
    return "solo"


def derive_profile(row: dict) -> dict[str, str]:
    """从已有轴 + VNDB 原始标签推导 focus / entry / mood / routes / playstyle / cast。"""
    raw_tags = row.get("raw_tags") or []
    refined = refine_axes(raw_tags, {
        "tone": row.get("tone") or "sweet",
        "setting": row.get("setting") or "school",
        "pace": row.get("pace") or "breezy",
    })
    # BGM 噪声标签或轴命中不足时，用标题规则补全（知名系列优先）
    if count_meaningful_tag_hits(raw_tags) < 3 and has_title_rule(row.get("name") or ""):
        refined = apply_title_rules(row.get("name") or "", refined)
    elif count_meaningful_tag_hits(raw_tags) == 0:
        refined = apply_title_rules(row.get("name") or "", refined)
    tone = refined["tone"]
    setting = refined["setting"]
    pace = refined["pace"]
    fame = row.get("fame") or "solid"
    raw_blob = " ".join(raw_tags).lower()

    # 重口 / 拔作：禁止甜系恋爱画像（如 黒獣2）
    if is_sweet_incompatible(raw_tags) and tone in ("sweet", "heal"):
        tone = "utsuge" if _blob_has(raw_blob, _DARK_NUKIGE_HINTS) else "hype"

    # 郁系 / 心理恐怖：微调 tone（Galgame Wiki 基调分类）
    if tone not in ("mindbend", "literary") and _blob_has(raw_blob, _UTSUGE_HINTS):
        tone = "utsuge"
    elif tone == "mindbend" and _blob_has(raw_blob, _HORROR_HINTS):
        pass  # 保持 mindbend，由 traits 补 appeal:horror

    focus = PROFILE_FOCUS_BY_TONE.get(tone, "story")
    if setting == "mystery":
        focus = "mystery"
    elif setting in ("fantasy", "scifi") and tone in ("epic", "mindbend", "utsuge"):
        focus = "world"
    elif setting == "school" and tone in ("sweet", "hype") and not is_sweet_incompatible(raw_tags):
        focus = "romance"

    if tone in ("sweet", "heal", "hype") and pace in ("breezy", "short") and fame in ("icon", "hit"):
        entry = "easy"
    elif tone in ("literary", "mindbend", "epic", "utsuge") or pace == "dense":
        entry = "deep"
    else:
        entry = "standard"

    mood = PROFILE_MOOD_BY_TONE.get(tone, "bittersweet")
    if tone in ("drama", "utsuge") and pace in ("dense", "slowburn"):
        mood = "heavy"
    elif tone == "heal" and pace == "short":
        mood = "light"

    # 拔作 / 重口：不得呈现甜系恋爱画像（tone=hype 的轻度拔作同理）
    if is_sweet_incompatible(raw_tags):
        if _blob_has(raw_blob, _DARK_NUKIGE_HINTS):
            mood = "heavy"
            if focus == "romance":
                focus = "world" if setting in ("fantasy", "scifi") else "story"
        else:
            mood = "bittersweet"
            if focus == "romance":
                focus = "story"
        if entry == "easy":
            entry = "standard"

    puzzle_hint = any(h in raw_blob for h in _ROUTE_HINTS)
    if puzzle_hint or (tone == "mindbend" and pace == "dense"):
        routes = "puzzle"
    elif _blob_has(raw_blob, _META_HINTS):
        routes = "puzzle"
    elif pace in ("breezy", "slowburn") and tone in ("sweet", "drama", "hype"):
        routes = "multi"
    elif pace == "short" or _blob_has(raw_blob, _CAST_SOLO):
        routes = "single"
    else:
        routes = "multi"

    profile = {
        "focus": focus,
        "entry": entry,
        "mood": mood,
        "routes": routes,
        "playstyle": derive_playstyle(raw_blob),
        "cast": derive_cast(raw_blob, tone, pace),
    }
    for key, val in (("tone", tone), ("setting", setting), ("pace", pace)):
        if val != row.get(key):
            profile[key] = val
    return profile


_TRAD_CHARS = set("國臺戀綺體發為這與門開關網電畫聽說讀寫實際後來從無時間歡樂樂園藝術")


def _has_han(s: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", s))


def _han_count(s: str) -> int:
    return len(re.findall(r"[\u4e00-\u9fff]", s))


def _name_score(s: str) -> float:
    """越高越像可用的中文显示名。"""
    if not _has_han(s):
        return -1.0
    han = _han_count(s)
    if han <= 1:
        return 5.0
    kana = len(re.findall(r"[\u3040-\u30ff]", s))
    latin = len(re.findall(r"[A-Za-z]", s))
    trad = sum(1 for c in s if c in _TRAD_CHARS)
    score = 50.0 + han * 3.0 - kana * 2.0 - latin * 0.5 - trad * 1.5
    return score


def _load_vndb_overrides() -> dict[str, str]:
    if not VNDB_OVERRIDES_JSON.exists():
        return {}
    raw = json.loads(VNDB_OVERRIDES_JSON.read_text(encoding="utf-8"))
    return {k: v for k, v in raw.items() if not k.startswith("_") and v}


def apply_vndb_overrides_file(path: Path) -> int:
    """把 pick_vndb_overrides.json 写回 sedai_tags / supplement 源文件。"""
    overrides = _load_vndb_overrides()
    if not overrides or not path.exists():
        return 0
    rows = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for row in rows:
        vid = overrides.get(row.get("name") or "")
        if vid and row.get("vndb_id") != vid:
            row["vndb_id"] = vid
            changed += 1
    if changed:
        path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return changed


def _load_authoritative_cn() -> dict[str, dict]:
    path = Path(__file__).with_name("pick_authoritative_cn.json")
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _load_display_overrides() -> dict[str, str]:
    out: dict[str, str] = {}
    if DISPLAY_OVERRIDES_JSON.exists():
        raw = json.loads(DISPLAY_OVERRIDES_JSON.read_text(encoding="utf-8"))
        for k, v in raw.items():
            if v:
                out[k.casefold()] = v.strip()
    return out


def _build_name_indexes() -> tuple[dict, dict, dict]:
    """vndb_by_id, bangumi_by_id, ym_cn_by_vndb"""
    vndb_by_id: dict[str, dict] = {}
    bgm_by_id: dict[int, dict] = {}
    ym_cn: dict[str, str] = {}
    if TAGS_CACHE_JSON.exists():
        cache = json.loads(TAGS_CACHE_JSON.read_text(encoding="utf-8"))
        for hit in (cache.get("vndb") or {}).values():
            if isinstance(hit, dict) and hit.get("id"):
                vndb_by_id[hit["id"]] = hit
        for hit in (cache.get("bangumi") or {}).values():
            if isinstance(hit, dict) and hit.get("id"):
                bgm_by_id[int(hit["id"])] = hit
    if YM_ALIAS_PACK.exists():
        pack = json.loads(YM_ALIAS_PACK.read_text(encoding="utf-8"))
        for entry in (pack.get("by_query") or {}).values():
            vid = entry.get("vndb_id")
            cn = ((entry.get("sources") or {}).get("ym") or {}).get("chineseName")
            if vid and cn and _has_han(cn):
                ym_cn[vid] = cn.strip()
        for cn_key, aliases in (pack.get("by_cn") or {}).items():
            if _has_han(cn_key) and _han_count(cn_key) >= 2:
                for alias in aliases or []:
                    if isinstance(alias, str) and alias and not _has_han(alias):
                        # 仅作备用：英文别名 -> 中文 key（弱映射）
                        pass
    return vndb_by_id, bgm_by_id, ym_cn


def pick_display_name(
    name: str,
    vndb_id: str | None,
    bangumi_id: int | None,
    overrides: dict[str, str],
    vndb_by_id: dict,
    bgm_by_id: dict,
    ym_cn: dict,
) -> str:
    if overrides.get(name.casefold()):
        ov = overrides[name.casefold()]
        if _han_count(ov) >= 2:
            return ov
    if vndb_id:
        ov_key = f"vndb:{vndb_id}".casefold()
        if overrides.get(ov_key):
            return overrides[ov_key]

    candidates: list[tuple[float, str]] = []
    if _has_han(name) and _han_count(name) >= 2:
        candidates.append((_name_score(name) + 20.0, name))

    if vndb_id and vndb_id in ym_cn:
        candidates.append((85.0, ym_cn[vndb_id]))

    auth = (_load_authoritative_cn().get(vndb_id) or {}) if vndb_id else {}
    auth_name = auth.get("name_cn")
    auth_src = auth.get("source") or ""
    if auth_name and _han_count(auth_name) >= 2:
        score = 98.0 if auth_src == "vndb_official" else 94.0 if auth_src == "bangumi" else 90.0
        candidates.append((score, auth_name))

    if vndb_id and vndb_id in vndb_by_id:
        hit = vndb_by_id[vndb_id]
        pool: list[str] = []
        if hit.get("alttitle"):
            pool.append(hit["alttitle"])
        for t in hit.get("titles") or []:
            if isinstance(t, str):
                pool.append(t)
        seen: set[str] = set()
        for t in pool:
            k = t.casefold()
            if k in seen:
                continue
            seen.add(k)
            sc = _name_score(t)
            if sc > 15:
                candidates.append((sc, t))

    if bangumi_id and bangumi_id in bgm_by_id:
        hit = bgm_by_id[bangumi_id]
        for t in (hit.get("name_cn"), hit.get("name")):
            if not t:
                continue
            sc = _name_score(t)
            if sc > 25:
                candidates.append((sc - 5.0, t))

    if not candidates:
        return name
    candidates.sort(key=lambda x: (-x[0], -len(x[1])))
    best = candidates[0][1].strip()
    # 若最佳仍是纯英文且原名也是英文，保留原名
    if not _has_han(best):
        return name
    return best


def enrich_display_names(catalog: list[dict]) -> None:
    overrides = _load_display_overrides()
    vndb_by_id, bgm_by_id, ym_cn = _build_name_indexes()
    cn = 0
    for g in catalog:
        dn = pick_display_name(
            g["name"],
            g.get("vndb_id"),
            g.get("bangumi_id"),
            overrides,
            vndb_by_id,
            bgm_by_id,
            ym_cn,
        )
        g["displayName"] = dn
        if _has_han(dn) and _han_count(dn) >= 2:
            cn += 1
    print(f"displayName with han: {cn}/{len(catalog)}")


def is_tagged(row: dict) -> bool:
    if row.get("tag_source") in (None, "none", "heuristic"):
        return False
    return bool(row.get("raw_tags"))


def is_tagged_entry(row: dict) -> bool:
    """最终 catalog 条目（可能已剥离 raw_tags）。"""
    return row.get("tag_source") not in (None, "none", "heuristic")


def row_to_game(r: dict, source: str, vndb_overrides: dict[str, str] | None = None) -> dict:
    vndb_overrides = vndb_overrides or {}
    game = {
        "name": r["name"],
        "year": r["year"],
        "rank": r["rank"],
        "source": source,
        "tone": r.get("tone") or "sweet",
        "setting": r.get("setting") or "school",
        "pace": r.get("pace") or "breezy",
        "era": r.get("era") or ("classic" if r["year"] <= 2012 else "modern"),
        "fame": r.get("fame") or "solid",
        "tag_source": r.get("tag_source") or "none",
        "vndb_id": vndb_overrides.get(r["name"]) or r.get("vndb_id"),
        "bangumi_id": r.get("bangumi_id"),
        "cngal_id": r.get("cngal_id"),
    }
    game.update(derive_profile(r))
    attach_traits(game, r)
    if r.get("raw_tags"):
        game["raw_tags"] = r["raw_tags"]
    return game


def _prefer_game(a: dict, b: dict) -> dict:
    """重复条目保留：世代优先 > 有 raw_tags > 有中文名 > 名称更完整 > 较新年份。"""

    def rank(g: dict) -> tuple:
        sedai = 1 if g.get("source") == "sedai" else 0
        raw_n = len(g.get("raw_tags") or [])
        label = g.get("displayName") or g.get("name") or ""
        han = 1 if _has_han(label) and _han_count(label) >= 2 else 0
        name_len = len(g.get("name") or "")
        return (sedai, 1 if raw_n else 0, raw_n, han, name_len, g.get("year", 0))

    return a if rank(a) >= rank(b) else b


def _dedupe_group_key(g: dict) -> str:
    if g.get("vndb_id"):
        return f"v:{g['vndb_id']}"
    if g.get("bangumi_id"):
        return f"b:{g['bangumi_id']}"
    return f"n:{g['name'].casefold()}"


def _inject_pinned(pool: list[dict], pinned_rows: list[dict]) -> list[dict]:
    """把 pinned 条目并入 pool（按 vndb_id 去重，pinned 优先）。"""
    by_vid = {g["vndb_id"]: g for g in pool if g.get("vndb_id")}
    for g in pinned_rows:
        vid = g.get("vndb_id")
        if not vid:
            continue
        if vid in by_vid:
            by_vid[vid] = _prefer_game(g, by_vid[vid])
        else:
            by_vid[vid] = g
    rest = [g for g in pool if not g.get("vndb_id")]
    rest += [g for vid, g in by_vid.items() if vid not in POOL_PIN_VNDB]
    pinned = [by_vid[vid] for vid in POOL_PIN_VNDB if vid in by_vid]
    return pinned + rest


def dedupe_catalog(pool: list[dict]) -> list[dict]:
    """按 vndb / bangumi / 名称合并重复作品（如英文名与中文名双条目）。"""
    groups: dict[str, list[dict]] = {}
    for g in pool:
        groups.setdefault(_dedupe_group_key(g), []).append(g)
    out: list[dict] = []
    for grp in groups.values():
        best = grp[0]
        for g in grp[1:]:
            best = _prefer_game(g, best)
        out.append(best)
    fame_ord = {"icon": 0, "hit": 1, "solid": 2}
    out.sort(key=lambda g: (fame_ord.get(g["fame"], 9), -g["year"], g["name"]))
    pinned = [g for g in out if g.get("vndb_id") in POOL_PIN_VNDB]
    rest = [g for g in out if g.get("vndb_id") not in POOL_PIN_VNDB]
    cap = max(POOL_TARGET - len(pinned), 0)
    return pinned + rest[:cap]


def _upgrade_raw_tags_from_cache(row: dict, cache: dict) -> dict:
    """用 cache 中的 VNDB tag.rating / BGM tag.count 为 raw_tags 补权重。"""
    raw = row.get("raw_tags") or []
    if not raw:
        return row
    if any(t.count(":") >= 2 for t in raw if t.startswith(("vndb:", "bgm:"))):
        return row

    vndb_bucket = cache.get("vndb") or {}
    bgm_bucket = cache.get("bangumi") or {}
    upgraded: list[str] = []

    vid = row.get("vndb_id")
    vhit = None
    if vid:
        vhit = vndb_bucket.get(f"id:{vid}")
        if not isinstance(vhit, dict):
            for v in vndb_bucket.values():
                if isinstance(v, dict) and v.get("id") == vid:
                    vhit = v
                    break

    bid = row.get("bangumi_id")
    bhit = None
    if bid:
        bhit = bgm_bucket.get(f"id:{bid}")
        if not isinstance(bhit, dict):
            for v in bgm_bucket.values():
                if isinstance(v, dict) and v.get("id") == bid:
                    bhit = v
                    break

    vndb_tags = {t.get("name"): float(t.get("rating") or 1.0) for t in (vhit or {}).get("tags") or [] if t.get("name")}
    bgm_tags = {t.get("name"): min(3.0, 0.8 + int(t.get("count") or 1) / 25.0) for t in (bhit or {}).get("tags") or [] if t.get("name")}

    for tag in raw:
        if tag.startswith("vndb:"):
            name = tag.split(":", 1)[1]
            w = vndb_tags.get(name, 1.0)
            upgraded.append(f"vndb:{name}:{w:.2f}")
        elif tag.startswith("bgm:"):
            name = tag.split(":", 1)[1]
            w = bgm_tags.get(name, 1.0)
            upgraded.append(f"bgm:{name}:{w:.2f}")
        elif tag.startswith("cngal:"):
            name = tag.split(":", 1)[1]
            upgraded.append(f"cngal:{name}:1.20")
        else:
            upgraded.append(tag)

    out = dict(row)
    out["raw_tags"] = upgraded[:36]
    return out


def rederive_tags_file(path: Path) -> int:
    """从 raw_tags 重算 tone/setting/pace 并写回 JSON。返回变更条数。"""
    if not path.exists():
        return 0
    cache = {}
    if TAGS_CACHE_JSON.exists():
        cache = json.loads(TAGS_CACHE_JSON.read_text(encoding="utf-8"))
    rows = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for i, row in enumerate(rows):
        if not row.get("raw_tags"):
            continue
        row = _upgrade_raw_tags_from_cache(row, cache)
        updated = rederive_row_axes(row)
        if row.get("raw_tags") != rows[i].get("raw_tags") or any(
            updated.get(k) != rows[i].get(k) for k in ("tone", "setting", "pace")
        ):
            rows[i] = updated
            changed += 1
    if changed:
        path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    return changed


def catalog_from_fetched_tags() -> list[dict] | None:
    if not TAGS_JSON.exists():
        return None
    n1 = rederive_tags_file(TAGS_JSON)
    n2 = rederive_tags_file(SUPPLEMENT_TAGS_JSON)
    if n1 or n2:
        print(f"rederived axes: sedai={n1} supplement={n2}")
    vndb_overrides = _load_vndb_overrides()
    sedai_rows = json.loads(TAGS_JSON.read_text(encoding="utf-8"))
    base_rows = [r for r in sedai_rows if is_tagged(r)]
    if not base_rows:
        return None

    seen = {r["name"].casefold() for r in base_rows}
    seen_vndb = {
        vndb_overrides.get(r["name"]) or r.get("vndb_id")
        for r in base_rows
        if vndb_overrides.get(r["name"]) or r.get("vndb_id")
    }
    seen_bgm = {r["bangumi_id"] for r in base_rows if r.get("bangumi_id")}
    pool = [row_to_game(r, "sedai", vndb_overrides) for r in base_rows]

    if SUPPLEMENT_TAGS_JSON.exists() and len(pool) < POOL_TARGET:
        supp_rows = json.loads(SUPPLEMENT_TAGS_JSON.read_text(encoding="utf-8"))
        fame_ord = {"icon": 0, "hit": 1, "solid": 2}
        supp_rows.sort(key=lambda r: (fame_ord.get(r.get("fame") or "solid", 9), -r["year"], r["name"]))
        for r in supp_rows:
            if not is_tagged(r):
                continue
            key = r["name"].casefold()
            vid = r.get("vndb_id")
            bid = r.get("bangumi_id")
            if key in seen or (vid and vid in seen_vndb) or (bid and bid in seen_bgm):
                continue
            seen.add(key)
            if vid:
                seen_vndb.add(vid)
            if bid:
                seen_bgm.add(bid)
            pool.append(row_to_game(r, "getchu-popular", vndb_overrides))
            if len(pool) >= POOL_TARGET + 24:
                break

    pinned_games: list[dict] = []
    if SUPPLEMENT_TAGS_JSON.exists() and POOL_PIN_VNDB:
        supp_by_vid = {
            r["vndb_id"]: r
            for r in json.loads(SUPPLEMENT_TAGS_JSON.read_text(encoding="utf-8"))
            if r.get("vndb_id") and is_tagged(r)
        }
        for vid in POOL_PIN_VNDB:
            r = supp_by_vid.get(vid)
            if not r:
                continue
            if vid in seen_vndb:
                continue
            pinned_games.append(row_to_game(r, "getchu-popular", vndb_overrides))
            seen_vndb.add(vid)
    if pinned_games:
        pool = _inject_pinned(pool, pinned_games)

    fame_ord = {"icon": 0, "hit": 1, "solid": 2}
    pool.sort(key=lambda g: (fame_ord.get(g["fame"], 9), -g["year"], g["name"]))
    pool = dedupe_catalog(pool)
    for i, g in enumerate(pool, 1):
        g["id"] = f"G{i:03d}"
    return pool


def build_js(catalog: list[dict], questions: list[dict]) -> str:
    tagged = sum(1 for g in catalog if is_tagged_entry(g))
    sedai_n = sum(1 for g in catalog if g.get("source") == "sedai")
    supp_n = sum(1 for g in catalog if g.get("source") == "getchu-popular")
    payload = {
        "meta": {
            "title": "Gal缘结",
            "subtitle": "答几道题，找出适合你的 Gal。看不懂的题可以跳过。",
            "resultCount": 1,
            "poolSize": len(catalog),
            "poolTarget": POOL_TARGET,
            "sedaiCount": sedai_n,
            "supplementCount": supp_n,
            "taggedCount": tagged,
            "questionBank": len(questions),
            "drawMax": 32,
            "scoringVersion": 7,
            "source": "gal-sedai(tagged) + getchu-popular + vndb/bangumi/cngal",
        },
        "games": catalog,
        "questions": questions,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    return (
        "/**\n"
        " * Gal缘结 — 原创题库(≤100) + 世代全量作品 + 外站 tags\n"
        " * 由 _sedai_raw/extract_pick_catalog.py 生成；tags 见 fetch_sedai_tags.py\n"
        " */\n"
        f"const GAL_PICK_DATA = {body};\n"
    )


def main() -> None:
    n1 = apply_vndb_overrides_file(TAGS_JSON)
    n2 = apply_vndb_overrides_file(SUPPLEMENT_TAGS_JSON)
    if n1 or n2:
        print(f"patched vndb_id: sedai={n1} supplement={n2}")

    catalog = catalog_from_fetched_tags()
    if catalog is None:
        print("sedai_tags.json missing — fallback heuristic tags; run fetch_sedai_tags.py first")
        seen: dict[str, dict] = {}
        for year, rank, title in load_sedai() + load_getchu():
            key = title.casefold()
            if key in seen:
                continue
            tags = infer_tags(title, year, rank)
            seen[key] = {
                "id": f"G{len(seen)+1:03d}",
                "name": title,
                "year": year,
                "rank": rank,
                "source": "bishojo-game-awards",
                "tag_source": "heuristic",
                **tags,
            }
            seen[key].update(derive_profile(seen[key]))
            attach_traits(seen[key], seen[key])
        catalog = list(seen.values())
        fame_ord = {"icon": 0, "hit": 1, "solid": 2}
        catalog.sort(key=lambda g: (fame_ord.get(g["fame"], 9), -g["year"], g["name"]))
        for i, g in enumerate(catalog, 1):
            g["id"] = f"G{i:03d}"
    else:
        print(f"using fetched tags: {TAGS_JSON.name} -> pool {len(catalog)} (target {POOL_TARGET})")

    enrich_display_names(catalog)
    before = len(catalog)
    catalog = dedupe_catalog(catalog)
    if len(catalog) < before:
        print(f"deduped catalog: {before} -> {len(catalog)}")
    for i, g in enumerate(catalog, 1):
        g["id"] = f"G{i:03d}"

    questions = build_question_bank()
    # JS payload: drop bulky ids if null-heavy? keep for debug
    slim = []
    for g in catalog:
        row = {k: v for k, v in g.items() if v is not None}
        row.pop("raw_tags", None)
        # displayName 与 name 相同时省略以减小体积
        if row.get("displayName") == row.get("name"):
            row.pop("displayName", None)
        slim.append(row)
    OUT_JSON.write_text(json.dumps(slim, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_JS.write_text(build_js(slim, questions), encoding="utf-8")
    tagged = sum(1 for g in slim if is_tagged_entry(g))
    supp = sum(1 for g in slim if g.get("source") == "getchu-popular")
    print(f"games={len(slim)} tagged={tagged} supplement={supp} questions={len(questions)}")
    print(f"wrote {OUT_JS.name}")


if __name__ == "__main__":
    main()
