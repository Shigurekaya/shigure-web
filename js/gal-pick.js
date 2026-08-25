/**
 * 萌新入坑推荐 — 样板交互
 */
(() => {
  const DATA = typeof GAL_PICK_DATA !== "undefined" ? GAL_PICK_DATA : null;
  if (!DATA) {
    console.error("[gal-pick] GAL_PICK_DATA missing");
    return;
  }

  const state = {
    mode: null,
    index: 0,
    scores: Object.create(null),
  };

  const els = {};

  function coverUrl(subjectId) {
    return `https://api.bgm.tv/v0/subjects/${subjectId}/image?type=medium`;
  }

  function resultById(id) {
    return DATA.results.find((r) => r.id === id);
  }

  function resetScores() {
    state.scores = Object.create(null);
    DATA.results.forEach((r) => {
      state.scores[r.id] = 0;
    });
  }

  function bind() {
    els.root = document.getElementById("pick-root");
    els.home = document.getElementById("pick-home");
    els.quiz = document.getElementById("pick-quiz");
    els.result = document.getElementById("pick-result");
    els.modeLabel = document.getElementById("pick-mode-label");
    els.qText = document.getElementById("pick-question-text");
    els.options = document.getElementById("pick-options");
    els.progressBar = document.getElementById("pick-progress-bar");
    els.progressCurrent = document.getElementById("pick-progress-current");
    els.progressTotal = document.getElementById("pick-progress-total");
    els.primary = document.getElementById("pick-result-primary");
    els.secondary = document.getElementById("pick-result-secondary");
    els.resultMode = document.getElementById("pick-result-mode");
    els.body = document.body;

    document.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => startMode(btn.dataset.mode));
    });
    document.getElementById("pick-exit")?.addEventListener("click", showHome);
    document.getElementById("pick-retry")?.addEventListener("click", () => {
      if (state.mode) startMode(state.mode);
    });
    document.getElementById("pick-home-btn")?.addEventListener("click", showHome);
  }

  function setTheme(mode) {
    els.body.classList.remove("page-pick--mode-home", "page-pick--mode-easy", "page-pick--mode-hard");
    if (mode === "easy") els.body.classList.add("page-pick--mode-easy");
    else if (mode === "hard") els.body.classList.add("page-pick--mode-hard");
    else els.body.classList.add("page-pick--mode-home");
  }

  function showHome() {
    state.mode = null;
    state.index = 0;
    setTheme("home");
    els.home.hidden = false;
    els.quiz.hidden = true;
    els.result.hidden = true;
  }

  function startMode(mode) {
    if (!DATA.questions[mode]) return;
    state.mode = mode;
    state.index = 0;
    resetScores();
    setTheme(mode);
    els.modeLabel.textContent = mode === "easy" ? "轻松模式" : "硬核模式";
    els.progressTotal.textContent = String(DATA.questions[mode].length);
    els.home.hidden = true;
    els.quiz.hidden = false;
    els.result.hidden = true;
    renderQuestion();
  }

  function renderQuestion() {
    const list = DATA.questions[state.mode];
    const q = list[state.index];
    const total = list.length;
    const current = state.index + 1;

    els.progressCurrent.textContent = String(current);
    els.progressBar.style.width = `${(current / total) * 100}%`;
    els.qText.textContent = q.text;
    els.options.innerHTML = "";

    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pick-option";
      btn.innerHTML = `<span class="pick-option__idx">${String.fromCharCode(65 + i)}</span><span class="pick-option__label">${opt.label}</span>`;
      btn.addEventListener("click", () => choose(opt.weights));
      els.options.appendChild(btn);
    });
  }

  function choose(weights) {
    Object.entries(weights || {}).forEach(([id, w]) => {
      state.scores[id] = (state.scores[id] || 0) + w;
    });
    const list = DATA.questions[state.mode];
    if (state.index + 1 >= list.length) {
      showResult();
      return;
    }
    state.index += 1;
    renderQuestion();
  }

  function vibeDistance(a, b) {
    if (!a || !b) return 1;
    return a === b ? 0 : 1;
  }

  function rankResults() {
    const ranked = DATA.results
      .map((r) => ({ ...r, score: state.scores[r.id] || 0 }))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    const primary = ranked[0];
    // 第 2 主推荐：优先选风格略有差异的高分项
    let second = ranked.slice(1).find((r) => vibeDistance(primary.vibe, r.vibe) > 0);
    if (!second) second = ranked[1];

    const used = new Set([primary.id, second?.id].filter(Boolean));
    const secondary = ranked.filter((r) => !used.has(r.id)).slice(0, 4);

    return { primary, second, secondary };
  }

  function cardHtml(r, rankLabel) {
    const cover = coverUrl(r.subjectId);
    return `
      <article class="pick-card ${rankLabel ? "pick-card--primary" : ""}">
        ${rankLabel ? `<span class="pick-card__rank">${rankLabel}</span>` : ""}
        <div class="pick-card__cover-wrap">
          <img class="pick-card__cover" src="${cover}" alt="" loading="lazy" decoding="async"
            onerror="this.classList.add('is-fallback'); this.removeAttribute('src');" />
        </div>
        <div class="pick-card__body">
          <h3 class="pick-card__name">${r.name}</h3>
          <p class="pick-card__hook">${r.hook}</p>
          <p class="pick-card__score">匹配权重 ${r.score}</p>
          <a class="pick-card__link" href="https://bgm.tv/subject/${r.subjectId}" target="_blank" rel="noopener noreferrer">Bangumi →</a>
        </div>
      </article>
    `;
  }

  function showResult() {
    const { primary, second, secondary } = rankResults();
    els.home.hidden = true;
    els.quiz.hidden = true;
    els.result.hidden = false;
    els.resultMode.textContent =
      state.mode === "easy" ? "轻松模式 · 2 主推荐 + 4 次要" : "硬核模式 · 2 主推荐 + 4 次要";

    els.primary.innerHTML =
      cardHtml(primary, "主推荐 1") + (second ? cardHtml(second, "主推荐 2") : "");

    els.secondary.innerHTML = secondary
      .map(
        (r) => `
      <a class="pick-mini" href="https://bgm.tv/subject/${r.subjectId}" target="_blank" rel="noopener noreferrer">
        <img src="${coverUrl(r.subjectId)}" alt="" loading="lazy" decoding="async"
          onerror="this.classList.add('is-fallback'); this.removeAttribute('src');" />
        <span>
          <strong>${r.name}</strong>
          <small>权重 ${r.score}</small>
        </span>
      </a>`,
      )
      .join("");
  }

  function init() {
    bind();
    showHome();
  }

  window.KayaGalPick = { init };
})();
