/**
 * Gal 水平测试页逻辑：随机 20 题 / 全部测试、媒体展示、判分计分
 */
(() => {
  const RANDOM_DRAW = 20;
  const RANDOM_PTS = 5;
  const FULL_MAX = 100;

  function $(id) {
    return document.getElementById(id);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function cjkCount(s) {
    return [...String(s)].filter((ch) => /\p{Script=Han}/u.test(ch)).length;
  }

  function normalize(s) {
    return String(s || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\u3000]/g, "")
      .replace(/[/、\-—]/g, "")
      .replace(/[「」『』【】\[\]()（）]/g, "")
      .replace(/['".,。，!！?？~～・·♥♡★☆†‡=＝:：;；]/g, "")
      .replace(/ー/g, "")
      .replace(/〜/g, "");
  }

  function answerVariants(raw) {
    const full = normalize(raw);
    const parts = String(raw || "")
      .split(/[/／、]/)
      .map((p) => normalize(p))
      .filter(Boolean);
    return [...new Set([full, ...parts])];
  }

  function partialMatch(u, v) {
    if (u === v) return true;
    // 短中文关键词（如「众筹」）：用户答案包含即可
    if (cjkCount(v) >= 2 && v.length >= 2 && v.length < 4 && u.includes(v)) {
      return true;
    }
    if (v.length >= 4 && u.includes(v)) return true;
    if (u.length >= 4 && v.includes(u)) {
      if (cjkCount(u) >= 3 && cjkCount(v) >= 3) return true;
      if (u.length >= Math.ceil(v.length * 0.6)) return true;
    }
    return false;
  }

  function checkMatchBlanks(parts, blanks) {
    if (!blanks || !blanks.length) return false;
    if (parts.length < blanks.length) return false;
    return blanks.every((keys, i) => {
      const u = normalize(parts[i] || "");
      if (!u) return false;
      return (keys || []).some((k) => {
        const v = normalize(k);
        return v && u.includes(v);
      });
    });
  }

  function checkText(user, answers) {
    const u = normalize(user);
    if (!u) return false;
    return (answers || []).some((a) =>
      answerVariants(a).some((v) => v && partialMatch(u, v))
    );
  }

  const LR_Q = /左.*右|右.*左|哪边/;
  const DUAL_Q = /①与②|①.*②/;
  const CIRC = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

  function compareLayout(q) {
    const imgs = q.images || [];
    const text = q.question || "";
    const n = imgs.length;
    if (n === 2) {
      if (LR_Q.test(text)) return "lr";
      if (DUAL_Q.test(text)) return "dual";
    }
    if (n === 3 && /①.*②.*③|①～③|①②③|三句|三张|3张/.test(text)) {
      return "triple";
    }
    // 启动图标等：恰好 4 张且题干写 ①～④
    if (n === 4 && /①～④|①〜④/.test(text)) return "quad";
    // 吉祥物 ①～⑦
    if (n === 7 && /①～⑦|①〜⑦/.test(text)) return "sept";
    // T 恤 A/B/C + 女主 ①②③（前 3 件衫、后 3 人）
    if (n === 6 && /T\s*恤|Ｔシャツ/.test(text) && /①.*②.*③|①②③|①～③/.test(text)) {
      return "tee";
    }
    // DEARDROPS：角色 ①②③ + 乐器 ＡＢＣ
    if (n === 6 && /乐器|楽器/.test(text) && /A\/B\/C|Ａ|①/.test(text)) {
      return "instrument";
    }
    // 包装原画题：主图 + 提示图
    if (n === 2 && /提示图|ヒント|参考にして|可参考/.test(text)) {
      return "hint2";
    }
    // 上排参考 + 下排角色（如 s4-08）
    if (
      n === 6 &&
      /下方|下３|下3|候选/.test(text) &&
      !/T\s*恤|Ｔシャツ|乐器|楽器/.test(text)
    ) {
      return "ref6";
    }
    return null;
  }

  function compareLabels(mode) {
    if (mode === "lr") return ["左", "右"];
    if (mode === "triple") return ["①", "②", "③"];
    if (mode === "quad") return CIRC.slice(0, 4);
    if (mode === "sept") return CIRC.slice(0, 7);
    if (mode === "tee") return ["Ａ", "Ｂ", "Ｃ", "①", "②", "③"];
    if (mode === "instrument") return ["①", "②", "③", "Ａ", "Ｂ", "Ｃ"];
    if (mode === "hint2") return ["题目图", "提示图"];
    if (mode === "ref6") return ["参考①", "参考②", "参考③", "①", "②", "③"];
    return ["①", "②"];
  }

  function rankLabel(score) {
    if (score >= 90) return "旮旯大神预备役";
    if (score >= 75) return "资深 Gal 玩家";
    if (score >= 55) return "一般 Gal 玩家";
    if (score >= 35) return "入门 Gal 玩家";
    return "还需努力（再开一局！）";
  }

  function correctAnswerText(q) {
    if (q.type === "choice") {
      const idxs = Array.isArray(q.answer) ? q.answer : [q.answer];
      return idxs.map((i) => q.options[i]).filter(Boolean).join(" / ");
    }
    if (q.type === "match") {
      const slots = q.slots || [];
      return (q.answer || [])
        .map((opts, i) => `${slots[i] || i + 1}${(opts || []).join("/")}`)
        .join("　");
    }
    if (q.match_blanks && q.match_blanks.length) {
      const labels = q.blank_labels || [];
      return q.match_blanks
        .map((keys, i) => `${labels[i] || i + 1}：${(keys || []).join("/")}`)
        .join("　");
    }
    return (q.answers || []).join(" / ");
  }

  /** TEMP: 原本为填空、后改成选择题的题号（校对用；已再改为 match 的已移出） */
  const CONVERTED_FROM_TEXT = new Set([
    "s1-09", "s1-10", "s1-14", "s1-15",
    "s2-02", "s2-03", "s2-04", "s2-05",
    "s2-13", "s2-18",
    "s3-01", "s3-03", "s3-04", "s3-05",
    "s3-10", "s3-13", "s3-15", "s3-16", "s3-17", "s3-18",
    "s4-02", "s4-03", "s4-04", "s4-07", "s4-08", "s4-10", "s4-15", "s4-16",
    "s5-03", "s5-07", "s5-08", "s5-10", "s5-12",
    "s5-13", "s5-17",
  ]);

  function debugTypeLabel(q) {
    if (q.type === "match") return "选填题（拖拽/点选）";
    if (q.type === "text") return "填空题";
    if (CONVERTED_FROM_TEXT.has(q.id)) return "原填空→选择题";
    return "原本选择题";
  }

  function resolveMediaUrl(src) {
    if (!src) return "";
    if (/^https?:\/\//i.test(src)) return src;
    return src.startsWith("/") ? src : `/${String(src).replace(/^\.\//, "")}`;
  }

  /** 已发起预加载的 URL → Promise，切题时复用浏览器缓存 */
  const imgPreload = new Map();

  function preloadImage(src) {
    const url = resolveMediaUrl(src);
    if (!url) return Promise.resolve(null);
    const cached = imgPreload.get(url);
    if (cached) return cached;
    const job = new Promise((resolve) => {
      const el = new Image();
      el.decoding = "async";
      const done = () => resolve(el);
      el.onload = done;
      el.onerror = () => resolve(null);
      el.src = url;
    });
    imgPreload.set(url, job);
    return job;
  }

  function preloadQuestionImages(q) {
    if (!q?.images?.length) return;
    q.images.forEach((src) => {
      preloadImage(src);
    });
  }

  /** 预加载当前题之后的若干题配图（默认下一题 + 再下一题） */
  function preloadAhead(fromIndex, ahead = 2) {
    const deck = state.deck;
    if (!deck.length) return;
    const end = Math.min(deck.length, fromIndex + 1 + ahead);
    for (let i = fromIndex + 1; i < end; i++) {
      preloadQuestionImages(deck[i]);
    }
  }

  function clearImagePreload() {
    imgPreload.clear();
  }

  function mountMedia(q) {
    const host = $("quiz-media");
    if (!host) return;

    host.replaceChildren();
    const images = q.images || [];
    const audio = q.audio || [];
    const video = q.video || [];

    if (!images.length && !audio.length && !video.length) {
      host.hidden = true;
      return;
    }

    host.hidden = false;

    const layout = compareLayout(q);
    if (layout) {
      host.classList.add("quiz-media--compare");
      const layoutClass =
        layout === "lr"
          ? "quiz-media--compare-lr"
          : layout === "triple"
            ? "quiz-media--compare-triple"
            : layout === "quad"
              ? "quiz-media--compare-quad"
              : layout === "sept"
                ? "quiz-media--compare-sept"
                : layout === "tee" || layout === "instrument" || layout === "ref6"
                  ? "quiz-media--compare-six"
                  : layout === "hint2"
                    ? "quiz-media--compare-dual"
                    : "quiz-media--compare-dual";
      host.classList.add(layoutClass);
    } else {
      host.classList.remove(
        "quiz-media--compare",
        "quiz-media--compare-lr",
        "quiz-media--compare-dual",
        "quiz-media--compare-triple",
        "quiz-media--compare-quad",
        "quiz-media--compare-sept",
        "quiz-media--compare-six"
      );
    }

    const labels = layout ? compareLabels(layout) : [];

    images.forEach((src, idx) => {
      const fig = document.createElement("figure");
      fig.className = "quiz-media__item";
      if (labels[idx]) {
        const cap = document.createElement("figcaption");
        cap.className = "quiz-media__label";
        cap.textContent = labels[idx];
        fig.appendChild(cap);
      }
      const img = document.createElement("img");
      img.src = resolveMediaUrl(src);
      img.alt = "题目配图";
      img.loading = "eager";
      img.decoding = "async";
      img.addEventListener("error", () => {
        fig.classList.add("is-error");
        const msg = document.createElement("p");
        msg.className = "quiz-media__error";
        msg.textContent = "图片加载失败，请刷新页面重试。";
        img.replaceWith(msg);
      });
      fig.appendChild(img);
      host.appendChild(fig);
    });

    audio.forEach((src) => {
      const wrap = document.createElement("div");
      wrap.className = "quiz-media__item quiz-media__audio";
      const el = document.createElement("audio");
      el.controls = true;
      el.preload = "none";
      el.src = resolveMediaUrl(src);
      wrap.appendChild(el);
      host.appendChild(wrap);
    });

    video.forEach((src) => {
      const wrap = document.createElement("div");
      wrap.className = "quiz-media__item quiz-media__video";
      const el = document.createElement("video");
      el.controls = true;
      el.preload = "none";
      el.src = resolveMediaUrl(src);
      wrap.appendChild(el);
      host.appendChild(wrap);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function historyItemHtml(h) {
    const ok = h.ok;
    const cls = ok ? "is-ok" : "is-ng";
    const badge = ok ? "✓" : "✗";
    const right = correctAnswerText(h.q);
    const userLabel = h.skipped ? "（未作答）" : h.user || "（空）";
    const meta = ok
      ? `<div><dt>你的答案</dt><dd>${escapeHtml(userLabel)}</dd></div>`
      : `<div><dt>你的答案</dt><dd>${escapeHtml(userLabel)}</dd></div>
        <div><dt>参考答案</dt><dd>${escapeHtml(right)}</dd></div>
        ${h.q.explain ? `<div><dt>解析</dt><dd>${escapeHtml(h.q.explain)}</dd></div>` : ""}`;
    return `<li class="quiz-review-item ${cls}">
      <div class="quiz-review-item__head">
        <span class="quiz-review-item__badge">${badge}</span>
        <strong>#${h.num}</strong>
        <span class="quiz-review-item__id">${escapeHtml(h.q.id)}</span>
      </div>
      <p class="quiz-review-item__q">${escapeHtml(h.q.question)}</p>
      <dl class="quiz-review-item__meta">${meta}</dl>
    </li>`;
  }

  const state = {
    mode: "random",
    deck: [],
    total: RANDOM_DRAW,
    i: 0,
    chosen: null,
    matchPicks: [],
    matchHeld: null,
    records: [],
  };

  function bank() {
    return window.GAL_QUIZ_BANK || [];
  }

  function current() {
    return state.deck[state.i];
  }

  function show(el, on) {
    if (el) el.hidden = !on;
  }

  function ptsPerQuestion() {
    return state.mode === "random" ? RANDOM_PTS : FULL_MAX / state.total;
  }

  function checkMatchSlots(picks, answer) {
    if (!answer || !answer.length) return false;
    if (!picks || picks.length < answer.length) return false;
    return answer.every((accepted, i) => {
      const v = normalize(picks[i] || "");
      if (!v) return false;
      return (accepted || []).some((a) => normalize(a) === v);
    });
  }

  function readAnswer(q) {
    if (q.type === "choice") {
      if (state.chosen == null) return { user: "", ok: false, missing: true };
      const user = q.options[state.chosen];
      const ans = q.answer;
      const ok = Array.isArray(ans) ? ans.includes(state.chosen) : state.chosen === ans;
      return { user, ok, missing: false };
    }
    if (q.type === "match") {
      const slots = q.slots || [];
      const picks = state.matchPicks || [];
      const filled = picks.filter(Boolean);
      if (!filled.length) return { user: "", ok: false, missing: true };
      const user = slots
        .map((lab, i) => `${lab}${picks[i] || "（空）"}`)
        .join(" / ");
      return {
        user,
        ok: checkMatchSlots(picks, q.answer),
        missing: false,
        matchPicks: picks.slice(),
      };
    }
    if (q.match_blanks && q.match_blanks.length) {
      const parts = q.match_blanks.map((_, i) => {
        const el = $(`quiz-text-input-${i}`);
        return (el && el.value.trim()) || "";
      });
      if (parts.every((p) => !p)) return { user: "", ok: false, missing: true };
      const user = parts.join(" / ");
      return { user, ok: checkMatchBlanks(parts, q.match_blanks), missing: false };
    }
    const input = $("quiz-text-input");
    const user = (input && input.value.trim()) || "";
    if (!user) return { user: "", ok: false, missing: true };
    return { user, ok: checkText(user, q.answers), missing: false };
  }

  function showWarn(msg) {
    const fb = $("quiz-feedback");
    fb.hidden = false;
    fb.className = "quiz-feedback is-warn";
    fb.textContent = msg;
  }

  function clearWarn() {
    const fb = $("quiz-feedback");
    fb.hidden = true;
    fb.textContent = "";
    fb.className = "quiz-feedback";
  }

  function answeredCount() {
    return state.records.filter(Boolean).length;
  }

  function computeScore() {
    const pts = ptsPerQuestion();
    return state.records.reduce((sum, r) => (r && r.ok ? sum + pts : sum), 0);
  }

  function saveCurrentIfFilled() {
    const q = current();
    if (!q) return;
    const { user, ok, missing, matchPicks } = readAnswer(q);
    if (missing) {
      state.records[state.i] = null;
      return;
    }
    state.records[state.i] = {
      user,
      ok,
      chosen: state.chosen,
      matchPicks: matchPicks || null,
    };
  }

  function buildHistory() {
    return state.records.map((rec, idx) => ({
      q: state.deck[idx],
      user: rec ? rec.user : "",
      ok: !!(rec && rec.ok),
      skipped: !rec,
      num: idx + 1,
    }));
  }

  function unansweredCount() {
    return state.records.filter((r) => !r).length;
  }

  function setNavOpen(open) {
    const play = $("quiz-play");
    const toggle = $("quiz-nav-toggle");
    const backdrop = $("quiz-nav-backdrop");
    if (!play) return;
    play.classList.toggle("is-nav-open", open);
    if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (backdrop) backdrop.hidden = !open;
  }

  function closeNavMobile() {
    setNavOpen(false);
  }

  function openNavMobile() {
    setNavOpen(true);
  }

  function renderNav() {
    const list = $("quiz-nav-list");
    const countDone = $("quiz-nav-count-done");
    const countTotal = $("quiz-nav-count-total");
    const miniFill = $("quiz-nav-mini-fill");
    const toggleText = $("quiz-nav-toggle-text");
    if (!list) return;

    const done = answeredCount();
    if (countDone) countDone.textContent = String(done);
    if (countTotal) countTotal.textContent = String(state.total);
    if (miniFill) miniFill.style.width = `${(done / state.total) * 100}%`;
    if (toggleText) toggleText.textContent = `${done}/${state.total}`;

    list.replaceChildren();
    for (let idx = 0; idx < state.total; idx++) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-nav__item";
      btn.textContent = String(idx + 1);
      btn.setAttribute("aria-label", `第 ${idx + 1} 题`);
      if (idx === state.i) btn.classList.add("is-current");
      const rec = state.records[idx];
      if (rec) btn.classList.add("is-done");
      btn.addEventListener("click", () => {
        if (idx === state.i) {
          closeNavMobile();
          return;
        }
        saveCurrentIfFilled();
        state.i = idx;
        renderQ();
        closeNavMobile();
      });
      li.appendChild(btn);
      list.appendChild(li);
    }

    const currentBtn = list.querySelector(".quiz-nav__item.is-current");
    if (currentBtn && typeof currentBtn.scrollIntoView === "function") {
      requestAnimationFrame(() => {
        currentBtn.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    }
  }

  function start(mode, opts) {
    const all = bank();
    if (!all.length) {
      alert("题库未加载");
      return;
    }

    const focusId = opts && opts.focusId ? String(opts.focusId).trim() : "";
    state.mode = mode === "full" || focusId ? "full" : "random";
    if (state.mode === "full") {
      /* 深链直达时保持题库顺序，便于定位；普通全题仍打乱 */
      state.deck = focusId ? all.slice() : shuffle(all);
      state.total = all.length;
    } else {
      if (all.length < RANDOM_DRAW) {
        alert(`题库不足 ${RANDOM_DRAW} 题`);
        return;
      }
      state.deck = shuffle(all).slice(0, RANDOM_DRAW);
      state.total = RANDOM_DRAW;
    }

    state.i = 0;
    if (focusId) {
      const idx = state.deck.findIndex((q) => q.id === focusId);
      if (idx < 0) {
        alert(`未找到题目 ${focusId}`);
        return;
      }
      state.i = idx;
    }

    state.records = Array(state.total).fill(null);
    clearImagePreload();
    document.querySelector(".page-main--quiz")?.classList.add("is-quiz-active");
    show($("quiz-intro"), false);
    show($("quiz-result"), false);
    show($("quiz-play"), true);
    closeNavMobile();
    $("quiz-play")?.classList.toggle("is-full", state.mode === "full");
    /* 开局预取第 1、2 题配图，再渲染 */
    preloadAhead(state.i - 1, 2);
    renderQ();
  }

  function focusIdFromLocation() {
    try {
      const path = window.location.pathname || "";
      const m = path.match(/^\/gal-quiz\/([^/]+)\/?$/i);
      if (m) {
        const seg = decodeURIComponent(m[1]).trim();
        if (seg && !/\.html?$/i.test(seg)) return seg;
      }
    } catch (_) {}
    try {
      const params = new URLSearchParams(window.location.search || "");
      return (params.get("q") || params.get("id") || "").trim();
    } catch (_) {
      return "";
    }
  }

  function applyDeepLink() {
    const focusId = focusIdFromLocation();
    if (!focusId) return;
    start("full", { focusId });
  }

  function paintMatch(box, q) {
    const used = new Set((state.matchPicks || []).filter(Boolean));
    box.querySelectorAll("[data-match-slot]").forEach((el) => {
      const i = Number(el.dataset.matchSlot);
      const val = (state.matchPicks && state.matchPicks[i]) || "";
      el.classList.toggle("is-filled", !!val);
      el.classList.toggle("is-drop-target", state.matchHeld != null && !val);
      const valueEl = el.querySelector(".quiz-match-slot__value");
      if (valueEl) valueEl.textContent = val || "拖入 / 点选填入";
    });
    box.querySelectorAll("[data-match-pool]").forEach((el) => {
      const word = el.dataset.matchPool;
      const taken = used.has(word);
      const held = state.matchHeld === word;
      el.classList.toggle("is-used", taken);
      el.classList.toggle("is-held", held);
      el.draggable = !taken;
      el.disabled = taken;
    });
  }

  function placeMatchWord(slotIdx, word, q, box) {
    if (slotIdx < 0 || slotIdx >= (q.slots || []).length) return;
    if (!word) return;
    const picks = state.matchPicks || [];
    const prevAt = picks.indexOf(word);
    if (prevAt >= 0) picks[prevAt] = "";
    picks[slotIdx] = word;
    state.matchPicks = picks;
    state.matchHeld = null;
    clearWarn();
    paintMatch(box, q);
  }

  function clearMatchSlot(slotIdx, q, box) {
    if (!state.matchPicks) return;
    state.matchPicks[slotIdx] = "";
    state.matchHeld = null;
    clearWarn();
    paintMatch(box, q);
  }

  function renderMatch(box, q) {
    const wrap = document.createElement("div");
    wrap.className = "quiz-match";

    const hint = document.createElement("p");
    hint.className = "quiz-match__hint";
    hint.textContent = "点选词条后点槽位填入，也可拖拽；再点已填槽位可清空。";
    wrap.appendChild(hint);

    const slots = document.createElement("div");
    slots.className = "quiz-match-slots";
    (q.slots || []).forEach((lab, i) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "quiz-match-slot";
      slot.dataset.matchSlot = String(i);
      slot.innerHTML = `<span class="quiz-match-slot__lab">${escapeHtml(lab)}</span><span class="quiz-match-slot__value">拖入 / 点选填入</span>`;
      slot.addEventListener("click", () => {
        const cur = (state.matchPicks && state.matchPicks[i]) || "";
        if (state.matchHeld) {
          placeMatchWord(i, state.matchHeld, q, box);
          return;
        }
        if (cur) clearMatchSlot(i, q, box);
      });
      slot.addEventListener("dragover", (e) => {
        e.preventDefault();
        slot.classList.add("is-dragover");
      });
      slot.addEventListener("dragleave", () => slot.classList.remove("is-dragover"));
      slot.addEventListener("drop", (e) => {
        e.preventDefault();
        slot.classList.remove("is-dragover");
        const word = e.dataTransfer.getData("text/plain");
        if (word) placeMatchWord(i, word, q, box);
      });
      slots.appendChild(slot);
    });
    wrap.appendChild(slots);

    const pool = document.createElement("div");
    pool.className = "quiz-match-pool";
    (q.pool || []).forEach((word) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "quiz-match-chip";
      chip.dataset.matchPool = word;
      chip.textContent = word;
      chip.draggable = true;
      chip.addEventListener("click", () => {
        if (chip.classList.contains("is-used")) return;
        state.matchHeld = state.matchHeld === word ? null : word;
        clearWarn();
        paintMatch(box, q);
      });
      chip.addEventListener("dragstart", (e) => {
        if (chip.classList.contains("is-used")) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/plain", word);
        e.dataTransfer.effectAllowed = "move";
        chip.classList.add("is-dragging");
        state.matchHeld = word;
        paintMatch(box, q);
      });
      chip.addEventListener("dragend", () => {
        chip.classList.remove("is-dragging");
        state.matchHeld = null;
        paintMatch(box, q);
      });
      pool.appendChild(chip);
    });
    wrap.appendChild(pool);
    box.appendChild(wrap);
    paintMatch(box, q);
  }

  function renderQ() {
    const q = current();
    state.chosen = null;

    $("quiz-progress-text").textContent = `${state.i + 1} / ${state.total}`;
    $("quiz-progress-fill").style.width = `${((state.i + 1) / state.total) * 100}%`;
    const cardNum = $("quiz-card-num");
    if (cardNum) cardNum.textContent = `Q${state.i + 1}`;
    $("quiz-meta").textContent = q.id;
    $("quiz-question").textContent = q.question;
    const debug = $("quiz-answer-debug");
    if (debug) {
      const ans = correctAnswerText(q);
      const explain = (q.explain || "").trim();
      const typeLabel = debugTypeLabel(q);
      const typeClass = CONVERTED_FROM_TEXT.has(q.id)
        ? "is-converted"
        : q.type === "match"
          ? "is-match"
          : q.type === "text"
            ? "is-text"
            : "is-orig-choice";
      debug.innerHTML = `<span class="quiz-answer-debug__label">临时答案</span>
        <span class="quiz-answer-debug__type ${typeClass}">${escapeHtml(typeLabel)}</span>
        <p class="quiz-answer-debug__ans">${escapeHtml(ans || "（无）")}</p>
        ${explain ? `<p class="quiz-answer-debug__explain">${escapeHtml(explain)}</p>` : ""}`;
    }
    mountMedia(q);
    preloadAhead(state.i, 2);
    clearWarn();

    const nextBtn = $("quiz-next");
    const prevBtn = $("quiz-prev");
    show(nextBtn, true);
    nextBtn.textContent = state.i >= state.total - 1 ? "查看成绩" : "下一题";
    if (prevBtn) {
      show(prevBtn, state.i > 0);
    }

    renderNav();

    const box = $("quiz-answers");
    box.innerHTML = "";
    state.matchHeld = null;
    state.matchPicks = (q.slots || []).map(() => "");

    if (q.type === "choice") {
      q.options.forEach((opt, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz-option";
        btn.textContent = opt;
        btn.addEventListener("click", () => {
          state.chosen = idx;
          clearWarn();
          [...box.querySelectorAll(".quiz-option")].forEach((b) =>
            b.classList.toggle("is-selected", b === btn)
          );
        });
        box.appendChild(btn);
      });
    } else if (q.type === "match") {
      renderMatch(box, q);
    } else if (q.match_blanks && q.match_blanks.length) {
      const wrap = document.createElement("div");
      wrap.className = "quiz-text-wrap quiz-text-wrap--blanks";
      const labels = q.blank_labels || [];
      q.match_blanks.forEach((_, i) => {
        const row = document.createElement("div");
        row.className = "quiz-blank-row";
        const lab = document.createElement("label");
        lab.className = "quiz-blank-label";
        lab.htmlFor = `quiz-text-input-${i}`;
        lab.textContent = labels[i] || `${i + 1}`;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "quiz-input";
        input.id = `quiz-text-input-${i}`;
        input.placeholder = q.placeholder || "输入答案…";
        input.autocomplete = "off";
        input.addEventListener("input", clearWarn);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const nextBlank = $(`quiz-text-input-${i + 1}`);
            if (nextBlank) nextBlank.focus();
            else next();
          }
        });
        row.appendChild(lab);
        row.appendChild(input);
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
      setTimeout(() => $("quiz-text-input-0")?.focus(), 50);
    } else {
      const wrap = document.createElement("div");
      wrap.className = "quiz-text-wrap";

      // 仅左右/①②③ 对照题提供格式 chip；禁止把 answers 白名单渲成可点选项（泄题）
      const layout = compareLayout(q);
      const chipLabels = layout ? compareLabels(layout) : [];

      if (chipLabels.length) {
        const chips = document.createElement("div");
        chips.className = "quiz-chips";
        chipLabels.forEach((label) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "quiz-chip";
          chip.textContent = label;
          chip.title = label;
          chip.addEventListener("click", () => {
            const input = wrap.querySelector("#quiz-text-input");
            if (input) {
              input.value = label;
              clearWarn();
              input.focus();
            }
          });
          chips.appendChild(chip);
        });
        wrap.appendChild(chips);
      }

      const input = document.createElement("input");
      input.type = "text";
      input.className = "quiz-input";
      input.id = "quiz-text-input";
      input.placeholder = q.placeholder || "输入答案…";
      input.autocomplete = "off";
      input.addEventListener("input", clearWarn);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          next();
        }
      });
      wrap.appendChild(input);
      box.appendChild(wrap);
      setTimeout(() => input.focus(), 50);
    }

    const rec = state.records[state.i];
    if (rec) {
      if (q.type === "choice" && rec.chosen != null) {
        state.chosen = rec.chosen;
        const btns = box.querySelectorAll(".quiz-option");
        if (btns[rec.chosen]) btns[rec.chosen].classList.add("is-selected");
      } else if (q.type === "match" && Array.isArray(rec.matchPicks)) {
        state.matchPicks = rec.matchPicks.slice();
        paintMatch(box, q);
      } else if (q.match_blanks && q.match_blanks.length) {
        const parts = String(rec.user || "").split(/\s*\/\s*/);
        q.match_blanks.forEach((_, i) => {
          const input = $(`quiz-text-input-${i}`);
          if (input) input.value = parts[i] || "";
        });
      } else if (q.type !== "choice" && q.type !== "match") {
        const input = $("quiz-text-input");
        if (input) input.value = rec.user;
      }
    }

    const toolbar = document.querySelector(".quiz-play__toolbar");
    if (toolbar && typeof toolbar.scrollIntoView === "function") {
      requestAnimationFrame(() => {
        toolbar.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }
  }

  function prev() {
    if (state.i <= 0) return;
    saveCurrentIfFilled();
    state.i -= 1;
    renderQ();
  }

  function next() {
    saveCurrentIfFilled();
    clearWarn();

    if (state.i >= state.total - 1) {
      finish();
      return;
    }
    state.i += 1;
    renderQ();
  }

  function finish() {
    saveCurrentIfFilled();
    clearWarn();

    const history = buildHistory();
    const skipped = unansweredCount();
    show($("quiz-play"), false);
    show($("quiz-result"), true);
    document.querySelector(".page-main--quiz")?.classList.remove("is-quiz-active");
    closeNavMobile();

    const correct = history.filter((h) => h.ok).length;
    const wrong = history.filter((h) => !h.ok).length;
    const displayScore =
      state.mode === "random"
        ? computeScore()
        : Math.round((correct / state.total) * FULL_MAX);

    $("quiz-score").textContent = String(displayScore);
    $("quiz-score-max").textContent = " / 100";
    $("quiz-result-detail").textContent =
      skipped > 0
        ? `答对 ${correct} / ${state.total} 题（未作答 ${skipped}）`
        : `答对 ${correct} / ${state.total} 题`;
    $("quiz-rank").textContent = rankLabel(displayScore);

    const list = $("quiz-review-list");
    const reviewTitle = $("quiz-review-title");
    const reviewEmpty = $("quiz-review-empty");

    if (reviewTitle) {
      reviewTitle.textContent =
        skipped > 0
          ? `答题回顾（答对 ${correct}，答错 ${wrong - skipped}，未作答 ${skipped}）`
          : `答题回顾（答对 ${correct}，答错 ${wrong}）`;
    }

    if (list) {
      show(reviewEmpty, false);
      list.innerHTML = history.map((h) => historyItemHtml(h)).join("");
    }
  }

  function backToIntro() {
    show($("quiz-play"), false);
    show($("quiz-result"), false);
    show($("quiz-intro"), true);
    document.querySelector(".page-main--quiz")?.classList.remove("is-quiz-active");
    closeNavMobile();
  }

  function bind() {
    $("quiz-start-random")?.addEventListener("click", () => start("random"));
    $("quiz-start-full")?.addEventListener("click", () => start("full"));
    $("quiz-next")?.addEventListener("click", next);
    $("quiz-prev")?.addEventListener("click", prev);
    $("quiz-retry")?.addEventListener("click", backToIntro);
    $("quiz-nav-toggle")?.addEventListener("click", () => {
      const play = $("quiz-play");
      if (play?.classList.contains("is-nav-open")) closeNavMobile();
      else openNavMobile();
    });
    $("quiz-nav-close")?.addEventListener("click", closeNavMobile);
    $("quiz-nav-backdrop")?.addEventListener("click", closeNavMobile);

    document.addEventListener("keydown", (e) => {
      const play = $("quiz-play");
      if (!play || play.hidden) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;

      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) {
        return;
      }

      e.preventDefault();
      if (e.key === "ArrowRight") next();
      else prev();
    });

    applyDeepLink();
  }

  window.KayaQuiz = { init: bind, start };
})();
