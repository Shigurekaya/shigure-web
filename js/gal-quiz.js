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

  function checkText(user, answers) {
    const u = normalize(user);
    if (!u) return false;
    return (answers || []).some((a) =>
      answerVariants(a).some((v) => {
        if (!v) return false;
        if (u === v) return true;
        if (v.length >= 4 && u.includes(v)) return true;
        return (
          u.length >= 4 &&
          v.length >= 4 &&
          v.includes(u) &&
          u.length >= Math.ceil(v.length * 0.6)
        );
      })
    );
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
    return (q.answers || []).join(" / ");
  }

  function resolveMediaUrl(src) {
    if (!src) return "";
    if (/^https?:\/\//i.test(src)) return src;
    return src.startsWith("/") ? src : `/${String(src).replace(/^\.\//, "")}`;
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

    images.forEach((src) => {
      const fig = document.createElement("figure");
      fig.className = "quiz-media__item";
      const img = document.createElement("img");
      img.src = resolveMediaUrl(src);
      img.alt = "题目配图";
      img.loading = "eager";
      img.decoding = "sync";
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

  function historyItemHtml(h, idx) {
    const right = correctAnswerText(h.q);
    return `<li class="quiz-review-item is-ng">
      <div class="quiz-review-item__head">
        <span class="quiz-review-item__badge">✗</span>
        <strong>#${idx + 1}</strong>
        <span class="quiz-review-item__id">${escapeHtml(h.q.id)}</span>
      </div>
      <p class="quiz-review-item__q">${escapeHtml(h.q.question)}</p>
      <dl class="quiz-review-item__meta">
        <div><dt>你的答案</dt><dd>${escapeHtml(h.user || "（空）")}</dd></div>
        <div><dt>参考答案</dt><dd>${escapeHtml(right)}</dd></div>
        ${h.q.explain ? `<div><dt>解析</dt><dd>${escapeHtml(h.q.explain)}</dd></div>` : ""}
      </dl>
    </li>`;
  }

  const state = {
    mode: "random",
    deck: [],
    total: RANDOM_DRAW,
    i: 0,
    score: 0,
    chosen: null,
    history: [],
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

  function readAnswer(q) {
    if (q.type === "choice") {
      if (state.chosen == null) return { user: "", ok: false, missing: true };
      const user = q.options[state.chosen];
      const ans = q.answer;
      const ok = Array.isArray(ans) ? ans.includes(state.chosen) : state.chosen === ans;
      return { user, ok, missing: false };
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

  function recordCurrent() {
    const q = current();
    const { user, ok, missing } = readAnswer(q);
    if (missing) return false;

    const pts = ptsPerQuestion();
    if (ok) state.score += pts;
    state.history.push({ q, user, ok, num: state.i + 1 });
    return true;
  }

  function start(mode) {
    const all = bank();
    if (!all.length) {
      alert("题库未加载");
      return;
    }

    state.mode = mode === "full" ? "full" : "random";
    if (state.mode === "full") {
      state.deck = shuffle(all);
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
    state.score = 0;
    state.history = [];
    show($("quiz-intro"), false);
    show($("quiz-result"), false);
    show($("quiz-play"), true);
    renderQ();
  }

  function renderQ() {
    const q = current();
    state.chosen = null;

    $("quiz-progress-text").textContent = `${state.i + 1} / ${state.total}`;
    $("quiz-progress-fill").style.width = `${((state.i + 1) / state.total) * 100}%`;
    $("quiz-meta").textContent = `来源：第 ${q.source} 弹 · 原题第 ${q.num} 问 · ${q.id}`;
    $("quiz-question").textContent = q.question;
    mountMedia(q);
    clearWarn();

    const nextBtn = $("quiz-next");
    show(nextBtn, true);
    nextBtn.textContent = state.i >= state.total - 1 ? "查看成绩" : "下一题";

    const box = $("quiz-answers");
    box.innerHTML = "";

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
    } else {
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
      box.appendChild(input);
      setTimeout(() => input.focus(), 50);
    }
  }

  function next() {
    if (!recordCurrent()) {
      showWarn("请先选择或填写答案");
      return;
    }

    if (state.i >= state.total - 1) {
      finish();
      return;
    }
    state.i += 1;
    renderQ();
  }

  function finish() {
    show($("quiz-play"), false);
    show($("quiz-result"), true);

    const correct = state.history.filter((h) => h.ok).length;
    const wrong = state.history.filter((h) => !h.ok);
    const displayScore =
      state.mode === "random"
        ? state.score
        : Math.round((correct / state.total) * FULL_MAX);

    $("quiz-score").textContent = String(displayScore);
    $("quiz-score-max").textContent = " / 100";
    $("quiz-result-detail").textContent = `答对 ${correct} / ${state.total} 题`;
    $("quiz-rank").textContent = rankLabel(displayScore);

    const list = $("quiz-review-list");
    const reviewTitle = $("quiz-review-title");
    const reviewEmpty = $("quiz-review-empty");

    if (reviewTitle) {
      reviewTitle.textContent =
        wrong.length > 0 ? `错题回顾（${wrong.length} 题）` : "错题回顾";
    }

    if (list) {
      if (wrong.length === 0) {
        list.innerHTML = "";
        show(reviewEmpty, true);
      } else {
        show(reviewEmpty, false);
        list.innerHTML = wrong
          .map((h, idx) => historyItemHtml(h, h.num - 1))
          .join("");
      }
    }
  }

  function backToIntro() {
    show($("quiz-play"), false);
    show($("quiz-result"), false);
    show($("quiz-intro"), true);
  }

  function bind() {
    $("quiz-start-random")?.addEventListener("click", () => start("random"));
    $("quiz-start-full")?.addEventListener("click", () => start("full"));
    $("quiz-next")?.addEventListener("click", next);
    $("quiz-retry")?.addEventListener("click", backToIntro);
  }

  window.KayaQuiz = { init: bind, start };
})();
