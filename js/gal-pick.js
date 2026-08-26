/**
 * Gal 心选 v5 — trait 向量 + IDF + 自适应选题 + 可跳过
 */
(() => {
  const DATA = typeof GAL_PICK_DATA !== "undefined" ? GAL_PICK_DATA : null;
  if (!DATA?.games?.length || !DATA?.questions?.length) {
    console.error("[gal-pick] GAL_PICK_DATA missing or empty");
    return;
  }

  const DRAW_MAX = Math.min(28, DATA.meta?.drawMax || 28, DATA.questions.length);
  const MIN_ANSWERS = 8;
  const MIN_TOTAL = 10;
  const MAX_SKIPS = 10;
  const CORE_IDS = new Set(["Q001", "Q002", "Q003", "Q004", "Q005", "Q006", "Q007", "Q008", "Q009", "Q010"]);

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

  let tagIdf = () => 1;
  let games = [];

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
    early: false,
  };

  const els = {};

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

  function axisWeight(axisKey) {
    const [dim] = axisKey.split(":");
    return AXIS_WEIGHT[dim] || 1;
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

  function applyHardDrops(opt) {
    const floor = dropFloor();
    (opt.drop || []).forEach((axis) => {
      const next = state.alive.filter((g) => !tagOf(g, axis) && traitStrength(g, axis) < 0.55);
      if (next.length >= floor) {
        state.alive = next;
        state.drops.add(axis);
      } else {
        state.penalty[axis] = (state.penalty[axis] || 0) - (state.alive.length > 55 ? 5.5 : 4);
      }
    });
  }

  function convergePool() {
    if (state.alive.length <= 3) return;
    const ranked = rankAlive();
    const top = ranked[0].score;
    const progress = state.index / DRAW_MAX;
    const scores = ranked.map((g) => g.score);
    const p75 = scores[Math.floor(scores.length * 0.25)] || top - 4;
    const slack = Math.max(1.2, Math.min(9, top - p75 + 1.5 - progress * 2));
    let kept = ranked.filter((g) => g.score >= top - slack);
    if (!kept.length) kept = ranked.slice(0, 2);
    const cap = Math.max(4, Math.ceil(52 - state.index * 2.4 - progress * 14));
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
    if (state.skippedIds.has(q.id)) w *= 0.15;
    if (q.skippable && state.answered < 6) w *= 0.55;
    if (CORE_IDS.has(q.id) && state.answered < 8) w *= 1.35;
    return w;
  }

  function pickNextQuestion() {
    const coreLeft = DATA.questions.filter((q) => CORE_IDS.has(q.id) && !state.asked.has(q.id));
    if (state.answered < 6 && coreLeft.length) {
      return coreLeft[Math.floor(Math.random() * coreLeft.length)];
    }
    const pool = DATA.questions.filter((q) => !state.asked.has(q.id));
    if (!pool.length) return null;
    const sample = shuffle(pool)
      .sort((a, b) => questionWeight(b) - questionWeight(a))
      .slice(0, 32);
    let best = sample[0];
    let bestV = -1;
    sample.forEach((q) => {
      const disc = Math.max(...q.options.map((o) => optionDiscrimination(o, state.alive, state.boost, state.penalty)));
      const v = disc * questionWeight(q);
      if (v > bestV) {
        bestV = v;
        best = q;
      }
    });
    return best;
  }

  function shouldConfidentFinish(ranked) {
    if (ranked.length <= 1) return true;
    if (state.answered < MIN_ANSWERS) return false;
    if (state.index < MIN_TOTAL && state.skipped < 3) return false;
    const g1 = ranked[0].score - ranked[1].score;
    const g2 = ranked.length > 2 ? ranked[1].score - ranked[2].score : g1 * 0.5;
    const rel = g1 / (Math.abs(ranked[0].score) + 1e-5);
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

  function searchUrl(name) {
    return `https://bgm.tv/subject_search/${encodeURIComponent(name)}?cat=4`;
  }

  function appendPickCard(container, g, { rank, compact }) {
    const reasons = matchReasons(g);
    const a = document.createElement("a");
    a.className = `pick-card${compact ? " pick-card--alt" : " pick-card--top"}`;
    a.href = searchUrl(gameLabel(g));
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML = `
      <span class="pick-card__rank">${String(rank).padStart(2, "0")}</span>
      <span class="pick-card__body">
        <strong class="pick-card__name">${gameLabel(g)}</strong>
        ${g.displayName && g.displayName !== g.name ? `<small class="pick-card__alt">${g.name}</small>` : ""}
        <small class="pick-card__meta">${reasonLine(g)}</small>
        ${reasons.length ? `<small class="pick-card__why">合你：${reasons.join(" · ")}</small>` : ""}
      </span>
      <span class="pick-card__go" aria-hidden="true">↗</span>
    `;
    container.appendChild(a);
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
    state.early = false;
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
    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--intro pick-stage--intro-minimal">
        <button type="button" class="pick-btn pick-btn--primary" data-pick-start>开始</button>
      </div>
    `;
    els.panel.querySelector("[data-pick-start]")?.addEventListener("click", () => {
      resetRun();
      renderQuestion();
    });
  }

  function finishOrContinue() {
    const ranked = rankAlive();
    if (shouldConfidentFinish(ranked)) {
      state.early = true;
      renderResult();
      return true;
    }
    if (state.index >= DRAW_MAX || state.asked.size >= DATA.questions.length) {
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
    const pct = Math.min(100, ((state.answered + 1) / DRAW_MAX) * 100);
    const canSkip = state.skipped < MAX_SKIPS;

    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--quiz">
        <div class="pick-status">
          <div class="pick-status__row">
            <span>第 <strong>${current}</strong> 题${state.answered ? ` · 已答 ${state.answered}` : ""}</span>
            ${canSkip ? `<button type="button" class="pick-skip" data-pick-skip>跳过</button>` : ""}
          </div>
          <div class="pick-progress" aria-hidden="true"><span class="pick-progress__bar" style="width:${pct}%"></span></div>
        </div>
        <h2 class="pick-q">${q.text}</h2>
        ${q.hint ? `<p class="pick-q-hint">${q.hint}</p>` : ""}
        <div class="pick-options" id="pick-options"></div>
      </div>
    `;

    els.panel.querySelector("[data-pick-skip]")?.addEventListener("click", () => skipQuestion(q));

    const box = els.panel.querySelector("#pick-options");
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pick-option";
      btn.innerHTML = `<span class="pick-option__idx">${String.fromCharCode(65 + i)}</span><span class="pick-option__label">${opt.label}</span>`;
      btn.addEventListener("click", () => {
        applyOption(opt);
        state.answered += 1;
        advanceQuestion();
      });
      box.appendChild(btn);
    });
  }

  function renderResult() {
    let alive = survivingGames();
    if (!alive.length) alive = games.slice();
    const ranked = rankList(alive);
    const top = ranked[0];
    const alts = top ? pickSecondaryCandidates(top, ranked) : [];

    els.panel.innerHTML = `
      <div class="pick-stage pick-stage--result">
        <p class="pick-result-kicker">${state.early ? "匹配完成" : "已了解你的偏好"}</p>
        <h2 class="pick-result-title">就是这部</h2>
        <div class="pick-results pick-results--hero" id="pick-results-main"></div>
        ${
          alts.length
            ? `<h3 class="pick-alts-title">也符合你的选择</h3>
        <div class="pick-results pick-results--alts" id="pick-results-alts"></div>`
            : ""
        }
        <div class="pick-actions">
          <button type="button" class="pick-btn pick-btn--ghost" data-pick-retry>再来一局</button>
          <a class="pick-btn pick-btn--primary" href="/">回主页</a>
        </div>
        <p class="pick-note">点卡片去 Bangumi 搜索 · 娱乐向匹配</p>
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
      resetRun();
      renderIntro();
    });
  }

  function init() {
    bind();
    if (!els.panel) return;
    renderIntro();
  }

  window.KayaGalPick = { init };
})();
