"""Title-based axis overrides when VNDB/BGM tags are missing or noisy."""
from __future__ import annotations

import re

TAG_RULES: list[tuple[re.Pattern[str], dict[str, str]]] = [
    (re.compile(r"Fate|空の境界|魔法使いの夜|月姫|MELTY|真月譚|型月", re.I), {"tone": "epic", "setting": "fantasy", "pace": "dense"}),
    (re.compile(r"CLANNAD|Kanon|雪之少女|AIR|Little Busters|Summer Pockets|智代|Rewrite|rewrite|Angel Beats", re.I), {"tone": "drama", "setting": "school", "pace": "slowburn"}),
    (re.compile(r"白色相簿|WHITE ALBUM", re.I), {"tone": "drama", "setting": "daily", "pace": "slowburn"}),
    (re.compile(r"Steins|CHAOS;|ROBOTICS;|命运石|科学.?[Aa][Dd][Vv]|Anonymous;Code", re.I), {"tone": "mindbend", "setting": "scifi", "pace": "dense"}),
    (re.compile(r"Muv-Luv|マブラヴ|シュヴァルツェス", re.I), {"tone": "epic", "setting": "scifi", "pace": "dense"}),
    (re.compile(r"千恋|夜宴|サノバ|RIDDLE|アマカノ|甘甜|近月|月に寄りそう|星光咖啡|喫茶ステラ|ゆず|柚子|天使嚣嚣|天使☆騒々|天使騒々", re.I), {"tone": "sweet", "setting": "school", "pace": "breezy"}),
    (re.compile(r"ATRI|方舟|海对面|水仙|narcissu|planetarian|星之梦|PL@NET", re.I), {"tone": "heal", "setting": "scifi", "pace": "short"}),
    (re.compile(r"樱之诗|樱之刻|サクラノ|夏空のモノローグ|素晴らしき日々|SubaHibi|美少女万華鏡", re.I), {"tone": "literary", "setting": "daily", "pace": "slowburn"}),
    (re.compile(r"9-nine|拔作|ドーナ|多娜|闪乱|対魔忍|Baldr|BALDR|大番长", re.I), {"tone": "hype", "setting": "fantasy", "pace": "breezy"}),
    (re.compile(r"沙耶|寒蝉|海猫", re.I), {"tone": "utsuge", "setting": "mystery", "pace": "dense"}),
    (re.compile(r"心跳文学|Meta|第四面墙|你和她和她", re.I), {"tone": "mindbend", "setting": "mystery", "pace": "dense"}),
    (re.compile(r"D\.C\.|ダ[・･]?カーポ|ToHeart|SHUFFLE|初音岛|恋姬|恋と選挙とチョコレート", re.I), {"tone": "sweet", "setting": "school", "pace": "breezy"}),
    (re.compile(r"兰斯|Rance|戦国ランス", re.I), {"tone": "hype", "setting": "fantasy", "pace": "dense"}),
    (re.compile(r"Ever17|Remember11|十二時|時計仕掛け|ルートダブル|Root Double", re.I), {"tone": "mindbend", "setting": "scifi", "pace": "dense"}),
    (re.compile(r"グリザイア|灰色|Grisaia", re.I), {"tone": "drama", "setting": "school", "pace": "dense"}),
    (re.compile(r"魔女的夜宴|千恋＊万花|千恋\*万花|千恋万花", re.I), {"tone": "sweet", "setting": "fantasy", "pace": "breezy"}),
    (re.compile(r"ノラと皇女|ノラとと|Clover Day|クロデイ", re.I), {"tone": "sweet", "setting": "fantasy", "pace": "breezy"}),
    (re.compile(r"恋×シンアイ|恋×心|ハミダシ|はみだし|常轨脱离", re.I), {"tone": "hype", "setting": "school", "pace": "breezy"}),
    (re.compile(r"艦隊これくしょん|舰娘|アズールレーン", re.I), {"tone": "hype", "setting": "scifi", "pace": "breezy"}),
    (re.compile(r"缘之空|ヨスガ|Yosuga", re.I), {"tone": "drama", "setting": "daily", "pace": "slowburn"}),
    (re.compile(r"染红的街道|フワリ|Furifuri", re.I), {"tone": "sweet", "setting": "school", "pace": "breezy"}),
    (re.compile(r"查拉图|Thus Spoke|Zarathustra", re.I), {"tone": "literary", "setting": "daily", "pace": "dense"}),
    (re.compile(r"加诺克|Inganock|インガノック", re.I), {"tone": "literary", "setting": "fantasy", "pace": "slowburn"}),
    (re.compile(r"ISLAND|アイランド", re.I), {"tone": "mindbend", "setting": "scifi", "pace": "slowburn"}),
    (re.compile(r"格诺西亚|Gnosia|グノーシア", re.I), {"tone": "mindbend", "setting": "mystery", "pace": "dense"}),
    (re.compile(r"海市蜃楼|ファタモルガーナ|Fata Morgana", re.I), {"tone": "literary", "setting": "mystery", "pace": "slowburn"}),
    (re.compile(r"死馆|にくにく|Nikuniku|館に芽吹く憎悪|逝去的你|Shiniyuku Kimi", re.I), {"tone": "utsuge", "setting": "mystery", "pace": "dense", "focus": "story"}),
    (re.compile(r"Euphoria|euphoria(?!\w)", re.I), {"tone": "mindbend", "setting": "mystery", "pace": "dense"}),
    (re.compile(r"STARLESS|Starless", re.I), {"tone": "utsuge", "pace": "dense"}),
    (re.compile(r"Gore Screaming|戈尔尖叫|ゴア・スクリーミング", re.I), {"tone": "mindbend", "setting": "mystery", "pace": "dense"}),
    (re.compile(r"SaDistic|狂嗜之血|サディスティック", re.I), {"tone": "utsuge", "pace": "dense"}),
    (re.compile(r"银色|銀色|Planetarian|星之梦", re.I), {"tone": "heal", "setting": "scifi", "pace": "short"}),
    (re.compile(r"学園|学园|スクール|学校", re.I), {"setting": "school"}),
    (re.compile(r"異世界|异世界|ファンタジー|魔王|勇者", re.I), {"setting": "fantasy"}),
    (re.compile(r"Reminiscence|追忆|回想録", re.I), {"tone": "drama", "setting": "mystery", "pace": "slowburn"}),
    (re.compile(r"アリス2010|Alice 2010|アリス×", re.I), {"tone": "hype", "setting": "fantasy", "pace": "breezy"}),
]


def apply_title_rules(name: str, axes: dict[str, str]) -> dict[str, str]:
    out = dict(axes)
    for pat, override in TAG_RULES:
        if pat.search(name):
            out.update(override)
            break
    return out


def has_title_rule(name: str) -> bool:
    return any(pat.search(name) for pat, _ in TAG_RULES)
