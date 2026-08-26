"""作品 trait 向量：从主标签 + VNDB/Bangumi 原始标签推导多维权重（供余弦/点积匹配）。

维度参考：Galgame Wiki 基调（萌/泣/郁/燃/悬疑/恐怖/Meta）、VNDB tags、CnGal 词条标签。
"""
from __future__ import annotations

import re

# 主标签向邻近 trait 扩散（权重）
TRAIT_SPREAD: dict[str, list[tuple[str, float]]] = {
    "tone:sweet": [("tone:heal", 0.42), ("tone:hype", 0.35), ("focus:romance", 0.55), ("mood:light", 0.5), ("appeal:moe", 0.45)],
    "tone:heal": [("tone:sweet", 0.4), ("tone:drama", 0.32), ("focus:story", 0.45), ("mood:light", 0.48), ("entry:easy", 0.35)],
    "tone:drama": [("tone:literary", 0.38), ("tone:heal", 0.28), ("focus:story", 0.5), ("mood:bittersweet", 0.55), ("appeal:nakige", 0.4)],
    "tone:literary": [("tone:drama", 0.4), ("tone:mindbend", 0.3), ("focus:story", 0.45), ("mood:heavy", 0.5), ("appeal:literary", 0.55), ("entry:deep", 0.4)],
    "tone:mindbend": [("tone:literary", 0.35), ("tone:epic", 0.28), ("focus:mystery", 0.55), ("routes:puzzle", 0.5), ("appeal:mystery", 0.5), ("entry:deep", 0.35)],
    "tone:epic": [("tone:drama", 0.32), ("tone:mindbend", 0.28), ("focus:world", 0.55), ("mood:heavy", 0.45), ("appeal:action", 0.4)],
    "tone:hype": [("tone:sweet", 0.35), ("tone:epic", 0.3), ("focus:romance", 0.35), ("mood:light", 0.4), ("appeal:comedy", 0.45)],
    "tone:utsuge": [("tone:drama", 0.45), ("tone:literary", 0.35), ("mood:heavy", 0.55), ("appeal:utsuge", 0.6), ("entry:deep", 0.35)],
    "setting:school": [("setting:daily", 0.35), ("focus:romance", 0.4), ("cast:ensemble", 0.3)],
    "setting:daily": [("setting:school", 0.3), ("focus:story", 0.35), ("mood:bittersweet", 0.25)],
    "setting:fantasy": [("setting:scifi", 0.28), ("focus:world", 0.45), ("appeal:action", 0.3)],
    "setting:scifi": [("setting:fantasy", 0.28), ("setting:mystery", 0.32), ("focus:world", 0.4), ("appeal:mystery", 0.35)],
    "setting:mystery": [("setting:scifi", 0.3), ("focus:mystery", 0.5), ("routes:puzzle", 0.4), ("appeal:mystery", 0.45)],
    "pace:short": [("pace:breezy", 0.4), ("entry:easy", 0.45), ("routes:single", 0.35), ("playstyle:vn", 0.3)],
    "pace:breezy": [("pace:short", 0.35), ("pace:slowburn", 0.25), ("entry:easy", 0.3), ("routes:multi", 0.3), ("playstyle:adv", 0.25)],
    "pace:slowburn": [("pace:breezy", 0.28), ("pace:dense", 0.25), ("focus:story", 0.35), ("mood:bittersweet", 0.3)],
    "pace:dense": [("pace:slowburn", 0.3), ("entry:deep", 0.45), ("routes:puzzle", 0.35), ("appeal:literary", 0.3)],
    "focus:romance": [("tone:sweet", 0.4), ("cast:solo", 0.35)],
    "focus:story": [("tone:drama", 0.35), ("tone:heal", 0.25)],
    "focus:world": [("tone:epic", 0.35), ("setting:fantasy", 0.3)],
    "focus:mystery": [("tone:mindbend", 0.4), ("setting:mystery", 0.35)],
    "entry:easy": [("tone:sweet", 0.3), ("pace:breezy", 0.28), ("fame:icon", 0.25)],
    "entry:deep": [("tone:literary", 0.32), ("pace:dense", 0.3), ("fame:solid", 0.2)],
    "mood:light": [("tone:sweet", 0.35), ("tone:heal", 0.3)],
    "mood:heavy": [("tone:literary", 0.35), ("tone:epic", 0.3), ("appeal:utsuge", 0.25)],
    "routes:multi": [("pace:breezy", 0.25), ("cast:harem", 0.35), ("playstyle:adv", 0.3)],
    "routes:single": [("pace:short", 0.3), ("playstyle:vn", 0.35)],
    "routes:puzzle": [("tone:mindbend", 0.35), ("pace:dense", 0.28), ("appeal:meta", 0.25)],
    "fame:icon": [("entry:easy", 0.3)],
    "fame:solid": [("entry:deep", 0.22)],
    "playstyle:adv": [("routes:multi", 0.3), ("focus:romance", 0.2)],
    "playstyle:vn": [("routes:single", 0.35), ("pace:short", 0.25), ("focus:story", 0.25)],
    "playstyle:rpg": [("tone:epic", 0.35), ("appeal:action", 0.4), ("playstyle:hybrid", 0.3)],
    "playstyle:sim": [("cast:harem", 0.25), ("pace:breezy", 0.2)],
    "playstyle:hybrid": [("playstyle:rpg", 0.4), ("playstyle:adv", 0.35)],
    "cast:harem": [("routes:multi", 0.35), ("tone:sweet", 0.25)],
    "cast:solo": [("focus:romance", 0.35), ("routes:single", 0.3)],
    "cast:ensemble": [("focus:story", 0.35), ("tone:epic", 0.2)],
    "appeal:utsuge": [("mood:heavy", 0.45), ("tone:drama", 0.35)],
    "appeal:horror": [("tone:mindbend", 0.4), ("mood:heavy", 0.35)],
    "appeal:meta": [("routes:puzzle", 0.45), ("tone:mindbend", 0.35)],
}

