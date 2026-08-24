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

      .replace(/[「」『』【】\[\]()（）"'“”‘’.,。，!！?？~～・·♥♡★☆†‡=＝:：;；]/g, "")

      .replace(/ー/g, "")

      .replace(/〜/g, "");

  }



  function checkText(user, answers) {

    const u = normalize(user);

    if (!u) return false;

    return (answers || []).some((a) => {

      const n = normalize(a);

      if (!n) return false;

      return u === n || u.includes(n) || n.includes(u);

    });

  }



  function rankLabel(score) {

    if (score >= 90) return "旮旯大神预备役";

    if (score >= 75) return "资深 Gal 玩家";

    if (score >= 55) return "一般 Gal 玩家";

    if (score >= 35) return "入门 Gal 玩家";

    return "还需努力（再开一局！）";

  }



  function mediaHtml(q) {

    const bits = [];

    (q.images || []).forEach((src) => {

      bits.push(

        `<figure class="quiz-media__item"><img src="${src}" alt="" loading="lazy" decoding="async" /></figure>`

      );

    });

    (q.audio || []).forEach((src) => {

      bits.push(

        `<div class="quiz-media__item quiz-media__audio"><audio controls preload="none" src="${src}"></audio></div>`

      );

    });

    (q.video || []).forEach((src) => {

      bits.push(

        `<div class="quiz-media__item quiz-media__video"><video controls preload="none" src="${src}"></video></div>`

      );

    });

    return bits.join("");

  }



  const state = {

    mode: "random",

    deck: [],

    total: RANDOM_DRAW,

    i: 0,

    score: 0,

    locked: false,

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

        alert("题库不足 20 题");

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

    state.locked = false;

    state.chosen = null;

    $("quiz-progress-text").textContent = `${state.i + 1} / ${state.total}`;

    $("quiz-progress-fill").style.width = `${((state.i + 1) / state.total) * 100}%`;

    $("quiz-meta").textContent = `来源：第 ${q.source} 弹 · 原题第 ${q.num} 问 · ${q.id}`;

    $("quiz-question").textContent = q.question;

    $("quiz-media").innerHTML = mediaHtml(q);

    $("quiz-feedback").hidden = true;

    $("quiz-feedback").textContent = "";

    $("quiz-feedback").className = "quiz-feedback";

    show($("quiz-submit"), true);

    show($("quiz-next"), false);



    const box = $("quiz-answers");

    box.innerHTML = "";

    if (q.type === "choice") {

      q.options.forEach((opt, idx) => {

        const btn = document.createElement("button");

        btn.type = "button";

        btn.className = "quiz-option";

        btn.textContent = opt;

        btn.addEventListener("click", () => {

          if (state.locked) return;

          state.chosen = idx;

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

      input.addEventListener("keydown", (e) => {

        if (e.key === "Enter") {

          e.preventDefault();

          submit();

        }

      });

      box.appendChild(input);

      setTimeout(() => input.focus(), 50);

    }

  }



  function submit() {

    if (state.locked) return;

    const q = current();

    let ok = false;

    let user = "";

    const pts = ptsPerQuestion();

    if (q.type === "choice") {

      if (state.chosen == null) {

        $("quiz-feedback").hidden = false;

        $("quiz-feedback").textContent = "请先选择一个选项";

        $("quiz-feedback").className = "quiz-feedback is-warn";

        return;

      }

      user = q.options[state.chosen];

      const ans = q.answer;

      ok = Array.isArray(ans) ? ans.includes(state.chosen) : state.chosen === ans;

      [...$("quiz-answers").querySelectorAll(".quiz-option")].forEach((b, idx) => {

        const correct = Array.isArray(ans) ? ans.includes(idx) : idx === ans;

        if (correct) b.classList.add("is-correct");

        if (idx === state.chosen && !ok) b.classList.add("is-wrong");

      });

    } else {

      const input = $("quiz-text-input");

      user = (input && input.value) || "";

      ok = checkText(user, q.answers);

      if (input) input.disabled = true;

    }



    state.locked = true;

    if (ok) state.score += pts;

    state.history.push({ q, user, ok });



    const fb = $("quiz-feedback");

    fb.hidden = false;

    fb.className = "quiz-feedback " + (ok ? "is-ok" : "is-ng");

    const right =

      q.type === "choice"

        ? (Array.isArray(q.answer) ? q.answer : [q.answer])

            .map((i) => q.options[i])

            .join(" / ")

        : (q.answers || []).slice(0, 3).join(" / ");

    const gain = ok && state.mode === "random" ? `+${RANDOM_PTS}` : "";

    fb.textContent = ok

      ? `正确${gain ? " " + gain : ""}${q.explain ? " · " + q.explain : ""}`

      : `不对。参考答案：${right}${q.explain ? " · " + q.explain : ""}`;



    show($("quiz-submit"), false);

    show($("quiz-next"), true);

  }



  function next() {

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

    const displayScore =

      state.mode === "random"

        ? state.score

        : Math.round((correct / state.total) * FULL_MAX);

    $("quiz-score").textContent = String(displayScore);

    $("quiz-score-max").textContent = " / 100";

    $("quiz-result-detail").textContent = `答对 ${correct} / ${state.total} 题`;

    $("quiz-rank").textContent = rankLabel(displayScore);

    const list = $("quiz-review-list");

    list.innerHTML = "";

    state.history.forEach((h, idx) => {

      const li = document.createElement("li");

      li.className = h.ok ? "is-ok" : "is-ng";

      const right =

        h.q.type === "choice"

          ? (Array.isArray(h.q.answer) ? h.q.answer : [h.q.answer])

              .map((i) => h.q.options[i])

              .join(" / ")

          : (h.q.answers || []).slice(0, 2).join(" / ");

      li.innerHTML = `<strong>#${idx + 1} ${h.ok ? "✓" : "✗"}</strong> ${escapeHtml(

        h.q.question.slice(0, 80)

      )}${h.q.question.length > 80 ? "…" : ""}<br/><small>你的答案：${escapeHtml(

        h.user || "（空）"

      )}　参考：${escapeHtml(right)}</small>`;

      list.appendChild(li);

    });

  }



  function backToIntro() {

    show($("quiz-play"), false);

    show($("quiz-result"), false);

    show($("quiz-intro"), true);

  }



  function escapeHtml(s) {

    return String(s)

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;");

  }



  function bind() {

    $("quiz-start-random")?.addEventListener("click", () => start("random"));

    $("quiz-start-full")?.addEventListener("click", () => start("full"));

    $("quiz-submit")?.addEventListener("click", submit);

    $("quiz-next")?.addEventListener("click", next);

    $("quiz-retry")?.addEventListener("click", backToIntro);

  }



  window.KayaQuiz = { init: bind, start };

})();


