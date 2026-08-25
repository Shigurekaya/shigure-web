/**
 * 萌新入坑推荐 — 样板题库（12 结果 × 双模式各 8 题）
 * 权重：+5 / +3 / +1，与 galgatest 思路相近的简化版
 */
const GAL_PICK_DATA = {
  meta: {
    resultCount: 12,
    questionsPerMode: 8,
    optionsPerQuestion: 4,
  },
  results: [
    {
      id: "R001",
      name: "千恋＊万花",
      subjectId: 172612,
      vibe: "moe",
      hook: "和风小镇 + 妖怪日常，甜度稳定、梗密集，几乎是当代废萌入坑默认答案。",
    },
    {
      id: "R002",
      name: "CLANNAD",
      subjectId: 13,
      vibe: "drama",
      hook: "校园日常慢慢铺开，家族线与成长线后劲极强，准备好纸巾。",
    },
    {
      id: "R003",
      name: "Summer Pockets",
      subjectId: 200763,
      vibe: "heal",
      hook: "海岛夏日与回忆碎片，氛围温柔，适合想被治愈而不是被吓到的萌新。",
    },
    {
      id: "R004",
      name: "命运石之门",
      subjectId: 3154,
      vibe: "sci",
      hook: "前半沙雕后半神展开，科幻悬疑爱好者的高转化率入坑作。",
    },
    {
      id: "R005",
      name: "魔女的夜宴",
      subjectId: 113290,
      vibe: "moe",
      hook: "柚子社招牌之一，角色魅力突出，恋爱喜剧节奏轻快。",
    },
    {
      id: "R006",
      name: "ATRI -My Dear Moments-",
      subjectId: 297264,
      vibe: "drama",
      hook: "短篇高精情感，机器人少女 × 末日海边，泪点集中、通关压力小。",
    },
    {
      id: "R007",
      name: "星光咖啡馆与死神之蝶",
      subjectId: 289599,
      vibe: "moe",
      hook: "咖啡馆舞台的温馨恋爱喜剧，音乐与角色台词都很讨喜。",
    },
    {
      id: "R008",
      name: "白色相簿2",
      subjectId: 22290,
      vibe: "drama",
      hook: "三角关系与情感拉扯的教科书，心理描写细到令人胃痛。",
    },
    {
      id: "R009",
      name: "樱之诗",
      subjectId: 22423,
      vibe: "literary",
      hook: "文学性极强的长篇，哲学与美学并重，适合愿意慢读的人。",
    },
    {
      id: "R010",
      name: "ISLAND",
      subjectId: 150191,
      vibe: "sci",
      hook: "孤岛悬疑开局，设定谜题多，喜欢反转的玩家会很过瘾。",
    },
    {
      id: "R011",
      name: "近月少女的礼仪",
      subjectId: 44123,
      vibe: "moe",
      hook: "女装校园喜剧名场面多，角色互动火花足，梗图传播度很高。",
    },
    {
      id: "R012",
      name: "水仙",
      subjectId: 1167,
      vibe: "literary",
      hook: "极简叙事与公路感，篇幅不长却余韵很长，适合想先试试水的轻度玩家。",
    },
  ],
  questions: {
    easy: [
      {
        id: 1,
        text: "第一次玩 Gal，你更想遇到怎样的开场？",
        options: [
          { label: "阳光校园 / 小镇日常，慢慢熟悉角色", weights: { R001: 5, R002: 5, R011: 3, R007: 3, R005: 1 } },
          { label: "一开场就有谜团或设定钩子", weights: { R004: 5, R010: 5, R006: 3, R008: 1 } },
          { label: "安静、文艺、像在看一部电影", weights: { R012: 5, R009: 5, R003: 3, R006: 1 } },
          { label: "海边 / 夏日 / 度假氛围", weights: { R003: 5, R006: 5, R007: 3, R001: 1 } },
        ],
      },
      {
        id: 2,
        text: "你能接受多长的故事？",
        options: [
          { label: "短篇最好，几小时能打完", weights: { R012: 5, R006: 5, R003: 3 } },
          { label: "中等篇幅，一个周末左右", weights: { R001: 5, R005: 5, R007: 3, R010: 3 } },
          { label: "长篇也无所谓，故事好就行", weights: { R002: 5, R009: 5, R008: 3, R004: 3 } },
          { label: "越长越爽，想当马拉松玩家", weights: { R009: 5, R002: 3, R008: 3, R004: 1 } },
        ],
      },
      {
        id: 3,
        text: "你更吃哪种情绪体验？",
        options: [
          { label: "甜甜恋爱、轻松搞笑", weights: { R001: 5, R005: 5, R007: 5, R011: 3 } },
          { label: "温暖治愈、有点感伤但最后是光", weights: { R003: 5, R002: 3, R006: 5, R012: 3 } },
          { label: "胃疼、纠结、虐心也行", weights: { R008: 5, R002: 3, R004: 3, R009: 1 } },
          { label: "烧脑悬疑、设定党狂欢", weights: { R004: 5, R010: 5, R008: 1 } },
        ],
      },
      {
        id: 4,
        text: "对「科幻 / 奇幻」元素的接受度？",
        options: [
          { label: "越低越好，只想看现实恋爱", weights: { R002: 5, R008: 5, R011: 5, R001: 3 } },
          { label: "轻度奇幻可以（妖怪、小镇传说）", weights: { R001: 5, R005: 3, R007: 3, R003: 1 } },
          { label: "时间旅行、世界线之类很酷", weights: { R004: 5, R010: 3, R006: 3 } },
          { label: "越怪越有意思", weights: { R010: 5, R004: 3, R009: 3 } },
        ],
      },
      {
        id: 5,
        text: "你更像哪种玩家？",
        options: [
          { label: "全员可爱就行，我全都要", weights: { R001: 5, R005: 5, R007: 3, R011: 3 } },
          { label: "会认真走一条线，吃角色成长", weights: { R002: 5, R006: 5, R003: 3, R012: 3 } },
          { label: "喜欢品味台词和文学性", weights: { R009: 5, R012: 5, R008: 3 } },
          { label: "追求名场面和话题性", weights: { R011: 5, R008: 5, R004: 3, R001: 1 } },
        ],
      },
      {
        id: 6,
        text: "雷点自查：你最想避开？",
        options: [
          { label: "过度沉重 / 致郁到受不了", weights: { R001: 5, R005: 5, R007: 5, R003: 3 } },
          { label: "太慢热、前期几乎没爆点", weights: { R004: 5, R010: 5, R011: 3, R001: 3 } },
          { label: "太萌太废，想看严肃剧情", weights: { R009: 5, R012: 5, R008: 3, R002: 3 } },
          { label: "三角恋拉扯（我会真情实感生气）", weights: { R003: 5, R006: 5, R001: 3, R005: 3 } },
        ],
      },
      {
        id: 7,
        text: "如果推荐作有动画 / 话题热度，你会？",
        options: [
          { label: "更想先入坑原作游戏", weights: { R002: 5, R004: 5, R001: 3, R008: 3 } },
          { label: "无所谓，游戏本身好玩就行", weights: { R009: 5, R012: 5, R010: 3, R006: 3 } },
          { label: "希望是近几年口碑作", weights: { R006: 5, R007: 5, R003: 3, R005: 3 } },
          { label: "经典老作品更能接受", weights: { R002: 3, R012: 5, R008: 3, R004: 3 } },
        ],
      },
      {
        id: 8,
        text: "最后一题：你希望第一款 Gal 给你什么印象？",
        options: [
          { label: "原来 Gal 可以这么好笑", weights: { R001: 5, R011: 5, R005: 3, R007: 3 } },
          { label: "原来 Gal 可以这么好哭", weights: { R002: 5, R006: 5, R003: 3, R012: 3 } },
          { label: "原来 Gal 可以这么帅这么燃", weights: { R004: 5, R010: 3, R008: 3 } },
          { label: "原来 Gal 可以这么美这么有味道", weights: { R009: 5, R012: 5, R003: 1 } },
        ],
      },
    ],
    hard: [
      {
        id: 1,
        text: "深夜推 Gal，你更可能继续玩下去的原因是？",
        options: [
          { label: "下一段日常还要确认角色关系变化", weights: { R002: 5, R008: 5, R011: 3 } },
          { label: "世界观谜团还差一块拼图", weights: { R004: 5, R010: 5, R009: 3 } },
          { label: "下一句台词可能是名场面", weights: { R001: 5, R011: 5, R005: 3 } },
          { label: "配乐和氛围让人舍不得关", weights: { R003: 5, R012: 5, R006: 3, R009: 3 } },
        ],
      },
      {
        id: 2,
        text: "你能接受「先甜后刀」的结构吗？",
        options: [
          { label: "完全不行，请一直对我温柔", weights: { R001: 5, R005: 5, R007: 5, R003: 3 } },
          { label: "可以刀，但请给我明确救赎", weights: { R002: 5, R006: 5, R003: 3 } },
          { label: "刀越深越好，我扛得住", weights: { R008: 5, R009: 3, R004: 3 } },
          { label: "我更在意逻辑自洽而不是甜或刀", weights: { R004: 5, R010: 5, R009: 5 } },
        ],
      },
      {
        id: 3,
        text: "角色塑造你更看重？",
        options: [
          { label: "反差萌 + 高密度可爱台词", weights: { R001: 5, R005: 5, R011: 5 } },
          { label: "成长弧光与家庭 / 羁绊", weights: { R002: 5, R003: 3, R006: 3 } },
          { label: "复杂人性与情感博弈", weights: { R008: 5, R009: 5, R004: 1 } },
          { label: "神秘感和设定承载", weights: { R010: 5, R004: 5, R006: 3 } },
        ],
      },
      {
        id: 4,
        text: "以下哪种「节奏」你最买帐？",
        options: [
          { label: "开局就有趣，不废话", weights: { R011: 5, R001: 5, R004: 3 } },
          { label: "慢热铺垫，后期爆发", weights: { R002: 5, R009: 5, R008: 3 } },
          { label: "短篇高密度，一气呵成", weights: { R012: 5, R006: 5, R010: 3 } },
          { label: "日常占比高，偶尔神来一笔", weights: { R003: 5, R007: 5, R005: 3 } },
        ],
      },
      {
        id: 5,
        text: "如果必须选一种「主题」，你会选？",
        options: [
          { label: "家族与传承", weights: { R002: 5, R009: 3, R003: 1 } },
          { label: "恋爱与身份认同", weights: { R011: 5, R008: 5, R001: 3 } },
          { label: "科幻伦理与时间", weights: { R004: 5, R006: 5, R010: 3 } },
          { label: "存在与记忆", weights: { R012: 5, R009: 5, R003: 3 } },
        ],
      },
      {
        id: 6,
        text: "你对 H 内容的预期？（样板题，按游玩态度作答）",
        options: [
          { label: "全年龄 / 淡化或无", weights: { R003: 5, R006: 5, R012: 5, R004: 3 } },
          { label: "有也行，但别影响剧情", weights: { R002: 5, R007: 5, R008: 3, R009: 3 } },
          { label: "商业作默认配置，无所谓", weights: { R001: 5, R005: 5, R011: 3 } },
          { label: "更在意剧本完成度而非尺度", weights: { R009: 5, R010: 5, R004: 3 } },
        ],
      },
      {
        id: 7,
        text: "朋友安利时，哪种话术最容易打动你？",
        options: [
          { label: "这部梗图超多，不玩跟不上群聊", weights: { R001: 5, R011: 5, R005: 3 } },
          { label: "这部神展开，后面全是伏笔", weights: { R004: 5, R010: 5, R008: 1 } },
          { label: "这部文学性很强，像读了本小说", weights: { R009: 5, R012: 5, R002: 3 } },
          { label: "这部很治愈，适合心情不好时玩", weights: { R003: 5, R006: 5, R007: 3 } },
        ],
      },
      {
        id: 8,
        text: "通关后你更希望产生哪种冲动？",
        options: [
          { label: "立刻开二周目走别的角色线", weights: { R001: 5, R005: 5, R007: 5 } },
          { label: "去找解析 / 访谈，搞懂所有伏笔", weights: { R004: 5, R010: 5, R009: 3 } },
          { label: "发呆很久，回味情绪", weights: { R012: 5, R006: 5, R008: 3, R002: 3 } },
          { label: "截图安利给朋友，拉人入坑", weights: { R011: 5, R003: 3, R001: 3 } },
        ],
      },
    ],
  },
};
