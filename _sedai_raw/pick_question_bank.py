"""Gal 心选 — 原创题库（≤100 题，运行时随机抽题）。"""


def q(text: str, options: list[dict], qid: str) -> dict:
    return {"id": qid, "text": text, "options": options}


def opt(label: str, boost: dict[str, int], drop: list[str] | None = None) -> dict:
    return {"label": label, "boost": boost, "drop": drop or []}


def build_question_bank() -> list[dict]:
    bank: list[dict] = []

    # —— 核心：开场偏好 ——
    bank.extend([
        q(
            "忙完一天打开 Gal，你最先想要什么？",
            [
                opt("轻松说笑，先乐再说", {"tone:hype": 4, "tone:sweet": 3, "pace:breezy": 3}, ["tone:literary", "pace:dense"]),
                opt("安静陪着，不用费脑子", {"tone:heal": 5, "tone:sweet": 2, "pace:short": 2}, ["tone:hype", "tone:epic"]),
                opt("走心，不怕沉重一点", {"tone:drama": 5, "pace:slowburn": 3}, ["tone:hype", "pace:breezy"]),
                opt("被设定吸住，想一直看", {"tone:mindbend": 5, "tone:epic": 3, "pace:dense": 3}, ["tone:sweet", "pace:breezy"]),
            ],
            "core-mood",
        ),
        q(
            "你更想故事发生在什么地方？",
            [
                opt("校园：教室、社团、放学路", {"setting:school": 5, "tone:sweet": 1}, ["setting:scifi", "setting:mystery"]),
                opt("城市或小镇的日常生活", {"setting:daily": 5, "tone:drama": 1}, ["setting:fantasy", "setting:scifi"]),
                opt("幻想世界：魔法、异能、异界", {"setting:fantasy": 5, "tone:epic": 2}, ["setting:daily"]),
                opt("科幻、封闭设施、时间线谜题", {"setting:scifi": 5, "setting:mystery": 3, "tone:mindbend": 2}, ["setting:school"]),
            ],
            "core-setting",
        ),
        q(
            "你愿意花多少时间推完一部？",
            [
                opt("几个晚上就能看完", {"pace:short": 5, "pace:breezy": 2}, ["pace:slowburn", "pace:dense"]),
                opt("中等篇幅，别拖太长", {"pace:breezy": 5}, ["pace:dense"]),
                opt("长线也行，愿意慢慢陪角色", {"pace:slowburn": 5, "tone:drama": 1}, ["pace:short"]),
                opt("信息量大、密度高也可以", {"pace:dense": 5, "tone:mindbend": 2, "tone:epic": 2}, ["pace:short", "pace:breezy"]),
            ],
            "core-pace",
        ),
        q(
            "你更在意角色相处，还是剧情事件？",
            [
                opt("相处第一：台词、互动、化学反应", {"tone:sweet": 4, "setting:school": 2, "pace:breezy": 2}, ["tone:mindbend", "pace:dense"]),
                opt("两者都要，但人物不能崩", {"tone:drama": 3, "tone:heal": 2, "pace:slowburn": 2}, []),
                opt("事件和谜题驱动也行", {"tone:mindbend": 4, "setting:mystery": 3, "pace:dense": 3}, ["tone:sweet"]),
                opt("要燃、要场面、要高潮", {"tone:hype": 4, "tone:epic": 4, "pace:dense": 2, "playstyle:rpg": 2}, ["tone:heal", "pace:slowburn"]),
            ],
            "core-cast-vs-plot",
        ),
        q(
            "情感上，你能接受到什么程度？",
            [
                opt("尽量甜、尽量稳", {"tone:sweet": 5, "tone:heal": 3, "fame:icon": 1}, ["tone:drama", "tone:epic", "tone:mindbend"]),
                opt("可以感伤，但希望有光", {"tone:heal": 4, "tone:drama": 3}, ["tone:hype"]),
                opt("胃痛、纠结、遗憾也能接受", {"tone:drama": 5, "tone:literary": 2, "appeal:utsuge": 2}, ["tone:sweet", "tone:hype"]),
                opt("压抑、黑暗、后劲大也行", {"tone:utsuge": 4, "appeal:utsuge": 4, "mood:heavy": 3}, ["tone:sweet", "tone:heal"]),
                opt("被世界观震撼也没关系", {"tone:epic": 4, "tone:mindbend": 3, "tone:literary": 2}, ["tone:sweet", "pace:breezy"]),
            ],
            "core-risk",
        ),
        q(
            "年代和名气，你更怎么选？",
            [
                opt("更想试近几年的", {"era:modern": 5, "pace:breezy": 1}, ["era:classic"]),
                opt("新旧都行，口碑好就好", {"fame:icon": 3, "fame:hit": 2}, []),
                opt("经典老作更有安全感", {"era:classic": 5, "fame:icon": 2}, ["era:modern"]),
                opt("冷门一点也行，别太烂大街", {"fame:solid": 4, "tone:literary": 2}, ["fame:icon"]),
            ],
            "core-era",
        ),
        q(
            "推完一部好 Gal，你希望带走什么？",
            [
                opt("名场面和梗，方便安利", {"fame:icon": 4, "tone:hype": 3, "tone:sweet": 2}, ["fame:solid"]),
                opt("心里空空的，情绪残留很久", {"tone:drama": 3, "tone:heal": 3, "tone:literary": 3}, ["tone:hype"]),
                opt("想翻解析、对时间线", {"tone:mindbend": 5, "setting:mystery": 2, "pace:dense": 2}, ["tone:sweet", "pace:breezy"]),
                opt("想立刻开二周目", {"tone:sweet": 3, "pace:breezy": 3, "setting:school": 2}, ["pace:dense", "tone:literary"]),
            ],
            "core-payoff",
        ),
        q(
            "今晚推 Gal，你更像哪种状态？",
            [
                opt("想被治愈，别折腾我", {"tone:sweet": 4, "tone:heal": 4, "mood:light": 3, "entry:easy": 2, "pace:short": 2, "pace:breezy": 2}, ["tone:epic", "tone:mindbend", "pace:dense"]),
                opt("想认真读完一个故事", {"tone:drama": 3, "focus:story": 3, "pace:slowburn": 3, "fame:hit": 2}, ["pace:short"]),
                opt("想被悬念拴住", {"tone:mindbend": 4, "focus:mystery": 3, "setting:scifi": 3, "setting:mystery": 3}, ["tone:sweet", "setting:school"]),
                opt("想看大场面、高强度展开", {"tone:epic": 5, "focus:world": 3, "tone:hype": 3, "pace:dense": 3}, ["tone:heal", "pace:short"]),
            ],
            "core-tonight",
        ),
    ])

    # —— 氛围与情绪 ——
    tone_items = [
        (
            "开场几分钟，你希望先感受到什么？",
            [
                opt("暖色日常，轻松可爱", {"tone:sweet": 5, "pace:breezy": 2}, ["tone:mindbend", "tone:epic"]),
                opt("安静治愈，像慢呼吸", {"tone:heal": 5, "pace:short": 2}, ["tone:hype"]),
                opt("认真叙事，情绪有分量", {"tone:drama": 5, "pace:slowburn": 2}, ["tone:hype", "pace:breezy"]),
                opt("烧脑或大气，别太平淡", {"tone:mindbend": 3, "tone:epic": 3, "pace:dense": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "如果用天气形容你想要的 Gal……",
            [
                opt("晴天：明亮轻快", {"tone:sweet": 4, "tone:hype": 2, "pace:breezy": 2}, ["tone:literary"]),
                opt("薄雾：温柔，略带感伤", {"tone:heal": 4, "tone:drama": 2}, ["tone:hype"]),
                opt("阴天：压抑、拉扯、余味长", {"tone:drama": 4, "tone:literary": 3}, ["tone:sweet"]),
                opt("雷雨：信息多、冲击强", {"tone:epic": 4, "tone:mindbend": 3, "pace:dense": 3}, ["pace:breezy"]),
            ],
        ),
        (
            "推完之后，你希望心里留着什么？",
            [
                opt("还想看角色多拌两句嘴", {"tone:sweet": 4, "setting:school": 2}, ["tone:epic"]),
                opt("心里安静了一会儿", {"tone:heal": 5}, ["tone:hype"]),
                opt("喉咙发紧，想发呆", {"tone:drama": 4, "tone:literary": 3}, ["tone:hype"]),
                opt("想去翻设定和时间线", {"tone:mindbend": 5, "pace:dense": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "以下哪种开场你更能接受？",
            [
                opt("可以接受甜，但别端着文艺腔", {"tone:sweet": 4, "pace:breezy": 2}, ["tone:literary"]),
                opt("可以接受感伤，但别全程起哄", {"tone:heal": 3, "tone:drama": 3}, ["tone:hype"]),
                opt("可以接受沉重，但别一直轻飘", {"tone:drama": 4, "tone:epic": 2}, ["pace:breezy", "tone:sweet"]),
                opt("可以接受硬核，但别纯撒糖", {"tone:mindbend": 3, "tone:epic": 3, "pace:dense": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "周末下午，哪种节奏最对味？",
            [
                opt("边笑边推，毫无压力", {"tone:hype": 3, "tone:sweet": 3, "pace:breezy": 3}, ["pace:dense"]),
                opt("慢慢铺，情绪自己涨", {"tone:drama": 3, "pace:slowburn": 4}, ["pace:short"]),
                opt("短而精，尽快到核心", {"tone:heal": 3, "pace:short": 5}, ["pace:slowburn"]),
                opt("信息量大也没关系", {"tone:mindbend": 3, "pace:dense": 5}, ["pace:breezy"]),
            ],
        ),
        (
            "什么会让你一直读下去？",
            [
                opt("角色太可爱，放不下", {"tone:sweet": 5, "setting:school": 2}, ["setting:mystery"]),
                opt("想知道他们会不会好起来", {"tone:drama": 4, "tone:heal": 2}, ["tone:hype"]),
                opt("谜团还差一块拼图", {"tone:mindbend": 5, "setting:mystery": 3}, ["tone:sweet"]),
                opt("下一场高潮好像要来了", {"tone:hype": 4, "tone:epic": 3}, ["pace:slowburn"]),
            ],
        ),
        (
            "你会怎么跟朋友安利一部 Gal？",
            [
                opt("「很好笑，很好嗑」", {"tone:sweet": 3, "tone:hype": 3, "fame:icon": 2}, ["tone:literary"]),
                opt("「很温柔」", {"tone:heal": 5}, ["tone:epic"]),
                opt("「会哭，但值得」", {"tone:drama": 5}, ["tone:hype"]),
                opt("「设定很猛」", {"tone:mindbend": 4, "tone:epic": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "「好玩」对你来说，更接近哪种感受？",
            [
                opt("开心、上头、想截图", {"tone:hype": 4, "tone:sweet": 3}, ["tone:literary"]),
                opt("被轻轻托住", {"tone:heal": 5, "pace:short": 1}, ["tone:epic"]),
                opt("被故事带走了", {"tone:drama": 4, "pace:slowburn": 2}, ["pace:breezy"]),
                opt("脑子转得很快", {"tone:mindbend": 5, "pace:dense": 3}, ["pace:breezy"]),
            ],
        ),
    ]
    for i, (prompt, options) in enumerate(tone_items, 1):
        bank.append(q(prompt, options, f"tone-{i}"))

    # —— 舞台与世界 ——
    setting_items = [
        (
            "背景声里，你更吃哪一种？",
            [
                opt("铃声、社团、走廊脚步", {"setting:school": 5, "tone:sweet": 1}, ["setting:mystery"]),
                opt("店里音乐、夜路、房间灯光", {"setting:daily": 5}, ["setting:fantasy"]),
                opt("法阵、刀锋、异界的风", {"setting:fantasy": 5, "tone:epic": 1}, ["setting:school"]),
                opt("仪器蜂鸣、广播、倒计时", {"setting:scifi": 5, "tone:mindbend": 1}, ["setting:daily"]),
            ],
        ),
        (
            "「日常戏」对你意味着什么？",
            [
                opt("校园日常就是主菜", {"setting:school": 5, "pace:breezy": 2}, ["pace:dense"]),
                opt("生活细节比奇观重要", {"setting:daily": 5, "tone:drama": 1}, ["tone:hype"]),
                opt("日常只是异常世界的表面", {"setting:fantasy": 4, "setting:mystery": 2}, ["setting:daily"]),
                opt("不太需要日常，要事件", {"setting:scifi": 3, "pace:dense": 3, "tone:mindbend": 2}, ["pace:breezy"]),
            ],
        ),
        (
            "什么设定最容易让你出戏？（选你能接受的）",
            [
                opt("别突然变硬核科幻", {"setting:school": 3, "setting:daily": 3}, ["setting:scifi"]),
                opt("别突然异世界大开", {"setting:daily": 4, "tone:drama": 1}, ["setting:fantasy"]),
                opt("别一直困在教室", {"setting:fantasy": 4, "setting:scifi": 2}, ["setting:school"]),
                opt("别只有恋爱没有谜团", {"setting:mystery": 4, "tone:mindbend": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "世界类型，此刻更偏向哪边？",
            [
                opt("校园就够", {"setting:school": 5}, ["setting:scifi"]),
                opt("普通人的城市生活", {"setting:daily": 5}, ["setting:fantasy"]),
                opt("非现实规则的世界", {"setting:fantasy": 5}, ["setting:daily"]),
                opt("封闭系统或科幻谜题", {"setting:scifi": 4, "setting:mystery": 3}, ["setting:school"]),
            ],
        ),
    ]
    for i, (prompt, options) in enumerate(setting_items, 1):
        bank.append(q(prompt, options, f"set-{i}"))

    # —— 篇幅与节奏 ——
    pace_items = [
        (
            "你对「日常闲聊」的容忍度？",
            [
                opt("能砍就砍，短而锋利", {"pace:short": 5}, ["pace:slowburn"]),
                opt("可以聊，但别没完没了", {"pace:breezy": 5}, ["pace:dense"]),
                opt("慢热可以，后期要兑现", {"pace:slowburn": 5}, ["pace:short"]),
                opt("信息密度优先，不怕劝退", {"pace:dense": 5}, ["pace:breezy"]),
            ],
        ),
        (
            "你平时怎么推 Gal？",
            [
                opt("想很快看到结局附近", {"pace:short": 5, "pace:breezy": 2}, ["pace:slowburn"]),
                opt("分几天，每次一小段", {"pace:breezy": 5}, ["pace:dense"]),
                opt("长期项目，陪着角色长大", {"pace:slowburn": 5}, ["pace:short"]),
                opt("一口气硬啃硬核章", {"pace:dense": 5}, ["pace:breezy"]),
            ],
        ),
        (
            "什么最容易让你弃坑？",
            [
                opt("太长太空，不知道爆点在哪", {"pace:short": 4, "pace:breezy": 3}, ["pace:slowburn"]),
                opt("太密太累，像在考试", {"pace:breezy": 4, "tone:sweet": 2}, ["pace:dense"]),
                opt("太短太飘，刚进入就结束", {"pace:slowburn": 4, "tone:drama": 2}, ["pace:short"]),
                opt("太甜太废，没有推进", {"pace:dense": 3, "tone:mindbend": 3, "tone:epic": 2}, ["tone:sweet"]),
            ],
        ),
    ]
    for i, (prompt, options) in enumerate(pace_items, 1):
        bank.append(q(prompt, options, f"pace-{i}"))

    # —— 年代与口碑 ——
    era_items = [
        (
            "画面和演出，你更在意？",
            [
                opt("新作的立绘和演出", {"era:modern": 5}, ["era:classic"]),
                opt("经典演出也有味道", {"era:classic": 4, "fame:icon": 2}, []),
                opt("看口碑，不看年份", {"fame:icon": 3, "fame:hit": 3}, []),
                opt("想避开烂大街的必玩清单", {"fame:solid": 5}, ["fame:icon"]),
            ],
        ),
        (
            "对「大家都在玩」的态度？",
            [
                opt("热门更安心，少踩雷", {"fame:icon": 5, "fame:hit": 2}, ["fame:solid"]),
                opt("热门可以，但别只有热门", {"fame:hit": 4}, []),
                opt("想找脸生一点的", {"fame:solid": 5, "tone:literary": 1}, ["fame:icon"]),
                opt("老牌名作更有仪式感", {"era:classic": 5, "fame:icon": 2}, ["era:modern"]),
            ],
        ),
        (
            "画面和剧本只能保一个，你选？",
            [
                opt("新画面 + 普通剧本", {"era:modern": 5, "pace:breezy": 2}, ["era:classic"]),
                opt("老剧本 + 普通画面", {"era:classic": 5, "tone:drama": 2}, ["era:modern"]),
                opt("名作光环优先", {"fame:icon": 5}, ["fame:solid"]),
                opt("个人口味优先，名气其次", {"fame:solid": 3, "tone:literary": 2, "tone:mindbend": 1}, ["fame:icon"]),
            ],
        ),
    ]
    for i, (prompt, options) in enumerate(era_items, 1):
        bank.append(q(prompt, options, f"era-{i}"))

    # —— 取舍与对比 ——
    contrast_items = [
        (
            "此刻更缺哪一种？",
            [
                opt("缺甜，给我糖", {"tone:sweet": 5, "tone:heal": 2}, ["tone:epic", "tone:mindbend"]),
                opt("缺刺激，给我冲突", {"tone:hype": 4, "tone:drama": 3}, ["tone:heal"]),
                opt("缺深度，给我余味", {"tone:literary": 4, "tone:drama": 3}, ["tone:hype"]),
                opt("缺谜题，给我结构", {"tone:mindbend": 5, "pace:dense": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "恋爱在故事里占多少？",
            [
                opt("恋爱是主菜", {"tone:sweet": 4, "setting:school": 2, "setting:daily": 2}, ["tone:epic"]),
                opt("恋爱和故事各半", {"tone:drama": 3, "tone:heal": 2}, []),
                opt("恋爱是调味，主线是事件", {"tone:mindbend": 3, "tone:epic": 3, "setting:mystery": 2}, ["tone:sweet"]),
                opt("可以很少恋爱，要世界观", {"tone:epic": 4, "setting:scifi": 3, "pace:dense": 2}, ["setting:school"]),
            ],
        ),
        (
            "哪种缺点你更能原谅？",
            [
                opt("剧情普通，但角色可爱", {"tone:sweet": 4, "fame:hit": 1}, ["tone:literary"]),
                opt("节奏慢，但情感真", {"pace:slowburn": 4, "tone:drama": 3}, ["pace:breezy"]),
                opt("人物脸谱，但谜题强", {"tone:mindbend": 4, "setting:mystery": 3}, ["tone:sweet"]),
                opt("压抑，但格局大", {"tone:epic": 4, "pace:dense": 2}, ["tone:heal"]),
            ],
        ),
        (
            "第一印象，你更看重什么？",
            [
                opt("OP 和开场气氛", {"tone:hype": 2, "fame:icon": 2, "era:modern": 2}, []),
                opt("女主的第一句台词", {"tone:sweet": 3, "setting:school": 2}, ["setting:scifi"]),
                opt("第一处伏笔", {"tone:mindbend": 4, "setting:mystery": 2}, ["pace:breezy"]),
                opt("第一场冲突", {"tone:drama": 3, "tone:epic": 3}, ["tone:heal"]),
            ],
        ),
        (
            "推完你会更想做什么？",
            [
                opt("截图发群安利", {"fame:icon": 3, "tone:hype": 3, "tone:sweet": 2}, ["tone:literary"]),
                opt("静静坐一会儿", {"tone:heal": 3, "tone:drama": 3, "tone:literary": 2}, ["tone:hype"]),
                opt("打开 wiki 查设定", {"tone:mindbend": 5, "pace:dense": 2}, ["tone:sweet"]),
                opt("立刻开二周目", {"tone:sweet": 3, "pace:breezy": 3, "setting:school": 2}, ["pace:dense"]),
            ],
        ),
        (
            "这部 Gal 对你来说是？",
            [
                opt("第一部入坑作", {"entry:easy": 5, "fame:icon": 2, "mood:light": 2}, ["entry:deep"]),
                opt("已经玩过几部，想换口味", {"entry:standard": 4, "fame:hit": 1}, []),
                opt("想挑战深度向", {"entry:deep": 5, "tone:literary": 2, "pace:dense": 2}, ["entry:easy"]),
                opt("无所谓，只要对味", {"tone:heal": 1, "tone:drama": 1, "tone:sweet": 1}, []),
            ],
        ),
        (
            "音乐和氛围，你更吃哪挂？",
            [
                opt("轻快可爱", {"tone:sweet": 3, "tone:hype": 2, "pace:breezy": 2}, ["tone:literary"]),
                opt("温柔氛围", {"tone:heal": 4, "setting:daily": 2}, ["tone:hype"]),
                opt("叙事张力", {"tone:drama": 3, "tone:epic": 2}, ["pace:breezy"]),
                opt("悬疑实验感", {"tone:mindbend": 3, "setting:mystery": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "如果必须先排除一类，你选？",
            [
                opt("排除超长硬核", {"pace:breezy": 3, "pace:short": 3}, ["pace:dense", "pace:slowburn"]),
                opt("排除纯甜无事件", {"tone:drama": 2, "tone:mindbend": 2, "tone:epic": 2}, ["tone:sweet"]),
                opt("排除致郁无光", {"tone:heal": 3, "tone:sweet": 2}, ["tone:drama", "tone:literary"]),
                opt("排除演出过时的老作", {"era:modern": 5}, ["era:classic"]),
            ],
        ),
    ]
    for i, (prompt, options) in enumerate(contrast_items, 1):
        bank.append(q(prompt, options, f"cx-{i}"))

    # —— 情境与细节 ——
    situational = [
        (
            "下雨天推 Gal，你更想要？",
            [
                opt("窗边甜宠", {"tone:sweet": 4, "setting:daily": 2}, ["tone:epic"]),
                opt("雨声里的感伤", {"tone:heal": 3, "tone:drama": 3}, ["tone:hype"]),
                opt("暴雨里的决断", {"tone:epic": 4, "tone:drama": 2}, ["pace:breezy"]),
                opt("雨幕下的阴谋", {"tone:mindbend": 4, "setting:mystery": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "对「多线互动」的态度？",
            [
                opt("喜欢多条线、多角色互动", {"tone:sweet": 4, "pace:breezy": 2, "setting:school": 2}, ["tone:literary"]),
                opt("更想单线深挖一个人", {"tone:drama": 3, "tone:heal": 3, "pace:slowburn": 2}, ["tone:hype"]),
                opt("结构无所谓，故事要抓人", {"tone:mindbend": 2, "tone:epic": 2, "fame:hit": 2}, []),
                opt("更在意群像和立场冲突", {"tone:epic": 3, "tone:drama": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "喜剧元素，你要多少？",
            [
                opt("多，靠笑话续命", {"tone:hype": 4, "tone:sweet": 3}, ["tone:literary", "tone:drama"]),
                opt("适中，笑点是调剂", {"tone:sweet": 2, "tone:drama": 2, "pace:breezy": 2}, []),
                opt("少，认真讲就好", {"tone:drama": 3, "tone:literary": 3}, ["tone:hype"]),
                opt("冷幽默可以，别尬哄", {"tone:mindbend": 2, "tone:literary": 2}, ["tone:hype"]),
            ],
        ),
        (
            "对「突然的生离死别」桥段？",
            [
                opt("尽量别来", {"tone:sweet": 4, "tone:heal": 3}, ["tone:drama", "tone:epic"]),
                opt("可以，但要有救赎", {"tone:heal": 3, "tone:drama": 4}, ["tone:hype"]),
                opt("可以很刀，我扛得住", {"tone:drama": 5, "tone:literary": 2}, ["tone:sweet"]),
                opt("若服务结构，可以很狠", {"tone:mindbend": 3, "tone:epic": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "文字量偏好？",
            [
                opt("轻量对白为主", {"pace:breezy": 4, "tone:sweet": 2}, ["pace:dense", "tone:literary"]),
                opt("中等叙述就好", {"pace:breezy": 3, "pace:slowburn": 2}, []),
                opt("愿意读大段独白", {"tone:literary": 4, "pace:slowburn": 3}, ["pace:short"]),
                opt("设定说明多也可以", {"pace:dense": 4, "tone:mindbend": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "什么「钩子」最容易抓住你？",
            [
                opt("角色魅力", {"tone:sweet": 4, "setting:school": 2}, ["setting:mystery"]),
                opt("情感关系", {"tone:drama": 4, "tone:heal": 2}, ["tone:hype"]),
                opt("悬念和谜团", {"tone:mindbend": 4, "setting:mystery": 4}, ["tone:sweet"]),
                opt("大场面和冲突", {"tone:hype": 4, "tone:epic": 3}, ["pace:slowburn"]),
            ],
        ),
        (
            "故事里有「学校」元素时？",
            [
                opt("就要校园恋爱味", {"setting:school": 5, "tone:sweet": 2}, ["setting:scifi"]),
                opt("学校只是外壳", {"setting:school": 2, "tone:drama": 2, "setting:mystery": 2}, []),
                opt("最好别困在校园", {"setting:daily": 3, "setting:fantasy": 3}, ["setting:school"]),
                opt("校园 + 异常事件最香", {"setting:school": 2, "setting:mystery": 4, "tone:mindbend": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "对「哲学式台词」？",
            [
                opt("少来，说人话", {"tone:sweet": 3, "pace:breezy": 3}, ["tone:literary"]),
                opt("偶尔闪光可以", {"tone:drama": 2, "tone:heal": 2}, []),
                opt("我就是来听这个的", {"tone:literary": 5, "pace:slowburn": 2}, ["tone:hype"]),
                opt("要和设定咬合，别空转", {"tone:mindbend": 3, "tone:literary": 3, "pace:dense": 2}, ["pace:breezy"]),
            ],
        ),
        (
            "群像和社交戏，你要多少？",
            [
                opt("小圈子亲密互动最好", {"tone:sweet": 3, "tone:heal": 2, "setting:daily": 2}, ["tone:epic"]),
                opt("社团、宿舍群像有趣", {"setting:school": 4, "tone:hype": 2}, ["setting:scifi"]),
                opt("大势力对抗更带感", {"tone:epic": 4, "setting:fantasy": 2}, ["pace:breezy"]),
                opt("封闭几人博弈更妙", {"setting:mystery": 4, "tone:mindbend": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "你最想避开哪类标签？",
            [
                opt("避开致郁向", {"tone:sweet": 3, "tone:heal": 3, "tone:hype": 1}, ["tone:drama", "tone:literary"]),
                opt("避开无脑甜", {"tone:drama": 2, "tone:mindbend": 2, "tone:literary": 2}, ["tone:sweet"]),
                opt("避开超长盘", {"pace:short": 3, "pace:breezy": 3}, ["pace:slowburn", "pace:dense"]),
                opt("避开演出过老", {"era:modern": 5}, ["era:classic"]),
            ],
        ),
        (
            "看到「科幻」标签，你的反应？",
            [
                opt("立刻加分", {"setting:scifi": 5, "tone:mindbend": 2}, ["setting:school"]),
                opt("有一点可以", {"setting:scifi": 2, "tone:heal": 1}, []),
                opt("更想奇幻而不是科幻", {"setting:fantasy": 5}, ["setting:scifi"]),
                opt("请给我现实向", {"setting:daily": 4, "setting:school": 3}, ["setting:scifi", "setting:fantasy"]),
            ],
        ),
        (
            "看到「推理 / 解谜」标签？",
            [
                opt("正中红心", {"setting:mystery": 5, "tone:mindbend": 3, "pace:dense": 2}, ["tone:sweet"]),
                opt("有一点彩蛋就好", {"setting:mystery": 2, "tone:drama": 1}, []),
                opt("别耽误谈恋爱", {"tone:sweet": 4, "setting:school": 2}, ["setting:mystery", "pace:dense"]),
                opt("可以，但别只有诡计", {"tone:drama": 3, "setting:mystery": 2}, ["pace:breezy"]),
            ],
        ),
        (
            "你更相信哪种推荐理由？",
            [
                opt("「新人友好」", {"fame:icon": 3, "tone:sweet": 2, "pace:breezy": 2}, ["pace:dense"]),
                opt("「哭完会变好」", {"tone:heal": 3, "tone:drama": 3}, ["tone:hype"]),
                opt("「神作但劝退」", {"tone:literary": 3, "tone:epic": 2, "pace:dense": 2}, ["tone:sweet"]),
                opt("「看完想讨论设定」", {"tone:mindbend": 5, "setting:mystery": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "一个人夜里推，你怕什么？",
            [
                opt("太压抑或太吓人", {"tone:sweet": 3, "tone:heal": 3}, ["tone:mindbend", "tone:epic"]),
                opt("太无聊", {"tone:hype": 3, "pace:breezy": 3}, ["pace:slowburn"]),
                opt("太短不过瘾", {"pace:slowburn": 3, "tone:drama": 2}, ["pace:short"]),
                opt("不怕压抑，怕逻辑烂", {"tone:mindbend": 4, "pace:dense": 2}, ["tone:hype"]),
            ],
        ),
        (
            "作品「名场面」很多，你怎么看？",
            [
                opt("加分，就吃这套", {"fame:icon": 4, "tone:hype": 3}, ["fame:solid"]),
                opt("可以，但别只有名场面", {"tone:drama": 3, "fame:hit": 2}, []),
                opt("更吃整体气质", {"tone:literary": 3, "tone:heal": 2}, ["tone:hype"]),
                opt("名场面不如结构漂亮", {"tone:mindbend": 4, "pace:dense": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "对「重制 / FD / 移植版」？",
            [
                opt("新画面重制更香", {"era:modern": 4, "fame:icon": 2}, ["era:classic"]),
                opt("原版气氛不可取代", {"era:classic": 4, "fame:icon": 2}, ["era:modern"]),
                opt("看具体作品", {"fame:hit": 3}, []),
                opt("更想碰正传本体", {"fame:icon": 2, "tone:drama": 1}, ["fame:solid"]),
            ],
        ),
        (
            "故事的叙述视角，你更喜欢？",
            [
                opt("亲密第一人称，像陪着角色", {"tone:sweet": 3, "tone:heal": 3}, ["tone:epic"]),
                opt("冷静旁观群像", {"tone:literary": 3, "tone:drama": 2}, ["tone:hype"]),
                opt("不可靠叙述、信息差", {"tone:mindbend": 5, "setting:mystery": 3}, ["tone:sweet"]),
                opt("史诗大视角推进", {"tone:epic": 5, "pace:dense": 2}, ["pace:breezy"]),
            ],
        ),
        (
            "结尾，你更想要什么？",
            [
                opt("明确甜、明朗", {"tone:sweet": 4, "tone:heal": 3}, ["tone:literary"]),
                opt("带伤但向前", {"tone:heal": 3, "tone:drama": 3}, ["tone:hype"]),
                opt("开放或余韵", {"tone:literary": 4, "tone:drama": 2}, ["tone:hype"]),
                opt("结构收束漂亮就行", {"tone:mindbend": 4, "pace:dense": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "用一个词形容你想要的 Gal？",
            [
                opt("可爱", {"tone:sweet": 5, "setting:school": 2, "pace:breezy": 2}, ["tone:epic", "tone:mindbend"]),
                opt("温柔", {"tone:heal": 5, "pace:short": 1}, ["tone:hype"]),
                opt("深刻", {"tone:drama": 3, "tone:literary": 4}, ["tone:hype", "pace:breezy"]),
                opt("聪明", {"tone:mindbend": 5, "setting:mystery": 2, "pace:dense": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "长途火车上，你会带哪种 Gal？",
            [
                opt("轻松不费脑", {"tone:sweet": 3, "pace:breezy": 4}, ["pace:dense"]),
                opt("短篇高密度情感", {"pace:short": 5, "tone:heal": 3}, ["pace:slowburn"]),
                opt("值得反复琢磨", {"tone:literary": 3, "tone:mindbend": 3}, ["tone:hype"]),
                opt("场面多、不易困", {"tone:hype": 4, "tone:epic": 2}, ["pace:slowburn"]),
            ],
        ),
        (
            "对经典关系位（妹 / 姐 / 青梅）？",
            [
                opt("就吃这套", {"tone:sweet": 4, "setting:school": 2, "setting:daily": 2}, ["tone:epic"]),
                opt("可以有，别只有标签", {"tone:drama": 2, "tone:heal": 2}, []),
                opt("更想非常规关系张力", {"tone:drama": 3, "tone:literary": 2}, ["tone:sweet"]),
                opt("位分不重要，结构和谜题重要", {"tone:mindbend": 4, "setting:mystery": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "「社团活动」戏份多少合适？",
            [
                opt("越多越好，校园感足", {"setting:school": 5, "tone:sweet": 2, "pace:breezy": 2}, ["setting:scifi"]),
                opt("适可而止", {"setting:school": 2, "tone:drama": 1}, []),
                opt("可以很少", {"setting:daily": 3, "setting:fantasy": 2}, ["setting:school"]),
                opt("社团只是异常事件入口", {"setting:mystery": 4, "setting:school": 2, "tone:mindbend": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "什么最容易劝退你？",
            [
                opt("太致郁", {"tone:sweet": 3, "tone:heal": 3}, ["tone:drama"]),
                opt("太注水", {"pace:short": 3, "pace:breezy": 2, "pace:dense": 2}, ["pace:slowburn"]),
                opt("逻辑崩", {"tone:mindbend": 3, "pace:dense": 2}, ["tone:hype"]),
                opt("演出过时", {"era:modern": 5}, ["era:classic"]),
            ],
        ),
        (
            "对「多周目结构」？",
            [
                opt("喜欢，愿意重读拼图", {"tone:mindbend": 4, "pace:dense": 2, "fame:hit": 1}, ["pace:short"]),
                opt("可以，但单周目也要完整", {"tone:drama": 3, "tone:heal": 2}, []),
                opt("更想单线一次讲完", {"pace:breezy": 3, "tone:sweet": 2}, ["pace:dense"]),
                opt("多周目若服务群像就加分", {"tone:epic": 2, "tone:drama": 2, "setting:mystery": 2}, []),
            ],
        ),
        (
            "战斗或动作戏，你需要吗？",
            [
                opt("不太需要", {"tone:sweet": 3, "tone:heal": 2, "setting:daily": 2}, ["tone:hype", "tone:epic"]),
                opt("有一点燃就好", {"tone:hype": 3, "pace:breezy": 1}, []),
                opt("要帅要大场面", {"tone:epic": 4, "tone:hype": 3}, ["tone:heal"]),
                opt("可以，但要服务设定", {"tone:mindbend": 3, "setting:scifi": 2, "setting:fantasy": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "旅行、转学这类「流动」情节？",
            [
                opt("喜欢夏日移动感", {"tone:heal": 3, "setting:daily": 2, "pace:breezy": 2}, ["setting:mystery"]),
                opt("喜欢因此改变关系", {"tone:drama": 4}, ["tone:hype"]),
                opt("喜欢因此打开异界", {"setting:fantasy": 4, "tone:epic": 2}, ["setting:school"]),
                opt("喜欢因此卷入事件", {"setting:mystery": 3, "tone:mindbend": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "对「旁白很多」的写法？",
            [
                opt("少旁白，多对话", {"tone:sweet": 2, "pace:breezy": 3}, ["tone:literary"]),
                opt("可以，帮助进情绪", {"tone:drama": 2, "tone:heal": 2}, []),
                opt("我吃长旁白", {"tone:literary": 5, "pace:slowburn": 2}, ["tone:hype"]),
                opt("旁白若在藏信息就好", {"tone:mindbend": 4, "pace:dense": 2}, ["pace:breezy"]),
            ],
        ),
        (
            "「夏天」作为默认季节？",
            [
                opt("夏日废萌可以", {"tone:sweet": 3, "pace:breezy": 3, "era:modern": 1}, ["tone:epic"]),
                opt("夏日感伤更对味", {"tone:heal": 3, "tone:drama": 3}, ["tone:hype"]),
                opt("季节不重要", {"fame:hit": 2}, []),
                opt("更想冬、雨、封闭感", {"setting:mystery": 3, "tone:literary": 2, "tone:mindbend": 2}, ["pace:breezy"]),
            ],
        ),
        (
            "女主很「强气」？",
            [
                opt("加分", {"tone:hype": 3, "tone:sweet": 2}, ["tone:literary"]),
                opt("看怎么写", {"tone:drama": 2}, []),
                opt("更想内敛细腻", {"tone:heal": 3, "tone:literary": 2}, ["tone:hype"]),
                opt("性格服务主题就好", {"tone:mindbend": 2, "tone:epic": 2}, []),
            ],
        ),
        (
            "对「超长共通线」？",
            [
                opt("能接受，想多相处", {"pace:slowburn": 4, "tone:sweet": 2}, ["pace:short"]),
                opt("共通短一点更好", {"pace:breezy": 3, "pace:short": 3}, ["pace:slowburn"]),
                opt("共通要有事件推进", {"tone:mindbend": 2, "tone:drama": 2, "pace:dense": 2}, ["tone:sweet"]),
                opt("无所谓，看整体", {"fame:hit": 2}, []),
            ],
        ),
        (
            "「异能战斗学园」这类设定？",
            [
                opt("感兴趣", {"setting:school": 2, "setting:fantasy": 3, "tone:hype": 3}, ["setting:daily"]),
                opt("可以一试", {"setting:fantasy": 2, "tone:epic": 2}, []),
                opt("更想纯爱日常", {"tone:sweet": 4, "setting:school": 3}, ["tone:epic", "setting:fantasy"]),
                opt("更想阴湿悬疑学园", {"setting:school": 2, "setting:mystery": 4, "tone:mindbend": 3}, ["tone:hype"]),
            ],
        ),
        (
            "角色「成长」和「魅力稳定」，你更吃哪个？",
            [
                opt("魅力稳定，别硬成长", {"tone:sweet": 3, "tone:hype": 2}, ["tone:literary"]),
                opt("要看到关系变化", {"tone:drama": 4, "tone:heal": 2}, []),
                opt("要主题层面的成长", {"tone:literary": 4, "tone:drama": 2}, ["tone:hype"]),
                opt("要认知被推翻的成长", {"tone:mindbend": 4, "tone:epic": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "「先虐后甜」的结构？",
            [
                opt("可以，但甜点要够", {"tone:heal": 4, "tone:drama": 3}, ["tone:epic"]),
                opt("别虐，直接甜", {"tone:sweet": 5}, ["tone:drama"]),
                opt("可以少甜，多真实", {"tone:drama": 4, "tone:literary": 2}, ["tone:sweet"]),
                opt("致郁若服务结构，可接受", {"tone:mindbend": 3, "tone:epic": 2, "tone:drama": 2}, ["tone:hype"]),
            ],
        ),
        (
            "对「超人气老名作」？",
            [
                opt("就想从名作入坑", {"fame:icon": 5, "era:classic": 2}, ["fame:solid"]),
                opt("名作可以，也想新一点", {"fame:icon": 2, "era:modern": 3}, []),
                opt("想避开被剧透过的", {"fame:solid": 4, "era:modern": 2}, ["fame:icon"]),
                opt("名作 + 硬核设定更香", {"fame:icon": 3, "tone:mindbend": 3, "tone:epic": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "剧情里专有名词很多，你能接受吗？",
            [
                opt("尽量别", {"tone:sweet": 2, "pace:breezy": 3}, ["pace:dense"]),
                opt("少量可以", {"tone:drama": 1, "pace:breezy": 1}, []),
                opt("我喜欢术语世界", {"pace:dense": 4, "tone:mindbend": 3, "setting:scifi": 2}, ["tone:sweet"]),
                opt("术语要美，像诗", {"tone:literary": 4, "setting:fantasy": 2}, ["tone:hype"]),
            ],
        ),
        (
            "「一章一个小高潮」的节奏？",
            [
                opt("喜欢，节奏明快", {"pace:breezy": 4, "tone:hype": 2}, ["pace:slowburn"]),
                opt("偶尔即可", {"tone:drama": 2, "pace:slowburn": 2}, []),
                opt("更想长线引爆", {"pace:slowburn": 4, "tone:drama": 2}, ["pace:breezy"]),
                opt("高潮要服务谜题翻转", {"tone:mindbend": 4, "pace:dense": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "你更想被怎样安利？",
            [
                opt("「超好玩超好笑」", {"tone:hype": 4, "tone:sweet": 3}, ["tone:literary"]),
                opt("「很治愈」", {"tone:heal": 5}, ["tone:epic"]),
                opt("「会哭」", {"tone:drama": 5}, ["tone:hype"]),
                opt("「看完会想讨论」", {"tone:mindbend": 4, "tone:literary": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "对世界「很大、很开放」的感觉？",
            [
                opt("不需要，线性更好", {"pace:breezy": 2, "tone:sweet": 2}, ["tone:epic"]),
                opt("有探索感加分", {"setting:fantasy": 3, "tone:hype": 2}, []),
                opt("要世界自己在运转", {"tone:epic": 4, "setting:fantasy": 2, "setting:scifi": 2}, ["setting:school"]),
                opt("世界感服务于阴谋", {"setting:mystery": 3, "tone:mindbend": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "如果只能留一种气质？",
            [
                opt("甜", {"tone:sweet": 5}, ["tone:epic", "tone:mindbend", "tone:drama"]),
                opt("暖", {"tone:heal": 5}, ["tone:hype", "tone:epic"]),
                opt("痛", {"tone:drama": 5}, ["tone:sweet", "tone:hype"]),
                opt("智", {"tone:mindbend": 5}, ["tone:sweet", "tone:hype"]),
            ],
        ),
        (
            "你今晚的耐心值？",
            [
                opt("很低，要好读", {"pace:breezy": 4, "pace:short": 3, "tone:sweet": 2}, ["pace:dense", "pace:slowburn"]),
                opt("中等，可认真一点", {"tone:drama": 2, "pace:breezy": 2}, []),
                opt("很高，可投入长线", {"pace:slowburn": 4, "tone:literary": 2}, ["pace:short"]),
                opt("高，且想要挑战", {"pace:dense": 4, "tone:mindbend": 3, "tone:epic": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "选作品时，你更信什么？",
            [
                opt("标签（甜 / 悬疑 / 校园）", {"tone:sweet": 1, "setting:school": 1, "setting:mystery": 1}, []),
                opt("口碑名作", {"fame:icon": 5}, ["fame:solid"]),
                opt("小众口碑", {"fame:solid": 4, "tone:literary": 2}, ["fame:icon"]),
                opt("自己的阅读直觉", {"tone:heal": 2, "tone:drama": 2, "tone:mindbend": 2}, []),
            ],
        ),
        (
            "开场很慢，你能忍吗？",
            [
                opt("不能忍", {"pace:breezy": 3, "pace:short": 3, "tone:hype": 2}, ["pace:slowburn"]),
                opt("可以，若人物可爱", {"tone:sweet": 3, "pace:slowburn": 2}, []),
                opt("可以，若在埋线", {"tone:mindbend": 3, "pace:slowburn": 3}, ["tone:hype"]),
                opt("我本来就喜欢慢热", {"pace:slowburn": 5, "tone:literary": 2}, ["pace:breezy"]),
            ],
        ),
        (
            "开场信息爆炸，你能接受吗？",
            [
                opt("不能忍", {"tone:sweet": 2, "pace:breezy": 3}, ["pace:dense"]),
                opt("可以，若很快爽到", {"tone:hype": 3, "pace:dense": 2}, []),
                opt("正想要这种", {"pace:dense": 5, "tone:mindbend": 3}, ["pace:breezy"]),
                opt("爆炸也要美", {"tone:literary": 3, "tone:epic": 3, "pace:dense": 2}, ["tone:hype"]),
            ],
        ),
        (
            "你更想「被选择」还是「去理解」？",
            [
                opt("被角色选中的恋爱感", {"tone:sweet": 5, "setting:school": 2}, ["tone:mindbend"]),
                opt("互相理解的过程", {"tone:heal": 3, "tone:drama": 3}, []),
                opt("理解世界的规则", {"tone:mindbend": 4, "setting:scifi": 2, "setting:mystery": 2}, ["tone:sweet"]),
                opt("理解冲突中的立场", {"tone:epic": 3, "tone:drama": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "关页面前，你希望是什么心情？",
            [
                opt("想笑着关掉", {"tone:hype": 3, "tone:sweet": 3}, ["tone:drama"]),
                opt("想平静关掉", {"tone:heal": 5}, ["tone:hype"]),
                opt("想带着情绪关掉", {"tone:drama": 4, "tone:literary": 2}, ["tone:hype"]),
                opt("想带着问题关掉", {"tone:mindbend": 5}, ["tone:sweet"]),
            ],
        ),
    ]
    for i, (prompt, options) in enumerate(situational, 1):
        bank.append(q(prompt, options, f"sit-{i}"))

    # —— 收束校准（自然问法，无「快问 / 附加」前缀）——
    closing = [
        (
            "此刻最想要什么甜度？",
            [
                opt("甜就行", {"tone:sweet": 5}, ["tone:mindbend", "tone:epic"]),
                opt("要暖", {"tone:heal": 5}, ["tone:hype"]),
                opt("要沉", {"tone:drama": 5}, ["tone:hype"]),
                opt("要烧脑", {"tone:mindbend": 5}, ["tone:sweet"]),
            ],
        ),
        (
            "舞台此刻更靠近哪边？",
            [
                opt("校园", {"setting:school": 5}, ["setting:scifi"]),
                opt("日常都市", {"setting:daily": 5}, ["setting:fantasy"]),
                opt("奇幻", {"setting:fantasy": 5}, ["setting:daily"]),
                opt("科幻", {"setting:scifi": 5}, ["setting:school"]),
            ],
        ),
        (
            "篇幅体感，你选哪种？",
            [
                opt("短", {"pace:short": 5}, ["pace:slowburn", "pace:dense"]),
                opt("中", {"pace:breezy": 5}, ["pace:dense"]),
                opt("长", {"pace:slowburn": 5}, ["pace:short"]),
                opt("密", {"pace:dense": 5}, ["pace:breezy"]),
            ],
        ),
        (
            "此刻最想避开什么？",
            [
                opt("避开虐", {"tone:sweet": 3, "tone:heal": 3}, ["tone:drama"]),
                opt("避开水", {"tone:drama": 2, "tone:mindbend": 2}, ["tone:sweet"]),
                opt("避开长", {"pace:short": 3, "pace:breezy": 3}, ["pace:slowburn"]),
                opt("避开老", {"era:modern": 5}, ["era:classic"]),
            ],
        ),
        (
            "此刻最想抓住什么？",
            [
                opt("抓住可爱", {"tone:sweet": 5}, ["tone:epic"]),
                opt("抓住情绪", {"tone:drama": 4, "tone:heal": 2}, ["tone:hype"]),
                opt("抓住悬念", {"tone:mindbend": 5, "setting:mystery": 2}, ["tone:sweet"]),
                opt("抓住场面", {"tone:hype": 4, "tone:epic": 3}, ["pace:slowburn"]),
            ],
        ),
        (
            "给今晚的推 Gal 定个调？",
            [
                opt("今晚要轻松", {"tone:sweet": 3, "pace:breezy": 3}, ["pace:dense"]),
                opt("今晚要认真", {"tone:drama": 3, "pace:slowburn": 2}, []),
                opt("今晚要刺激", {"tone:hype": 3, "tone:epic": 3}, ["tone:heal"]),
                opt("今晚要动脑", {"tone:mindbend": 5}, ["tone:sweet"]),
            ],
        ),
        (
            "开场前三分钟，标准是什么？",
            [
                opt("三分钟内要开心", {"tone:hype": 3, "tone:sweet": 3}, ["pace:slowburn"]),
                opt("三分钟内要安静", {"tone:heal": 4}, ["tone:hype"]),
                opt("三分钟内要有钩子", {"tone:mindbend": 3, "setting:mystery": 3}, ["tone:sweet"]),
                opt("三分钟内要有冲突", {"tone:drama": 3, "tone:epic": 2}, ["tone:heal"]),
            ],
        ),
        (
            "你会为了二周目吗？",
            [
                opt("很想二周目", {"tone:sweet": 3, "pace:breezy": 2, "setting:school": 2}, ["pace:dense"]),
                opt("一周目就够", {"pace:short": 3, "tone:heal": 2}, []),
                opt("为拼图二周目", {"tone:mindbend": 5, "pace:dense": 2}, ["tone:sweet"]),
                opt("为群像二周目", {"tone:drama": 2, "tone:epic": 2}, []),
            ],
        ),
        (
            "结局余味，你更想要什么？",
            [
                opt("明朗收束", {"tone:sweet": 3, "tone:heal": 3}, ["tone:literary"]),
                opt("释然留白", {"tone:heal": 3, "tone:drama": 2}, []),
                opt("长久余韵", {"tone:literary": 4, "tone:drama": 2}, ["tone:hype"]),
                opt("精巧反转", {"tone:mindbend": 4}, ["tone:sweet"]),
            ],
        ),
        (
            "什么情况下你会中途弃坑？",
            [
                opt("太吵太闹", {"tone:heal": 3, "tone:literary": 2}, ["tone:hype"]),
                opt("节奏太慢", {"pace:breezy": 3, "pace:short": 2}, ["pace:slowburn"]),
                opt("情感太浅", {"tone:drama": 3, "tone:literary": 2}, ["tone:sweet"]),
                opt("设定太乱", {"tone:mindbend": 2, "fame:icon": 1}, ["tone:hype"]),
            ],
        ),
        (
            "分支很多、选项很多，你怎么看？",
            [
                opt("喜欢，选择本身有趣", {"tone:sweet": 2, "pace:breezy": 2, "setting:school": 2}, ["pace:dense"]),
                opt("可以，但别为分支而分支", {"tone:drama": 3, "fame:hit": 1}, []),
                opt("更想作者帮我讲好一条线", {"tone:literary": 3, "pace:slowburn": 2}, ["tone:hype"]),
                opt("分支若服务谜题就加分", {"tone:mindbend": 4, "setting:mystery": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "主角是「普通人」还是「特殊存在」？",
            [
                opt("普通人更有代入感", {"setting:daily": 3, "tone:heal": 2, "setting:school": 2}, ["tone:epic"]),
                opt("都可以，看怎么写", {"tone:drama": 2, "fame:hit": 1}, []),
                opt("特殊能力或身份更带感", {"setting:fantasy": 3, "tone:epic": 2, "setting:scifi": 2}, ["setting:daily"]),
                opt("不可靠或异常的主角更有趣", {"tone:mindbend": 4, "setting:mystery": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "你更吃哪种女主类型？",
            [
                opt("可爱系、软萌系", {"tone:sweet": 5, "setting:school": 2}, ["tone:epic"]),
                opt("温柔系、治愈系", {"tone:heal": 4, "tone:drama": 1}, ["tone:hype"]),
                opt("强气系、有主见", {"tone:hype": 3, "tone:drama": 2}, ["tone:literary"]),
                opt("神秘系、难读懂", {"tone:mindbend": 3, "setting:mystery": 3}, ["tone:sweet"]),
            ],
        ),
        (
            "对「日常 → 突变」的转折？",
            [
                opt("喜欢，反差越大越上头", {"tone:hype": 3, "tone:mindbend": 3, "setting:mystery": 2}, ["tone:heal"]),
                opt("可以，但转折要有铺垫", {"tone:drama": 3, "pace:slowburn": 2}, []),
                opt("更想从头到尾一种气质", {"tone:heal": 3, "tone:sweet": 2, "pace:breezy": 2}, ["tone:epic"]),
                opt("突变若改变世界规则最香", {"setting:scifi": 3, "tone:epic": 3, "tone:mindbend": 2}, ["setting:school"]),
            ],
        ),
        (
            "你推 Gal 时，更常是什么状态？",
            [
                opt("放空，当背景陪伴", {"tone:heal": 3, "pace:breezy": 3, "tone:sweet": 2}, ["pace:dense"]),
                opt("专注，像在读小说", {"tone:literary": 3, "tone:drama": 2, "pace:slowburn": 2}, ["tone:hype"]),
                opt("追更，想知道后面怎样", {"tone:mindbend": 3, "tone:hype": 2}, ["pace:short"]),
                opt("沉浸，跟着角色一起紧张", {"tone:drama": 4, "tone:epic": 2}, ["pace:breezy"]),
            ],
        ),
        (
            "如果朋友问你「哪部适合入门」？",
            [
                opt("我会推轻松好笑的", {"tone:sweet": 3, "tone:hype": 3, "fame:icon": 2}, ["pace:dense"]),
                opt("我会推温柔短小的", {"tone:heal": 4, "pace:short": 3}, ["tone:epic"]),
                opt("我会推口碑扎实的", {"fame:icon": 4, "tone:drama": 2}, ["fame:solid"]),
                opt("我会推设定惊艳的", {"tone:mindbend": 4, "tone:epic": 2}, ["tone:sweet"]),
            ],
        ),
        (
            "你更想故事「像梦」还是「像真的」？",
            [
                opt("像梦，允许不现实", {"setting:fantasy": 4, "tone:sweet": 2, "tone:heal": 2}, ["setting:daily"]),
                opt("像真的，细节要落地", {"setting:daily": 4, "tone:drama": 2}, ["setting:fantasy"]),
                opt("真假交界最迷人", {"setting:mystery": 3, "tone:mindbend": 3}, ["tone:hype"]),
                opt("真假不重要，情绪要对", {"tone:drama": 3, "tone:heal": 2}, ["pace:dense"]),
            ],
        ),
        (
            "你更怕推完后有什么感受？",
            [
                opt("怕太闹，静不下来", {"tone:heal": 3, "mood:light": 2, "tone:literary": 2}, ["tone:hype"]),
                opt("怕太闷，推不动", {"tone:hype": 3, "pace:breezy": 3, "mood:light": 1}, ["pace:slowburn"]),
                opt("怕太浅，像没推过", {"tone:drama": 3, "focus:story": 2, "tone:literary": 3}, ["tone:sweet"]),
                opt("怕太乱，理不清", {"tone:mindbend": 2, "focus:mystery": 2, "pace:dense": 2, "fame:icon": 1}, ["tone:hype"]),
            ],
        ),
        (
            "推荐结果你更想看到哪种？",
            [
                opt("稳妥热门", {"fame:icon": 5, "era:modern": 1}, ["fame:solid"]),
                opt("热门里偏冷门", {"fame:hit": 4, "fame:solid": 2}, []),
                opt("个性小众", {"fame:solid": 5, "tone:literary": 2}, ["fame:icon"]),
                opt("硬核讨论向", {"tone:mindbend": 4, "tone:epic": 2, "fame:hit": 1}, ["tone:sweet"]),
            ],
        ),
        (
            "年代上，你现在更想试？",
            [
                opt("近五年新作", {"era:modern": 5}, ["era:classic"]),
                opt("2010 年代", {"era:modern": 3, "fame:hit": 2}, []),
                opt("2000 年代经典", {"era:classic": 4, "fame:icon": 2}, []),
                opt("越老越有味道", {"era:classic": 5, "fame:icon": 1}, ["era:modern"]),
            ],
        ),
        (
            "最后一题：你现在最缺什么？",
            [
                opt("缺一部能笑出来的", {"tone:hype": 4, "tone:sweet": 3}, ["tone:literary"]),
                opt("缺一部能安静下来的", {"tone:heal": 5}, ["tone:epic"]),
                opt("缺一部能哭一场的", {"tone:drama": 5}, ["tone:hype"]),
                opt("缺一部能烧脑的", {"tone:mindbend": 5, "pace:dense": 2}, ["tone:sweet"]),
            ],
        ),
    ]
    for i, (prompt, options) in enumerate(closing, 1):
        bank.append(q(prompt, options, f"close-{i}"))

    # 去重并截断到 100
    seen_text: set[str] = set()
    unique: list[dict] = []
    for item in bank:
        key = item["text"]
        if key in seen_text:
            continue
        seen_text.add(key)
        unique.append(item)
        if len(unique) >= 100:
            break

    for i, item in enumerate(unique, 1):
        item["id"] = f"Q{i:03d}"
    return unique
