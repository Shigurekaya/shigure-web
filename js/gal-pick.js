/**
 * Gal缘结 v8.4 — 弹性题量 + trait 向量匹配（分数驱动池收窄 + 同分收尾）
 */
(() => {
  /** @type {typeof GAL_PICK_DATA | null} */
  let DATA = typeof GAL_PICK_DATA !== "undefined" ? GAL_PICK_DATA : null;
  /** @type {(() => void) | null} */
  let pendingCatalog = null;
  let catalogReady = false;
  /** 选题动画未提交时递增，用于作废过期 setTimeout */
  let advanceGen = 0;
  /** 换题后短时吞掉触控幽灵点击，避免连跳两题 */
  let pickInputCooldownUntil = 0;
  let bootBound = false;
  let scrollPerfBound = false;

  const MIN_ANSWERS = 6;
  const MIN_ANSWERS_STRICT = 8;
  const MAX_SKIPS = 10;
  const CORE_CATEGORIES = new Set(["core", "horror"]);
  const REDUCED_MOTION = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CATEGORY_BADGE = {
    core: "基础取向",
    horror: "接受度",
  };

  const TONE_GRADIENT = {
    sweet: "linear-gradient(145deg, #ffd8ec 0%, #fff5fa 55%, #f3eeff 100%)",
    heal: "linear-gradient(145deg, #d4f5e8 0%, #f0fff8 55%, #eef8ff 100%)",
    drama: "linear-gradient(145deg, #e8dff5 0%, #f5f0ff 55%, #fce8f0 100%)",
    mindbend: "linear-gradient(145deg, #dce4ff 0%, #eef2ff 55%, #e8f0ff 100%)",
    epic: "linear-gradient(145deg, #ffe8cc 0%, #fff6e8 55%, #ffeef5 100%)",
    hype: "linear-gradient(145deg, #ffe0c8 0%, #fff3e6 55%, #fff8dc 100%)",
    literary: "linear-gradient(145deg, #e6e2dc 0%, #f7f4ef 55%, #eeeaf5 100%)",
    utsuge: "linear-gradient(145deg, #ddd8e8 0%, #f0edf5 55%, #e8eaf5 100%)",
  };

  const AXIS_WEIGHT = {
    tone: 1.18,
    setting: 1.06,
    pace: 0.96,
    era: 0.58,
    fame: 0.52,
    focus: 1.12,
    entry: 1.02,
    mood: 0.92,
    routes: 0.78,
    appeal: 0.92,
    cast: 0.68,
    playstyle: 0.72,
  };

  const AFFINITY = {
    /* 甜↔燃 不互跳：否则拔作/搞笑会因 hype 亲和度误占「甜」榜首 */
    "tone:sweet": ["tone:heal", "appeal:moe"],
    "tone:heal": ["tone:sweet", "mood:light"],
    "tone:drama": ["tone:literary", "tone:heal", "appeal:nakige"],
    "tone:literary": ["tone:drama", "tone:mindbend", "appeal:literary"],
    "tone:mindbend": ["tone:literary", "tone:epic", "appeal:mystery", "appeal:horror"],
    "tone:epic": ["tone:drama", "tone:mindbend", "appeal:action"],
    "tone:hype": ["tone:epic", "appeal:comedy", "mood:light"],
    "tone:utsuge": ["tone:drama", "tone:literary", "appeal:utsuge", "mood:heavy"],
    "setting:school": ["setting:daily", "focus:romance"],
    "setting:daily": ["setting:school"],
    "setting:fantasy": ["setting:scifi", "playstyle:rpg"],
    "setting:scifi": ["setting:fantasy", "setting:mystery"],
    "setting:mystery": ["setting:scifi", "focus:mystery"],
    "pace:short": ["pace:breezy", "playstyle:vn"],
    "pace:breezy": ["pace:short", "pace:slowburn", "playstyle:adv"],
    "pace:slowburn": ["pace:breezy", "pace:dense"],
    "pace:dense": ["pace:slowburn", "routes:puzzle"],
    "focus:romance": ["appeal:moe", "cast:harem"],
    "focus:story": ["tone:drama", "appeal:nakige", "cast:ensemble"],
    "focus:world": ["tone:epic", "appeal:action"],
    "focus:mystery": ["tone:mindbend", "appeal:mystery"],
    "entry:easy": ["pace:breezy", "fame:icon"],
    "entry:deep": ["tone:literary", "appeal:literary", "pace:dense"],
    "appeal:comedy": ["tone:hype", "mood:light"],
    "appeal:nakige": ["tone:drama", "mood:bittersweet"],
    "appeal:utsuge": ["tone:utsuge", "mood:heavy"],
    "appeal:horror": ["tone:mindbend", "mood:heavy"],
    "appeal:meta": ["routes:puzzle", "tone:mindbend"],
    "appeal:mystery": ["focus:mystery", "routes:puzzle"],
    "playstyle:adv": ["routes:multi", "pace:breezy"],
    "playstyle:vn": ["routes:single", "pace:short"],
    "playstyle:rpg": ["tone:epic", "appeal:action"],
    "playstyle:sim": ["cast:harem", "pace:breezy"],
    "playstyle:hybrid": ["playstyle:rpg", "playstyle:adv"],
  };

  /** 同维可并存的邻近值（其余同维高权重会互斥衰减） */
  const AXIS_SOFT_NEIGHBORS = {
    tone: {
      sweet: ["heal"],
      heal: ["sweet", "drama"],
      drama: ["heal", "literary", "utsuge"],
      literary: ["drama", "mindbend"],
      mindbend: ["literary", "epic"],
      epic: ["drama", "mindbend", "hype"],
      hype: ["epic"],
      utsuge: ["drama", "literary"],
    },
    mood: {
      light: ["bittersweet"],
      bittersweet: ["light", "heavy"],
      heavy: ["bittersweet"],
    },
  };

  /** 调参时：拉高某 tone 则对明确对立轴施加软惩罚（负向「不要」） */
  const TONE_SOFT_AVOID = {
    sweet: ["utsuge", "mindbend"],
    heal: ["utsuge"],
    hype: ["utsuge", "literary"],
    utsuge: ["sweet", "heal", "hype"],
    mindbend: ["sweet", "hype"],
    epic: ["sweet"],
    literary: ["hype", "sweet"],
    drama: ["hype"],
  };

  const IMPLIED = {
    "tone:sweet": ["focus:romance", "mood:light", "appeal:moe"],
    "tone:heal": ["focus:story", "mood:light", "entry:easy"],
    "tone:hype": ["focus:romance", "appeal:comedy"],
    "tone:drama": ["focus:story", "mood:bittersweet", "appeal:nakige"],
    "tone:literary": ["focus:story", "mood:heavy", "entry:deep", "appeal:literary"],
    "tone:mindbend": ["focus:mystery", "routes:puzzle", "appeal:mystery"],
    "tone:epic": ["focus:world", "mood:heavy", "appeal:action"],
    "tone:utsuge": ["mood:heavy", "appeal:utsuge", "entry:deep"],
    "setting:school": ["focus:romance"],
    "setting:mystery": ["focus:mystery", "appeal:mystery"],
    "pace:short": ["entry:easy", "playstyle:vn"],
    "pace:dense": ["entry:deep", "routes:puzzle"],
    "fame:icon": ["entry:easy"],
    "entry:easy": ["fame:icon"],
    "appeal:horror": ["mood:heavy"],
    "appeal:meta": ["routes:puzzle"],
  };

  const LABELS = {
    tone: { sweet: "甜", heal: "治愈", drama: "致郁", mindbend: "悬疑", epic: "史诗", hype: "燃", literary: "文学", utsuge: "郁" },
    setting: { school: "校园", daily: "日常", fantasy: "奇幻", scifi: "科幻", mystery: "谜团" },
    pace: { short: "短篇", breezy: "轻快", slowburn: "慢热", dense: "硬核" },
    era: { classic: "经典年代", modern: "近年" },
    fame: { icon: "殿堂", hit: "热门", solid: "扎实" },
    focus: { romance: "恋爱", story: "叙事", world: "世界观", mystery: "解谜" },
    entry: { easy: "入坑向", standard: "均衡", deep: "深度向" },
    mood: { light: "轻松", bittersweet: "余味", heavy: "沉重" },
    routes: { single: "单线", multi: "多线", puzzle: "拼图" },
    appeal: { comedy: "搞笑", nakige: "催泪", utsuge: "郁", horror: "恐怖", meta: "Meta", mystery: "悬疑", action: "动作", literary: "文学", moe: "萌" },
    cast: { solo: "单女主", harem: "后宫", ensemble: "群像" },
    playstyle: { adv: "ADV", vn: "视觉小说", sim: "养成", rpg: "RPG", hybrid: "混合" },
  };

  const MANUAL_GROUP_LABELS = {
    tone: "基调",
    setting: "场景",
    pace: "节奏",
    era: "年代",
    fame: "知名度",
    appeal: "元素",
    focus: "重心",
    mood: "氛围",
    entry: "难度",
    routes: "线路",
    cast: "角色",
    playstyle: "玩法",
  };

  const MANUAL_DIMS = ["tone", "setting", "pace", "era", "fame", "appeal", "focus", "mood", "entry", "routes", "cast", "playstyle"];
  const MANUAL_SLIDER_MAX = 10;
  /** 滑条 10 → boost 5，与答题选项量级一致 */
  const MANUAL_BOOST_SCALE = 0.5;

  const manualState = {
    prefs: Object.create(null),
    refreshTimer: 0,
    /** 指针/触控拖动滑条期间禁止重算推荐 */
    sliding: false,
    /** 最近一次已渲染的偏好签名，避免松手双事件重复整块重绘 */
    lastRenderedSig: null,
  };

  const REASON_LABEL = {
    "tone:sweet": "甜度合你",
    "tone:heal": "治愈感",
    "tone:drama": "情感深度",
    "tone:mindbend": "烧脑气质",
    "tone:epic": "大场面",
    "tone:hype": "轻松搞笑",
    "tone:literary": "文学性",
    "tone:utsuge": "郁系气质",
    "setting:school": "校园舞台",
    "setting:daily": "日常系",
    "setting:fantasy": "幻想世界",
    "setting:scifi": "科幻设定",
    "setting:mystery": "谜团氛围",
    "pace:short": "篇幅友好",
    "pace:breezy": "节奏轻快",
    "pace:slowburn": "慢热叙事",
    "pace:dense": "信息密度高",
    "focus:romance": "恋爱向",
    "focus:story": "故事驱动",
    "focus:world": "世界观",
    "focus:mystery": "解谜向",
    "entry:easy": "入坑友好",
    "entry:standard": "难度均衡",
    "entry:deep": "深度向",
    "mood:light": "轻松心情",
    "mood:bittersweet": "余味",
    "mood:heavy": "厚重感",
    "routes:single": "单线",
    "routes:multi": "多线",
    "routes:puzzle": "拼图结构",
    "era:classic": "经典年代",
    "era:modern": "近年作品",
    "fame:icon": "殿堂级",
    "fame:hit": "热门",
    "fame:solid": "口碑扎实",
    "appeal:comedy": "喜剧感",
    "appeal:nakige": "催泪",
    "appeal:utsuge": "郁系",
    "appeal:horror": "恐怖氛围",
    "appeal:meta": "Meta 叙事",
    "appeal:mystery": "悬疑",
    "appeal:action": "动作场面",
    "appeal:moe": "萌系",
    "appeal:literary": "文学性",
    "cast:solo": "单女主",
    "cast:harem": "多角色",
    "cast:ensemble": "群像",
    "playstyle:adv": "分支 ADV",
    "playstyle:vn": "视觉小说",
    "playstyle:sim": "养成玩法",
    "playstyle:rpg": "RPG 玩法",
    "playstyle:hybrid": "混合玩法",
  };

  const els = {};
  let tagIdf = () => 1;
  let games = [];
  let optionKeyHandler = null;
  /** @type {ReturnType<typeof rankList> | null} */
  let cachedAliveRank = null;
  let cachedAliveRankGen = 0;
  let rankCacheGen = 0;

  const state = {
    index: 0,
    answered: 0,
    skipped: 0,
    boost: Object.create(null),
    penalty: Object.create(null),
    drops: new Set(),
    alive: [],
    asked: new Set(),
    skippedIds: new Set(),
    stagnantAlive: 0,
    /** @type {'quiz'|'single'|'auto'|'early'|'random'} */
    finishMode: "quiz",
  };

  function getData() {
    if (DATA?.games?.length && DATA?.questions?.length) return DATA;
    if (typeof GAL_PICK_DATA !== "undefined" && GAL_PICK_DATA?.games?.length && GAL_PICK_DATA?.questions?.length) {
      DATA = GAL_PICK_DATA;
    }
    return DATA;
  }

  function ensureCatalog() {
    const d = getData();
    if (!d) return false;
    if (!catalogReady) {
      games = dedupeGames(d.games);
      initTagIdf(games);
      if (els.lead && d.meta?.subtitle) {
        els.lead.textContent = d.meta.subtitle;
        els.lead.hidden = !d.meta.subtitle.trim();
      }
      catalogReady = true;
    }
    return true;
  }

  function whenCatalogReady(fn) {
    if (ensureCatalog()) {
      fn();
      return;
    }
    pendingCatalog = fn;
    setIntroBusy(true);
  }

  function onDataLoaded() {
    if (!ensureCatalog()) {
      console.error("[gal-pick] GAL_PICK_DATA missing or empty");
      onDataLoadFailed();
      return;
    }
    setIntroBusy(false);
    const hint = els.panel?.querySelector(".pick-intro-hint");
    if (hint && games.length) {
      hint.textContent = `题库约 ${games.length} 部`;
    }
    if (pendingCatalog) {
      const run = pendingCatalog;
      pendingCatalog = null;
      run();
    }
  }

  function onDataLoadFailed() {
    pendingCatalog = null;
    setIntroBusy(false);
    const hint = els.panel?.querySelector(".pick-intro-hint");
    if (hint) {
      hint.textContent = "题库加载失败，请刷新页面重试";
    } else if (els.lead) {
      els.lead.textContent = "题库加载失败，请刷新页面重试";
    }
  }

  function setIntroBusy(busy) {
    const start = els.panel?.querySelector("[data-pick-start]");
    const random = els.panel?.querySelector("[data-pick-random]");
    const manual = els.panel?.querySelector("[data-pick-manual]");
    [start, random, manual].forEach((btn) => {
      if (btn) btn.disabled = busy;
    });
    const title = start?.querySelector(".pick-mode-card__title");
    if (title) title.textContent = busy ? "加载题库…" : "开始答题";
    els.panel?.classList.toggle("is-busy", !!busy);
  }

  function cancelPendingAdvance() {
    advanceGen += 1;
  }

  function lockQuestionActions(box) {
    if (box) box.dataset.lock = "1";
    clearOptionKeys();
    els.panel?.querySelectorAll("[data-pick-skip], [data-pick-finish]").forEach((btn) => {
      btn.disabled = true;
    });
  }

  function initScrollPerf() {
    if (scrollPerfBound) return;
    scrollPerfBound = true;
    let scrollTimer = 0;
    window.addEventListener("scroll", () => {
      if (!scrollTimer) document.body.classList.add("pick-is-scrolling");
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        document.body.classList.remove("pick-is-scrolling");
        scrollTimer = 0;
      }, 120);
    }, { passive: true });
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function initTagIdf(games) {
    const df = Object.create(null);
    games.forEach((g) => {
      Object.keys(g.traits || {}).forEach((k) => {
        df[k] = (df[k] || 0) + 1;
      });
    });
    const n = games.length;
    tagIdf = (k) => Math.log((n + 1) / ((df[k] || 0) + 1)) + 0.82;
  }

  function tagOf(game, axisKey) {
    const [dim, val] = axisKey.split(":");
    if (!dim || !val) return false;
    if (game[dim] === val) return true;
    return false;
  }

  function invalidateRankCache() {
    rankCacheGen += 1;
    cachedAliveRank = null;
  }

  function poolUncertainty(rankedIn) {
    const ranked = rankedIn || rankAlive();
    if (ranked.length <= 2) return 0;
    const top = ranked[0].score;
    const gap1 = top - ranked[1].score;
    const gap2 = ranked.length > 2 ? ranked[1].score - ranked[2].score : gap1;
    const band = ranked.slice(0, Math.min(12, ranked.length));
    const spread = top - band[band.length - 1].score;
    const gapScore = Math.max(0, 1 - gap1 / 5.5) * 0.55 + Math.max(0, 1 - gap2 / 3.5) * 0.25;
    const spreadScore = Math.min(1, spread / 7) * 0.2;
    const sizeScore = Math.min(1, state.alive.length / 120) * 0.15;
    return Math.min(1, gapScore + spreadScore + sizeScore);
  }

  function poolShrinkRatio() {
    if (!games.length) return 0;
    return 1 - state.alive.length / games.length;
  }

  /** 综合匹配进度：置信度 + 池缩小 + 分差 + 候选规模 */
  function poolProgress() {
    const ranked = rankAlive();
    const conf = matchConfidence(ranked);
    const shrink = poolShrinkRatio();
    const aliveFactor = state.alive.length <= 1
      ? 1
      : 1 - Math.min(1, state.alive.length / Math.max(games.length, 1));
    const g1 = ranked.length > 1 ? ranked[0].score - ranked[1].score : 3;
    const gapFactor = Math.min(1, g1 / 3.5);
    return Math.min(1, conf * 0.42 + shrink * 0.28 + aliveFactor * 0.18 + gapFactor * 0.12);
  }

  function matchConfidence(ranked) {
    if (!ranked.length) return 0;
    if (ranked.length === 1) return 1;
    const gap1 = ranked[0].score - ranked[1].score;
    const gap2 = ranked.length > 2 ? ranked[1].score - ranked[2].score : gap1 * 0.6;
    const rel = gap1 / (Math.abs(ranked[0].score) + 1e-5);
    return Math.min(1, gap1 / 6 + rel * 0.35 + Math.min(gap2, 3) / 8);
  }

  function preferenceGaps() {
    const axes = Object.create(null);
    state.alive.slice(0, 80).forEach((g) => {
      Object.entries(g.traits || {}).forEach(([k, v]) => {
        if (v >= 0.35) axes[k] = (axes[k] || 0) + v;
      });
    });
    return Object.entries(axes)
      .filter(([k]) => !(state.boost[k] > 0.5))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([k]) => k);
  }

  function questionTargets(q) {
    const keys = new Set();
    (q.options || []).forEach((opt) => {
      Object.keys(opt.boost || {}).forEach((k) => keys.add(k));
      (opt.drop || []).forEach((k) => keys.add(k));
    });
    return keys;
  }

  function questionRelevance(q, gaps = null) {
    const gapKeys = gaps || preferenceGaps();
    const targets = questionTargets(q);
    let hit = 0;
    targets.forEach((k) => {
      if (gapKeys.includes(k)) hit += 1;
    });
    if (q.category === "horror" && !(state.boost["appeal:horror"] > 0)) hit += 1.5;
    if (q.category === "core") hit += 0.5;
    return hit;
  }

  function traitStrength(game, axisKey) {
    const [dim, val] = axisKey.split(":");
    const related = AFFINITY[axisKey] || [];
    const t = game.traits?.[axisKey];
    /* 主轴不一致：禁止无关 tone 冒充；邻近主轴（甜→heal）用本轴强度 */
    if (dim === "tone" && val && game.tone && game.tone !== val) {
      const own = `tone:${game.tone}`;
      if (!related.includes(own)) return 0;
      const rt = game.traits?.[own];
      const viaOwn = rt != null && rt > 0 ? rt * 0.72 : tagOf(game, own) ? 0.62 : 0;
      const soft = t != null && t > 0 ? t : 0;
      return Math.max(viaOwn, soft);
    }
    if (t != null && t > 0) return t;
    if (tagOf(game, axisKey)) return 0.9;
    for (let i = 0; i < related.length; i += 1) {
      const rt = game.traits?.[related[i]];
      if (rt != null && rt > 0) return rt * 0.46;
      if (tagOf(game, related[i])) return 0.4;
    }
    return 0;
  }

  function traitCosine(a, b) {
    const keys = new Set([...Object.keys(a.traits || {}), ...Object.keys(b.traits || {})]);
    let dot = 0;
    let na = 0;
    let nb = 0;
    keys.forEach((k) => {
      const va = a.traits?.[k] || 0;
      const vb = b.traits?.[k] || 0;
      dot += va * vb;
      na += va * va;
      nb += vb * vb;
    });
    return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-6);
  }

  /**
   * 同维多项高权重（如甜+郁）时：优先保留与作品主轴一致的那一项，其余对立项强衰减。
   * @param {Record<string, number>} boost
   * @param {{ tone?: string, setting?: string, pace?: string, mood?: string }} [game]
   */
  function competeSameDimBoost(boost, game = null) {
    const byDim = Object.create(null);
    Object.entries(boost).forEach(([axis, w]) => {
      if (!(w > 0)) return;
      const [dim, val] = axis.split(":");
      if (!dim || !val) return;
      (byDim[dim] || (byDim[dim] = [])).push({ axis, dim, val, w });
    });
    const out = Object.create(null);
    Object.keys(boost).forEach((k) => {
      out[k] = boost[k];
    });
    Object.entries(byDim).forEach(([dim, entries]) => {
      if (entries.length < 2) return;
      const maxW = Math.max(...entries.map((e) => e.w));
      const neighbors = AXIS_SOFT_NEIGHBORS[dim] || null;
      const gameVal = game && game[dim] ? String(game[dim]) : null;
      entries.forEach((e) => {
        if (gameVal) {
          if (e.val === gameVal) {
            out[e.axis] = e.w;
            return;
          }
          const compat = neighbors?.[gameVal]?.includes(e.val);
          out[e.axis] = e.w * (compat ? 0.55 : 0.12);
          return;
        }
        const peers = entries.filter((o) => o.axis !== e.axis);
        let factor = 1;
        peers.forEach((o) => {
          const compat = neighbors?.[e.val]?.includes(o.val) || neighbors?.[o.val]?.includes(e.val);
          if (compat) {
            factor = Math.min(factor, 0.92);
            return;
          }
          const rel = e.w / (maxW + 1e-6);
          const peerRel = o.w / (maxW + 1e-6);
          if (peerRel >= 0.55) factor = Math.min(factor, 0.38 + 0.22 * rel);
        });
        out[e.axis] = e.w * factor;
      });
    });
    return out;
  }

  function scoreGame(game, boost = state.boost, penalty = state.penalty) {
    let dot = 0;
    let u2 = 0;
    let g2 = 0;
    let strongHits = 0;
    const effBoost = competeSameDimBoost(boost, game);
    const toneBoostKeys = Object.keys(effBoost).filter((k) => k.startsWith("tone:") && effBoost[k] > 0);
    const toneIdfFloor = toneBoostKeys.length >= 2
      ? Math.min(...toneBoostKeys.map((k) => tagIdf(k)))
      : null;

    Object.entries(effBoost).forEach(([axis, w]) => {
      if (w <= 0) return;
      const [dim, val] = axis.split(":");
      const idf = dim === "tone" && toneIdfFloor != null ? toneIdfFloor : tagIdf(axis);
      const iw = idf * axisWeight(axis);
      const tw = w * iw;
      u2 += tw * tw;
      let gv = traitStrength(game, axis);
      /* 主轴 tone 冲突时不再用 IMPLIED（恋爱/轻松等）抬分，避免拔作蹭甜 */
      const toneMismatch = dim === "tone" && val && game.tone && game.tone !== val;
      if (!toneMismatch) {
        (IMPLIED[axis] || []).forEach((imp) => {
          gv = Math.max(gv, traitStrength(game, imp) * 0.72);
        });
      }
      if (gv >= 0.48) strongHits += 1;
      dot += tw * gv;
      g2 += gv * gv;
    });

    Object.entries(penalty).forEach(([axis, w]) => {
      if (w >= 0) return;
      const gv = traitStrength(game, axis);
      if (gv > 0.2) dot += w * tagIdf(axis) * axisWeight(axis) * gv * 0.92;
    });

    // 入坑向：人气作小幅加权
    if ((effBoost["entry:easy"] || 0) > 0 && game.fame === "icon") {
      dot += (effBoost["entry:easy"] || 0) * 0.35;
    }

    // 多轴一致：偏好向量与作品 trait 高度吻合
    if (strongHits >= 3) dot *= 1 + 0.035 * (strongHits - 2);

    const cosine = dot / (Math.sqrt(u2) * Math.sqrt(g2) + 1e-6);
    return dot * 0.5 + cosine * 15;
  }

  function gameIdentity(g) {
    if (g.vndb_id) return `v:${g.vndb_id}`;
    const cn = (g.displayName || g.name || "").trim();
    if (/[\u4e00-\u9fff]{2,}/.test(cn)) return `cn:${cn}`;
    return `n:${(g.name || "").toLowerCase()}`;
  }

  function isSameTitle(a, b) {
    return gameIdentity(a) === gameIdentity(b);
  }

  function dedupeGames(list) {
    const seen = new Set();
    return list.filter((g) => {
      const id = gameIdentity(g);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function survivingGames() {
    return state.alive.slice();
  }

  function gameLabel(g) {
    return g.displayName || g.name;
  }

  /** @returns {{ list: typeof games, scores: number[], order: number[] }} */
  function rankListCore(list, boost, penalty) {
    const n = list.length;
    const scores = new Array(n);
    for (let i = 0; i < n; i += 1) {
      scores[i] = scoreGame(list[i], boost, penalty);
    }
    const order = new Array(n);
    for (let i = 0; i < n; i += 1) order[i] = i;
    order.sort((ia, ib) => {
      const ds = scores[ib] - scores[ia];
      if (ds !== 0) return ds;
      const a = list[ia];
      const b = list[ib];
      return a.rank - b.rank || gameLabel(a).localeCompare(gameLabel(b), "zh");
    });
    return { list, scores, order };
  }

  function rankListLite(core) {
    const { list, scores, order } = core;
    return order.map((i) => ({ score: scores[i], rank: list[i].rank }));
  }

  function rankList(list, boost = state.boost, penalty = state.penalty) {
    const { list: src, scores, order } = rankListCore(list, boost, penalty);
    return order.map((i) => ({ ...src[i], score: scores[i] }));
  }

  function rankAlive() {
    if (cachedAliveRank && cachedAliveRankGen === rankCacheGen) return cachedAliveRank;
    cachedAliveRank = rankList(state.alive);
    cachedAliveRankGen = rankCacheGen;
    return cachedAliveRank;
  }

  function mergeOptionVectors(opt, boost, penalty, aliveCount = state.alive.length) {
    const damp = aliveCount <= 8 ? 0.88 : 0.74;
    Object.entries(opt.boost || {}).forEach(([k, w]) => {
      const prev = boost[k] || 0;
      boost[k] = prev + w * (prev > 0 ? damp : 1);
    });
    (opt.drop || []).forEach((axis) => {
      penalty[axis] = (penalty[axis] || 0) - 4.2;
    });
  }

  function minAliveAfterDrop(aliveCount, nextCount) {
    if (aliveCount <= 8) return Math.max(1, Math.ceil(aliveCount * 0.5));
    if (aliveCount <= 14) return Math.max(2, Math.floor(aliveCount * 0.42));
    return Math.max(10, Math.min(45, Math.floor(aliveCount * 0.055)));
  }

  function axisWeight(axisKey) {
    const [dim] = axisKey.split(":");
    return AXIS_WEIGHT[dim] || 1;
  }

  function applyHardDrops(opt) {
    (opt.drop || []).forEach((axis) => {
      const next = state.alive.filter((g) => traitStrength(g, axis) < 0.52);
      const floor = minAliveAfterDrop(state.alive.length, next.length);
      if (next.length >= floor) {
        state.alive = next;
        state.drops.add(axis);
      } else {
        state.penalty[axis] = (state.penalty[axis] || 0) - (state.alive.length > 55 ? 5.5 : 4.2);
      }
    });
  }

  /** 根据分差动态计算保留带宽；answered 可传入以支持选题模拟 */
  function scoreSlackFor(ranked, answered = state.answered) {
    const n = ranked.length;
    if (n <= 1) return 0;
    const top = ranked[0].score;
    const g1 = top - ranked[1].score;
    const gTail = top - ranked[n - 1].score;
    const tighten = Math.min(3.2, answered * 0.14);

    if (g1 >= 4) return Math.max(0.55, 1.35 - tighten * 0.18);
    if (g1 >= 2.5) return Math.max(0.95, 2.1 - tighten * 0.22);
    if (g1 >= 1.2) return Math.max(1.45, 3.4 - tighten * 0.3);

    return Math.max(2.1, Math.min(gTail + 0.45, 8.5 - tighten));
  }

  function applyScoreConverge(alive, boost, penalty, answered) {
    if (answered < 5 || alive.length <= 1) return alive;
    const core = rankListCore(alive, boost, penalty);
    const { list, scores, order } = core;
    const rankedLite = rankListLite(core);
    const top = scores[order[0]];
    const slack = scoreSlackFor(rankedLite, answered);
    let kept = order.filter((i) => scores[i] >= top - slack);
    if (!kept.length) kept = [order[0]];

    const g1 = scores[order[0]] - scores[order[1]];
    const conf = matchConfidence(rankedLite);
    if (conf >= 0.5 && g1 >= 1.6 && kept.length > 3) {
      const cap = Math.max(2, Math.ceil(kept.length * (1.08 - conf * 0.42)));
      if (kept.length > cap) kept = kept.slice(0, cap);
    }

    return kept.map((i) => list[i]);
  }

  function convergePool() {
    state.alive = applyScoreConverge(state.alive, state.boost, state.penalty, state.answered);
  }

  /** 池子停滞时，仅在有明显尾部分差时裁掉落后者 */
  function resolveStagnation() {
    const core = rankListCore(state.alive, state.boost, state.penalty);
    const { list, scores, order } = core;
    const n = order.length;
    if (n <= 1) return;

    const top = scores[order[0]];
    const g1 = top - scores[order[1]];
    const tail = scores[order[n - 1]];
    const median = scores[order[Math.floor(n / 2)]];

    if (n >= 4 && median - tail >= 0.85) {
      const next = order.filter((i) => scores[i] >= median - 0.35);
      if (next.length >= 1 && next.length < n) {
        state.alive = next.map((i) => list[i]);
        invalidateRankCache();
        return;
      }
    }

    if (g1 >= 1.0) {
      const cutoff = top - Math.max(0.65, g1 * 0.72);
      const next = order.filter((i) => scores[i] >= cutoff);
      if (next.length >= 1 && next.length < n) {
        state.alive = next.map((i) => list[i]);
        invalidateRankCache();
        return;
      }
    }

    if (state.answered >= 18 && n <= 8) {
      const rankedLite = rankListLite(core);
      const slack = scoreSlackFor(rankedLite, state.answered) * 0.68;
      const next = order.filter((i) => scores[i] >= top - slack);
      if (next.length >= 1 && next.length < n) {
        state.alive = next.map((i) => list[i]);
        invalidateRankCache();
      }
    }
  }

  /** 一次 simulate 算出 discrimination + narrow + tie，避免重复 rank/simulate */
  function optionTotalScore(opt, alive, boost, penalty) {
    const includeNarrow = alive.length <= 10;
    const sim = simulateOptionEffect(opt, alive, boost, penalty);
    let disc = 0;
    let narrow = 0;
    let scores = null;

    if (sim.alive.length > 1) {
      scores = new Array(sim.alive.length);
      for (let i = 0; i < sim.alive.length; i += 1) {
        scores[i] = scoreGame(sim.alive[i], sim.boost, sim.penalty);
      }
      let mean = 0;
      let max = scores[0];
      let min = scores[0];
      for (let i = 0; i < scores.length; i += 1) {
        mean += scores[i];
        if (scores[i] > max) max = scores[i];
        if (scores[i] < min) min = scores[i];
      }
      mean /= scores.length;
      let variance = 0;
      let topBand = 0;
      for (let i = 0; i < scores.length; i += 1) {
        variance += (scores[i] - mean) ** 2;
        if (scores[i] >= max - 0.85) topBand += 1;
      }
      variance /= scores.length;
      const spread = max - min;
      const shrinkBonus = (alive.length - sim.alive.length) * 0.42;
      disc = variance * (1.15 + 1 / (topBand + 0.5)) + spread * 0.18 + shrinkBonus;
      if (includeNarrow) {
        const shrink = alive.length - sim.alive.length;
        if (shrink > 0) narrow = shrink * 0.55 + spread * 0.08;
      }
    }

    let tie = 0;
    const rankedCore = rankListCore(alive, boost, penalty);
    const { scores: aliveScores, order: aliveOrder } = rankedCore;
    if (aliveOrder.length >= 2) {
      const g1 = aliveScores[aliveOrder[0]] - aliveScores[aliveOrder[1]];
      if (g1 < 0.45) {
        const newCore = rankListCore(sim.alive, sim.boost, sim.penalty);
        if (newCore.order.length < 2) tie = 0.4;
        else {
          const newG1 = newCore.scores[newCore.order[0]] - newCore.scores[newCore.order[1]];
          tie = Math.max(0, newG1 - g1) * 2.8;
        }
      }
    }

    return disc + narrow + tie;
  }

  function applyOption(opt) {
    const prevLen = state.alive.length;
    mergeOptionVectors(opt, state.boost, state.penalty);
    applyHardDrops(opt);
    convergePool();
    if (state.alive.length < prevLen) {
      state.stagnantAlive = 0;
    } else if (state.alive.length > 1 && state.answered >= 7) {
      state.stagnantAlive += 1;
      const stallLimit = state.alive.length <= 6 ? 2 : 3;
      if (state.stagnantAlive >= stallLimit) {
        resolveStagnation();
        state.stagnantAlive = 0;
      }
    } else {
      state.stagnantAlive = 0;
    }
    invalidateRankCache();
  }

  function simulateOptionEffect(opt, alive, boost, penalty) {
    const simB = { ...boost };
    const simP = { ...penalty };
    mergeOptionVectors(opt, simB, simP, alive.length);
    let simAlive = alive;
    (opt.drop || []).forEach((axis) => {
      const next = simAlive.filter((g) => traitStrength(g, axis) < 0.52);
      const floor = minAliveAfterDrop(simAlive.length, next.length);
      if (next.length >= floor) simAlive = next;
    });
    simAlive = applyScoreConverge(simAlive, simB, simP, state.answered + 1);
    return { boost: simB, penalty: simP, alive: simAlive };
  }

  function questionWeight(q, gaps = null) {
    let w = 1;
    if (state.skippedIds.has(q.id)) w *= 0.12;
    if (q.skippable && state.answered < 5) w *= 0.5;
    if (CORE_CATEGORIES.has(q.category) && state.answered < MIN_ANSWERS_STRICT) w *= 1.4;
    w *= 1 + questionRelevance(q, gaps) * 0.22;
    return w;
  }

  function pickNextQuestion() {
    const pool = getData().questions.filter((q) => !state.asked.has(q.id));
    if (!pool.length) return null;

    const coreLeft = pool.filter((q) => CORE_CATEGORIES.has(q.category));
    const horrorLeft = pool.filter((q) => q.category === "horror");

    if (state.answered < 5 && coreLeft.length) {
      const must = coreLeft.filter((q) => q.category === "core");
      const bag = must.length ? must : coreLeft;
      return bag[Math.floor(Math.random() * bag.length)];
    }

    if (state.answered >= 4 && state.answered < 8 && horrorLeft.length) {
      const horrorQ = horrorLeft.find((q) => !state.asked.has(q.id));
      if (horrorQ) return horrorQ;
    }

    const gaps = preferenceGaps();
    const sample = shuffle(pool)
      .sort((a, b) => questionWeight(b, gaps) - questionWeight(a, gaps))
      .slice(0, 36);
    let best = sample[0];
    let bestV = -1;
    const smallPoolBoost = state.alive.length <= 8 ? 1.35 : 1;
    const tieBoost = state.answered >= 12 ? 1.2 : 1;
    sample.forEach((q) => {
      const discs = q.options.map((o) => optionTotalScore(o, state.alive, state.boost, state.penalty));
      const disc = Math.max(...discs);
      const rel = questionRelevance(q, gaps);
      const v = disc * questionWeight(q, gaps) * (1 + rel * 0.35) * smallPoolBoost * tieBoost;
      if (v > bestV) {
        bestV = v;
        best = q;
      }
    });
    return best;
  }

  function shouldConfidentFinish(ranked) {
    if (!ranked.length) return true;
    if (ranked.length === 1) return true;
    if (state.alive.length <= 1) return true;
    if (state.answered < MIN_ANSWERS) return false;
    const conf = matchConfidence(ranked);
    const unc = poolUncertainty(ranked);
    const g1 = ranked[0].score - ranked[1].score;
    const g2 = ranked.length > 2 ? ranked[1].score - ranked[2].score : g1 * 0.55;
    const rel = g1 / (Math.abs(ranked[0].score) + 1e-5);

    if (state.answered >= 6 && conf >= 0.72 && g1 >= 3.8) return true;
    if (state.answered >= 8 && conf >= 0.58 && g1 >= 2.8 && g2 >= 0.7) return true;
    if (state.answered >= 10 && unc < 0.32 && g1 >= 2.2) return true;
    if (state.answered >= 12 && unc < 0.42 && g1 >= 1.8) return true;
    if (state.answered >= 14 && state.alive.length <= 6 && g1 >= 1.5 && g2 >= 0.35) return true;
    if (state.answered >= 22 && state.alive.length <= 5 && g1 >= 0.85) return true;
    if (state.answered >= 28 && g1 < 0.15) return true;
    if (state.answered >= 32 && state.alive.length <= 15 && g1 < 0.38) return true;
    if (state.answered >= 35 && state.alive.length <= 10 && g1 >= 0.6) return true;

    const skipBonus = state.skipped >= 4 ? 0.85 : 1;
    return g1 >= 3.2 * skipBonus && rel >= 0.12 && g2 >= 0.55;
  }

  function label(dim, val) {
    return LABELS[dim]?.[val] || val;
  }

  function reasonLine(g) {
    return [g.year, label("tone", g.tone), label("setting", g.setting), label("focus", g.focus)].join(" · ");
  }

  function matchReasons(game) {
    const hits = [];
    Object.entries(state.boost)
      .filter(([, w]) => w > 0)
      .forEach(([axis, w]) => {
        const gv = traitStrength(game, axis);
        if (gv >= 0.42) hits.push({ axis, s: w * gv * tagIdf(axis) });
      });
    hits.sort((a, b) => b.s - a.s);
    const out = [];
    hits.forEach((h) => {
      const text = REASON_LABEL[h.axis];
      if (text && !out.includes(text)) out.push(text);
    });
    return out.slice(0, 3);
  }

  function pickSecondaryMMR(top, pool) {
    const MIN = 5;
    const MAX = 8;
    const SCORE_SLACK = 4.5;
    const blocked = new Set([gameIdentity(top)]);

    let candidates = pool.filter((g) => !blocked.has(gameIdentity(g)));
    let band = candidates.filter((g) => g.score >= top.score - SCORE_SLACK);
    if (band.length < MIN) band = candidates.slice(0, 24);
    if (band.length < MIN) band = candidates;
    /* 同分扎堆时略扩带宽，让 MMR 有空间拉开多样性 */
    if (band.length >= 3) {
      const near = band.filter((g) => Math.abs(g.score - top.score) < 0.35);
      if (near.length >= 4) {
        const wider = candidates.filter((g) => g.score >= top.score - SCORE_SLACK - 1.2);
        if (wider.length > band.length) band = wider;
      }
    }

    const picked = [];
    const pickedIds = new Set();
    const rest = band.slice();

    while (picked.length < MAX && rest.length) {
      let best = null;
      let bestMmr = -Infinity;
      rest.forEach((g) => {
        const gid = gameIdentity(g);
        if (pickedIds.has(gid)) return;
        const rel = g.score;
        const div = picked.length ? Math.max(...picked.map((p) => gameSimilarity(p, g))) : 0;
        const mmr = rel * 0.78 - div * 8;
        if (mmr > bestMmr) {
          bestMmr = mmr;
          best = g;
        }
      });
      if (!best) break;
      picked.push(best);
      pickedIds.add(gameIdentity(best));
      rest.splice(rest.indexOf(best), 1);
    }

    if (picked.length < MIN) {
      candidates
        .filter((g) => !pickedIds.has(gameIdentity(g)) && !blocked.has(gameIdentity(g)))
        .sort((a, b) => b.score - a.score)
        .forEach((g) => {
          if (picked.length >= MAX) return;
          picked.push(g);
          pickedIds.add(gameIdentity(g));
        });
    }

    return picked.slice(0, MAX);
  }

  function pickSecondaryCandidates(top, rankedAlive) {
    let pool = rankedAlive.filter((g) => !isSameTitle(g, top));

    if (pool.length < 8) {
      const rankedAll = rankList(games);
      const seen = new Set([gameIdentity(top), ...pool.map(gameIdentity)]);
      rankedAll.forEach((g) => {
        if (pool.length >= 20) return;
        const gid = gameIdentity(g);
        if (!seen.has(gid)) {
          seen.add(gid);
          pool.push(g);
        }
      });
    }

    pool.sort((a, b) => b.score - a.score);
    return pickSecondaryMMR(top, pool);
  }

  function gameSimilarity(a, b) {
    if (isSameTitle(a, b)) return 1;
    let sim = traitCosine(a, b) * 0.62;
    if (a.tone === b.tone) sim += 0.18;
    if (a.focus === b.focus) sim += 0.14;
    if (a.setting === b.setting) sim += 0.1;
    if (a.playstyle === b.playstyle) sim += 0.08;
    return Math.min(1, sim);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function boostTags(opt, limit = 2) {
    const boosts = Object.entries(opt.boost || {})
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    return boosts.map(([axis]) => {
      const [dim, val] = axis.split(":");
      const text = REASON_LABEL[axis] || label(dim, val) || val;
      return `<span class="pick-option__tag">${escapeHtml(text)}</span>`;
    }).join("");
  }

  function optionsLayoutClass(count) {
    if (count === 2) return "pick-options--duel";
    if (count === 3) return "pick-options--trio";
    if (count >= 4) return "pick-options--grid";
    return "";
  }

  function categoryStageClass(q) {
    if (q.category === "horror") return "pick-stage--horror";
    if (q.category === "core") return "pick-stage--core";
    return "";
  }

  function traitChipsHtml(g) {
    const rows = [
      { text: label("tone", g.tone), tone: g.tone },
      { text: label("setting", g.setting), tone: "" },
      { text: label("focus", g.focus), tone: "" },
    ].filter((r) => r.text);
    return rows
      .map((r) => {
        const toneClass = r.tone ? ` pick-chip--tone pick-chip--${escapeHtml(r.tone)}` : "";
        return `<span class="pick-chip${toneClass}">${escapeHtml(r.text)}</span>`;
      })
      .join("");
  }

  function panelPulse() {
    const panel = els.panel;
    if (!panel) return;
    panel.classList.remove("pick-panel--pulse");
    window.requestAnimationFrame(() => {
      panel.classList.add("pick-panel--pulse");
    });
  }

  function stageMotionClass() {
    if (REDUCED_MOTION()) return "";
    return state.index <= 1 ? "pick-stage--enter" : "pick-stage--swap";
  }

  function optionMotionClass() {
    if (REDUCED_MOTION() || state.index > 1) return "";
    return " pick-option--enter";
  }

  /** 入场播完后摘掉 motion class，避免滚动/样式抖动再次触发 from{opacity:0} */
  function settleStageMotion() {
    const root = els.panel;
    if (!root || REDUCED_MOTION()) return;
    const stage = root.querySelector(".pick-stage");
    if (!stage) return;
    const clear = () => {
      stage.classList.remove("pick-stage--enter", "pick-stage--swap");
      root.querySelectorAll(".pick-option--enter").forEach((el) => {
        el.classList.remove("pick-option--enter");
      });
    };
    const anims = typeof stage.getAnimations === "function" ? stage.getAnimations() : [];
    if (!anims.length) {
      window.setTimeout(clear, 480);
      return;
    }
    Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(clear);
  }

  const VNDB_BASE = "https://vndb.org";

  /** 结果卡片外链：仅 VNDB（有 vndb_id 直达，否则按名称搜索）。 */
  function gameUrl(g) {
    const id = (g.vndb_id || "").trim();
    if (/^v\d+$/i.test(id)) return `${VNDB_BASE}/${id.toLowerCase()}`;
    const q = (g.name || gameLabel(g)).trim();
    return `${VNDB_BASE}/v?q=${encodeURIComponent(q)}`;
  }

  function appendPickCard(container, g, { rank, compact }) {
    const reasons = matchReasons(g);
    const tone = g.tone || "sweet";
    const grad = TONE_GRADIENT[tone] || TONE_GRADIENT.sweet;
    const a = document.createElement("a");
    a.className = `pick-card${compact ? " pick-card--alt" : " pick-card--top"} pick-card--${tone}`;
    a.href = gameUrl(g);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.setProperty("--pick-card-grad", grad);
    a.innerHTML = `
      ${compact ? "" : `<span class="pick-card__tone" aria-hidden="true"></span>`}
      <span class="pick-card__rank">${String(rank).padStart(2, "0")}</span>
      <span class="pick-card__body">
        <strong class="pick-card__name">${escapeHtml(gameLabel(g))}</strong>
        ${g.displayName && g.displayName !== g.name ? `<small class="pick-card__alt">${escapeHtml(g.name)}</small>` : ""}
        <span class="pick-card__chips">${traitChipsHtml(g)}</span>
        <small class="pick-card__meta">${escapeHtml(reasonLine(g))}</small>
        ${reasons.length ? `<small class="pick-card__why">合你：${reasons.map(escapeHtml).join(" · ")}</small>` : ""}
      </span>
      <span class="pick-card__go" aria-hidden="true">↗</span>
    `;
    container.appendChild(a);
  }

  function pickRandomFromBand(ranked) {
    if (!ranked.length) return null;
    const top = ranked[0].score;
    const bandSize = Math.max(3, Math.min(18, Math.ceil(ranked.length * 0.35)));
    const band = ranked.slice(0, bandSize);
    const seed = band[Math.floor(Math.random() * band.length)];
    const slack = Math.max(2.8, top - (band[band.length - 1]?.score ?? top - 4) + 1.2);
    const similar = ranked.filter(
      (g) => g.score >= top - slack && gameSimilarity(seed, g) >= 0.45,
    );
    const pool = similar.length >= 2 ? similar : band;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function pickPrimaryResult(ranked) {
    if (state.finishMode === "random") {
      return games[Math.floor(Math.random() * games.length)];
    }
    if (!ranked.length) return null;
    if (state.finishMode === "early") {
      return pickRandomFromBand(ranked);
    }
    return ranked[0];
  }

  function resultKicker() {
    switch (state.finishMode) {
      case "random":
        return "随机推荐";
      case "early":
        return "从当前匹配中随机";
      case "single":
        return "候选已唯一";
      case "auto":
        return "匹配完成";
      default:
        return "匹配完成";
    }
  }

  function resetRun() {
    state.index = 0;
    state.answered = 0;
    state.skipped = 0;
    state.boost = Object.create(null);
    state.penalty = Object.create(null);
    state.drops = new Set();
    state.alive = games.slice();
    state.asked = new Set();
    state.skippedIds = new Set();
    state.stagnantAlive = 0;
    state.finishMode = "quiz";
    invalidateRankCache();
  }

  function startQuiz() {
    whenCatalogReady(() => {
      resetRun();
      renderQuestion();
    });
  }

  function startRandomPick() {
    whenCatalogReady(() => {
      resetRun();
      state.finishMode = "random";
      renderResult();
    });
  }

  function finishEarly() {
    if (performance.now() < pickInputCooldownUntil) return;
    cancelPendingAdvance();
    clearOptionKeys();
    pickInputCooldownUntil = performance.now() + 420;
    state.finishMode = "early";
    renderResult();
  }

  function bindDom() {
    els.root = document.getElementById("pick-root");
    els.panel = document.getElementById("pick-panel");
    els.lead = document.getElementById("pick-hero-lead");
    els.backIntro = document.getElementById("pick-back-intro");
  }

  function syncTopNav() {
    if (!els.backIntro) return;
    const onIntro = !!els.panel?.querySelector(".pick-stage--intro");
    els.backIntro.hidden = onIntro;
  }

  function setManualPageLayout(on) {
    document.querySelector(".page-main--pick")?.classList.toggle("page-main--manual", on);
    if (els.lead) {
      const n = games.length || getData()?.games?.length || 0;
      els.lead.textContent = on
        ? `拖动滑条设定偏好（0–10），松手后匹配${n ? ` ${n}` : ""} 部作品。`
        : "";
      els.lead.hidden = !els.lead.textContent;
    }
  }

  function resetManualPrefs() {
    window.clearTimeout(manualState.refreshTimer);
    manualState.refreshTimer = 0;
    manualState.sliding = false;
    manualState.lastRenderedSig = null;
    manualState.prefs = Object.create(null);
  }

  function manualPrefsSignature() {
    return Object.keys(manualState.prefs)
      .filter((k) => (manualState.prefs[k] || 0) > 0)
      .sort()
      .map((k) => `${k}=${manualState.prefs[k]}`)
      .join("&");
  }

  function manualPrefCount() {
    return Object.values(manualState.prefs).filter((v) => v > 0).length;
  }

  /** 同一维度（如 tone）下多项都 >0 时结果会互相拉扯 */
  function manualSameDimConflict() {
    const byDim = Object.create(null);
    Object.entries(manualState.prefs).forEach(([axis, v]) => {
      if (!(v > 0)) return;
      const dim = axis.split(":")[0];
      byDim[dim] = (byDim[dim] || 0) + 1;
    });
    return Object.values(byDim).some((n) => n >= 2);
  }

  function manualBoostWeight(value) {
    return Math.max(0, Number(value) || 0) * MANUAL_BOOST_SCALE;
  }

  function syncManualVectors() {
    state.boost = Object.create(null);
    state.penalty = Object.create(null);
    state.drops = new Set();
    Object.entries(manualState.prefs).forEach(([axis, value]) => {
      const w = manualBoostWeight(value);
      if (w > 0) state.boost[axis] = w;
    });
    /* 拉高基调时，对明确对立轴施加软惩罚（负向「不要」） */
    Object.entries(manualState.prefs).forEach(([axis, value]) => {
      if (!(value >= 6)) return;
      const [dim, val] = axis.split(":");
      if (dim !== "tone" || !val) return;
      const avoid = TONE_SOFT_AVOID[val] || [];
      const strength = manualBoostWeight(value) * 0.55;
      avoid.forEach((opp) => {
        const key = `tone:${opp}`;
        if ((manualState.prefs[key] || 0) > 0) return;
        state.penalty[key] = (state.penalty[key] || 0) - strength;
      });
    });
    invalidateRankCache();
  }

  function manualAlivePool() {
    syncManualVectors();
    return games.slice();
  }

  function manualSliderId(axis) {
    return `tune-${axis.replace(/:/g, "-")}`;
  }

  function syncManualSliderRow(slider, value) {
    const val = Math.max(0, Math.min(MANUAL_SLIDER_MAX, Number(value) || 0));
    if (slider.value !== String(val)) slider.value = String(val);
    slider.setAttribute("aria-valuenow", String(val));
    const row = slider.closest(".pick-tune-row");
    row?.classList.toggle("pick-tune-row--active", val > 0);
    const out = row?.querySelector(".pick-tune-row__val");
    if (out) out.textContent = String(val);
  }

  function setManualPref(axis, value, { refresh = false } = {}) {
    const val = Math.max(0, Math.min(MANUAL_SLIDER_MAX, Number(value) || 0));
    if (val > 0) manualState.prefs[axis] = val;
    else delete manualState.prefs[axis];
    if (refresh) scheduleManualRefresh();
  }

  function scheduleManualRefresh(delay = 280) {
    /* 拖动中绝不排队；仅键盘等无 pointer 路径的兜底 */
    if (manualState.sliding) return;
    window.clearTimeout(manualState.refreshTimer);
    manualState.refreshTimer = window.setTimeout(() => {
      manualState.refreshTimer = 0;
      if (manualState.sliding) return;
      refreshManualResults();
    }, delay);
  }

  /**
   * 松手提交：pointerup / lostpointercapture / change 常跨任务连发，
   * microtask 挡不住晚到的 change，用短防抖合并成一次重绘。
   */
  function commitManualRefresh() {
    window.clearTimeout(manualState.refreshTimer);
    manualState.refreshTimer = window.setTimeout(() => {
      manualState.refreshTimer = 0;
      if (manualState.sliding) return;
      refreshManualResults();
    }, 48);
  }

  function manualGroupsHtml() {
    return MANUAL_DIMS.map((dim) => {
      const entries = Object.entries(LABELS[dim] || {});
      if (!entries.length) return "";
      const groupLabel = MANUAL_GROUP_LABELS[dim] || dim;
      const rows = entries.map(([val, text]) => {
        const axis = `${dim}:${val}`;
        const pref = manualState.prefs[axis] || 0;
        const active = pref > 0 ? " pick-tune-row--active" : "";
        const id = manualSliderId(axis);
        return `
          <div class="pick-tune-row${active}">
            <label class="pick-tune-row__label" for="${escapeHtml(id)}">${escapeHtml(text)}</label>
            <input
              type="range"
              class="pick-tune-slider"
              id="${escapeHtml(id)}"
              data-tune-axis="${escapeHtml(axis)}"
              min="0"
              max="${MANUAL_SLIDER_MAX}"
              step="1"
              value="${pref}"
              aria-valuemin="0"
              aria-valuemax="${MANUAL_SLIDER_MAX}"
              aria-valuenow="${pref}"
            />
            <output class="pick-tune-row__val" for="${escapeHtml(id)}">${pref}</output>
          </div>`;
      }).join("");
      return `
        <section class="pick-tune-group">
          <h3 class="pick-tune-group__title">${escapeHtml(groupLabel)}</h3>
          <div class="pick-tune-rows">${rows}</div>
        </section>`;
    }).join("");
  }

  function refreshManualResults({ force = false } = {}) {
    if (manualState.sliding && !force) return;

    const resultsEl = els.panel?.querySelector("#pick-tune-results");
    const metaEl = els.panel?.querySelector("#pick-tune-meta");
    if (!resultsEl) return;

    const prefN = manualPrefCount();
    const sig = manualPrefsSignature();
    const syncMeta = () => {
      if (!metaEl) return;
      const conflict = manualSameDimConflict();
      if (!prefN) {
        metaEl.textContent = `拖动滑条设定偏好（0–${MANUAL_SLIDER_MAX}），松手后更新推荐`;
      } else if (conflict) {
        metaEl.textContent = `已调 ${prefN} 项 · 同组对立项（如甜+郁）会互斥衰减`;
      } else {
        metaEl.textContent = `已调 ${prefN} 项 · 松手后更新 · 0=不参与 · 基调≥6会软避开对立轴`;
      }
    };

    if (!force && sig === manualState.lastRenderedSig && resultsEl.childElementCount > 0) {
      syncMeta();
      return;
    }

    syncMeta();
    manualState.lastRenderedSig = sig;

    if (!prefN) {
      resultsEl.replaceChildren();
      resultsEl.innerHTML = `<p class="pick-tune-empty">还没有偏好。把左侧滑条调到 1 以上，推荐会出现在这里。</p>`;
      return;
    }

    const pool = manualAlivePool();
    const ranked = rankList(pool);
    if (!ranked.length) {
      resultsEl.replaceChildren();
      resultsEl.innerHTML = `<p class="pick-tune-empty">没有匹配的作品，试试调整偏好权重。</p>`;
      return;
    }

    /* 先在 fragment 里建完再一次性挂载，避免先清空再填充造成二次闪烁 */
    const frag = document.createDocumentFragment();
    const top = ranked[0];
    const alts = pickSecondaryCandidates(top, ranked).slice(0, 7);
    const main = document.createElement("div");
    main.className = "pick-results pick-results--hero";
    appendPickCard(main, top, { rank: 1, compact: false });
    frag.appendChild(main);

    if (alts.length) {
      const title = document.createElement("h3");
      title.className = "pick-alts-title";
      title.textContent = "也符合你的偏好";
      frag.appendChild(title);
      const altList = document.createElement("div");
      altList.className = "pick-results pick-results--alts";
      alts.forEach((g, i) => {
        appendPickCard(altList, g, { rank: i + 2, compact: true });
      });
      frag.appendChild(altList);
    }

    const count = document.createElement("p");
    count.className = "pick-tune-count";
    count.textContent = `在 ${pool.length} 部候选中匹配 · 共 ${ranked.length} 部有得分`;
    frag.appendChild(count);
    resultsEl.replaceChildren(frag);
  }

  function bindManualTuneControls() {
    const applySliderValue = (slider) => {
      const axis = slider.getAttribute("data-tune-axis");
      const val = Number(slider.value);
      setManualPref(axis, val, { refresh: false });
      syncManualSliderRow(slider, val);
    };

    /** @type {null | (() => void)} */
    let detachDocEnd = null;
    /** 键盘方向键微调：不走 sliding，交给 change 提交 */
    let keyAdjust = false;

    const endSlide = () => {
      if (detachDocEnd) {
        detachDocEnd();
        detachDocEnd = null;
      }
      const wasSliding = manualState.sliding;
      manualState.sliding = false;
      /* pointerup 与 lostpointercapture 常成对；仅首次从 sliding→结束时排队 */
      if (wasSliding) commitManualRefresh();
    };

    const armDocEnd = () => {
      if (detachDocEnd) return;
      const onEnd = () => endSlide();
      const opts = { capture: true };
      /* Pointer Events 已覆盖触控/鼠标，避免再叠 touchend/mouseup 导致多次 end */
      window.addEventListener("pointerup", onEnd, opts);
      window.addEventListener("pointercancel", onEnd, opts);
      detachDocEnd = () => {
        window.removeEventListener("pointerup", onEnd, opts);
        window.removeEventListener("pointercancel", onEnd, opts);
      };
    };

    const beginSlide = (slider, ev) => {
      keyAdjust = false;
      if (!manualState.sliding) {
        manualState.sliding = true;
        window.clearTimeout(manualState.refreshTimer);
        manualState.refreshTimer = 0;
      }
      armDocEnd();
      if (ev && typeof ev.pointerId === "number") {
        try {
          slider.setPointerCapture?.(ev.pointerId);
        } catch {
          /* ignore */
        }
      }
    };

    const isRangeKey = (key) => (
      key === "ArrowLeft" || key === "ArrowRight"
      || key === "ArrowUp" || key === "ArrowDown"
      || key === "Home" || key === "End"
      || key === "PageUp" || key === "PageDown"
    );

    els.panel.querySelectorAll("[data-tune-axis]").forEach((slider) => {
      slider.addEventListener("pointerdown", (e) => beginSlide(slider, e));
      slider.addEventListener("lostpointercapture", endSlide);

      slider.addEventListener("keydown", (e) => {
        if (!isRangeKey(e.key)) return;
        keyAdjust = true;
        /* 若指针手势残留未结束，放开以免挡住键盘 change */
        if (manualState.sliding) {
          if (detachDocEnd) {
            detachDocEnd();
            detachDocEnd = null;
          }
          manualState.sliding = false;
        }
      });

      /*
       * input：只改数字。
       * - 指针/触控：确保进入 sliding，并由 doc 级松手 + change 合并提交
       * - 键盘：不进入 sliding，由随后的 change 提交
       */
      slider.addEventListener("input", () => {
        applySliderValue(slider);
        if (keyAdjust) {
          keyAdjust = false;
          window.clearTimeout(manualState.refreshTimer);
          manualState.refreshTimer = 0;
          return;
        }
        if (!manualState.sliding) beginSlide(slider, null);
        window.clearTimeout(manualState.refreshTimer);
        manualState.refreshTimer = 0;
      });

      /* change 与 pointerup 均可能触发；一律走防抖，拖动中也先排队，松手后一次落地 */
      slider.addEventListener("change", () => {
        applySliderValue(slider);
        commitManualRefresh();
      });
    });

    els.panel.querySelector("[data-tune-reset]")?.addEventListener("click", () => {
      if (detachDocEnd) {
        detachDocEnd();
        detachDocEnd = null;
      }
      resetManualPrefs();
      els.panel.querySelectorAll("[data-tune-axis]").forEach((slider) => {
        syncManualSliderRow(slider, 0);
      });
      refreshManualResults({ force: true });
    });
  }

  function renderManualTune() {
    clearOptionKeys();
    setManualPageLayout(true);
    manualState.lastRenderedSig = null;
    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--manual pick-stage--enter">
        <div class="pick-tune-controls">
          <p class="pick-tune-lead" id="pick-tune-meta">拖动滑条设定偏好（0–${MANUAL_SLIDER_MAX}），松手后更新推荐</p>
          <div class="pick-tune-groups">${manualGroupsHtml()}</div>
          <div class="pick-tune-toolbar">
            <button type="button" class="pick-btn pick-btn--ghost pick-btn--sm" data-tune-reset>全部归零</button>
          </div>
        </div>
        <aside class="pick-tune-aside">
          <h2 class="pick-tune-aside__title">推荐结果</h2>
          <div id="pick-tune-results"></div>
        </aside>
        <p class="pick-tune-note">点卡片去 VNDB · 滑条 10 ≈ 答题强偏好 · 与答题模式共用匹配算法</p>
      </div>
    `;
    bindManualTuneControls();
    refreshManualResults();
    settleStageMotion();
    syncTopNav();
  }

  function startManualTune() {
    whenCatalogReady(() => {
      resetRun();
      resetManualPrefs();
      renderManualTune();
    });
  }

  function backToIntro() {
    clearOptionKeys();
    resetRun();
    resetManualPrefs();
    setManualPageLayout(false);
    renderIntro();
  }

  function renderIntro() {
    clearOptionKeys();
    setManualPageLayout(false);
    const n = games.length || getData()?.games?.length || 0;
    const poolHint = n ? `题库约 ${n} 部` : "题库加载中…";
    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--intro pick-stage--enter">
        <div class="pick-intro-modes" role="group" aria-label="选择进入方式">
          <button type="button" class="pick-mode-card pick-mode-card--primary" data-pick-start>
            <span class="pick-mode-card__num" aria-hidden="true">01</span>
            <span class="pick-mode-card__body">
              <span class="pick-mode-card__title">开始答题</span>
              <span class="pick-mode-card__desc">跟着感觉选，动态缩小候选池</span>
            </span>
            <span class="pick-mode-card__go" aria-hidden="true">→</span>
          </button>
          <button type="button" class="pick-mode-card" data-pick-manual>
            <span class="pick-mode-card__num" aria-hidden="true">02</span>
            <span class="pick-mode-card__body">
              <span class="pick-mode-card__title">手动调参</span>
              <span class="pick-mode-card__desc">直接拨动维度，即时看推荐</span>
            </span>
            <span class="pick-mode-card__go" aria-hidden="true">→</span>
          </button>
          <button type="button" class="pick-mode-card pick-mode-card--dice" data-pick-random>
            <span class="pick-mode-card__num" aria-hidden="true">🎲</span>
            <span class="pick-mode-card__body">
              <span class="pick-mode-card__title">随机一部</span>
              <span class="pick-mode-card__desc">不作答，直接抽一部试试</span>
            </span>
            <span class="pick-mode-card__go" aria-hidden="true">→</span>
          </button>
        </div>
        <p class="pick-intro-hint">${escapeHtml(poolHint)}</p>
      </div>
    `;
    els.panel.querySelector("[data-pick-start]")?.addEventListener("click", startQuiz);
    els.panel.querySelector("[data-pick-manual]")?.addEventListener("click", startManualTune);
    els.panel.querySelector("[data-pick-random]")?.addEventListener("click", startRandomPick);
    settleStageMotion();
    syncTopNav();
  }

  function handleOptionPick(btn, opt, box) {
    if (box.dataset.lock === "1") return;
    if (performance.now() < pickInputCooldownUntil) return;
    lockQuestionActions(box);
    btn.classList.add("is-selected");
    box.querySelectorAll(".pick-option").forEach((el) => {
      if (el !== btn) el.classList.add("is-faded");
    });
    panelPulse();
    const delay = REDUCED_MOTION() ? 0 : 340;
    /* 覆盖换题动画 + 常见 300ms 幽灵 click，防止点穿到下一题 */
    pickInputCooldownUntil = performance.now() + delay + 420;
    /** @type {ReturnType<typeof planAdvanceQuestion> | null} */
    let planned = null;
    if (delay > 0) {
      applyOption(opt);
      state.answered += 1;
      planned = planAdvanceQuestion();
    }
    const token = ++advanceGen;
    window.setTimeout(() => {
      if (token !== advanceGen) return;
      if (planned) {
        commitAdvanceQuestion(planned);
        return;
      }
      applyOption(opt);
      state.answered += 1;
      advanceQuestion();
    }, delay);
  }

  /** 动画期间预计算下一题/是否结束，不改变 index */
  function planAdvanceQuestion() {
    const ranked = rankAlive();
    if (state.alive.length <= 1) {
      return { action: "result", finishMode: "single" };
    }
    if (shouldConfidentFinish(ranked)) {
      return { action: "result", finishMode: "auto" };
    }
    if (state.asked.size >= getData().questions.length) {
      return { action: "result", finishMode: state.answered > 0 ? "auto" : "random" };
    }
    const q = pickNextQuestion();
    if (!q) return { action: "result", finishMode: "auto" };
    return { action: "question", q };
  }

  function commitAdvanceQuestion(plan) {
    state.index += 1;
    if (plan.action === "result") {
      state.finishMode = plan.finishMode;
      renderResult();
      return;
    }
    state.asked.add(plan.q.id);
    renderQuestionWithQ(plan.q);
  }

  function clearOptionKeys() {
    if (optionKeyHandler) {
      window.removeEventListener("keydown", optionKeyHandler);
      optionKeyHandler = null;
    }
  }

  function bindOptionKeys(box, options) {
    clearOptionKeys();
    optionKeyHandler = (ev) => {
      if (!box.isConnected || box.dataset.lock === "1") return;
      const key = ev.key.toLowerCase();
      let idx = -1;
      if (key >= "1" && key <= "9") idx = Number(key) - 1;
      else if (key >= "a" && key <= "z") idx = key.charCodeAt(0) - 97;
      if (idx < 0 || idx >= options.length) return;
      ev.preventDefault();
      const btn = box.querySelectorAll(".pick-option")[idx];
      if (btn) handleOptionPick(btn, options[idx], box);
    };
    window.addEventListener("keydown", optionKeyHandler);
  }

  function finishOrContinue() {
    const ranked = rankAlive();
    if (state.alive.length <= 1) {
      state.finishMode = "single";
      renderResult();
      return true;
    }
    if (shouldConfidentFinish(ranked)) {
      state.finishMode = "auto";
      renderResult();
      return true;
    }
    if (state.asked.size >= getData().questions.length) {
      state.finishMode = state.answered > 0 ? "auto" : "random";
      renderResult();
      return true;
    }
    return false;
  }

  function advanceQuestion() {
    state.index += 1;
    finishOrContinue() || renderQuestion();
  }

  function skipQuestion(q) {
    if (state.skipped >= MAX_SKIPS) return;
    const box = els.panel?.querySelector("#pick-options");
    if (box?.dataset.lock === "1") return;
    if (performance.now() < pickInputCooldownUntil) return;
    cancelPendingAdvance();
    clearOptionKeys();
    pickInputCooldownUntil = performance.now() + 420;
    state.skipped += 1;
    state.skippedIds.add(q.id);
    advanceQuestion();
  }

  function renderQuestionWithQ(q) {
    const current = state.index + 1;
    const pct = Math.min(100, poolProgress() * 100);
    const canSkip = state.skipped < MAX_SKIPS;
    const canFinishEarly = state.answered >= 1;
    const catBadge = CATEGORY_BADGE[q.category];
    const optLayout = optionsLayoutClass(q.options.length);
    const shrinkPct = Math.round(poolShrinkRatio() * 100);

    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--quiz ${stageMotionClass()} ${categoryStageClass(q)}">
        <div class="pick-status">
          <div class="pick-status__row">
            <span>第 <strong>${current}</strong> 题 · 候选 <strong>${state.alive.length}</strong> 部${state.answered ? ` · 已答 ${state.answered}` : ""}</span>
            <span class="pick-status__actions">
              ${canFinishEarly ? `<button type="button" class="pick-skip" data-pick-finish>提前出结果</button>` : ""}
              ${canSkip ? `<button type="button" class="pick-skip" data-pick-skip>跳过</button>` : ""}
            </span>
          </div>
          <div class="pick-progress pick-progress--rich" aria-hidden="true">
            <span class="pick-progress__bar" style="width:${pct}%"></span>
            <span class="pick-progress__glow" style="width:${pct}%"></span>
          </div>
          <p class="pick-status__hint">已收窄 ${shrinkPct}% · 按 1–${q.options.length} 或 A–${String.fromCharCode(64 + q.options.length)} 选择</p>
        </div>
        ${catBadge ? `<p class="pick-q-badge">${escapeHtml(catBadge)}</p>` : ""}
        <h2 class="pick-q">${escapeHtml(q.text)}</h2>
        ${q.hint ? `<p class="pick-q-hint">${escapeHtml(q.hint)}</p>` : ""}
        <div class="pick-options ${optLayout}" id="pick-options"></div>
      </div>
    `;

    els.panel.querySelector("[data-pick-skip]")?.addEventListener("click", () => skipQuestion(q));
    els.panel.querySelector("[data-pick-finish]")?.addEventListener("click", finishEarly);

    const box = els.panel.querySelector("#pick-options");
    const frag = document.createDocumentFragment();
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `pick-option${optionMotionClass()}`;
      btn.style.setProperty("--pick-opt-i", String(i));
      const tags = boostTags(opt);
      btn.innerHTML = `
        <span class="pick-option__idx">${String.fromCharCode(65 + i)}</span>
        <span class="pick-option__body">
          <span class="pick-option__label">${escapeHtml(opt.label)}</span>
          ${tags ? `<span class="pick-option__tags">${tags}</span>` : ""}
        </span>`;
      btn.addEventListener("click", () => handleOptionPick(btn, opt, box));
      frag.appendChild(btn);
    });
    box.appendChild(frag);
    bindOptionKeys(box, q.options);
    settleStageMotion();
    syncTopNav();
  }

  function renderQuestion() {
    if (finishOrContinue()) return;

    const q = pickNextQuestion();
    if (!q) {
      renderResult();
      return;
    }
    state.asked.add(q.id);
    renderQuestionWithQ(q);
  }

  function renderResult() {
    clearOptionKeys();
    let alive = survivingGames();
    if (!alive.length) alive = games.slice();
    const ranked = rankList(alive);
    const top = pickPrimaryResult(ranked);
    const alts = top ? pickSecondaryCandidates(top, ranked) : [];

    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--result pick-stage--enter">
        <p class="pick-result-kicker">${resultKicker()}</p>
        <h2 class="pick-result-title">${state.finishMode === "random" ? "试试这部" : "就是这部"}</h2>
        <div class="pick-results pick-results--hero" id="pick-results-main"></div>
        ${
          alts.length
            ? `<h3 class="pick-alts-title">也符合你的选择</h3>
        <div class="pick-results pick-results--alts" id="pick-results-alts"></div>`
            : ""
        }
        <div class="pick-actions">
          <button type="button" class="pick-btn pick-btn--ghost" data-pick-retry>再来一局</button>
          <button type="button" class="pick-btn pick-btn--ghost" data-pick-random-again>随机一部</button>
          <a class="pick-btn pick-btn--primary" href="/">回主页</a>
        </div>
        <p class="pick-note">点卡片去 VNDB · 娱乐向匹配 · 题量随候选池缩小，无固定上限</p>
      </div>
    `;

    if (top) appendPickCard(els.panel.querySelector("#pick-results-main"), top, { rank: 1, compact: false });

    const altList = els.panel.querySelector("#pick-results-alts");
    if (altList) {
      alts.forEach((g, i) => {
        appendPickCard(altList, g, { rank: i + 2, compact: true });
      });
    }

    els.panel.querySelector("[data-pick-retry]")?.addEventListener("click", backToIntro);
    els.panel.querySelector("[data-pick-random-again]")?.addEventListener("click", startRandomPick);
    settleStageMotion();
    syncTopNav();
  }

  function init() {
    if (bootBound) return;
    bootBound = true;
    bindDom();
    initScrollPerf();
    els.backIntro?.addEventListener("click", backToIntro);
    if (!els.panel) return;
    ensureCatalog();
    const params = new URLSearchParams(window.location.search);
    if (params.get("random") === "1") {
      startRandomPick();
      return;
    }
    if (params.get("tune") === "1") {
      startManualTune();
      return;
    }
    renderIntro();
  }

  window.KayaGalPick = { init, onDataLoaded, onDataLoadFailed, startRandomPick, startManualTune };
})();
