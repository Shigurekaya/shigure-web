"""Shared tag maps + axis derivation from raw_tags (fetch + catalog + audit)."""
from __future__ import annotations

import re

# VNDB English tags → tone / setting / pace
VNDB_MAP: dict[str, dict[str, str]] = {
    "Romance": {"tone": "sweet"},
    "Comedy": {"tone": "hype"},
    "Drama": {"tone": "drama"},
    "Tragedy": {"tone": "drama"},
    "Melodrama": {"tone": "drama"},
    "Nakige": {"tone": "drama"},
    "Utsuge": {"tone": "utsuge"},
    "Healing": {"tone": "heal"},
    "Iyashikei": {"tone": "heal"},
    "Slice of Life": {"tone": "heal", "setting": "daily"},
    "Slice of Life Comedy": {"tone": "hype", "setting": "daily"},
    "Mystery": {"tone": "mindbend", "setting": "mystery"},
    "Thriller": {"tone": "mindbend", "setting": "mystery"},
    "Horror": {"tone": "mindbend", "setting": "mystery"},
    "Psychological Horror": {"tone": "mindbend", "setting": "mystery"},
    "Detective": {"tone": "mindbend", "setting": "mystery"},
    "Crime": {"tone": "mindbend", "setting": "mystery"},
    "Sci-fi": {"setting": "scifi", "tone": "mindbend"},
    "Science Fiction": {"setting": "scifi"},
    "Cyberpunk": {"setting": "scifi"},
    "Post-apocalyptic": {"setting": "scifi", "tone": "mindbend"},
    "Fantasy": {"setting": "fantasy"},
    "High Fantasy": {"setting": "fantasy"},
    "Urban Fantasy": {"setting": "fantasy"},
    "Medieval Fantasy": {"setting": "fantasy"},
    "Historical": {"setting": "fantasy"},
    "High School": {"setting": "school"},
    "School Life": {"setting": "school"},
    "College": {"setting": "school"},
    "Modern Day Japan": {"setting": "daily"},
    "Fictional Modern Day Japanese Town": {"setting": "daily"},
    "Fictional Modern Day Japanese Countryside": {"setting": "daily"},
    "ADV": {"pace": "breezy"},
    "Branching Plot": {"pace": "breezy"},
    "Episodic Story": {"pace": "breezy"},
    "Kinetic Novel": {"pace": "short"},
    "Linear Plot": {"pace": "short"},
    "Short": {"pace": "short"},
    "Long": {"pace": "slowburn"},
    "Very Long": {"pace": "dense"},
    "Action": {"tone": "hype"},
    "Combat": {"tone": "epic"},
    "War": {"tone": "epic"},
    "Politics": {"tone": "epic"},
    "Philosophy": {"tone": "literary"},
    "Literary Fiction": {"tone": "literary"},
    "Psychological": {"tone": "literary"},
    "Time Travel": {"setting": "scifi", "tone": "mindbend"},
    "Multiple Route Mystery": {"tone": "mindbend", "setting": "mystery"},
    "Netorare": {"tone": "drama"},
    # adult / dark — must not fall back to sweet
    "Nukige": {"tone": "hype"},
    "High Sexual Content": {"tone": "hype"},
    "Rape": {"tone": "utsuge"},
    "High Amounts of Rape": {"tone": "utsuge"},
    "Gang Rape": {"tone": "utsuge"},
    "Mindbreak": {"tone": "utsuge"},
    "Sexual Slavery": {"tone": "utsuge"},
    "Bestiality": {"tone": "utsuge"},
    "Torture": {"tone": "utsuge"},
    "Guro": {"tone": "utsuge"},
    "Cannibalism": {"tone": "utsuge"},
    "Villainous Protagonist": {"tone": "utsuge"},
    "Life and Death Drama": {"tone": "drama"},
    "Psychological Trauma": {"tone": "utsuge"},
    "Bad Endings": {"tone": "drama"},
    "Bad Endings with Story": {"tone": "drama"},
    "Dystopia": {"setting": "scifi", "tone": "utsuge"},
    "Post-apocalyptic Science Fiction": {"setting": "scifi", "tone": "mindbend"},
    "Mecha": {"setting": "scifi", "tone": "epic"},
    "Magic": {"setting": "fantasy"},
    "No Sexual Content": {"tone": "heal"},
    "Student Heroine": {"setting": "school"},
    "Student Protagonist": {"setting": "school"},
    "Love Overcomes All": {"tone": "sweet"},
    "Multiple Heroines": {"tone": "sweet"},
}

# Bangumi/CnGal 平台噪声标签 — 不参与轴投票
BGM_NOISE_TAGS: frozenset[str] = frozenset({
    "pc", "android", "ios", "steam", "linux", "mac", "edu", "dvd", "psp", "psv", "ns", "switch",
    "game", "games", "galgame", "gal", "avg", "adv", "vn", "visual novel", "视觉小说", "游戏",
    "手机游戏", "手游", "同人", "汉化", "生肉", "官中", "民间汉化", "资源难找", "入正", "正版",
    "2020", "2021", "2022", "2023", "2024", "2025", "2026",
    "7+", "12+", "15+", "18+", "全平台", "multi-platform",
})