# VNDB / 中文原始标签 → trait 加分（参考 VNDB tag 体系 + Galgame Wiki）
RAW_TRAIT_RULES: list[tuple[re.Pattern[str], dict[str, float]]] = [
    (re.compile(r"romance|恋爱|纯爱|甜", re.I), {"focus:romance": 0.35, "tone:sweet": 0.25}),
    (re.compile(r"comedy|喜剧|搞笑|欢脱|ギャグ", re.I), {"appeal:comedy": 0.5, "tone:hype": 0.25}),
    (re.compile(r"nakige|泣き|泣系|催泪|泪", re.I), {"appeal:nakige": 0.55, "tone:drama": 0.3, "mood:bittersweet": 0.25}),
    (re.compile(r"utsuge|鬱|郁系|depressing|psychological trauma|tragedy", re.I), {"appeal:utsuge": 0.55, "tone:utsuge": 0.45, "mood:heavy": 0.4}),
    (re.compile(r"mystery|悬疑|推理|thriller|whodunit|detective", re.I), {"appeal:mystery": 0.5, "focus:mystery": 0.35}),
    (re.compile(r"horror|恐怖|psychological horror|gore|惊悚", re.I), {"appeal:horror": 0.55, "tone:mindbend": 0.3, "mood:heavy": 0.35}),
    (re.compile(r"meta|fourth wall|metafiction|打破第四|self-aware|meta.?narr", re.I), {"appeal:meta": 0.55, "routes:puzzle": 0.35, "tone:mindbend": 0.25}),
    (re.compile(r"time travel|loop|轮回|多周目|route unlock|multiple route", re.I), {"routes:puzzle": 0.45, "appeal:mystery": 0.25}),
    (re.compile(r"war|combat|mecha|战斗|action|turn.?based", re.I), {"appeal:action": 0.5, "tone:epic": 0.25, "playstyle:rpg": 0.35}),
    (re.compile(r"philosophy|literary|文学|哲学|psychological", re.I), {"appeal:literary": 0.5, "tone:literary": 0.3}),
    (re.compile(r"harem|后宫|multiple heroine|多女主", re.I), {"cast:harem": 0.55, "routes:multi": 0.3}),
    (re.compile(r"single route|kinetic|linear|短篇|short|sound novel|音响小说", re.I), {"routes:single": 0.4, "pace:short": 0.25, "playstyle:vn": 0.4}),
    (re.compile(r"ensemble|群像|large cast", re.I), {"cast:ensemble": 0.45, "focus:story": 0.2}),
    (re.compile(r"healing|iyashikei|治愈", re.I), {"tone:heal": 0.35, "mood:light": 0.3}),
    (re.compile(r"slice of life|日常|school life|空气系", re.I), {"setting:daily": 0.3, "setting:school": 0.25, "appeal:moe": 0.2}),
    (re.compile(r"science fiction|sci-fi|科幻|near future", re.I), {"setting:scifi": 0.35, "focus:world": 0.2}),
    (re.compile(r"fantasy|奇幻|异世界|magic", re.I), {"setting:fantasy": 0.35, "focus:world": 0.2}),
    (re.compile(r"high school|校园|学园", re.I), {"setting:school": 0.35}),
    (re.compile(r"tragedy|致郁|dark story|dark theme", re.I), {"mood:heavy": 0.4, "tone:drama": 0.25, "appeal:utsuge": 0.3}),
    (re.compile(r"tsundere|萌|moe|cute|萌系", re.I), {"appeal:moe": 0.4, "tone:sweet": 0.2}),
    (re.compile(r"simulation|raising|schedule|养成|slg", re.I), {"playstyle:sim": 0.5}),
    (re.compile(r"role.?playing|rpg|srpg|dungeon|战棋", re.I), {"playstyle:rpg": 0.5, "appeal:action": 0.25}),
    (re.compile(r"visual novel|adv|branching|choices matter", re.I), {"playstyle:adv": 0.35}),
    (re.compile(r"nukige|拔作|eroge focus|sexual content", re.I), {"tone:hype": 0.2}),  # 弱标记，不单独推荐
]


