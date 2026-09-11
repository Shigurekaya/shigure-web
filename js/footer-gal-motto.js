/**
 * 页脚名言：随机展示 Gal 保留句 + 肖申克，桌面端点击查看详情。
 */
(() => {
  const QUOTES_URL = "/gal-quotes/quotes.json";
  /** 仅桌面端可点开详情（与页脚名言断点一致） */
  const DETAIL_MQ = window.matchMedia("(min-width: 641px)");

  /** 站点固定收录（非 Gal，始终参与随机） */
  const BUILTIN_QUOTES = [
    {
      id: "shawshank-birds",
      kind: "film",
      quote_zh: "你知道，有些鸟儿是注定不会被关在牢笼里的，它们的每一片羽毛都闪耀着自由的光辉。",
      quote:
        "Some birds aren't meant to be caged. Their feathers are just too bright.",
      character: "埃利斯·「红」·雷丁",
      vn_title_zh: "肖申克的救赎",
      vn_title: "The Shawshank Redemption",
      source: "film",
      quote_zh_source: "known",
      source_url: "https://zh.wikipedia.org/wiki/肖申克的救赎",
    },
  ];

  /** @type {WeakMap<Element, object>} */
  const quoteByEl = new WeakMap();
  /** @type {object[] | null} */
  let cachedQuotes = null;

  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str ?? "";
    return d.innerHTML;
  }

  function displayTitle(q) {
    return (q.vn_title_zh || q.vn_title || "").trim() || "未知作品";
  }

  /** Gal 优先日文；无日文时用 VNDB 英文；电影等非 Gal 用英文 */
  function originalText(q) {
    const ja = (q.quote_ja || "").trim();
    if (ja) return ja;
    return (q.quote || "").trim();
  }

  function originalLabel(q) {
    if ((q.quote_ja || "").trim()) return "日文";
    if (q.kind === "film" || q.source === "film") return "英文";
    return "原文";
  }

  function canOpenDetail() {
    return DETAIL_MQ.matches;
  }

  function syncInteractive(el) {
    if (!(el instanceof HTMLElement)) return;
    const on = canOpenDetail();
    el.classList.toggle("is-gal-quote--interactive", on);
    if (el.tagName === "BUTTON") {
      el.toggleAttribute("disabled", !on);
    }
    if (on) {
      el.setAttribute("aria-label", "点击查看详情");
    } else {
      el.removeAttribute("aria-label");
    }
  }

  function pickRandom(quotes) {
    if (!quotes?.length) return null;
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  function ensureDialog() {
    let dlg = document.getElementById("footer-motto-dialog");
    if (dlg) return dlg;

    dlg = document.createElement("dialog");
    dlg.id = "footer-motto-dialog";
    dlg.className = "footer-motto-dialog";
    dlg.setAttribute("aria-label", "名言详情");
    dlg.innerHTML = `
      <div class="footer-motto-dialog__panel">
        <header class="footer-motto-dialog__head footer-motto-dialog__head--close-only">
          <button type="button" class="footer-motto-dialog__close" id="footer-motto-close" aria-label="关闭">×</button>
        </header>
        <div class="footer-motto-dialog__body" id="footer-motto-body"></div>
      </div>`;
    document.body.appendChild(dlg);

    const close = () => dlg.close();
    dlg.querySelector("#footer-motto-close")?.addEventListener("click", close);
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) close();
    });
    return dlg;
  }

  function renderDialogBody(q) {
    const zh = (q.quote_zh || q.quote || "").trim();
    const orig = originalText(q);
    const title = displayTitle(q);

    return `
      <dl class="footer-motto-dialog__list">
        <div class="footer-motto-dialog__row">
          <dt>中文</dt>
          <dd>${esc(zh)}</dd>
        </div>
        ${orig ? `
        <div class="footer-motto-dialog__row">
          <dt>${esc(originalLabel(q))}</dt>
          <dd>${esc(orig)}</dd>
        </div>` : ""}
        <div class="footer-motto-dialog__row">
          <dt>出处</dt>
          <dd>《${esc(title)}》</dd>
        </div>
      </dl>`;
  }

  function openDetail(q) {
    if (!q || !canOpenDetail()) return;
    const dlg = ensureDialog();
    const body = dlg.querySelector("#footer-motto-body");
    if (body) {
      body.innerHTML = renderDialogBody(q);
      body.classList.remove("is-in");
      void body.offsetWidth;
      body.classList.add("is-in");
    }
    if (typeof dlg.showModal === "function") dlg.showModal();
  }

  function wireEl(el) {
    if (!(el instanceof HTMLElement) || el.dataset.galMottoWired) return;
    el.dataset.galMottoWired = "1";
    el.classList.add("is-gal-quote");

    el.addEventListener("click", () => {
      if (!canOpenDetail()) return;
      openDetail(quoteByEl.get(el));
    });
    el.addEventListener("keydown", (e) => {
      if (!canOpenDetail()) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetail(quoteByEl.get(el));
      }
    });
    syncInteractive(el);
  }

  function setMottoText(el, text) {
    const next = String(text ?? "").replace(/\s+/g, " ").trim();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const prev = (el.dataset.mottoRaw || el.textContent || "").replace(/\s+/g, " ").trim();
    if (reduced || !prev) {
      el.dataset.mottoRaw = next;
      el.title = next;
      el.textContent = next;
      window.KayaFooterMotto?.refit?.();
      return;
    }
    el.classList.add("is-swapping");
    window.setTimeout(() => {
      el.dataset.mottoRaw = next;
      el.title = next;
      el.textContent = next;
      el.classList.remove("is-swapping");
      window.KayaFooterMotto?.refit?.();
    }, 220);
  }

  function applyToElements(q) {
    document.querySelectorAll(".site-footer__motto").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      wireEl(el);
      const text = (q.quote_zh || q.quote || "").trim();
      quoteByEl.set(el, q);
      setMottoText(el, text);
    });
  }

  async function loadQuotes() {
    if (cachedQuotes) return cachedQuotes;
    let gal = [];
    try {
      const r = await fetch(QUOTES_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const data = await r.json();
      gal = Array.isArray(data) ? data.filter((q) => (q.quote_zh || q.quote || "").trim()) : [];
    } catch (err) {
      console.warn("[footer-gal-motto] load failed", err);
    }
    cachedQuotes = [...BUILTIN_QUOTES, ...gal];
    return cachedQuotes;
  }

  async function applyRandomMotto() {
    const els = document.querySelectorAll(".site-footer__motto");
    if (!els.length) return null;

    const quotes = await loadQuotes();
    if (!quotes.length) return null;

    const q = pickRandom(quotes);
    applyToElements(q);
    return q;
  }

  window.KayaFooterGalMotto = {
    applyRandomMotto,
    openDetail,
    pickRandom,
  };

  DETAIL_MQ.addEventListener("change", () => {
    document.querySelectorAll(".site-footer__motto.is-gal-quote").forEach(syncInteractive);
  });
})();