# Bangumi / CnGal → axes
CN_MAP: dict[str, dict[str, str]] = {
    "恋爱": {"tone": "sweet"},
    "纯爱": {"tone": "sweet"},
    "甜作": {"tone": "sweet"},
    "废萌": {"tone": "sweet"},
    "萌": {"tone": "sweet"},
    "治愈": {"tone": "heal"},
    "温馨": {"tone": "heal"},
    "日常": {"tone": "heal", "setting": "daily"},
    "致郁": {"tone": "drama"},
    "悲情": {"tone": "drama"},
    "百合": {"tone": "drama"},
    "催泪": {"tone": "drama"},
    "泪腺崩坏": {"tone": "drama"},
    "泣きゲー": {"tone": "drama"},
    "郁": {"tone": "utsuge"},
    "鬱": {"tone": "utsuge"},
    "Drama": {"tone": "drama"},
    "悬疑": {"tone": "mindbend", "setting": "mystery"},
    "推理": {"tone": "mindbend", "setting": "mystery"},
    "神秘": {"tone": "mindbend", "setting": "mystery"},
    "猎奇": {"tone": "mindbend"},
    "科幻": {"setting": "scifi", "tone": "mindbend"},
    "未来": {"setting": "scifi"},
    "奇幻": {"setting": "fantasy"},
    "幻想": {"setting": "fantasy"},
    "魔法": {"setting": "fantasy"},
    "异世界": {"setting": "fantasy"},
    "校园": {"setting": "school"},
    "学园": {"setting": "school"},
    "高中": {"setting": "school"},
    "短篇": {"pace": "short"},
    "长篇": {"pace": "slowburn"},
    "超长篇": {"pace": "dense"},
    "全年龄": {"tone": "heal"},
    "文学": {"tone": "literary"},
    "哲学": {"tone": "literary"},
    "战斗": {"tone": "epic"},
    "热血": {"tone": "hype"},
    "喜剧": {"tone": "hype"},
    "欢脱": {"tone": "hype"},
    "后宫": {"tone": "sweet"},
    "群像": {"tone": "drama"},
    "拔作": {"tone": "hype"},
    "解谜": {"tone": "mindbend", "setting": "mystery"},
    "狼人杀": {"tone": "mindbend", "setting": "mystery"},
    "轮回": {"tone": "mindbend", "setting": "scifi"},
    "meta": {"tone": "mindbend"},
    "电波": {"tone": "mindbend"},
    "泣系": {"tone": "drama"},
    "泪系": {"tone": "drama"},
    "神作": {"tone": "literary"},
    "剧情": {"tone": "drama"},
    "冒险": {"setting": "fantasy", "tone": "hype"},
}

_DARK_TONE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"rape|mindbreak|sexual slavery|bestiality|gang rape|torture|guro|cannibalism|"
        r"choukyou|public use|heroine rape|villainous protagonist|snuff|humiliation|"
        r"high amounts of rape|pain only rape|monster rape|tentacle rape|sex cult",
        re.I,
    ),
)
_HORROR_TONE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"horror|psychological horror|thriller|gore|惊悚|恐怖", re.I),
)
_NUKIGE_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"nukige|拔作|eroge focus|high sexual content|sexual content", re.I),
)
_SWEET_BLOCK_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"rape|mindbreak|sexual slavery|bestiality|gang rape|torture|guro|cannibalism|"
        r"villainous protagonist|high amounts of rape|choukyou|nukige|"
        r"high sexual content|eroge focus|sexual content|拔作",
        re.I,
    ),
)

# Backward compat alias used by older imports
VNDB_DARK_MAP = VNDB_MAP


def _blob(raw_tags: list[str]) -> str:
    return " ".join(raw_tags).lower()


