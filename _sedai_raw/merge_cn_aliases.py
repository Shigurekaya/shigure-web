#!/usr/bin/env python3
"""合并权威中文名 ↔ 英/日别名到 pick_title_aliases.json。"""
from __future__ import annotations

import json
from pathlib import Path

ALIASES = Path(__file__).with_name("pick_title_aliases.json")

EXTRA: dict[str, list[str]] = {
    "混沌头脑": ["Chaos;Head", "CHAOS;HEAD", "カオスヘッド"],
    "混沌头脑 Noah": ["Chaos;Head Noah", "CHAOS;HEAD NOAH"],
    "混沌子": ["Chaos;Child", "CHAOS;CHILD", "カオスチャイルド"],
    "机器人笔记": ["Robotics;Notes", "ROBOTICS;NOTES"],
    "机器人笔记 Elite": ["Robotics;Notes Elite"],
    "机器人笔记 DaSH": ["Robotics;Notes DaSH"],
    "Anonymous;Code": ["アノニマスコード", "Anonymous Code"],
    "海市蜃楼之馆": ["The House in Fata Morgana", "ファタモルガーナの館", "Fata Morgana"],
    "空之少女": ["Kara no Shoujo", "殻ノ少女"],
    "空之少女2": ["Kara no Shoujo 2", "続・殻ノ少女"],
    "天鹅之歌": ["Swan Song", "スワンソング"],
    "车轮之国、向日葵的少女": ["Sharin no Kuni, Himawari no Shoujo", "車輪の国、向日葵の少女"],
    "黑之夏尔诺斯": ["Shikkoku no Sharnoth", "漆黒のシャルノス"],
    "焰之印加诺克": ["Sekien no Inganock", "積木のインガノック"],
    "智代After": ["Tomoyo After", "智代アフター", "Tomoyo After ~It's a Wonderful Life~"],
    "库特饭后甜点": ["Kud Wafter", "クドわふたー"],
    "向日葵": ["Himawari -The Sunflower-", "ひまわり"],
    "星白永远": ["AstralAir no Shiroki Towa", "アストラエアの白き永遠"],
    "架向星空之桥": ["Hoshizora e Kakaru Hashi", "星空へ架かる橋"],
    "四叶草之日": ["Clover Day's", "クローバーデイズ"],
    "金色拉布利切": ["Kin'iro Loveriche", "金色ラブリッチェ", "Kin-iro Loveriche"],
    "金色拉布利切 Golden Time": ["Kin'iro Loveriche -Golden Time-", "金色ラブリッチェ-Golden Time-"],
    "月之彼方所及之处": ["Tsuki no Kanata de Aimashou", "月の彼方で逢いましょう", "Tsukikana"],
    "吸血狂袭！": ["Dracu-Riot!", "ドラクリオット"],
    "初音岛II": ["Da Capo II", "D.C.II", "ダ・カーポII"],
    "初音岛III": ["Da Capo III", "D.C.III", "ダ・カーポIII"],
    "雪樱": ["Snow Sakura", "スノーサクラ", "SNOW"],
    "Fate/hollow ataraxia": ["フェイト/ホロウアタラクシア"],
    "美少女万华镜 -被诅咒的传说少女-": [
        "Bishoujo Mangekyou -Kamikaze Kai-",
        "美少女万華鏡 -呪われし伝説の少女-",
    ],
    "美少女万华镜 -勿忘草与永远的少女-": [
        "Bishoujo Mangekyou -Tsubaki no Me-",
        "美少女万華鏡 -勿忘草と永遠の少女-",
    ],
    "神采炼金大师": ["Kamidori Alchemy Meister", "神採りアルケミーマイスター"],
    "夏莉的炼金工房": ["Evenicle", "イブニクル"],
    "英雄战姬": ["Eiyuu Senki", "英雄*戦姫"],
    "真忆": ["True Remembrance"],
    "天音开关": ["Amane Switch", "アマネスイッチ"],
    "星织梦未来": ["Hoshi Ori Yume Mirai", "星織ユメミライ"],
    "时钟机关之莱茵": ["A Clockwork Ley-Line", "時計仕掛けのレイライン"],
    "青空下的四重奏": ["Ao no Kanata no Four Rhythm", "Aokana", "蒼の彼方のフォーリズム"],
    "青空下的四重奏 EXTRA1": ["Aokana EXTRA1", "蒼の彼方のフォーリズム EXTRA1"],
    "青空下的四重奏 EXTRA2": ["Aokana EXTRA2", "蒼の彼方のフォーリズム EXTRA2"],
    "星光咖啡馆与死神之蝶": [
        "Cafe Stella to Shinigami no Chou",
        "喫茶ステラと死神の蝶",
        "Café Stella to Shinigami no Chou",
    ],
    "12Riven": ["12Riven -the Ψcliminal of integral-"],
    "根双重": ["Root Double", "ルートダブル"],
    "格诺西亚": ["Gnosia", "グノーシア"],
    "猫娘乐园 Vol.0": ["Nekopara Vol.0"],
    "猫娘乐园 Vol.1": ["Nekopara Vol.1"],
    "猫娘乐园 Vol.2": ["Nekopara Vol.2"],
    "猫娘乐园 Vol.3": ["Nekopara Vol.3"],
    "猫娘乐园 Vol.4": ["Nekopara Vol.4"],
    "认真和我谈恋爱！": ["Majikoi! Love Me Seriously!", "マジで恋する！", "Maji de Watashi ni Koi Shinasai!"],
    "认真和我谈恋爱！S": ["Majikoi! Love Me Seriously! S", "マジで恋する！S"],
    "魔女的夜宴": ["Sanoba Witch", "サノバウィッチ"],
    "千恋＊万花": ["Senren＊Banka", "Senren Banka", "千恋*万花", "千恋万花"],
    "谜语小丑": ["Riddle Joker", "RIDDLE JOKER"],
    "爱上火车 Last Run!!": ["Maitetsu:Last Run!!", "Maitetsu Last Run!!", "まいてつ Last Run!!"],
    "多娜多娜 一起来干坏事吧": [
        "Dohna Dohna",
        "ドーナドーナ",
        "Dohna Dohna Issho ni Warui Koto o Shiyou",
    ],
    "ATRI -My Dear Moments-": ["ATRI", "アトリ"],
    "LOOPERS": ["ルーパーズ"],
    "甜蜜女友": ["Amakano", "アマカノ"],
    "甜蜜女友2": ["Amakano 2", "アマカノ2"],
    "甜蜜女友3": ["Amakano 3", "アマカノ3"],
    "天使嚣嚣 RE-BOOT!": ["天使☆騒々 RE-BOOT!", "Tenshi Souzou RE-BOOT!"],
    "恋爱，我借走了": ["Renai Karichaimashita", "恋、借りちゃいました", "Koi, Karichaimashita"],
    "IxSHE Tell": ["イクシーテル"],
    "三色绘恋": ["Tricolour Lovestory", "トリコロールラヴストーリー"],
    "原始之心": ["Primal Hearts", "プライマルハーツ"],
    "原始之心2": ["Primal Hearts 2", "プライマルハーツ2"],
    "Chrono Clock": ["クロノクロック"],
    "Fureraba": ["フレラバ"],
    "Hapymaher": ["ハピメア"],
    "Kanon": ["カノン"],
    "AIR": ["エア"],
    "风 -a breath of heart-": ["Wind -a breath of heart-", "ウインド"],
    "Baldr Sky Dive2": ['Baldr Sky Dive2 "Recordare"', "BALDR SKY Dive2"],
    "Baldr Sky DiveX": ['Baldr Sky DiveX "Dream World"'],
    "ef - a fairy tale of the two.": ["ef"],
    "片羽少女": ["Katawa Shoujo"],
    "怪物娘的奇幻世界": ["Monster Girl Quest", "モン娘クエスト"],
    "白色相簿": ["White Album", "ホワイトアルバム"],
    "学校日子": ["School Days", "スクールデイズ"],
    "缘之空": ["Yosuga no Sora", "ヨスガノソラ"],
    "Remember11": ["Remember11 -the age of infinity-"],
    "Ever17": ["Ever17 -the out of infinity-", "永远的艾塞莉娅"],
    "任性高规格": ["Wagamama High Spec", "ワガママハイスペック"],
    "Making*Lovers": ["Making Lovers", "メイキングラバーズ"],
    "Sugar*Style": ["Sugar Style", "シュガースタイル"],
    "后宫王国": ["HaremKingdom", "ハーレムキングダム", "Harem Kingdom"],
    "近月少女的礼仪": ["Tsuki ni Yorisou Otome no Sahou", "月に寄りそう乙女の作法"],
    "近月少女的礼仪2": ["Tsuki ni Yorisou Otome no Sahou 2"],
    "近月少女的礼仪3": ["Tsuki ni Yorisou Otome no Sahou 3"],
    "常轨脱离Creative": ["Hamidashi Creative", "ハミダシクリエイティブ"],
    "常轨脱离Love Potion": ["Hamidashi Creative Rhapsody", "ハミダシクリエイティブラプソディ"],
    "初恋1/1": ["Hatsukoi 1/1"],
    "恋与选举与巧克力": ["Koi to Senkyo to Chocolate", "恋と選挙とチョコレート"],
    "恋花绽放樱飞时": ["Koi ga Saku Koro Sakura Doki", "恋がさくころ桜どき"],
    "花开Work Spring！": ["Hanasaki Work Spring!", "花咲ワークスプリング！", "花咲works spring！"],
    "Golden Marriage": ["ゴールデンマリッジ"],
    "多娜多娜": ["ドーナドーナ"],
    "Cafe Stella": ["喫茶ステラ"],
    "海猫鸣泣之时": ["Umineko no Naku Koro ni", "うみねこのなく頃に"],
    "寒蝉鸣泣之时": ["Higurashi no Naku Koro ni", "ひぐらしのなく頃に"],
    "沙耶之歌": ["Saya no Uta", "沙耶の唄"],
    "WHITE ALBUM2": ["ホワイトアルバム2", "白色相簿2"],
    "住在拔作岛上的贫乳应该如何是好？": [
        "Nukitashi",
        "抜きゲーみたいな島に住んでる貧乳はどうすりゃいいですか？",
        "飞机场生活在拔作岛怎么破？",
        "飞机场生活在拔作岛怎么破",
    ],
    "住在拔作岛上的贫乳应该如何是好？2": [
        "Nukitashi 2",
        "抜きゲーみたいな島に住んでる貧乳はどうすりゃいいですか？2",
    ],
    "恋爱成双": ["Koiiro Soramoyou", "こいいろそらいろ"],
    "世界终焉的物语 episode.1": ["World End Economica episode.1"],
    "世界终焉的物语 episode.2": ["World End Economica episode.2"],
    "世界终焉的物语 episode.3": ["World End Economica episode.3"],
    "秋之回忆": ["Memories Off", "メモリーズオフ"],
    "秋之回忆2": ["Memories Off 2nd"],
    "秋之回忆3": ["Memories Off ~Sorekara~"],
    "秋之回忆4": ["Memories Off ~From the Depths~"],
    "秋之回忆5": ["Memories Off #5"],
    "秋之回忆6": ["Memories Off 6"],
    "秋之回忆7": ["Memories Off 7"],
}


def main() -> None:
    data = json.loads(ALIASES.read_text(encoding="utf-8"))
    for k, aliases in EXTRA.items():
        data.setdefault(k, [])
        for a in aliases:
            if a not in data[k]:
                data[k].append(a)
    ALIASES.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"aliases keys={len(data)}")


if __name__ == "__main__":
    main()