def _bump(traits: dict[str, float], key: str, val: float) -> None:
    traits[key] = min(1.0, max(traits.get(key, 0.0), val))


def build_traits(row: dict) -> dict[str, float]:
    """生成稀疏 trait 向量（0.15～1.0）。"""
    profile = row
    traits: dict[str, float] = {}

    primary_keys = [
        f"tone:{profile.get('tone') or 'sweet'}",
        f"setting:{profile.get('setting') or 'school'}",
        f"pace:{profile.get('pace') or 'breezy'}",
        f"era:{profile.get('era') or 'modern'}",
        f"fame:{profile.get('fame') or 'solid'}",
        f"focus:{profile.get('focus') or 'story'}",
        f"entry:{profile.get('entry') or 'standard'}",
        f"mood:{profile.get('mood') or 'light'}",
        f"routes:{profile.get('routes') or 'multi'}",
        f"playstyle:{profile.get('playstyle') or 'adv'}",
        f"cast:{profile.get('cast') or 'solo'}",
    ]
    for key in primary_keys:
        _bump(traits, key, 1.0)

    for _ in range(2):
        for key, val in list(traits.items()):
            for spread_key, w in TRAIT_SPREAD.get(key, []):
                _bump(traits, spread_key, val * w)

    blob = " ".join(row.get("raw_tags") or []).lower()
    if blob:
        for pat, adds in RAW_TRAIT_RULES:
            if pat.search(blob):
                for k, w in adds.items():
                    _bump(traits, k, w)

    return {k: round(v, 2) for k, v in traits.items() if v >= 0.18}


def attach_traits(game: dict, source_row: dict) -> None:
    game["traits"] = build_traits({**source_row, **game})
