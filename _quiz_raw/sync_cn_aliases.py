# -*- coding: utf-8 -*-
"""
对照 ima-ero 原题 answer_ja + 萌娘百科/维基官中译名，补全 zh_pack.json 答案别名。

规则：
1. questions_raw.answer_ja → TITLE_CANON 权威中文别名
2. explain 内《作品名》与「常称/俗称/又名/民间译作」句式
3. EXTRA 手工补丁
4. 修正已知误译（如将「拔作创意」改回官中「常轨脱离Creative」）
5. ym_vndb_alias_pack.json（月幕/VNDB 第二轮简称）
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from quiz_match import check_text, normalize

RAW = Path(__file__).resolve().parent
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))
raw_qs = json.loads((RAW / "questions_raw.json").read_text(encoding="utf-8"))
raw_by_id = {q["id"]: q for q in raw_qs}

# 月幕 / VNDB 第二轮简称包（由 enrich_aliases_ym_vndb.py 生成）
_YM_PACK_PATH = RAW / "ym_vndb_alias_pack.json"
YM_PACK: dict = (
    json.loads(_YM_PACK_PATH.read_text(encoding="utf-8"))
    if _YM_PACK_PATH.is_file()
    else {"by_ja": {}, "by_cn": {}, "by_qid": {}}
)

# explain 《》 titles that are NOT valid answers for that question
SKIP_TITLE_FOR = {
    "s1-10": {"学园催眠隶奴"},
    "s3-05": {
        "绽放★青春全力向前冲！",
        "在这苍穹展翅",
        "无人知晓的天体之泪",
        "纯白交响曲",
        "乙女剑与秘密协奏曲",
    },
    "s3-06": {"纯白交响曲", "大图书馆的牧羊人", "喜欢我的话就要说出来！"},
    "s3-08": {"乙女剑与秘密协奏曲", "Liminal Border", "巨乳飞机杯妖怪与乡下生活"},
    "s3-11": {"Fate/stay night"},
    "s4-10": {"种付大叔 VS 迷你裙警察"},
    "s5-12": {"恋岚Spirichu", "恋岚 Spirit"},
}

# ima-ero answer_ja → 权威中文别名（萌娘百科官中 / 维基 / 民间通行译名）
# 参考：https://zh.moegirl.tw/ 、https://zh.wikipedia.org/
TITLE_CANON: dict[str, list[str]] = {
    "ハミダシクリエイティブ": [
        "常轨脱离Creative",
        "常轨脱离 Creative",
        "常轨脱离",
        "灵感满溢的甜蜜创想",
        "Hamidashi Creative",
        "HAMIDASHI CREATIVE",
        "ハミクリ",
        "hamicri",
        "hamidashi",
    ],
    "ハミダシクリエイティブ凸": [
        "常轨脱离Creative凸",
        "常轨脱离 Creative 凸",
        "灵感满溢的甜蜜创想凸",
        "Hamidashi Creative 凸",
    ],
    "はじめるセカイの理想論 −goodbye world index−": [
        # 萌娘百科 / Steam 官中：创造世界的空想理论（「起始世界的理想论」为误译）
        "创造世界的空想理论",
        "创造世界的空想理论 -goodbye world index-",
        "goodbye world index",
        "はじめるセカイの理想論",
        "启动世界的理想论",
    ],
    "景の海のアペイリア": [
        "流景之海的艾佩理雅",
        "景之海的艾佩莉娅",
        "景之海的艾佩理雅",
        "Apeiria",
    ],
    "さくらの雲＊スカアレットの恋": [
        # 萌娘百科常用译名：樱色之云＊绯色之恋；社区简称：樱云绯恋
        "樱色之云＊绯色之恋",
        "樱色之云绯色之恋",
        "樱云绯恋",
        "樱云",
        "さくレット",
        "sakuretto",
        "Sakuretto",
    ],
    "抜きゲーみたいな島に住んでる貧乳はどうすりゃいいですか？": [
        "拔作岛",
        "ぬきたし",
        "住在像拔作一样的岛上的贫乳该如何是好",
    ],
    "素晴らしき日々": [
        "美好的每一天",
        "素晴日",
        "美好的每一天～不连续的存在～",
    ],
    "Fate/stay night": [
        "命运之夜",
        "fate stay night",
        "Fate stay night",
    ],
    "CROSS†CHANNEL": [
        "十字通道",
        "cross channel",
    ],
    "楽園の扉": [
        "乐园之门",
        "乐园的门",
    ],
    "Euphoria": [
        "euphoria",
    ],
}

# 题干/解析汉化修正（对照 ima-ero 原题 + 官中译名）
TEXT_FIXES: dict[str, dict[str, str]] = {
    "s3-04": {
        "question": "请根据图片：《恋之巢》（こいのす☆イチャコライズ）主人公房间「改造后」属于哪位女主路线？",
        "explain": "一香/萨奇/夏目三路线房间各不同。改造后房间青蛙等小物很多，选看起来最幼的萨奇就对了。",
    },
    "s3-07": {
        "explain": (
            "①《天神乱漫》OP 谜之 pose，因太离谱迅速传播，官方还出了手办；"
            "②BALDR SKY 吉尔伯特立绘「登堂入室构」；"
            "③《常轨脱离Creative凸》（民间汉化常译「灵感满溢的甜蜜创想凸」）"
            "OP《一册的 Arrow》封面 pose，暗中人气很高。"
        ),
    },
    "s4-14": {
        "explain": (
            "《常轨脱离Creative》（日文：ハミダシクリエイティブ，"
            "民间汉化常译「灵感满溢的甜蜜创想」）——与妃爱在町田站前的回忆之地。"
        ),
    },
    "s5-08": {
        "question": "请根据图片：《常轨脱离Creative》和泉妃爱三句台词中，哪句是作中实际台词？",
    },
    "s5-10": {
        "question": "《榨精病栋》系列除嫌恶/阴湿/粗暴护士外，第四位护士的属性是？",
    },
    "s3-24": {
        "explain": "《樱色之云＊绯色之恋》（简称樱云绯恋）OP「樱烂罗曼西亚」。前奏帅到离谱，且在高潮场景播放，气氛拉满。",
    },
    "s4-06": {
        "explain": "《樱色之云＊绯色之恋》（简称樱云绯恋），大正时代 mystery 作品。",
    },
    "s4-22": {
        "explain": (
            "明羽杏子常演门面 heroine，本作角色偏男孩子气，可能较难辨认。"
            "出自《创造世界的空想理论 -goodbye world index-》。"
        ),
    },
    "s5-07": {
        "question": "请根据图片：《恋爱×决胜战》启动图标是①～④中的哪一个？",
    },
    "s5-12": {
        "question": "请根据图片：①～⑧中哪一个是《创作少女的恋爱公式》标题 logo 的「恋」字？",
        "explain": "⑥。另附各作 logo 对照，笔者喜欢《恋岚Spirichu》的 logo。",
    },
    "s5-17": {
        "question": (
            "请根据图片：《LimeLight Lemonade Jam》（民间译「逐光柠檬协奏曲」）中，"
            "ほかん负责的是几号女主？"
        ),
    },
}

# explicit aliases (work titles, common CN names)
EXTRA: dict[str, list[str]] = {
    "s1-16": ["繁花落舞恋如樱"],
    "s1-17": ["dc"],
    "s1-20": ["everlasting fairytale", "everlasting fairytale of the two"],
    "s2-16": ["DRACU-RIOT!", "DRACU-RIOT", "ドラクリオット", "龙骑士骚动", "Dracu-Riot", "Dracu-Riot!"],
    "s2-18": ["时よ止まれ", "时啊停下吧", "时啊停住吧"],
    "s2-20": ["命运之夜", "fate stay night"],
    "s3-07": ["灵感满溢的甜蜜创想凸", "一册的 Arrow", "常轨脱离Creative凸", "常轨脱离 Creative 凸"],
    "s4-05": ["吻痕", "Kiss angle"],
    "s4-06": [
        "樱色之云＊绯色之恋",
        "樱色之云绯色之恋",
        "樱云绯恋",
        "樱云",
        "さくレット",
        "sakuretto",
    ],
    "s4-14": [
        "常轨脱离Creative",
        "常轨脱离",
        "灵感满溢的甜蜜创想",
        "ハミクリ",
    ],
    "s4-24": ["Chocolat", "maid cafe curio"],
    "s4-25": ["Select Oblige"],
    "s5-06": ["霞流宝石心", "霞流宝石心 -壮志凌云振寰宇-"],
    "s5-23": ["有个真妹妹的大泉君", "实妹相伴的大泉君", "リアル妹がいる大泉くんのばあい", "Riaimo"],
    "s5-25": ["废村少女［贰］", "废村少女贰", "废村少女［贰］～诱引阴翳的秘姬之匣～"],
}

# 声优题：ima-ero 问的是「声優さんは誰」——作品名不能当答案
VA_QUESTION_IDS = frozenset({"s2-22", "s3-22", "s4-21", "s4-22", "s5-21", "s5-22"})

# 仅问曲名（非「曲名或作品名均可」）：解析里的作品名不能当答案
SONG_TITLE_ONLY_IDS = frozenset(
    {
        "s1-25",
        "s2-23",
        "s2-24",
        "s2-25",
        "s3-24",
        "s3-25",
        "s4-23",
        "s4-24",
        "s4-25",
    }
)

# 从 answers 中强制剔除的误加别名（误译 / 题型不符）
STRIP_ANSWERS: dict[str, set[str]] = {
    "s2-16": {
        # 大恶党＝DRACU-RIOT! 社区梗，≠ 大悪司
        "大悪司",
        "大恶司",
        "Dai Akuji",
        "Dai Aku Tsukasa",
        "Daiakuji",
    },
    "s2-24": {"流景之海的艾佩理雅", "景之海的艾佩理雅", "Apelia"},  # 曲名题＝アペイリア
    "s3-22": {"Unless Terminalia", "终末的米诺陶", "アンレス・テルミナリア"},
    "s3-24": {
        "樱之云＊绯红之恋",
        "樱之云绯红之恋",
        "樱之云",
        "樱色之云＊绯色之恋",
        "樱色之云绯色之恋",
        "樱云绯恋",
        "樱云",
    },
    "s3-25": {"多娜多娜 一起来干坏事吧", "多娜多娜"},
    "s4-06": {
        # 剔除旧误译；正确译名与简称由 TITLE_CANON / EXTRA 注入
        "樱之云＊绯红之恋",
        "樱之云绯红之恋",
        "樱之云",
    },
    "s4-21": {"从Kiss开始的自我主义", "从Kiss开始的自我主义～EGOISM～"},
    "s4-22": {
        "创造世界的空想理论",
        "创造世界的空想理论 -goodbye world index-",
        "起始世界的理想论",
        "启动世界的理想论",
        "goodbye world index",
    },
    "s5-10": {"榨精病栋", "搾精病栋", "搾精病棟"},
    "s5-21": {"几度相逢若初见", "何度目かのはじめまして"},
    "s5-22": {"催眠性指导", "Secret Lesson"},
    "s5-23": {
        "妹を汚した記憶",
        "与妹妹的记忆",
        "玷污妹妹的记忆",
        "与妹妹的记忆 / 玷污妹妹的记忆",
        "Imokega",
        "いもけが",
        "This cosmos blooms earlier than other flowers.",
        "Real Imouto ga Iru Ooizumi-kun no Baai",
    },
}

WORK_Q = re.compile(
    r"作品|校服|曲名|标题|广告语|类型名|开篇|哪部|Galgame|OP|ED|启动图标|圣地|包装|模仿|填什么"
)

ALIAS_IN_EXPLAIN = re.compile(
    r"(?:常称|俗称|又名|民间(?:汉化)?(?:常)?译(?:作|为)|汉化译作)"
    r"[「『\"']?"
    r"([^」』\"'，。；\n（）]+?)"
    r"[」』\"']?"
)

# 误译别名：保留社区梗作可接受答案，但不再作为解析主标题
DEPRECATED_PRIMARY = {"拔作创意"}


def has_alias(answers: list[str], candidate: str) -> bool:
    """已能被现有 answers 判对的候选，不再重复追加。"""
    return check_text(candidate, answers)


def add_aliases(qid: str, titles: list[str]) -> None:
    entry = zh[qid]
    if entry.get("type") != "text":
        return
    answers = entry.setdefault("answers", [])
    for t in titles:
        t = t.strip().strip("「」『』\"'")
        if not t or has_alias(answers, t):
            continue
        answers.append(t)


def extract_explain_aliases(explain: str) -> list[str]:
    out: list[str] = []
    for m in ALIAS_IN_EXPLAIN.finditer(explain):
        chunk = m.group(1).strip()
        for part in re.split(r"[/／、]", chunk):
            part = part.strip()
            if part:
                out.append(part)
    return out


def canon_for_answer_ja(answer_ja: str) -> list[str]:
    key = answer_ja.strip()
    if not key:
        return []
    out: list[str] = []
    if key in TITLE_CANON:
        out.extend(TITLE_CANON[key])
    # 月幕/VNDB：仅精确键（避免短答案被子串误扩）
    ja_pack = YM_PACK.get("by_ja") or {}
    key2 = re.sub(r"^[①-⑨]\s*", "", key).strip()
    for k in (key, key2):
        if k in ja_pack:
            out.extend(ja_pack[k])
    # TITLE_CANON：答案包含完整日文作品名键才展开
    for k, aliases in TITLE_CANON.items():
        if len(k) >= 6 and k in key:
            out.extend(aliases)
    seen: set[str] = set()
    uniq: list[str] = []
    for a in out:
        a = a.strip()
        if not a or a.casefold() in seen:
            continue
        seen.add(a.casefold())
        uniq.append(a)
    return uniq


def answer_ja_is_work_title(answer_ja: str) -> bool:
    s = (answer_ja or "").strip()
    if not s or len(s) < 2:
        return False
    if s.count("①") + s.count("②") + s.count("③") >= 2:
        return False
    if re.match(r"^(NLNS|SHO|SS|\d+)", s, re.I):
        return False
    if "→" in s:
        return False
    return True


# --- apply text fixes ---
for qid, fields in TEXT_FIXES.items():
    if qid in zh:
        zh[qid].update(fields)

overlay_path = RAW / "zh_overlay_v2.json"
if overlay_path.is_file():
    overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
    for qid, fields in TEXT_FIXES.items():
        if qid in overlay:
            overlay[qid].update(fields)
    overlay_path.write_text(
        json.dumps(overlay, ensure_ascii=False, indent=2), encoding="utf-8"
    )

# --- alias sync ---
WORK_OR_SONG_OK = frozenset(
    {"s1-16", "s1-20", "s2-16", "s2-18", "s5-23", "s5-24", "s5-25"}
)

for qid, entry in zh.items():
    explain = entry.get("explain", "")
    qtext = entry.get("question", "")
    skip = SKIP_TITLE_FOR.get(qid, set())
    raw = raw_by_id.get(qid)
    ja = (raw or {}).get("answer_ja", "")
    inject_work_aliases = bool(
        WORK_Q.search(qtext) or answer_ja_is_work_title(ja) or qid in WORK_OR_SONG_OK
    )

    if qid not in VA_QUESTION_IDS and qid not in SONG_TITLE_ONLY_IDS:
        titles = re.findall(r"《([^》]+)》", explain)
        if WORK_Q.search(qtext):
            add_aliases(qid, [t for t in titles if t not in skip])

        add_aliases(qid, extract_explain_aliases(explain))
        add_aliases(qid, EXTRA.get(qid, []))
        if inject_work_aliases:
            add_aliases(qid, (YM_PACK.get("by_qid") or {}).get(qid, []))
        if raw and entry.get("type") == "text" and answer_ja_is_work_title(ja):
            add_aliases(qid, canon_for_answer_ja(ja))
    elif qid in EXTRA:
        add_aliases(qid, EXTRA.get(qid, []))
    # 曲名或作品名均可（含部分本在 SONG 集合外的题）
    if qid in WORK_OR_SONG_OK:
        add_aliases(qid, (YM_PACK.get("by_qid") or {}).get(qid, []))
        add_aliases(qid, EXTRA.get(qid, []))
        if raw and answer_ja_is_work_title(ja):
            add_aliases(qid, canon_for_answer_ja(ja))

# s4-14: 移除误译主名「拔作创意」，保留日文/官中/民间译名
if "s4-14" in zh:
    zh["s4-14"]["answers"] = [
        a for a in zh["s4-14"]["answers"] if normalize(a) != normalize("拔作创意")
    ]

# 剔除误加的作品名 / 误译别名
for qid, block in STRIP_ANSWERS.items():
    if qid not in zh or zh[qid].get("type") != "text":
        continue
    blocked = {normalize(x) for x in block}
    zh[qid]["answers"] = [
        a for a in zh[qid]["answers"] if normalize(a) not in blocked
    ]

# s2-20: drop standalone "Fate" (too short; invites guessing)
if "s2-20" in zh:
    zh["s2-20"]["answers"] = [
        a for a in zh["s2-20"]["answers"] if normalize(a) != "fate"
    ]
    for a in ["Fate/stay night", "fate stay night", "命运之夜"]:
        if not has_alias(zh["s2-20"]["answers"], a):
            zh["s2-20"]["answers"].append(a)

# restore full choice options (match ima-ero original order + answer index)
zh["s1-01"]["options"] = [
    "はっちゃけあやよさん",
    "ぶっちゃけあやよさん",
    "ぶっとべあやよさん",
    "YO！チェケ！あやよさん",
    "あやよさんの秘密",
    "あやよさんの大冒険",
]
zh["s1-01"]["answer"] = 0

zh["s1-05"]["options"] = [
    "Kanon",
    "Fate/stay night",
    "CROSS†CHANNEL",
    "ましろ色シンフォニー",
    "ヨスガノソラ",
    "ワルキューレロマンツェ",
]
zh["s1-05"]["answer"] = 2

zh["s1-06"]["options"] = [
    "WHITE ALBUM2",
    "君が望む永遠",
    "青空の見える丘",
    "キラ☆キラ",
    "さくらさくら",
    "もしも明日が晴れならば",
]
zh["s1-06"]["answer"] = 3

zh["s1-07"]["options"] = [
    "Phantom ～Phantom of inferno～",
    "鬼哭街 The Cyber Slayer",
    "沙耶の唄",
    "吸血殲鬼ヴェドゴニア",
    "月光のカルネヴァーレ",
    "続・殺戮のジャンゴ ─地獄の賞金首─",
]
zh["s1-07"]["answer"] = 4

zh["s1-08"]["options"] = [
    "車輪の国、向日葵の少女",
    "黄昏のシンセミア",
    "水月 -すいげつ-",
    "この青空に約束を―",
    "この大空に、翼をひろげて",
    "カルタグラ ～ツキ狂イノ病～",
]
zh["s1-08"]["answer"] = 5

(RAW / "zh_pack.json").write_text(
    json.dumps(zh, ensure_ascii=False, indent=2), encoding="utf-8"
)

# report: explain titles still not accepted
gaps = []
for qid, entry in zh.items():
    if entry.get("type") != "text":
        continue
    explain = entry.get("explain", "")
    for t in re.findall(r"《([^》]+)》", explain):
        if not check_text(t, entry.get("answers", [])):
            gaps.append((qid, t))

print("updated zh_pack.json with aliases + choice options")
if gaps:
    print("explain title gaps (review SKIP_TITLE_FOR):")
    for g in gaps[:20]:
        print(f"  {g[0]}: {g[1]}")
