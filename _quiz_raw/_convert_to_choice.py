# -*- coding: utf-8 -*-
"""Convert reasonably closed-set text questions to choice in zh_pack.json."""
from __future__ import annotations

import json
from pathlib import Path

RAW = Path(__file__).resolve().parent

# id -> {question?, options, answer, explain?}
# Keep existing question/explain unless override needed.
CONVERSIONS: dict[str, dict] = {
    # --- closed pairs / taxonomy ---
    "s1-03": {
        "options": [
            "莉西亚斯＝神族、莉奈＝魔族",
            "莉西亚斯＝魔族、莉奈＝神族",
            "两人都是神族",
            "两人都是魔族",
        ],
        "answer": 0,
    },
    "s1-04": {
        "options": [
            "NLNS / SHO / SS",
            "SHO / NLNS / SS",
            "SS / SHO / NLNS",
            "NLNS / SS / SHO",
        ],
        "answer": 0,
        "question": "Qruppo《拔作岛》中，主角秘密结社 / 敌对公益社团 / 学园生徒会·风纪的简称分别是？",
    },
    "s1-09": {
        "options": ["①②③", "①③②", "②③①", "③②①", "②①③", "③①②"],
        "answer": 2,
    },
    "s1-10": {
        "options": [
            "最多①、最少⑤",
            "最多①、最少④",
            "最多②、最少⑤",
            "最多⑤、最少①",
            "最多③、最少①",
        ],
        "answer": 0,
    },
    "s1-14": {
        "options": ["①②", "①④", "②③", "③④", "①②③④"],
        "answer": 1,
        "question": "请根据图片：①～④中，むりりん负责原画的角色编号是？",
    },
    "s1-15": {
        "options": ["①②", "①②③", "②③④", "①④", "①②③④"],
        "answer": 1,
        "question": "请根据图片：①～④中，宫坂みゆ负责原画的角色编号是？",
    },
    "s2-02": {
        "options": ["HMX-12", "HMX-14", "MHX-12", "HMX-21", "RX-78"],
        "answer": 0,
    },
    "s2-04": {
        "options": [
            "都是新干线列车的爱称",
            "都是花的别名",
            "都是声优的艺名",
            "都是车站名",
            "都是季节名",
        ],
        "answer": 0,
    },
    "s2-06": {
        "options": [
            "尽くしたい / お世話好き",
            "お世話好き / 尽くしたい",
            "恋したい / お世話好き",
            "尽くしたい / 甘えたい",
        ],
        "answer": 0,
        "question": "HOOKSOFT《放学后的灰姑娘》中，築島つくし与小瀬葉月宣传语被黑条遮住的两处，分别填什么？",
    },
    "s2-07": {
        "options": [
            "グロブティ / フォン / にゃん。",
            "グロブティ / フェング / むすめ。",
            "グローブティ / フォン / むすめ。",
            "グロブティ / フォン / むすめ。",
        ],
        "answer": 0,
        "question": "写出下列 Gal 厂商名的日语读法：GLOVETY / feng / 娘。",
    },
    "s2-08": {
        "options": [
            "フライングサーカス / 刃道",
            "スカイサーカス / 剣道",
            "フライングサーカス / 剣道",
            "エアロサーカス / 刃道",
        ],
        "answer": 0,
        "question": "写出两部作品中的虚构运动名——《苍之彼方的四重奏》的「□□□马戏团」与《牵绊闪耀的恋之伊吕波》的「□道」。",
    },
    "s2-18": {
        "options": [
            "時よ止まれ。おまえは美しい。",
            "時よ進め。おまえは儚い。",
            "世界よ止まれ。おまえは美しい。",
            "時よ止まれ。わたしは美しい。",
        ],
        "answer": 0,
        "question": "《Dies irae》2007 版咏唱最后一句（对应德语 Verweile doch…）是？",
    },
    "s2-19": {
        "options": [
            "左＝しらたま、右＝梱枝りこ",
            "左＝梱枝りこ、右＝しらたま",
            "左＝みつみ美里、右＝梱枝りこ",
            "左＝しらたま、右＝むりりん",
        ],
        "answer": 0,
    },
    "s3-05": {
        "options": [
            "アクティ部",
            "ソアリング部",
            "チャカポコ部",
            "ぬこ部",
            "乙女部",
            "銃剣道部",
        ],
        "answer": 5,
        "question": "下列部活中，哪一个从未在 Gal 中作为女主所属出现？（其余选项均曾在 Gal 中出现或有女主所属）",
    },
    "s3-08": {
        "options": ["①Ａ②Ｂ③Ｃ", "①Ｂ②Ａ③Ｃ", "①Ｃ②Ａ③Ｂ", "①Ｂ②Ｃ③Ａ"],
        "answer": 1,
        "question": "请根据图片：三件 T 恤（A/B/C）分别由哪位女主穿着？按 ①②③ 顺序选出对应字母。",
    },
    "s3-09": {
        "options": [
            "都进行过众筹（クラウドファンディング）",
            "都改编成了动画",
            "都是同人社团作品",
            "都是 18 禁全年龄双版本",
            "都由同一剧本家执笔",
        ],
        "answer": 0,
    },
    "s3-13": {
        "options": ["①②③", "①③②", "②③①", "③②①", "②①③", "③①②"],
        "answer": 2,
    },
    "s3-15": {
        "options": [
            "姐姐＝小桃、妹妹＝小雨",
            "姐姐＝小雨、妹妹＝小桃",
            "两人同龄（同时出生）",
            "无法从立绘判断",
        ],
        "answer": 0,
        "question": "请根据图片：《星空下的回忆》双胞胎姐妹，谁是姐姐、谁是妹妹？",
    },
    "s3-16": {
        "options": [
            "①初回版、②豪华版",
            "①豪华版、②初回版",
            "两件都是初回版",
            "两件都是豪华版",
        ],
        "answer": 0,
    },
    "s3-17": {
        "options": [
            "左＝E-15、右＝R-18",
            "左＝R-18、右＝E-15",
            "两边都是 E-15",
            "两边都是 R-18",
        ],
        "answer": 0,
        "question": "请根据图片：《D.C. 10 周年感谢包》左、右哪边是 E-15、哪边是 R-18？",
    },
    "s3-18": {
        "options": [
            "改成拉面超人那种发型",
            "删掉整段抓头发描写",
            "改成戴假发",
            "改成「抓帽子」描写",
            "未作任何修正",
        ],
        "answer": 0,
    },
    "s3-20": {
        "options": ["①", "②", "③", "④"],
        "answer": 1,
    },
    "s4-02": {
        "options": [
            "都是 Gal 厂商名的略称",
            "都是作品女主名",
            "都是声优事务所名",
            "都是游戏引擎名",
            "都是同人社团名",
        ],
        "answer": 0,
    },
    "s4-04": {
        "options": [
            "その体は、きっと剣で出来ていた。",
            "この体は、きっと鋼で出来ていた。",
            "その魂は、きっと剣で出来ていた。",
            "その体は、きっと夢で出来ていた。",
        ],
        "answer": 0,
        "question": "补全《Fate/stay night》无限剑制咏唱最后一句日文。",
    },
    "s4-08": {
        "options": [
            "①ゆるキャン△",
            "②シス△キャン",
            "③△エロキャン",
            "④キャン·ドゥ",
            "⑤きゃんきゃんバニー",
        ],
        "answer": 1,
        "question": "请根据图片：图中下方三位角色出自下列哪一部作品？",
    },
    "s4-09": {
        "options": [
            "①Orthros、②Cuteuphoria",
            "①Cuteuphoria、②Orthros",
            "①ASa Project、②Cuteuphoria",
            "①Orthros、②ゆずソフト",
        ],
        "answer": 0,
        "question": "请根据图片：①②分别是哪家厂商的吉祥物？",
    },
    "s4-10": {
        "options": ["①③", "②⑤", "②④", "③⑥", "①⑤"],
        "answer": 1,
        "question": "《像 Gal 一样来场美好的恋爱吧！》作中作列表里，哪两个不是作中作？",
    },
    "s4-15": {
        "options": [
            "①限定版、②通常版",
            "①通常版、②限定版",
            "两件都是通常版",
            "两件都是限定版",
        ],
        "answer": 0,
    },
    "s4-18": {
        "options": ["ヒンニュー教", "ボイン教", "フラット教", "ミルク教", "シークレット教"],
        "answer": 0,
    },
    "s5-04": {
        "options": [
            "最高＝鴻さゆみ、最低＝柳木詩夢",
            "最高＝柳木詩夢、最低＝鴻さゆみ",
            "最高＝鴻さゆみ、最低＝硯川・e・涙香",
            "最高＝黒姫結灯、最低＝柳木詩夢",
        ],
        "answer": 0,
        "question": "《甜蜜女友 3》「撒娇度」初始值最高与最低的女主分别是？",
    },
    "s5-09": {
        "options": [
            "①七　②十三　③２０",
            "①八　②十二　③２５",
            "①七　②十一　③１８",
            "①九　②十三　③２２",
        ],
        "answer": 0,
        "question": "请根据图片：《流星世界演绎者》①舞台「第■共和国」②所属「警察厅■■课」③妖精 Melissa 身高约■■ cm —— 选出正确数字组合。",
    },
    "s5-10": {
        "options": [
            "無気力ナース",
            "ドＳナース",
            "天然ナース",
            "ヤンデレナース",
            "クールナース",
        ],
        "answer": 0,
    },
    "s5-11": {
        "options": ["①Ａ②Ｂ③Ｃ", "①Ｂ②Ｃ③Ａ", "①Ｃ②Ａ③Ｂ", "①Ｃ②Ｂ③Ａ"],
        "answer": 2,
        "question": "请根据图片：《DEARDROPS》角色与乐器 A/B/C 的正确对应是？",
    },
    "s5-15": {
        "options": [
            "①下载版、②实体版",
            "①实体版、②下载版",
            "两件都是下载版",
            "两件都是实体版",
        ],
        "answer": 0,
    },
    "s5-17": {
        "options": ["①", "②", "③", "④"],
        "answer": 2,
    },
    # --- matching with full-key options ---
    "s2-10": {
        "options": [
            "①うぐぅ②グッドだ③がお④ぶっこぉすぞ！⑤きゃる～ん☆⑥バカバカ",
            "①まだまだだね②うぐぅ③がお④はにゃーん⑤きゃる～ん☆⑥バカバカ",
            "①うぐぅ②グッドだ③がお④いっけーマグナム⑤ピッピカチュウ⑥バカバカ",
            "①がお②グッドだ③うぐぅ④ぶっこぉすぞ！⑤きゃる～ん☆⑥バカバカ",
        ],
        "answer": 0,
        "question": "请根据图片：按①～⑥顺序选出对应口头禅/台词。",
    },
    "s3-06": {
        "options": [
            "①ぱんにゃ②ソフィーティア③うたまる④儀左右衛門⑤ドルジ⑥QP⑦ハニー",
            "①ぱんにゃ②うたまる③ソフィーティア④儀左右衛門⑤ドルジ⑥QP⑦ハニー",
            "①QP②ソフィーティア③うたまる④儀左右衛門⑤ドルジ⑥ぱんにゃ⑦ハニー",
            "①ぱんにゃ②ソフィーティア③うたまる④ドルジ⑤儀左右衛門⑥QP⑦ハニー",
        ],
        "answer": 0,
        "question": "请根据图片：为①～⑦各吉祥物选出正确名称对应。",
    },
    "s3-07": {
        "options": [
            "①荒ぶる天神乱漫のポーズ②堂に入った構え③アローポーズ",
            "①アローポーズ②堂に入った構え③荒ぶる天神乱漫のポーズ",
            "①荒ぶる天神乱漫のポーズ②アローポーズ③堂に入った構え",
            "①堂に入った構え②荒ぶる天神乱漫のポーズ③アローポーズ",
        ],
        "answer": 0,
        "question": "请根据图片：①～③三种姿势在玩家间通称什么？",
    },
    # --- identification with plausible distractors ---
    "s1-13": {
        "options": ["夏野イオ", "みつみ美里", "むりりん", "ななせめるち", "こもわた遙華"],
        "answer": 0,
    },
    "s2-05": {
        "options": [
            "偷了 1000 个以上有女孩坐过的秋千",
            "偷了 1000 个以上的女式内裤",
            "在公园秋千上做出不雅行为",
            "破坏了 1000 个以上的游乐设施",
        ],
        "answer": 0,
    },
    "s2-13": {
        "options": ["ケロＱ＆枕", "ゆずソフト", "Key", "フロントウイング", "ASa Project"],
        "answer": 0,
    },
    "s3-03": {
        "options": ["モンキホーテ", "ドンキホーテ", "モンキージェット", "サルキホーテ", "ドンキーモール"],
        "answer": 0,
    },
    "s4-03": {
        "options": [
            "「動くな。童貞だ」",
            "「動くな。処女だ」",
            "「動くな。人質だ」",
            "「動くな。偽物だ」",
        ],
        "answer": 0,
        "question": "以下是《流景之海的艾佩理雅》中的台词。零一对沙罗说的黑条内容是？",
    },
    "s5-03": {
        "options": [
            "「バイブのモネマネ」",
            "「スマホのバイブ」",
            "「寒さでガタガタ」",
            "「筋トレの反動」",
        ],
        "answer": 0,
        "question": "以下是《与义妹们的生活虽爽但有点累》中的台词。夏海颤抖的黑条解释是？",
    },
    # --- already-listed candidates / tiny closed sets ---
    "s3-04": {
        "options": ["いちか", "サチ", "なつめ"],
        "answer": 1,
        "question": "请根据图片：《恋之巢》（こいのす☆イチャコライズ）主人公房间「改造后」属于哪位女主路线？",
    },
    "s3-19": {
        "options": ["なかむらたけし", "みつみ美里", "両名共同", "どちらでもない"],
        "answer": 0,
        "question": "请根据图片：《没有天使的 12 月》包装角色由哪位原画师负责？（提示图可选）",
    },
    # --- machine / long-name matching ---
    "s1-11": {
        "options": [
            "①デモンベイン②劔冑③シュミクラム④クラリアス⑤戦術機",
            "①デモンベイン②クラリアス③シュミクラム④劔冑⑤戦術機",
            "①シュミクラム②劔冑③デモンベイン④クラリアス⑤戦術機",
            "①デモンベイン②劔冑③戦術機④クラリアス⑤シュミクラム",
        ],
        "answer": 0,
        "question": "请根据图片：选出①～⑤机体名称的正确对应。",
    },
    "s1-12": {
        "options": [
            "リリ・リル・リーリ・リンダ・リッテル・ローリア・リンドリア・ブリットアニア",
            "リリ・リル・リーリ・リンダ・リッテル・ローリア・ブリットアニア",
            "リリ・リーリ・リンダ・リッテル・ローリア・リンドリア・ブリットアニア",
            "リリ・リル・リーリ・リッテル・ローリア・リンドリア・ブリットアニア",
        ],
        "answer": 0,
        "question": "请根据图片：写出《世界末日陨落之星》该角色的全名。",
    },
    # --- uniforms (cross-distractors among famous sets) ---
    "s1-16": {
        "options": [
            "それは舞い散る桜のように",
            "D.C. 〜ダ・カーポ〜",
            "大図書館の羊飼い",
            "リトルバスターズ！",
            "ef - a fairy tale of the two.",
        ],
        "answer": 0,
    },
    "s1-17": {
        "options": [
            "D.C. 〜ダ・カーポ〜",
            "それは舞い散る桜のように",
            "Kanon",
            "AIR",
            "CLANNAD",
        ],
        "answer": 0,
    },
    "s1-18": {
        "options": [
            "大図書館の羊飼い",
            "ましろ色シンフォニー",
            "恋と選挙とチョコレート",
            "カルマルカ*サークル",
            "サノバウィッチ",
        ],
        "answer": 0,
    },
    "s1-19": {
        "options": [
            "リトルバスターズ！エクスタシー",
            "CLANNAD",
            "Rewrite",
            "Angel Beats!",
            "Summer Pockets",
        ],
        "answer": 0,
    },
    "s1-20": {
        "options": [
            "efシリーズ",
            "D.C. 〜ダ・カーポ〜",
            "フォセット - Cafe au Le Ciel Bleu -",
            "eden*",
            "ヨスガノソラ",
        ],
        "answer": 0,
    },
    "s2-20": {
        "options": [
            "Fate/stay night",
            "月姫",
            "空の境界",
            "MELTY BLOOD",
            "魔法使いの夜",
        ],
        "answer": 0,
    },
    "s3-21": {
        "options": [
            "真剣で私に恋しなさい！",
            "マブラヴ",
            "学園ヘヴン",
            "君が望む永遠",
            "大図書館の羊飼い",
        ],
        "answer": 0,
    },
    "s4-19": {
        "options": ["Kanon", "AIR", "CLANNAD", "Planetarian", "智代アフター"],
        "answer": 0,
    },
    "s4-20": {
        "options": [
            "マブラヴ",
            "マブラヴ オルタネイティヴ",
            "シュヴァルツェスマーケン",
            "バルドスカイ",
            "斬魔大聖デモンベイン",
        ],
        "answer": 0,
    },
    "s5-19": {
        "options": ["AIR", "Kanon", "CLANNAD", "Planetarian", "リトルバスターズ！"],
        "answer": 0,
    },
    "s5-20": {
        "options": [
            "同級生２",
            "同級生",
            "下級生",
            "フォルト!!",
            "恋愛CHU! -色々な恋愛のカタチ-",
        ],
        "answer": 0,
    },
    # --- pilgrimage / icon / room / parody ---
    "s2-01": {
        "options": [
            "マリちゃん危機一髪",
            "電脳学園",
            "ドラゴンナイト",
            "同窓会",
            "遺作",
        ],
        "answer": 0,
    },
    "s2-11": {
        "options": [
            "巨乳ファンタジー",
            "巨乳ファンタジー外伝",
            "天結いラビリンスマイスター",
            "デモンバスターズ",
            "戦女神VERITA",
        ],
        "answer": 0,
    },
    "s2-14": {
        "options": [
            "穢翼のユースティア（カイムの家）",
            "穢翼のユースティア（ユースティアの家）",
            "天使のいない12月（主人公の家）",
            "素晴らしき日々（主人公の部屋）",
            "サノバウィッチ（綾地寧々の家）",
        ],
        "answer": 0,
    },
    "s3-01": {
        "options": [
            "ランスⅣ -教団の遺産-",
            "Rance X -決戦-",
            "鬼畜王ランス",
            "戦国ランス",
            "ランス・クエスト",
        ],
        "answer": 0,
    },
    "s3-02": {
        "options": [
            "ハピメア",
            "サノバウィッチ",
            "千恋＊万花",
            "RIDDLE JOKER",
            "アマカノ",
        ],
        "answer": 0,
    },
    "s4-13": {
        "options": [
            "先輩が私の妄想にドージンする？！",
            "お兄ちゃん、右手の使用を禁止します！",
            "お兄ちゃん、キッスの準備はまだですか？",
            "妹のセイイキ",
            "リアル妹がいる大泉くんのばあい",
        ],
        "answer": 0,
    },
    "s4-14": {
        "options": [
            "ハミダシクリエイティブ",
            "ハミダシクリエイティブ凸",
            "千恋＊万花",
            "サノバウィッチ",
            "RIDDLE JOKER",
        ],
        "answer": 0,
    },
    "s5-14": {
        "options": [
            "サノバウィッチ",
            "千恋＊万花",
            "RIDDLE JOKER",
            "喫茶ステラと死神の蝶",
            "ノラと皇女と野良猫ハート",
        ],
        "answer": 0,
    },
    # --- catchcopy / genre / synopsis / opening line ---
    "s2-16": {
        "options": [
            "DRACU-RIOT!",
            "千恋＊万花",
            "サノバウィッチ",
            "RIDDLE JOKER",
            "ノラと皇女と野良猫ハート",
        ],
        "answer": 0,
    },
    "s2-17": {
        "options": [
            "ノラと皇女と野良猫ハート",
            "DRACU-RIOT!",
            "サノバウィッチ",
            "千恋＊万花",
            "恋×シンアイ関係",
        ],
        "answer": 0,
    },
    "s3-11": {
        "options": [
            "抜きゲーみたいな島に住んでる貧乳はどうすりゃいいですか？",
            "ヘンタイ・プリズン",
            "搾精病棟",
            "放課後シンデレラ",
            "リアル妹がいる大泉くんのばあい",
        ],
        "answer": 0,
    },
    "s3-12": {
        "options": [
            "さよならを教えて ～comment te dire adieu～",
            "沙耶の唄",
            "虚ろなる神ゲム",
            "虚無と幸福の箱庭",
            "素晴らしき日々 ～不連続存在～",
        ],
        "answer": 0,
    },
    "s4-05": {
        "options": [
            "キスアト",
            "キスベル",
            "恋と選挙とチョコレート",
            "恋がさくころ桜どき",
            "その花びらにくちづけを",
        ],
        "answer": 0,
    },
    "s4-06": {
        "options": [
            "さくらの雲＊スカアレットの恋",
            "サクラノ詩",
            "サクラノ刻",
            "さくらのしっぽ",
            "さくらさくら",
        ],
        "answer": 0,
    },
    "s5-02": {
        "options": [
            "天使のいない12月",
            "さよならを教えて",
            "沙耶の唄",
            "素晴らしき日々 ～不連続存在～",
            "CROSS†CHANNEL",
        ],
        "answer": 0,
    },
    "s5-05": {
        "options": [
            "アインシュタインより愛を込めて",
            "アストラエアの白き永遠",
            "アマカノ",
            "アイドル魔法少女ちるちる☆みちる",
            "恋と選挙とチョコレート",
        ],
        "answer": 0,
    },
    "s5-06": {
        "options": [
            "ジュエリー・ハーツ・アカデミア",
            "大図書館の羊飼い",
            "恋と選挙とチョコレート",
            "千恋＊万花",
            "アマツツム",
        ],
        "answer": 0,
    },
    # --- seiyuu (audio) ---
    "s1-21": {
        "options": ["秋野花", "北見六花", "民安ともえ", "藤森ゆき奈", "歩サラ"],
        "answer": 0,
    },
    "s2-21": {
        "options": ["夏和小", "秋野花", "明月まりあ", "あじ秋刀魚", "藤咲ウサ"],
        "answer": 0,
    },
    "s2-22": {
        "options": ["風花ましろ", "夏和小", "小波すず", "北大路ゆき", "歩サラ"],
        "answer": 0,
    },
    "s3-22": {
        "options": ["北大路ゆき", "秋野花", "夏和小", "風花ましろ", "あじ秋刀魚"],
        "answer": 0,
    },
    "s4-21": {
        "options": ["和央きりか", "明羽杏子", "夏和小", "歩サラ", "北大路ゆき"],
        "answer": 0,
    },
    "s4-22": {
        "options": ["明羽杏子", "和央きりか", "風花ましろ", "秋野花", "夏和小"],
        "answer": 0,
    },
    "s5-21": {
        "options": ["柳ひとみ", "蒼乃むすび", "秋野花", "夏和小", "北大路ゆき"],
        "answer": 0,
    },
    "s5-22": {
        "options": ["蒼乃むすび", "柳ひとみ", "風花ましろ", "明羽杏子", "和央きりか"],
        "answer": 0,
    },
    # --- song / BGM titles ---
    "s1-22": {
        "options": [
            "空気力学少女と少年の詩",
            "Light colors",
            "Last regrets",
            "鳥の詩",
            "青空の欠片",
        ],
        "answer": 0,
    },
    "s1-23": {
        "options": [
            "未来への咆哮",
            "光る空の光芒",
            "未来へのプロローグ",
            "翼をください",
            "Brave Heart",
        ],
        "answer": 0,
    },
    "s1-24": {
        "options": ["Leaf ticket", "Light colors", "White Album", "Leaf Garden", "Feeling Heart"],
        "answer": 0,
    },
    "s1-25": {
        "options": ["true my heart", "Heartful Song", "My Dear", "true love", "Heart to Heart"],
        "answer": 0,
    },
    "s2-23": {
        "options": ["Answer", "Question", "Reply", "Echo", "Signal"],
        "answer": 0,
    },
    "s2-24": {
        "options": ["アペイリア", "アストレア", "アカシック", "アストロ", "アリア"],
        "answer": 0,
    },
    "s2-25": {
        "options": [
            "Love♡Vacation",
            "Love Celebration",
            "Summer Vacation",
            "Love Emotion",
            "Heart Vacation",
        ],
        "answer": 0,
    },
    "s3-23": {
        "options": [
            "Flyable Heart",
            "Flyable CandyHeart",
            "ましろ色シンフォニー",
            "恋色空模様",
            "まいてつ",
        ],
        "answer": 0,
        "question": "请听音频：标题画面 BGM 出自哪部作品？",
    },
    "s3-24": {
        "options": [
            "桜爛ロマンシア",
            "桜の木の下で",
            "桜色の夢",
            "桜舞う坂道で",
            "桜前線異常ナシ",
        ],
        "answer": 0,
    },
    "s3-25": {
        "options": [
            "ドーナドーナのうた",
            "ドナドナ",
            "ドンナ・ドンナ",
            "ドーナのマーチ",
            "ドーナドーナ・ラブ",
        ],
        "answer": 0,
    },
    "s4-23": {
        "options": [
            "楽園の扉",
            "楽園の翼",
            "失楽園",
            "楽園への道",
            "扉の向こう",
        ],
        "answer": 0,
    },
    "s4-24": {
        "options": ["Cream+Mint", "Chocolate Mint", "Cream Soda", "Milk+Mint", "Sugar+Mint"],
        "answer": 0,
    },
    "s4-25": {
        "options": [
            "Path to glory",
            "Road to glory",
            "Path of glory",
            "Glory Days",
            "Select Oblige",
        ],
        "answer": 0,
    },
    "s5-23": {
        "options": [
            "your little sister",
            "my little sister",
            "little sister",
            "dear sister",
            "sweet sister",
        ],
        "answer": 0,
        "question": "请听音频：曲名是？",
    },
    "s5-24": {
        "options": [
            "冬に咲く華",
            "冬の花",
            "雪に咲く華",
            "春に咲く華",
            "冬に舞う華",
        ],
        "answer": 0,
        "question": "请听音频：曲名是？",
    },
    "s5-25": {
        "options": [
            "孤籠の鶫",
            "籠の鳥",
            "廃村の歌",
            "孤高の鶫",
            "籠の鶫",
        ],
        "answer": 0,
        "question": "请听音频：曲名是？",
    },
    "s3-10": {
        "options": [
            "森田はいつになったら一流になるんだ？",
            "森田はいつになったら二流になるんだ？",
            "森田はいつになったら三流になるんだ？",
            "森田はいつになったら超一流になるんだ？",
        ],
        "answer": 0,
        "question": "以下是《车轮之国、向日葵的少女》中的台词。请选出黑条部分的正确内容。\n\n法月将臣：只会照做的人，是三流。\n法月将臣：能把交代的事做好的人，才刚够二流。\n法月将臣：森田要什么时候才能成为一流啊？",
    },
}


def to_choice(entry: dict, conv: dict) -> dict:
    out = {
        "type": "choice",
        "question": conv.get("question", entry["question"]),
        "options": conv["options"],
        "answer": conv["answer"],
        "explain": conv.get("explain", entry.get("explain", "")),
    }
    return out


def main() -> None:
    path = RAW / "zh_pack.json"
    zh = json.loads(path.read_text(encoding="utf-8"))
    missing = [k for k in CONVERSIONS if k not in zh]
    if missing:
        raise SystemExit(f"missing ids: {missing}")

    changed = []
    for qid, conv in CONVERSIONS.items():
        old = zh[qid]
        if old.get("type") == "choice" and qid not in ("s5-13",):
            # allow overwrite only for still-text
            pass
        zh[qid] = to_choice(old, conv)
        changed.append(qid)

    path.write_text(json.dumps(zh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("converted", len(changed), "questions:")
    print(", ".join(changed))

    # sanity: answer index in range
    for qid in changed:
        z = zh[qid]
        assert 0 <= z["answer"] < len(z["options"]), qid


if __name__ == "__main__":
    main()