def _any_match(blob: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(p.search(blob) for p in patterns)


def _is_noise_tag(source: str, name: str) -> bool:
    if source not in ("bgm", "cngal"):
        return False
    key = name.strip().casefold()
    if key in BGM_NOISE_TAGS:
        return True
    if key.isdigit() and len(key) == 4:
        return True
    # 仅过滤拉丁短码，保留「悬疑」「猎奇」等双字中文标签
    if len(key) <= 2 and key.isascii():
        return True
    return False


def apply_map(name: str, mapping: dict[str, dict[str, str]], votes: dict[str, dict[str, float]], w: float) -> None:
    hit = mapping.get(name)
    if not hit:
        best_len = 0
        for k, v in mapping.items():
            if k in name or name in k:
                if len(k) > best_len:
                    best_len = len(k)
                    hit = v
    if not hit:
        return
    for dim, val in hit.items():
        bucket = votes.setdefault(dim, {})
        bucket[val] = bucket.get(val, 0.0) + w


def apply_vndb_dark_map(name: str, votes: dict[str, dict[str, float]], weight: float) -> None:
    apply_map(name, VNDB_MAP, votes, weight)


def apply_raw_tag_signals(raw_tags: list[str], votes: dict[str, dict[str, float]]) -> None:
    if not raw_tags:
        return
    blob = _blob(raw_tags)
    w = 2.5
    if _any_match(blob, _DARK_TONE_PATTERNS):
        votes.setdefault("tone", {})["utsuge"] = votes["tone"].get("utsuge", 0.0) + w
        votes.setdefault("pace", {})["dense"] = votes["pace"].get("dense", 0.0) + w * 0.4
    elif _any_match(blob, _NUKIGE_PATTERNS):
        votes.setdefault("tone", {})["hype"] = votes["tone"].get("hype", 0.0) + w * 0.8
    if _any_match(blob, _HORROR_TONE_PATTERNS):
        votes.setdefault("tone", {})["mindbend"] = votes["tone"].get("mindbend", 0.0) + w
        votes.setdefault("setting", {})["mystery"] = votes["setting"].get("mystery", 0.0) + w * 0.5


def is_sweet_incompatible(raw_tags: list[str]) -> bool:
    return _any_match(_blob(raw_tags), _SWEET_BLOCK_PATTERNS)


def vote_axes(tag_votes: dict[str, dict[str, float]]) -> dict[str, str]:
    axes: dict[str, str] = {}
    for dim, votes in tag_votes.items():
        if votes:
            axes[dim] = max(votes.items(), key=lambda kv: kv[1])[0]
    return axes


def apply_axis_defaults(raw_tags: list[str], axes: dict[str, str]) -> None:
    has_tags = bool(raw_tags)
    if "tone" not in axes:
        axes["tone"] = "drama" if has_tags else "sweet"
    if "setting" not in axes:
        axes["setting"] = "daily" if has_tags else "school"
    if "pace" not in axes:
        axes["pace"] = "slowburn" if has_tags else "breezy"


def refine_axes(raw_tags: list[str], axes: dict[str, str]) -> dict[str, str]:
    if not raw_tags:
        return axes
    blob = _blob(raw_tags)
    out = dict(axes)
    if not is_sweet_incompatible(raw_tags):
        return out

    if _any_match(blob, _DARK_TONE_PATTERNS):
        out["tone"] = "utsuge"
        if out.get("pace") in (None, "breezy", "short"):
            out["pace"] = "dense" if "very long" in blob or "dense" in blob else "slowburn"
    elif _any_match(blob, _HORROR_TONE_PATTERNS):
        out["tone"] = "mindbend"
        out.setdefault("setting", "mystery")
    elif _any_match(blob, _NUKIGE_PATTERNS):
        out["tone"] = "hype"

    if out.get("tone") in ("utsuge", "mindbend", "literary", "drama") and out.get("pace") == "breezy":
        if _any_match(blob, _DARK_TONE_PATTERNS) or "very long" in blob or "long" in blob:
            out["pace"] = "slowburn"
    return out


def count_meaningful_tag_hits(raw_tags: list[str]) -> int:
    n = 0
    for tag in raw_tags:
        if ":" in tag:
            source, name = tag.split(":", 1)
        else:
            source, name = "vndb", tag
        if _is_noise_tag(source, name):
            continue
        if tag_maps_to(name, source):
            n += 1
    return n


def derive_axes_from_raw_tags(raw_tags: list[str]) -> dict[str, str]:
    """Full axis vote from stored raw_tags (vndb:/bgm:/cngal: prefixes)."""
    votes: dict[str, dict[str, float]] = {"tone": {}, "setting": {}, "pace": {}}
    for tag in raw_tags:
        if ":" in tag:
            source, name = tag.split(":", 1)
        else:
            source, name = "vndb", tag
        if _is_noise_tag(source, name):
            continue
        if source == "vndb":
            apply_map(name, VNDB_MAP, votes, 1.5)
        elif source in ("bgm", "cngal"):
            apply_map(name, CN_MAP, votes, 1.2)
        else:
            apply_map(name, VNDB_MAP, votes, 1.2)
            apply_map(name, CN_MAP, votes, 1.2)

    apply_raw_tag_signals(raw_tags, votes)
    axes = vote_axes(votes)
    apply_axis_defaults(raw_tags, axes)
    return refine_axes(raw_tags, axes)


def tag_maps_to(name: str, source: str) -> dict[str, str] | None:
    if source == "vndb":
        if name in VNDB_MAP:
            return VNDB_MAP[name]
        for k, v in VNDB_MAP.items():
            if k in name or name in k:
                return v
        return None
    if name in CN_MAP:
        return CN_MAP[name]
    for k, v in CN_MAP.items():
        if k in name or name in k:
            return v
    return None


def rederive_row_axes(row: dict) -> dict:
    raw_tags = row.get("raw_tags") or []
    if not raw_tags:
        return row
    axes = derive_axes_from_raw_tags(raw_tags)
    if count_meaningful_tag_hits(raw_tags) == 0 and row.get("name"):
        from pick_title_rules import apply_title_rules

        axes = apply_title_rules(row["name"], axes)
    out = dict(row)
    for key in ("tone", "setting", "pace"):
        if key in axes:
            out[key] = axes[key]
    return out
