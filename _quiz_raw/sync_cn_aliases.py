# -*- coding: utf-8 -*-
"""Add Chinese title aliases from explain + manual patches to zh_pack.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

from quiz_match import normalize

RAW = Path(__file__).resolve().parent
zh = json.loads((RAW / "zh_pack.json").read_text(encoding="utf-8"))

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
    "s5-12": {"恋岚 Spirit"},
}

# explicit aliases (work titles, common CN names)
EXTRA: dict[str, list[str]] = {
    "s1-16": ["繁花落舞恋如樱"],
    "s1-17": ["dc"],
    "s1-20": ["everlasting fairytale", "everlasting fairytale of the two"],
    "s2-16": ["大恶党"],
    "s2-18": ["时よ止まれ", "时啊停下吧", "时啊停住吧"],
    "s2-20": ["命运之夜", "fate stay night"],
    "s2-24": ["流景之海的艾佩理雅", "Apelia"],
    "s3-07": ["灵感满溢的甜蜜创想凸", "一册的 Arrow", "常轨脱离 Creative 凸"],
    "s3-22": ["Unless Terminalia", "终末的米诺陶"],
    "s3-24": ["樱之云＊绯红之恋", "樱之云绯红之恋"],
    "s3-25": ["多娜多娜 一起来干坏事吧", "多娜多娜"],
    "s4-05": ["吻痕", "Kiss angle", "Kiss angle"],
    "s4-21": ["从Kiss开始的自我主义", "从Kiss开始的自我主义～EGOISM～"],
    "s4-22": ["起始世界的理想论", "goodbye world index"],
    "s4-24": ["Chocolat", "maid cafe curio"],
    "s4-25": ["Select Oblige"],
    "s5-06": ["霞流宝石心", "霞流宝石心 -壮志凌云振寰宇-"],
    "s5-10": ["榨精病栋"],
    "s5-21": ["几度相逢若初见"],
    "s5-22": ["催眠性指导", "Secret Lesson"],
    "s5-23": ["有个真妹妹的大泉君"],
    "s5-25": ["废村少女［贰］", "废村少女贰", "废村少女［贰］～诱引阴翳的秘姬之匣～"],
}

WORK_Q = re.compile(
    r"作品|校服|曲名|标题|广告语|类型名|开篇|哪部|Galgame|OP|ED|启动图标|圣地|包装|模仿|填什么"
)


def has_alias(answers: list[str], candidate: str) -> bool:
    c = normalize(candidate)
    if not c:
        return True
    return any(c == normalize(a) or c in normalize(a) or normalize(a) in c for a in answers)


def add_aliases(qid: str, titles: list[str]) -> None:
    entry = zh[qid]
    if entry.get("type") != "text":
        return
    answers = entry.setdefault("answers", [])
    for t in titles:
        t = t.strip()
        if not t or has_alias(answers, t):
            continue
        answers.append(t)


for qid, entry in zh.items():
    explain = entry.get("explain", "")
    titles = re.findall(r"《([^》]+)》", explain)
    skip = SKIP_TITLE_FOR.get(qid, set())
    qtext = entry.get("question", "")
    if WORK_Q.search(qtext):
        add_aliases(qid, [t for t in titles if t not in skip])
    add_aliases(qid, EXTRA.get(qid, []))

# s2-20: drop standalone "Fate" / "FATE" (too short; invites guessing)
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
print("updated zh_pack.json with aliases + choice options")
