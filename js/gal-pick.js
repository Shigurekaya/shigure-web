/**
 * Gal缘结 v8 — 弹性题量（无固定上限，池缩至 1 即出结果）+ trait 向量匹配
 */
(() => {
  const DATA = typeof GAL_PICK_DATA !== "undefined" ? GAL_PICK_DATA : null;
  if (!DATA?.games?.length || !DATA?.questions?.length) {
    console.error("[gal-pick] GAL_PICK_DATA missing or empty");
    return;
  }

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
    "tone:sweet": ["tone:heal", "tone:hype", "appeal:moe"],
    "tone:heal": ["tone:sweet", "tone:drama", "mood:light"],
    "tone:drama": ["tone:literary", "tone:heal", "appeal:nakige"],
    "tone:literary": ["tone:drama", "tone:mindbend", "appeal:literary"],
    "tone:mindbend": ["tone:literary", "tone:epic", "appeal:mystery", "appeal:horror"],
    "tone:epic": ["tone:drama", "tone:mindbend", "appeal:action"],
    "tone:hype": ["tone:sweet", "tone:epic", "appeal:comedy"],
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
    "focus:romance": ["tone:sweet", "appeal:moe", "cast:harem"],
    "focus:story": ["tone:drama", "appeal:nakige", "cast:ensemble"],
    "focus:world": ["tone:epic", "appeal:action"],
    "focus:mystery": ["tone:mindbend", "appeal:mystery"],
    "entry:easy": ["tone:sweet", "pace:breezy", "fame:icon"],
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
    focus: { romance: "恋爱", story: "叙事", world: "世界观", mystery: "解谜" },
    entry: { easy: "入坑向", standard: "均衡", deep: "深度向" },
    mood: { light: "轻松", bittersweet: "余味", heavy: "沉重" },
    routes: { single: "单线", multi: "多线", puzzle: "拼图" },
    appeal: { comedy: "搞笑", nakige: "催泪", utsuge: "郁", horror: "恐怖", meta: "Meta", mystery: "悬疑", action: "动作", literary: "文学", moe: "萌" },
    cast: { solo: "单女主", harem: "后宫", ensemble: "群像" },
    playstyle: { adv: "ADV", vn: "视觉小说", sim: "养成", rpg: "RPG", hybrid: "混合" },
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
    "entry:deep": "深度向",
    "mood:light": "轻松心情",
    "mood:bittersweet": "余味",
    "mood:heavy": "厚重感",
    "routes:multi": "多线",
    "routes:puzzle": "拼图结构",
    "appeal:comedy": "喜剧感",
    "appeal:nakige": "催泪",
    "appeal:utsuge": "郁系",
    "appeal:horror": "恐怖氛围",
    "appeal:meta": "Meta 叙事",
    "appeal:mystery": "悬疑",
    "appeal:action": "动作场面",
    "appeal:moe": "萌系",
    "cast:harem": "多角色",
    "cast:ensemble": "群像",
    "playstyle:adv": "分支 ADV",
    "playstyle:vn": "视觉小说",
    "playstyle:rpg": "RPG 玩法",
  };

  const els = {};
  let tagIdf = () => 1;
  let games = [];
  let optionKeyHandler = null;

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
    /** @type {'quiz'|'single'|'auto'|'early'|'random'} */
    finishMode: "quiz",
  };

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

  function poolUncertainty() {
    const ranked = rankAlive();
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

  function questionRelevance(q) {
    const gaps = preferenceGaps();
    const targets = questionTargets(q);
    let hit = 0;
    targets.forEach((k) => {
      if (gaps.includes(k)) hit += 1;
    });
    if (q.category === "horror" && !(state.boost["appeal:horror"] > 0)) hit += 1.5;
    if (q.category === "core") hit += 0.5;
    return hit;
  }

  function traitStrength(game, axisKey) {
    const t = game.traits?.[axisKey];
    if (t != null && t > 0) return t;
    if (tagOf(game, axisKey)) return 0.9;
    const related = AFFINITY[axisKey] || [];
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

  function scoreGame(game, boost = state.boost, penalty = state.penalty) {
    let dot = 0;
    let u2 = 0;
    let g2 = 0;
    let strongHits = 0;

    Object.entries(boost).forEach(([axis, w]) => {
      if (w <= 0) return;
      const iw = tagIdf(axis) * axisWeight(axis);
      const tw = w * iw;
      u2 += tw * tw;
      let gv = traitStrength(game, axis);
      (IMPLIED[axis] || []).forEach((imp) => {
        gv = Math.max(gv, traitStrength(game, imp) * 0.72);
      });
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
    if ((boost["entry:easy"] || 0) > 0 && game.fame === "icon") {
      dot += (boost["entry:easy"] || 0) * 0.35;
    }

    // 多轴一致：偏好向量与作品 trait 高度吻合
    if (strongHits >= 3) dot *= 1 + 0.035 * (strongHits - 2);

    const cosine = dot / (Math.sqrt(u2) * Math.sqrt(g2) + 1e-6);
    return dot * 0.5 + cosine * 15;
  }

  function gameIdentity(g) {
    if (g.vndb_id) return `v:${g.vndb_id}`;
    if (g.bangumi_id) return `b:${g.bangumi_id}`;
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

  function rankList(list, boost = state.boost, penalty = state.penalty) {
    return list
      .map((g) => ({ ...g, score: scoreGame(g, boost, penalty) }))
      .sort((a, b) => b.score - a.score || a.rank - b.rank || gameLabel(a).localeCompare(gameLabel(b), "zh"));
  }

  function rankAlive() {
    return rankList(state.alive);
  }

  function mergeOptionVectors(opt, boost, penalty) {
    Object.entries(opt.boost || {}).forEach(([k, w]) => {
      const prev = boost[k] || 0;
      boost[k] = prev + w * (prev > 0 ? 0.74 : 1);
    });
    (opt.drop || []).forEach((axis) => {
      penalty[axis] = (penalty[axis] || 0) - 4.2;
    });
  }

  function dropFloor() {
    return Math.max(10, Math.min(45, Math.floor(state.alive.length * 0.055)));
  }

  function axisWeight(axisKey) {
    const [dim] = axisKey.split(":");
    return AXIS_WEIGHT[dim] || 1;
  }

  function applyHardDrops(opt) {
    const floor = dropFloor();
    (opt.drop || []).forEach((axis) => {
      const next = state.alive.filter((g) => traitStrength(g, axis) < 0.52);
      if (next.length >= floor) {
        state.alive = next;
        state.drops.add(axis);
      } else {
        state.penalty[axis] = (state.penalty[axis] || 0) - (state.alive.length > 55 ? 5.5 : 4.2);
      }
    });
  }

  function convergePool() {
    if (state.alive.length <= 5 || state.answered < 5) return;
    const ranked = rankAlive();
    const top = ranked[0].score;
    const shrink = poolShrinkRatio();
    const progress = Math.min(1, state.answered / 18 + shrink * 0.45);
    const scores = ranked.map((g) => g.score);
    const p75 = scores[Math.floor(scores.length * 0.25)] || top - 4;
    const slack = Math.max(1.6, Math.min(11, top - p75 + 2.0 - progress * 2.2));
    let kept = ranked.filter((g) => g.score >= top - slack);
    if (!kept.length) kept = ranked.slice(0, 4);
    const cap = Math.max(10, Math.ceil(64 - state.answered * 2.4 - progress * 14));
    if (kept.length > cap) kept = kept.slice(0, cap);
    state.alive = kept.map(({ score, ...g }) => g);
  }

  function applyOption(opt) {
    mergeOptionVectors(opt, state.boost, state.penalty);
    applyHardDrops(opt);
    convergePool();
  }

  function optionDiscrimination(opt, alive, boost, penalty) {
    const simB = { ...boost };
    const simP = { ...penalty };
    mergeOptionVectors(opt, simB, simP);
    const scores = alive.map((g) => scoreGame(g, simB, simP));
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, s) => a + (s - mean) ** 2, 0) / scores.length;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const spread = max - min;
    const topBand = scores.filter((s) => s >= max - 0.85).length;
    return variance * (1.15 + 1 / (topBand + 0.5)) + spread * 0.18;
  }

  function questionWeight(q) {
    let w = 1;
    if (state.skippedIds.has(q.id)) w *= 0.12;
    if (q.skippable && state.answered < 5) w *= 0.5;
    if (CORE_CATEGORIES.has(q.category) && state.answered < MIN_ANSWERS_STRICT) w *= 1.4;
    w *= 1 + questionRelevance(q) * 0.22;
    return w;
  }

  function pickNextQuestion() {
    const pool = DATA.questions.filter((q) => !state.asked.has(q.id));
    if (!pool.length) return null;

    const coreLeft = pool.filter((q) => CORE_CATEGORIES.has(q.category));
    const horrorLeft = pool.filter((q) => q.category === "horror");

    if (state.answered < 5 && coreLeft.length) {
      const must = coreLeft.filter((q) => q.category === "core");
      const bag = must.length ? must : coreLeft;
      return bag[Math.floor(Math.random() * bag.length)];
    }

    if (state.answered >= 4 && state.answered < 8 && horrorLeft.length && !state.asked.has(horrorLeft[0].id)) {
      return horrorLeft[0];
    }

    const sample = shuffle(pool)
      .sort((a, b) => questionWeight(b) - questionWeight(a))
      .slice(0, 36);
    let best = sample[0];
    let bestV = -1;
    sample.forEach((q) => {
      const disc = Math.max(...q.options.map((o) => optionDiscrimination(o, state.alive, state.boost, state.penalty)));
      const rel = questionRelevance(q);
      const v = disc * questionWeight(q) * (1 + rel * 0.35);
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
    const unc = poolUncertainty();
    const g1 = ranked[0].score - ranked[1].score;
    const g2 = ranked.length > 2 ? ranked[1].score - ranked[2].score : g1 * 0.55;
    const rel = g1 / (Math.abs(ranked[0].score) + 1e-5);

    if (state.answered >= 6 && conf >= 0.72 && g1 >= 3.8) return true;
    if (state.answered >= 8 && conf >= 0.58 && g1 >= 2.8 && g2 >= 0.7) return true;
    if (state.answered >= 10 && unc < 0.32 && g1 >= 2.2) return true;
    if (state.answered >= 12 && unc < 0.42 && g1 >= 1.8) return true;

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

  function profileBarsHtml() {
    const entries = Object.entries(state.boost)
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (!entries.length) return "";
    const max = entries[0][1] || 1;
    const bars = entries.map(([axis, w]) => {
      const [dim, val] = axis.split(":");
      const name = REASON_LABEL[axis] || label(dim, val) || axis;
      const pct = Math.min(100, Math.round((w / max) * 100));
      return `<div class="pick-profile__row">
        <span class="pick-profile__name">${escapeHtml(name)}</span>
        <span class="pick-profile__track"><span class="pick-profile__fill" style="width:${pct}%"></span></span>
      </div>`;
    }).join("");
    return `<div class="pick-profile" aria-hidden="true"><p class="pick-profile__label">你的偏好</p>${bars}</div>`;
  }

  function introStatsHtml() {
    const meta = DATA.meta || {};
    const pool = meta.poolSize || games.length || "—";
    const bank = meta.questionBank || DATA.questions.length || "—";
    return `<ul class="pick-facts pick-facts--intro">
      <li><span>作品池</span><strong>${pool}</strong><small>部候选</small></li>
      <li><span>题库</span><strong>${bank}</strong><small>题随机抽</small></li>
      <li><span>题量</span><strong>∞</strong><small>随池缩小</small></li>
    </ul>`;
  }

  function traitChipsHtml(g) {
    const chips = [
      label("tone", g.tone),
      label("setting", g.setting),
      label("focus", g.focus),
    ].filter(Boolean);
    return chips.map((c) => `<span class="pick-chip">${escapeHtml(c)}</span>`).join("");
  }

  function panelPulse() {
    els.panel?.classList.remove("pick-panel--pulse");
    void els.panel?.offsetWidth;
    els.panel?.classList.add("pick-panel--pulse");
  }

  function gameUrl(g) {
    const id = (g.vndb_id || "").trim();
    if (/^v\d+$/i.test(id)) return `https://vndb.org/${id.toLowerCase()}`;
    const q = (g.name || gameLabel(g)).trim();
    return `https://vndb.org/v?q=${encodeURIComponent(q)}`;
  }

  function appendPickCard(container, g, { rank, compact }) {
    const reasons = matchReasons(g);
    const grad = TONE_GRADIENT[g.tone] || TONE_GRADIENT.sweet;
    const a = document.createElement("a");
    a.className = `pick-card${compact ? " pick-card--alt" : " pick-card--top"}`;
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
        return "已了解你的偏好";
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
    state.finishMode = "quiz";
  }

  function startQuiz() {
    resetRun();
    renderQuestion();
  }

  function startRandomPick() {
    resetRun();
    state.finishMode = "random";
    renderResult();
  }

  function finishEarly() {
    state.finishMode = "early";
    renderResult();
  }

  function bind() {
    els.root = document.getElementById("pick-root");
    els.panel = document.getElementById("pick-panel");
    els.lead = document.getElementById("pick-hero-lead");
    if (els.lead) {
      els.lead.textContent = DATA.meta?.subtitle || "找出最适合你的 Gal。";
    }
    games = dedupeGames(DATA.games);
    initTagIdf(games);
  }

  function renderIntro() {
    clearOptionKeys();
    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--intro pick-stage--intro-minimal pick-stage--enter">
        ${introStatsHtml()}
        <div class="pick-intro-actions">
          <button type="button" class="pick-btn pick-btn--primary" data-pick-start>开始答题</button>
          <button type="button" class="pick-btn pick-btn--ghost pick-btn--dice" data-pick-random>
            <span class="pick-btn__dice" aria-hidden="true">🎲</span> 不作答，随机一部
          </button>
        </div>
      </div>
    `;
    els.panel.querySelector("[data-pick-start]")?.addEventListener("click", startQuiz);
    els.panel.querySelector("[data-pick-random]")?.addEventListener("click", startRandomPick);
  }

  function handleOptionPick(btn, opt, box) {
    if (box.dataset.lock === "1") return;
    box.dataset.lock = "1";
    btn.classList.add("is-selected");
    box.querySelectorAll(".pick-option").forEach((el) => {
      if (el !== btn) el.classList.add("is-faded");
    });
    panelPulse();
    const delay = REDUCED_MOTION() ? 0 : 340;
    window.setTimeout(() => {
      applyOption(opt);
      state.answered += 1;
      advanceQuestion();
    }, delay);
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
    if (state.asked.size >= DATA.questions.length) {
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
    state.skipped += 1;
    state.skippedIds.add(q.id);
    advanceQuestion();
  }

  function renderQuestion() {
    if (finishOrContinue()) return;

    const q = pickNextQuestion();
    if (!q) {
      renderResult();
      return;
    }
    state.asked.add(q.id);

    const current = state.index + 1;
    const conf = matchConfidence(rankAlive());
    const pct = Math.min(100, (conf * 0.55 + poolShrinkRatio() * 0.45) * 100);
    const canSkip = state.skipped < MAX_SKIPS;
    const canFinishEarly = state.answered >= 1;
    const catBadge = CATEGORY_BADGE[q.category];
    const optLayout = optionsLayoutClass(q.options.length);
    const shrinkPct = Math.round(poolShrinkRatio() * 100);

    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--quiz pick-stage--enter ${categoryStageClass(q)}">
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
        ${profileBarsHtml()}
        ${catBadge ? `<p class="pick-q-badge">${escapeHtml(catBadge)}</p>` : ""}
        <h2 class="pick-q">${escapeHtml(q.text)}</h2>
        ${q.hint ? `<p class="pick-q-hint">${escapeHtml(q.hint)}</p>` : ""}
        <div class="pick-options ${optLayout}" id="pick-options"></div>
      </div>
    `;

    els.panel.querySelector("[data-pick-skip]")?.addEventListener("click", () => skipQuestion(q));
    els.panel.querySelector("[data-pick-finish]")?.addEventListener("click", finishEarly);

    const box = els.panel.querySelector("#pick-options");
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pick-option pick-option--enter";
      btn.style.setProperty("--pick-opt-i", String(i));
      const tags = boostTags(opt);
      btn.innerHTML = `
        <span class="pick-option__idx">${String.fromCharCode(65 + i)}</span>
        <span class="pick-option__body">
          <span class="pick-option__label">${escapeHtml(opt.label)}</span>
          ${tags ? `<span class="pick-option__tags">${tags}</span>` : ""}
        </span>`;
      btn.addEventListener("click", () => handleOptionPick(btn, opt, box));
      box.appendChild(btn);
    });
    bindOptionKeys(box, q.options);
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

    els.panel.querySelector("[data-pick-retry]")?.addEventListener("click", () => {
      renderIntro();
    });
    els.panel.querySelector("[data-pick-random-again]")?.addEventListener("click", startRandomPick);
  }

  function init() {
    bind();
    if (!els.panel) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("random") === "1") {
      startRandomPick();
      return;
    }
    renderIntro();
  }

  window.KayaGalPick = { init, startRandomPick };
})();
