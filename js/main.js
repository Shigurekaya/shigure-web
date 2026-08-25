/**
 * 时雨榧个人站
 */
const Kaya = (() => {
  /* 品牌色略降饱和，更贴页面色调 */
  const ICONS = {
    bilibili: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#3BA3C4" d="M6.35 2.55a.9.9 0 0 1 1.26.2L10.4 6.2a.75.75 0 0 1-1.2.9L6.55 3.8a.9.9 0 0 1-.2-1.25zm11.3 0a.9.9 0 0 1-.2 1.25l-2.65 3.3a.75.75 0 1 1-1.2-.9l2.79-3.45a.9.9 0 0 1 1.26-.2z"/><rect x="2.4" y="6.4" width="19.2" height="14.2" rx="4.2" fill="#3BA3C4"/><rect x="4.55" y="8.55" width="14.9" height="9.9" rx="2.2" fill="#EEF8FB"/><circle cx="9.05" cy="12.55" r="1.15" fill="#2A6F85"/><circle cx="14.95" cy="12.55" r="1.15" fill="#2A6F85"/><path fill="none" stroke="#2A6F85" stroke-width="1.25" stroke-linecap="round" d="M10.15 15.35c.85.75 2.85.75 3.7 0"/></svg>`,
    youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#D94F4F" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#3A3A3A" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.991ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>`,
  };

  const data = () => window.SITE_DATA || { user: {}, videos: [], links: [] };

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  const SANDAIME_MARK = "三代目";
  const SANDAIME_HINT = "一代目破产了，二代目跑路了";

  function wrapSandaimeInHtml(html) {
    return html.replace(/三代目/g, `<span class="kaya-sandaime" tabindex="0">${SANDAIME_MARK}</span>`);
  }

  function initSandaimeHint() {
    if (document.body.dataset.sandaimeHint) return;
    document.body.dataset.sandaimeHint = "1";

    const hint = document.createElement("div");
    hint.id = "kaya-sandaime-hint";
    hint.className = "kaya-sandaime-hint";
    hint.setAttribute("role", "tooltip");
    hint.hidden = true;
    hint.setAttribute("aria-hidden", "true");
    hint.innerHTML = `<span class="kaya-sandaime-hint__text">${escapeHtml(SANDAIME_HINT)}</span>`;
    document.body.appendChild(hint);

    let active = null;
    let mx = 0;
    let my = 0;
    const OFFSET_X = 14;
    const OFFSET_Y = 18;

    function placeHint() {
      let x = mx + OFFSET_X;
      let y = my + OFFSET_Y;
      hint.style.left = `${x}px`;
      hint.style.top = `${y}px`;

      const rect = hint.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) x = mx - rect.width - OFFSET_X;
      if (rect.bottom > window.innerHeight - 8) y = my - rect.height - OFFSET_Y;
      hint.style.left = `${Math.max(8, x)}px`;
      hint.style.top = `${Math.max(8, y)}px`;
    }

    function show() {
      hint.hidden = false;
      hint.setAttribute("aria-hidden", "false");
      placeHint();
      requestAnimationFrame(() => {
        if (active) hint.classList.add("is-visible");
      });
    }

    function hide() {
      active = null;
      hint.classList.remove("is-visible");
      hint.setAttribute("aria-hidden", "true");
      hint.hidden = true;
    }

    function track(e) {
      mx = e.clientX;
      my = e.clientY;
      if (active) placeHint();
    }

    document.addEventListener("mouseover", (e) => {
      const mark = e.target.closest?.(".kaya-sandaime");
      if (mark) {
        active = mark;
        mx = e.clientX;
        my = e.clientY;
        show();
        return;
      }
      if (active && !e.relatedTarget?.closest?.(".kaya-sandaime")) hide();
    });

    document.addEventListener("mousemove", track);
    document.addEventListener("focusin", (e) => {
      const mark = e.target.closest?.(".kaya-sandaime");
      if (!mark) return;
      active = mark;
      const r = mark.getBoundingClientRect();
      mx = r.left + r.width / 2;
      my = r.bottom;
      show();
    });
    document.addEventListener("focusout", (e) => {
      if (e.target.closest?.(".kaya-sandaime")) hide();
    });
    window.addEventListener("blur", hide);
  }

  function initSandaimeBrand() {
    if (document.getElementById("hero-sign")) return;
    document.querySelectorAll(".site-header .brand").forEach((brand) => {
      if (brand.querySelector(".kaya-sandaime")) return;
      const text = brand.textContent.trim();
      if (!text || text.includes(SANDAIME_MARK)) return;
      brand.innerHTML = `${escapeHtml(text)}<span class="kaya-sandaime brand-sandaime" tabindex="0">${SANDAIME_MARK}</span>`;
    });
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function biliUrl(bvid) {
    return `https://www.bilibili.com/video/${bvid}`;
  }

  function videoThumb(v) {
    if (v?.thumb && !v.thumb.includes("..")) return v.thumb;
    if (v?.bvid) return `assets/images/covers/${v.bvid}.jpg`;
    return "assets/images/avatar.jpg";
  }

  function videoThumbOnError(v) {
    const fb = v?.bvid ? `assets/images/covers/${v.bvid}.jpg` : "assets/images/avatar.jpg";
    return `onerror="if(!this.dataset.fbf){this.dataset.fbf='1';this.src='${fb}'}else{this.src='assets/images/avatar.jpg'}"`;
  }

  function createWorkCard(v, index) {
    const card = document.createElement("a");
    card.className = "work-card";
    card.href = biliUrl(v.bvid);
    card.target = "_blank";
    card.rel = "noopener";

    const meta = [v.date, v.length].filter(Boolean).join(" · ");
    const thumb = videoThumb(v);

    card.innerHTML = `
      <div class="work-card__thumb">
        <img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" width="480" height="270"
             ${videoThumbOnError(v)} />
        <span class="work-card__play" aria-hidden="true">▶</span>
      </div>
      <div class="work-card__body">
        <span class="work-card__index">${String(index + 1).padStart(2, "0")}</span>
        <h2 class="work-card__title">${escapeHtml(v.title)}</h2>
        ${meta ? `<p class="work-card__meta">${escapeHtml(meta)}</p>` : ""}
      </div>
    `;
    return card;
  }

  function renderGrid(grid, videos, startIndex = 0) {
    if (!grid) return;
    grid.innerHTML = "";
    videos.forEach((v, i) => grid.appendChild(createWorkCard(v, startIndex + i)));
  }

  function spaceUrl() {
    const d = data();
    if (d.bilibili_url) return d.bilibili_url;
    return `https://space.bilibili.com/${d.mid || 109084234}`;
  }

  function externalLinks() {
    const d = data();
    if (d.links?.length) return d.links;
    return [
      { icon: "bilibili", title: "B 站空间", url: spaceUrl(), label: "space.bilibili.com" },
      { icon: "youtube", title: "YouTube", url: d.youtube_url || "https://www.youtube.com/@ShigureKaya", label: "@ShigureKaya" },
      { icon: "x", title: "X", url: d.twitter_url || "https://x.com/ShigureKaya", label: "@ShigureKaya" },
    ];
  }

  function renderSocialIcons(container) {
    if (!container) return;
    container.innerHTML = externalLinks().map((link) => `
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
         class="social-pill social-pill--${escapeHtml(link.icon)}" title="${escapeHtml(link.title)}" aria-label="${escapeHtml(link.title)}">
        <span class="social-pill__icon">${ICONS[link.icon] || ""}</span>
      </a>
    `).join("");
  }

  function renderLinkCards(container) {
    if (!container) return;
    container.innerHTML = externalLinks().map((link) => `
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-card link-card--${escapeHtml(link.icon)}">
        <span class="link-card__icon">${ICONS[link.icon] || ""}</span>
        <span class="link-card__text">
          <strong>${escapeHtml(link.title)}</strong>
          <small>${escapeHtml(link.label || link.url.replace(/^https?:\/\//, ""))}</small>
        </span>
        <span class="link-card__arrow" aria-hidden="true">↗</span>
      </a>
    `).join("");
  }

  function renderIntro(container) {
    if (!container) return;
    const intro = data().intro;
    if (!intro) {
      container.innerHTML = "";
      container.closest(".intro-panel")?.classList.add("is-empty");
      return;
    }
    container.closest(".intro-panel")?.classList.remove("is-empty");
    if (typeof intro === "string") {
      container.innerHTML = intro.split("\n\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      return;
    }
    if (Array.isArray(intro.paragraphs)) {
      container.innerHTML = intro.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    }
  }

  function initNav() {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    const closeNav = () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target) && e.target !== toggle) closeNav();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });
  }

  const KAYA_ASSET_V = "202608251200";
  const SPA_PAGE_CLASSES = ["page-home", "page-works", "page-links", "page-mv"];
  const SPA_TITLES = {
    home: "时雨榧",
    works: "作品 · 时雨榧",
    links: "链接 · 时雨榧",
    mv: "MV 素材 · 时雨榧",
  };
  const SPA_PATHS = {
    home: "/",
    works: "/works/",
    links: "/links/",
    mv: "/mv-materials/",
  };
  const SPA_MAIN = {
    home: `<main class="home-main">
    <section class="profile-hero">
      <div class="profile-avatar">
        <img id="hero-avatar" class="avatar" src="assets/images/avatar.jpg" alt="时雨榧" width="128" height="128" fetchpriority="high" decoding="async" />
      </div>
      <h1 class="profile-name" id="hero-name">时雨榧</h1>
      <p class="profile-roman">ShigureKaya</p>
      <p class="profile-sign" id="hero-sign">实现愿望程度的能力</p>
      <nav class="social-row" id="social-icons" aria-label="外部链接"></nav>
    </section>
    <section class="intro-panel" aria-label="简介">
      <div class="intro-panel__body" id="intro-body"></div>
    </section>
    <div class="home-tool-entries" aria-label="Gal 工具">
      <a href="/gal-quiz/" class="site-quiz-entry" aria-label="Gal 水平测试">
        <span class="site-quiz-entry__label">Quiz</span>
        <span class="site-quiz-entry__title">gal水平测试</span>
        <span class="site-quiz-entry__arrow" aria-hidden="true">→</span>
      </a>
      <a href="/gal-sedai/" class="site-quiz-entry" aria-label="Gal 世代">
        <span class="site-quiz-entry__label">Sedai</span>
        <span class="site-quiz-entry__title">Gal世代</span>
        <span class="site-quiz-entry__arrow" aria-hidden="true">→</span>
      </a>
    </div>
    <aside class="site-log" aria-label="站点日志">
      <div class="site-log__inner">
        <span class="site-log__tag">LOG</span>
        <p class="site-log__text">因本人在2026年8月20日被突然的暴雨淋了五分钟（一条不可挡雨的路），以水鬼姿态进入地铁，故增加了暴雨页面<br>经本人亲身证明，即使人在滴水，地铁安检员也会放你进去</p>
        <div class="site-log__action">
          <a href="/?rain=storm" class="site-log__btn">暴雨页面</a>
          <p class="site-log__hint">对电脑性能极其自信再点击</p>
        </div>
      </div>
    </aside>
    <section class="home-cards" aria-label="快捷入口">
      <a href="/works/" class="home-card">
        <span class="home-card__label">Portfolio</span>
        <span class="home-card__title">作品集</span>
        <span class="home-card__desc">视频与投稿列表</span>
        <span class="home-card__arrow" aria-hidden="true">→</span>
      </a>
      <a href="/mv-materials/" class="home-card home-card--mv">
        <span class="home-card__label">MV Assets</span>
        <span class="home-card__title">部分 MV 素材</span>
        <span class="home-card__desc">立绘与分镜素材预览</span>
        <div class="home-card__preview" id="mv-preview" aria-hidden="true"></div>
        <span class="home-card__arrow" aria-hidden="true">→</span>
      </a>
    </section>
  </main>`,
    works: `<main class="page-main">
    <header class="page-head">
      <p class="page-head__eyebrow">Portfolio</p>
      <h1>作品集</h1>
      <p class="page-head__sub">点击封面跳转 B 站观看</p>
    </header>
    <div class="works-grid" id="works-grid"></div>
  </main>`,
    links: `<main class="page-main page-main--narrow">
    <header class="page-head page-head--center">
      <p class="page-head__eyebrow">Links</p>
      <h1>链接</h1>
      <p class="page-head__sub">各平台主页</p>
    </header>
    <nav class="link-cards" id="link-cards" aria-label="外部链接"></nav>
  </main>`,
    mv: `<main class="page-main page-main--mv">
    <header class="page-head page-head--center">
      <p class="page-head__eyebrow">MV Assets</p>
      <h1>部分 MV 素材</h1>
    </header>
    <div class="mv-board" id="mv-gallery"></div>
  </main>`,
  };
  const MV_LIGHTBOX_HTML = `<dialog class="mv-lightbox" id="mv-lightbox" aria-label="图片预览">
    <button type="button" class="mv-lightbox__close" id="mv-lightbox-close" aria-label="关闭">×</button>
    <div class="mv-lightbox__layout">
      <figure class="mv-lightbox__figure">
        <img class="mv-lightbox__img" id="mv-lightbox-img" alt="" />
      </figure>
      <aside class="mv-lightbox__rail" id="mv-lightbox-rail" aria-label="缩略图列表"></aside>
    </div>
  </dialog>`;

  let shellInited = false;
  let spaPage = null;
  let spaBusy = false;
  let mvLightboxInited = false;
  const loadedScripts = new Set(
    [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src") || ""),
  );

  function spaPageFromPath(pathname) {
    const p = normalizePathname(pathname);
    if (p === "/" || p === "/index.html") return "home";
    if (p === "/works") return "works";
    if (p === "/links") return "links";
    if (p === "/mv-materials") return "mv";
    return null;
  }

  function persistRainMode() {
    const mode = rainModeFromBody() || readStoredRainMode();
    if (mode) writeStoredRainMode(mode);
  }

  function spaUrlHasWeatherOverride(url) {
    if ([...url.searchParams.keys()].some((k) => (
      k === "rain" || k === "storm" || k === "heavy" || k === "light"
      || k === "sunny" || k === "clear" || k === "rainbow" || k === "after"
    ))) return true;
    const p = normalizePathname(url.pathname);
    return p === "/heavy" || p === "/light" || p === "/storm" || p === "/sunny" || p === "/rainbow";
  }

  function isSpaNavUrl(url) {
    if (!(url instanceof URL)) return false;
    if (url.origin !== window.location.origin) return false;
    if (spaUrlHasWeatherOverride(url)) return false;
    return spaPageFromPath(url.pathname) != null;
  }

  function loadScriptOnce(src) {
    if (loadedScripts.has(src) || document.querySelector(`script[src="${src}"]`)) {
      loadedScripts.add(src);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = () => {
        loadedScripts.add(src);
        resolve();
      };
      s.onerror = () => reject(new Error(`script failed: ${src}`));
      document.head.appendChild(s);
    });
  }

  async function ensurePageData(page) {
    const jobs = [];
    if ((page === "home" || page === "works") && !window.SITE_DATA?.videos?.length) {
      jobs.push(loadScriptOnce(`js/site-data.js?v=${KAYA_ASSET_V}`));
    }
    if ((page === "home" || page === "mv") && !window.MV_MATERIALS) {
      jobs.push(loadScriptOnce(`js/mv-materials-data.js?v=${KAYA_ASSET_V}`));
    }
    if (page === "links" && !window.SITE_DATA?.links?.length) {
      jobs.push(loadScriptOnce(`js/links-data.js?v=${KAYA_ASSET_V}`));
    }
    if (jobs.length) await Promise.all(jobs);
  }

  function prefetchSpaData() {
    const jobs = [];
    if (!window.SITE_DATA?.videos?.length) {
      jobs.push(loadScriptOnce(`js/site-data.js?v=${KAYA_ASSET_V}`));
    }
    if (!window.MV_MATERIALS) {
      jobs.push(loadScriptOnce(`js/mv-materials-data.js?v=${KAYA_ASSET_V}`));
    }
    Promise.all(jobs).catch(() => { /* ignore */ });
  }

  function updateSpaNav(page) {
    const activePath = SPA_PATHS[page] || "/";
    document.querySelectorAll("#site-nav a").forEach((a) => {
      let url;
      try {
        url = new URL(a.getAttribute("href") || "", window.location.href);
      } catch {
        return;
      }
      const key = spaPageFromPath(url.pathname);
      a.classList.toggle("active", key === page || normalizePathname(url.pathname) === normalizePathname(activePath));
    });
  }

  function setSpaBodyPage(page) {
    document.body.classList.remove(
      ...SPA_PAGE_CLASSES,
      "page-ready",
      "home-intro-playing",
      "home-ready",
      "home-revealed",
    );
    document.body.classList.add(`page-${page === "mv" ? "mv" : page}`);
    document.body.dataset.kayaPage = page;
    if (page === "home") {
      document.body.classList.add("home-ready", "home-revealed");
    }
    document.getElementById("home-intro")?.remove();
  }

  function ensureMvLightboxDom() {
    if (document.getElementById("mv-lightbox")) return;
    const footer = document.querySelector(".site-footer");
    if (footer) footer.insertAdjacentHTML("beforebegin", MV_LIGHTBOX_HTML);
    else document.body.insertAdjacentHTML("beforeend", MV_LIGHTBOX_HTML);
  }

  function closeMvLightbox() {
    const dialog = document.getElementById("mv-lightbox");
    if (!dialog?.open) return;
    try { dialog.close(); } catch { /* ignore */ }
    const img = document.getElementById("mv-lightbox-img");
    const rail = document.getElementById("mv-lightbox-rail");
    if (img) img.src = "";
    if (rail) rail.innerHTML = "";
  }

  function swapSpaMain(page) {
    const html = SPA_MAIN[page];
    if (!html) return;
    const cur = document.querySelector("main");
    if (cur) cur.outerHTML = html;
    else document.querySelector(".site-header")?.insertAdjacentHTML("afterend", html);
  }

  function mountSpaContent(page) {
    if (page === "home") {
      initHero();
      renderMvHomePreview(document.getElementById("mv-preview"));
      return;
    }
    if (page === "works") {
      renderGrid(document.getElementById("works-grid"), data().videos);
      return;
    }
    if (page === "links") {
      renderLinkCards(document.getElementById("link-cards"));
      return;
    }
    if (page === "mv") {
      ensureMvLightboxDom();
      renderMvGallery(document.getElementById("mv-gallery"));
      initMvLightbox();
    }
  }

  async function softNavigate(page, { url, replace = false, fromPop = false } = {}) {
    if (!page || !SPA_MAIN[page]) return false;
    if (spaBusy) return false;
    if (page === spaPage && !fromPop) {
      if (url && !replace) {
        const next = typeof url === "string" ? url : `${url.pathname}${url.search}${url.hash}`;
        if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
          history.pushState({ kayaSpa: page }, "", next);
        }
      }
      return true;
    }

    spaBusy = true;
    persistRainMode();
    try {
      await ensurePageData(page);
      const nextUrl = url
        ? (typeof url === "string" ? url : `${url.pathname}${url.search}${url.hash}`)
        : SPA_PATHS[page];

      closeMvLightbox();
      document.getElementById("site-nav")?.classList.remove("open");
      document.getElementById("menu-toggle")?.setAttribute("aria-expanded", "false");
      setSpaBodyPage(page);
      document.title = SPA_TITLES[page] || document.title;
      updateSpaNav(page);
      swapSpaMain(page);
      mountSpaContent(page);

      if (!fromPop) {
        if (replace) history.replaceState({ kayaSpa: page }, "", nextUrl);
        else history.pushState({ kayaSpa: page }, "", nextUrl);
      } else if (!history.state?.kayaSpa) {
        history.replaceState({ kayaSpa: page }, "", `${window.location.pathname}${window.location.search}${window.location.hash}`);
      }

      window.scrollTo(0, 0);
      spaPage = page;
      refreshRainLedges();
      markPageReady();
      return true;
    } catch (err) {
      console.error("[kaya-spa]", err);
      return false;
    } finally {
      spaBusy = false;
    }
  }

  /** 站内主区软切换：保留天气层；天气参数 / 外链仍整页跳转 */
  function initSpaRouter() {
    if (document.body.dataset.kayaSpaRouter) return;
    document.body.dataset.kayaSpaRouter = "1";

    spaPage = spaPageFromPath(window.location.pathname) || document.body.dataset.kayaPage || null;
    if (spaPage) {
      history.replaceState({ kayaSpa: spaPage }, "", `${window.location.pathname}${window.location.search}${window.location.hash}`);
    }

    document.addEventListener("click", (e) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      if (a.classList.contains("heavy-gate") || a.classList.contains("site-log__btn")) return;

      const href = a.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (!isSpaNavUrl(url)) {
        if (url.origin === window.location.origin) persistRainMode();
        return;
      }

      const page = spaPageFromPath(url.pathname);
      if (!page) return;

      e.preventDefault();
      persistRainMode();
      softNavigate(page, { url }).then((ok) => {
        if (!ok) window.location.assign(url.href);
      });
    }, true);

    window.addEventListener("popstate", () => {
      const page = spaPageFromPath(window.location.pathname);
      if (!page) return;
      if (!rainApi) {
        window.location.reload();
        return;
      }
      softNavigate(page, { fromPop: true });
    });

    const schedulePrefetch = () => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => prefetchSpaData(), { timeout: 2500 });
      } else {
        window.setTimeout(prefetchSpaData, 1200);
      }
    };
    if (document.readyState === "complete") schedulePrefetch();
    else window.addEventListener("load", schedulePrefetch, { once: true });
  }

  const rm = () => window.KayaRainMode;

  function normalizeRainMode(mode) { return rm().normalize(mode); }
  function forceRainFromUrl() { return rm().forceFromUrl(); }
  function forceHeavyFromUrl() { return rm().forceHeavyFromUrl(); }
  function forceStormFromUrl() { return rm().forceStormFromUrl(); }
  function forceSpecialWeatherFromUrl() { return rm().forceSpecialFromUrl(); }
  function readStoredRainMode() { return rm().readStored(); }
  function writeStoredRainMode(mode) { rm().writeStored(mode); }
  function rainModeFromBody() { return rm().fromBody(); }
  function pickInitialRainMode() { return rm().pickInitial(); }
  function isDryWeatherMode(mode) { return rm().isDry(mode); }

  const SPLASH_SELECTORS = [
    ".intro-panel__body",
    ".home-card",
    ".work-card",
    ".link-card",
    ".footer-sites",
    ".footer-sites-item",
    ".profile-avatar",
  ].join(",");

  /** @type {{ refreshLedges?: () => void } | null} */
  let rainApi = null;

  function pickInitialHeavy() {
    const m = pickInitialRainMode();
    return m === "heavy" || m === "storm";
  }

  function initSiteRain(host, rainMode) {
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    /* 与开场主题共用同一次抽签，避免 refresh 时抽两次不一致 */
    const mode = typeof rainMode === "string"
      ? normalizeRainMode(rainMode)
      : (typeof rainMode === "boolean"
        ? (rainMode ? "heavy" : "light")
        : pickInitialRainMode());
    const heavy = mode === "heavy" || mode === "storm";
    const storm = mode === "storm";
    const dry = isDryWeatherMode(mode);

    /** @type {HTMLCanvasElement | null} */
    let bgCanvas = null;
    /** @type {HTMLElement | null} */
    let fx = null;

    if (!dry) {
      bgCanvas = document.createElement("canvas");
      bgCanvas.className = "site-bg__rain";
      bgCanvas.setAttribute("aria-hidden", "true");
      const bgCtx = bgCanvas.getContext("2d", { alpha: true });
      if (!bgCtx) return;
      host.appendChild(bgCanvas);

      /* 小雨/晴天不需 site-fx 层，避免多余 DOM 与大雨脚本误挂载 */
      if (heavy) {
        fx = document.createElement("div");
        fx.className = "site-fx";
        fx.setAttribute("aria-hidden", "true");
        document.body.appendChild(fx);
      }
    }

    let running = !document.hidden;
    let w = 0;
    let h = 0;
    let resizeTimer = 0;
    let lastScrollAt = 0;
    let scrollRaf = 0;
    let lastScrollY = window.scrollY || 0;
    /** @type {Array<{x:number,y:number,w:number,radius:number}>} */
    let ledges = [];
    /** @type {WeakMap<Element, number>} */
    const radiusCache = new WeakMap();
    let heavyFx = null;
    let lightFx = null;
    let stormFx = null;
    let sunnyFx = null;
    let splashNodes = null;
    let splashNodesAt = 0;

    const applyRainMode = () => {
      applyRainTheme(mode);
      fx?.classList.toggle("is-active", heavy);
    };

    const ensureSplashNodes = (force = false) => {
      const now = performance.now();
      if (!force && splashNodes && now - splashNodesAt < 1000) return splashNodes;
      splashNodes = document.querySelectorAll(SPLASH_SELECTORS);
      splashNodesAt = now;
      return splashNodes;
    };

    const collectLedges = () => {
      const nodes = ensureSplashNodes();
      const next = [];
      const max = 32;
      const vh = h || window.innerHeight;
      const vw = w || window.innerWidth;
      for (let i = 0; i < nodes.length && next.length < max; i += 1) {
        const el = nodes[i];
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 36 || r.height < 16) continue;
        if (r.bottom < -40 || r.top > vh + 40 || r.right < -20 || r.left > vw + 20) continue;
        let radius = radiusCache.get(el);
        if (radius == null) {
          radius = Math.min(22, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14);
          radiusCache.set(el, radius);
        }
        const minSide = Math.min(r.width, r.height);
        const roundish = el.classList.contains("profile-avatar")
          || radius >= minSide * 0.42
          || getComputedStyle(el).borderRadius === "50%";
        next.push({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          radius,
          shape: roundish ? "circle" : "rect",
        });
      }
      ledges = next;
      return ledges;
    };

    const isScrolling = () => performance.now() - lastScrollAt < 140;

    const ensureHeavyFx = () => {
      if (!fx) return null;
      if (heavyFx) return heavyFx;
      if (!window.KayaHeavyRain?.attach) {
        console.warn("[kaya] KayaHeavyRain missing");
        return null;
      }
      heavyFx = window.KayaHeavyRain.attach(fx, {
        getLedges: () => ledges,
        collectLedges,
        isScrolling,
        bgHost: host,
        storm,
      });
      return heavyFx;
    };

    const ensureStormFx = () => {
      if (!storm || !fx) return null;
      if (stormFx) return stormFx;
      if (!window.KayaStormLightning?.attach) {
        console.warn("[kaya] KayaStormLightning missing");
        return null;
      }
      /* 暴雨打雷：效果优先，不做手机 lite 降档 */
      stormFx = window.KayaStormLightning.attach(fx, {
        lite: false,
        maxQuality: true,
      });
      return stormFx;
    };

    const ensureLightFx = () => {
      if (!bgCanvas) return null;
      if (lightFx) return lightFx;
      if (!window.KayaLightRain?.attach) {
        console.warn("[kaya] KayaLightRain missing");
        return null;
      }
      lightFx = window.KayaLightRain.attach(bgCanvas, { mistHost: host });
      return lightFx;
    };

    const ensureSunnyFx = () => {
      if (sunnyFx) return sunnyFx;
      if (!window.KayaSunnySky?.attach) {
        console.warn("[kaya] KayaSunnySky missing");
        return null;
      }
      sunnyFx = window.KayaSunnySky.attach(host);
      return sunnyFx;
    };

    const ensureDryFx = () => ensureSunnyFx();

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      if (heavy) {
        ensureSplashNodes(true);
        collectLedges();
        heavyFx?.resize();
        stormFx?.resize();
      } else if (mode === "sunny") {
        sunnyFx?.resize();
      } else {
        lightFx?.resize();
      }
    };

    const onResize = () => {
      /* 晴天切回前台常伴随假 resize；交给 sunny 内部 guard，这里也节流 */
      if (dry && document.hidden) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, dry ? 200 : 100);
    };

    const flushScroll = () => {
      scrollRaf = 0;
      if (!heavy) return;
      const y = window.scrollY || 0;
      const dy = Math.abs(y - lastScrollY);
      lastScrollY = y;
      collectLedges();
      if (dy > 2) heavyFx?.onScroll?.(dy);
    };

    const onScroll = () => {
      if (!heavy) return;
      lastScrollAt = performance.now();
      if (!scrollRaf) scrollRaf = window.requestAnimationFrame(flushScroll);
    };

    const onVisibility = () => {
      const hidden = document.hidden;
      host.classList.toggle("is-paused", hidden);
      if (hidden) {
        running = false;
        window.cancelAnimationFrame(scrollRaf);
        scrollRaf = 0;
        /* 晴天是静态层：切后台不要 stop（否则回来全屏重烘焙卡死） */
        if (!dry) {
          /* 大雨/雷暴：立刻硬停，避免淡出期间仍跑 RAF/截图 */
          if (heavyFx?.pause) heavyFx.pause();
          else heavyFx?.stop();
          lightFx?.stop();
          stormFx?.stop();
        }
        return;
      }
      /* 后台挂起时浏览器会节流 timer/CSS，开场遮罩可能永不完结 */
      if (document.body.classList.contains("home-intro-playing")) {
        try { window.__kayaForceFinishIntro?.(); } catch { /* ignore */ }
        document.body.classList.add("home-ready", "home-revealed");
        document.body.classList.remove("home-intro-playing");
        document.getElementById("home-intro")?.remove();
      }
      running = true;
      /* 晴天：尺寸未变就别 resize/rebake */
      if (dry) {
        sunnyFx?.start?.();
        return;
      }
      resize();
      window.requestAnimationFrame(() => {
        if (document.hidden) return;
        startActiveFx();
        if (heavy) {
          ensureSplashNodes(true);
          collectLedges();
        }
      });
    };

    const startActiveFx = () => {
      if (!running) return;
      if (heavy) {
        ensureHeavyFx()?.start();
        ensureStormFx()?.start();
        ensureSplashNodes(true);
        collectLedges();
      } else if (mode === "sunny") {
        ensureDryFx()?.start();
      } else {
        ensureLightFx()?.start();
      }
    };

    applyRainMode();
    host.classList.toggle("is-paused", document.hidden);
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    const onPageShow = (e) => {
      if (e.persisted && !document.hidden) onVisibility();
    };
    window.addEventListener("pageshow", onPageShow);

    if (heavy) {
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
      resize();
      /* 必须等 home-ready：贴屏 html2canvas 若在正文 opacity:0 时截图 → 全屏黑底只剩雨 */
      const introPlaying = document.body.classList.contains("home-intro-playing");
      if (introPlaying) {
        const waitIntro = () => {
          const ready = document.body.classList.contains("home-ready");
          const introGone = !document.body.classList.contains("home-intro-playing");
          if (ready || introGone) {
            /* 再等 1～2 帧让浏览器提交可见态，再挂贴屏折射 */
            window.requestAnimationFrame(() => {
              window.setTimeout(startActiveFx, ready ? 120 : 40);
            });
            return;
          }
          window.setTimeout(waitIntro, 80);
        };
        window.setTimeout(waitIntro, 160);
      } else {
        startActiveFx();
      }
      window.setTimeout(() => {
        if (!running) return;
        ensureSplashNodes(true);
        collectLedges();
      }, 1100);
    } else if (mode === "sunny") {
      resize();
      startActiveFx();
    } else {
      resize();
      /* 小雨开场已挂同引擎；开幕淡出时衔接主站雨层，避免空窗 */
      const introPlaying = document.body.classList.contains("home-intro-playing");
      if (introPlaying) {
        const waitIntro = () => {
          const intro = document.getElementById("home-intro");
          if (
            !document.body.classList.contains("home-intro-playing")
            || intro?.classList.contains("is-done")
          ) {
            startActiveFx();
            return;
          }
          window.setTimeout(waitIntro, 80);
        };
        window.setTimeout(waitIntro, 160);
      } else {
        startActiveFx();
      }
    }

    rainApi = {
      refreshLedges: () => {
        if (!heavy || !running) return;
        ensureSplashNodes(true);
        collectLedges();
      },
      destroy: () => {
        running = false;
        window.clearTimeout(resizeTimer);
        window.cancelAnimationFrame(scrollRaf);
        window.removeEventListener("resize", onResize);
        window.visualViewport?.removeEventListener("resize", onResize);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pageshow", onPageShow);
        window.removeEventListener("scroll", onScroll, true);
        try { heavyFx?.destroy?.(); } catch { /* ignore */ }
        try { lightFx?.destroy?.(); } catch { /* ignore */ }
        try { stormFx?.destroy?.(); } catch { /* ignore */ }
        try { sunnyFx?.destroy ? sunnyFx.destroy() : sunnyFx?.stop(); } catch { /* ignore */ }
        bgCanvas?.remove();
        fx?.remove();
        rainApi = null;
      },
    };
  }

  function refreshRainLedges() {
    rainApi?.refreshLedges?.();
    window.requestAnimationFrame(() => rainApi?.refreshLedges?.());
  }

  function markPageReady() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.classList.remove("page-ready");
    if (reduced) {
      document.body.classList.add("page-ready");
      return;
    }
    void document.body.offsetWidth;
    window.requestAnimationFrame(() => {
      document.body.classList.add("page-ready");
    });
  }

  function initCommon(rainMode) {
    const isStandaloneTool = document.body.classList.contains("page-quiz")
      || document.body.classList.contains("page-sedai");
    if (!isStandaloneTool && !shellInited) {
      shellInited = true;
      initNav();
      initSpaRouter();
      initWeatherPreview();
      initFooterSites();
      initSiteRain(document.querySelector(".site-bg"), rainMode);
      initSandaimeHint();
      initSandaimeBrand();
    }
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function initHero() {
    const d = data();
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set("hero-name", d.user.name || "时雨榧");

    const signEl = document.getElementById("hero-sign");
    if (signEl) {
      const sign = d.user.sign || "";
      signEl.innerHTML = sign
        .split("\n")
        .map((line) => wrapSandaimeInHtml(escapeHtml(line)))
        .join("<br />");
    }

    const avatarEl = document.getElementById("hero-avatar");
    if (avatarEl && d.user.avatar) {
      avatarEl.src = d.user.avatar;
      avatarEl.alt = d.user.name || "";
    }

    renderSocialIcons(document.getElementById("social-icons"));
    renderIntro(document.getElementById("intro-body"));
  }

  function startIntroRain(canvas) {
    const heavy = document.body.classList.contains("heavy-rain");
    const storm = document.body.classList.contains("storm-rain");
    const dry = document.body.classList.contains("sunny-sky");

    /* 晴/虹开场不应再挂小雨 */
    if (dry) return () => {};

    /* 小雨开场复用主站引擎，保证与主页面观感一致 */
    if (!heavy && window.KayaLightRain?.attach && canvas) {
      const fx = window.KayaLightRain.attach(canvas, { mistHost: null });
      fx.start();
      return () => {
        try { fx.destroy(); } catch { /* ignore */ }
      };
    }

    /* 大雨/雷暴开幕：分层 2D 逼近 GPU 雨丝（同页勿开第二个 WebGL） */
    const ctx = canvas?.getContext("2d");
    if (!ctx) return () => {};

    const drops = [];
    let raf = 0;
    let running = true;
    let last = performance.now();
    let w = window.innerWidth;
    let h = window.innerHeight;
    let wind = storm ? 0.28 : 0.32;
    let windTarget = wind;
    let windTimer = 0;
    const area = clamp((w * h) / (1280 * 720), 0.7, 1.45);
    const layers = storm
      ? [
        /* 对齐参考片：短密近竖直雨帘 */
        { n: Math.round(380 * area), len: [0.004, 0.009], speed: [1200, 1700], alpha: [0.12, 0.22], width: [0.55, 0.95], drift: 6 },
        { n: Math.round(420 * area), len: [0.006, 0.014], speed: [1400, 1950], alpha: [0.2, 0.4], width: [0.75, 1.3], drift: 9 },
        { n: Math.round(300 * area), len: [0.008, 0.018], speed: [1600, 2200], alpha: [0.32, 0.58], width: [1.0, 1.7], drift: 12 },
      ]
      : [
        { n: Math.round(160 * area), len: [0.0065, 0.013], speed: [980, 1320], alpha: [0.07, 0.14], width: [0.5, 0.85], drift: 8 },
        { n: Math.round(220 * area), len: [0.01, 0.021], speed: [1150, 1580], alpha: [0.12, 0.26], width: [0.7, 1.2], drift: 12 },
        { n: Math.round(160 * area), len: [0.015, 0.032], speed: [1380, 1880], alpha: [0.22, 0.42], width: [1.0, 1.75], drift: 16 },
      ];

    for (let L = 0; L < layers.length; L += 1) {
      const spec = layers[L];
      for (let i = 0; i < spec.n; i += 1) {
        drops.push({
          x: Math.random() * w,
          y: Math.random() * h,
          len: h * (spec.len[0] + Math.random() * (spec.len[1] - spec.len[0])),
          speed: spec.speed[0] + Math.random() * (spec.speed[1] - spec.speed[0]),
          alpha: spec.alpha[0] + Math.random() * (spec.alpha[1] - spec.alpha[0]),
          width: spec.width[0] + Math.random() * (spec.width[1] - spec.width[0]),
          drift: spec.drift * (0.75 + Math.random() * 0.5),
          wobble: Math.random() * Math.PI * 2,
        });
      }
    }

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
    };

    const tick = (now) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      windTimer -= dt;
      if (windTimer <= 0) {
        windTimer = storm ? (0.9 + Math.random() * 1.6) : (2.2 + Math.random() * 2.4);
        const mag = storm ? (0.35 + Math.random() * 0.7) : (0.18 + Math.random() * 0.4);
        const flip = storm ? Math.random() < 0.55 : Math.random() < 0.14;
        const sign = flip
          ? (Math.random() < 0.5 ? -1 : 1)
          : (Math.sign(wind) || 1);
        windTarget = sign * mag;
      }
      wind += (windTarget - wind) * Math.min(1, dt * (storm ? 1.35 : 0.7));

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < drops.length; i += 1) {
        const d = drops[i];
        d.wobble += dt * 2.2;
        const sway = Math.sin(d.wobble) * d.drift * 0.04;
        const tilt = wind * d.drift * (storm ? 0.22 : 0.12) + sway;
        const x2 = d.x + tilt;
        const y2 = d.y + d.len;
        const g = ctx.createLinearGradient(d.x, d.y, x2, y2);
        const profile = window.KayaRainStreakProfile;
        if (profile) {
          profile.applyCanvasGradient(g, "200,225,245", d.alpha);
        } else {
          g.addColorStop(0, "rgba(200,225,245,0)");
          g.addColorStop(0.15, `rgba(200,225,245,${d.alpha * 0.25})`);
          g.addColorStop(0.42, `rgba(200,225,245,${d.alpha * 0.46})`);
          g.addColorStop(0.72, `rgba(200,225,245,${d.alpha * 0.84})`);
          g.addColorStop(1, `rgba(200,225,245,${Math.min(1, d.alpha)})`);
        }
        ctx.strokeStyle = g;
        ctx.lineWidth = d.width;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        d.y += d.speed * dt;
        d.x += (wind * 28 + d.drift * 0.35) * dt;
        if (d.y > h + d.len) {
          d.y = -d.len - Math.random() * 40;
          d.x = Math.random() * w;
        } else if (d.x > w + 30) {
          d.x = -12;
        } else if (d.x < -30) {
          d.x = w + 12;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }

  function normalizePathname(pathname) {
    let p = pathname || "/";
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p || "/";
  }

  /** Home intro: play on direct/external/reload; skip when arriving from another page of the same site. */
  function shouldPlayHomeIntro(sitePrefix) {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "reload") return true;
    if (nav?.type === "back_forward") return false;

    const ref = document.referrer;
    if (!ref) return true;

    try {
      const refUrl = new URL(ref);
      if (refUrl.origin !== location.origin) return true;

      const p = normalizePathname(refUrl.pathname);
      const prefix = sitePrefix === "/" ? "" : String(sitePrefix || "").replace(/\/+$/, "");

      if (!prefix) {
        // Root site: treat /fuyuu and deferred creator paths as outside.
        if (
          p === "/fuyuu" ||
          p.startsWith("/fuyuu/") ||
          p.startsWith("/koharu") ||
          p.startsWith("/shiotsuki") ||
          p.startsWith("/tianhu") ||
          p.startsWith("/api")
        ) {
          return true;
        }
        return p === "/" || p === "/index.html";
      }

      if (p !== prefix && !p.startsWith(`${prefix}/`)) return true;
      return p === prefix || p === `${prefix}/index.html`;
    } catch {
      return true;
    }
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  }

  function easeOutCubic(t) {
    return 1 - ((1 - t) ** 3);
  }

  function startIntroLiquid(canvas, src) {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return Promise.resolve(() => {});
    const heavy = document.body.classList.contains("heavy-rain");
    /* 正常约 2.1s；超时则跳过，避免手机端 canvas 尺寸为 0 时永远卡住 */
    const LIQUID_HARD_MS = 3200;
    const SIZE_WAIT_MS = 480;

    return new Promise((resolve) => {
      let settled = false;
      let raf = 0;
      let running = true;
      let hardTimer = 0;
      let cleanup = () => {};

      const finish = (stopFn) => {
        if (settled) return;
        settled = true;
        running = false;
        window.clearTimeout(hardTimer);
        window.cancelAnimationFrame(raf);
        try { cleanup(); } catch { /* ignore */ }
        cleanup = () => {};
        resolve(typeof stopFn === "function" ? stopFn : () => {});
      };

      hardTimer = window.setTimeout(() => finish(() => {}), LIQUID_HARD_MS);

      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (settled) return;
        const started = performance.now();
        const FILL_MS = 1550;
        const SETTLE_MS = 550;
        const mask = document.createElement("canvas");
        const mctx = mask.getContext("2d");
        if (!mctx) {
          finish(() => {});
          return;
        }

        // 多点有机绽放：错落生长，汇成整字
        const blooms = [
          { x: 0.08, y: 0.52, delay: 0.00, grow: 1.15, seed: 0.7 },
          { x: 0.18, y: 0.38, delay: 0.04, grow: 1.00, seed: 1.4 },
          { x: 0.27, y: 0.62, delay: 0.08, grow: 1.08, seed: 2.1 },
          { x: 0.36, y: 0.44, delay: 0.12, grow: 0.95, seed: 0.3 },
          { x: 0.46, y: 0.58, delay: 0.16, grow: 1.12, seed: 1.9 },
          { x: 0.55, y: 0.36, delay: 0.20, grow: 1.05, seed: 2.6 },
          { x: 0.64, y: 0.55, delay: 0.24, grow: 1.18, seed: 0.9 },
          { x: 0.74, y: 0.42, delay: 0.28, grow: 1.02, seed: 1.6 },
          { x: 0.84, y: 0.60, delay: 0.32, grow: 1.10, seed: 2.3 },
          { x: 0.92, y: 0.48, delay: 0.36, grow: 0.98, seed: 0.5 },
          { x: 0.22, y: 0.78, delay: 0.10, grow: 0.72, seed: 1.1 },
          { x: 0.68, y: 0.78, delay: 0.26, grow: 0.70, seed: 1.8 },
          { x: 0.50, y: 0.22, delay: 0.18, grow: 0.68, seed: 2.4 },
        ];

        const fallbackCssSize = () => {
          const parent = canvas.parentElement;
          const pr = parent?.getBoundingClientRect?.();
          let cssW = pr?.width || 0;
          let cssH = pr?.height || 0;
          if (cssW < 2) cssW = Math.min(window.innerWidth * 0.86, 576) || 280;
          if (cssH < 2) cssH = cssW * (440 / 1400);
          return { cssW, cssH };
        };

        const resize = () => {
          let rect = canvas.getBoundingClientRect();
          let cssW = rect.width;
          let cssH = rect.height;
          if (cssW < 2 || cssH < 2) {
            const fb = fallbackCssSize();
            cssW = fb.cssW;
            cssH = fb.cssH;
          }
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.max(1, Math.floor(cssW * dpr));
          const h = Math.max(1, Math.floor(cssH * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            mask.width = w;
            mask.height = h;
          }
        };

        const drawOrganicBlob = (target, cx, cy, radius, t, seed) => {
          if (radius < 0.8) return;
          target.beginPath();
          const steps = 56;
          for (let i = 0; i <= steps; i += 1) {
            const a = (i / steps) * Math.PI * 2;
            const n =
              Math.sin(a * 2.0 + t * 1.6 + seed) * 0.18 +
              Math.sin(a * 3.5 - t * 1.2 + seed * 1.7) * 0.12 +
              Math.sin(a * 5.0 + t * 2.1 + seed * 0.6) * 0.07 +
              Math.sin(a * 1.0 + t * 0.7 + seed * 2.2) * 0.1;
            const r = radius * (1 + n);
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r * (0.82 + 0.08 * Math.sin(seed + t));
            if (i === 0) target.moveTo(x, y);
            else target.lineTo(x, y);
          }
          target.closePath();
          target.fill();
        };

        const fillBloomMask = (target, level, t, w, h) => {
          const maxR = Math.hypot(w, h) * 0.42;
          blooms.forEach((b) => {
            const local = Math.max(0, Math.min(1, (level - b.delay) / Math.max(0.001, 1 - b.delay)));
            if (local <= 0) return;
            const grown = easeOutCubic(local);
            const radius = maxR * grown * b.grow * (0.22 + 0.78 * level);
            const cx = w * (b.x + Math.sin(t * 0.55 + b.seed) * 0.012 * (1 - level));
            const cy = h * (b.y + Math.cos(t * 0.65 + b.seed) * 0.018 * (1 - level));
            drawOrganicBlob(target, cx, cy, radius, t, b.seed);
          });

          if (level > 0.72) {
            const fin = easeOutCubic((level - 0.72) / 0.28);
            drawOrganicBlob(target, w * 0.5, h * 0.5, maxR * 0.95 * fin, t, 3.1);
            drawOrganicBlob(target, w * 0.3, h * 0.5, maxR * 0.7 * fin, t, 4.2);
            drawOrganicBlob(target, w * 0.7, h * 0.5, maxR * 0.7 * fin, t, 5.0);
          }
        };

        const drawWord = (target, w, h) => {
          if (!img.naturalWidth || !img.naturalHeight) return;
          const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          target.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        };

        /* 大雨开幕：墨色字改白，深色底上才可读 */
        const paintInkGlyph = (target, w, h) => {
          drawWord(target, w, h);
          if (!heavy) return;
          target.save();
          target.globalCompositeOperation = "source-in";
          target.fillStyle = "#f5f8ff";
          target.fillRect(0, 0, w, h);
          target.restore();
        };

        const stop = () => {
          running = false;
          window.cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
        };

        const paint = (now) => {
          if (!running || settled) return;
          resize();
          const w = canvas.width;
          const h = canvas.height;
          const elapsed = now - started;

          /* 布局未就绪过久则放弃液体字，避免深色开场黑屏死锁 */
          if (w < 2 || h < 2) {
            if (elapsed > SIZE_WAIT_MS) {
              finish(stop);
              return;
            }
            raf = window.requestAnimationFrame(paint);
            return;
          }

          const fillRaw = Math.min(1, elapsed / FILL_MS);
          const level = easeInOutCubic(fillRaw);
          const settleRaw = elapsed <= FILL_MS
            ? 0
            : Math.min(1, (elapsed - FILL_MS) / SETTLE_MS);
          const settle = easeInOutCubic(settleRaw);
          const t = elapsed / 1000;

          if (settleRaw >= 1) {
            ctx.clearRect(0, 0, w, h);
            paintInkGlyph(ctx, w, h);
            finish(stop);
            return;
          }

          mctx.clearRect(0, 0, w, h);
          mctx.globalCompositeOperation = "source-over";
          mctx.fillStyle = "#fff";
          fillBloomMask(mctx, level, t, w, h);
          mctx.globalCompositeOperation = "destination-in";
          drawWord(mctx, w, h);

          ctx.clearRect(0, 0, w, h);

          const washAlpha = (1 - settle) * (0.75 + level * 0.25);
          if (washAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = washAlpha;
            ctx.drawImage(mask, 0, 0);
            ctx.globalCompositeOperation = "source-in";
            const u = settle;
            let grad;
            if (heavy) {
              grad = ctx.createLinearGradient(0, h * 0.2, w, h * 0.85);
              grad.addColorStop(0, `rgba(245, 250, 255, ${0.75 - 0.15 * u})`);
              grad.addColorStop(0.55, `rgba(200, 220, 245, ${0.85 - 0.1 * u})`);
              grad.addColorStop(1, `rgba(170, 195, 230, ${0.9 - 0.05 * u})`);
            } else {
              const r1 = Math.round(210 - 50 * u);
              const g1 = Math.round(195 - 70 * u);
              const b1 = Math.round(235 - 100 * u);
              const r2 = Math.round(115 - 70 * u);
              const g2 = Math.round(90 - 55 * u);
              const b2 = Math.round(175 - 100 * u);
              grad = ctx.createLinearGradient(0, h * 0.2, w, h * 0.85);
              grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0.5)`);
              grad.addColorStop(0.55, `rgba(${r2}, ${g2}, ${b2}, 0.78)`);
              grad.addColorStop(1, "rgba(26, 21, 32, 0.88)");
            }
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
          }

          ctx.save();
          ctx.globalAlpha = Math.min(1, 0.22 + level * 0.4 + settle * 0.55);
          paintInkGlyph(ctx, w, h);
          ctx.globalCompositeOperation = "destination-in";
          ctx.drawImage(mask, 0, 0);
          ctx.restore();

          raf = window.requestAnimationFrame(paint);
        };

        const onResize = () => {
          if (!running) return;
          resize();
        };

        resize();
        cleanup = () => {
          window.removeEventListener("resize", onResize);
        };
        window.addEventListener("resize", onResize, { passive: true });
        raf = window.requestAnimationFrame(paint);
      };
      img.onerror = () => finish(() => {});
      img.src = src;
    });
  }

  function weatherModeFromHref(href) {
    if (!href) return null;
    const q = href.match(/[?&]rain=(light|heavy|storm|sunny|rainbow|after|clear)/i);
    if (q) return normalizeRainMode(q[1].toLowerCase());
    const p = href.match(/\/(light|heavy|storm|sunny|rainbow)\/?$/i);
    return p ? normalizeRainMode(p[1].toLowerCase()) : null;
  }

  function initFooterSites() {
    const dialog = document.getElementById("footer-sites-dialog");
    const openBtn = document.getElementById("footer-sites-open");
    const closeBtn = document.getElementById("footer-sites-close");
    let toast = document.getElementById("kaya-toast");
    if (!dialog || !openBtn || typeof dialog.showModal !== "function") return;
    if (dialog.dataset.kayaBound) return;
    dialog.dataset.kayaBound = "1";

    if (!toast) {
      toast = document.createElement("div");
      toast.className = "kaya-toast";
      toast.id = "kaya-toast";
      toast.hidden = true;
      toast.setAttribute("aria-live", "polite");
      dialog.appendChild(toast);
    } else if (toast.parentElement !== dialog) {
      dialog.appendChild(toast);
    }

    let toastTimer = 0;
    let toastHideTimer = 0;
    const hideToast = () => {
      window.clearTimeout(toastTimer);
      window.clearTimeout(toastHideTimer);
      if (toast.hidden) return;
      toast.classList.remove("is-on");
      toast.classList.add("is-off");
      toastHideTimer = window.setTimeout(() => {
        toast.classList.remove("is-off");
        toast.hidden = true;
        toast.textContent = "";
      }, 300);
    };
    const showToast = (msg) => {
      window.clearTimeout(toastTimer);
      window.clearTimeout(toastHideTimer);
      toast.classList.remove("is-on", "is-off");
      toast.textContent = msg || "暂未完成（懒得做）";
      toast.hidden = false;
      /* 强制重绘，保证连续点击也能重播入场 */
      void toast.offsetWidth;
      toast.classList.add("is-on");
      toastTimer = window.setTimeout(hideToast, 2000);
    };

    const open = () => {
      if (dialog.open) return;
      dialog.showModal();
    };
    const close = () => {
      if (dialog.open) dialog.close();
    };

    openBtn.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close();
    });
    dialog.querySelectorAll(".footer-sites-item.is-wip").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        showToast(el.getAttribute("data-wip-msg") || "暂未完成（懒得做）");
      });
    });
  }

  function initWeatherPreview() {
    const footer = document.querySelector(".site-footer");
    if (!footer) return;

    footer.querySelector(".weather-preview")?.remove();
    footer.querySelectorAll(".heavy-gate").forEach((el) => el.remove());
    if (footer.querySelector(".weather-gate")) return;

    const modes = [
      { href: "?rain=sunny", label: "晴天" },
      { href: "?rain=light", label: "小雨" },
      { href: "?rain=heavy", label: "大雨" },
      { href: "?rain=storm", label: "雷暴" },
    ];

    const gate = document.createElement("div");
    gate.className = "weather-gate";
    gate.id = "weather-gate";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "weather-gate__trigger";
    trigger.id = "weather-gate-trigger";
    trigger.setAttribute("aria-label", "调整天气");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "weather-gate-panel");
    trigger.innerHTML = '<span class="weather-gate__icon" aria-hidden="true">☁</span>';

    const panel = document.createElement("nav");
    panel.className = "weather-gate__panel";
    panel.id = "weather-gate-panel";
    panel.setAttribute("aria-label", "天气预览");
    panel.hidden = true;

    modes.forEach(({ href, label }) => {
      const a = document.createElement("a");
      a.href = href;
      a.textContent = label;
      panel.appendChild(a);
    });

    gate.appendChild(trigger);
    gate.appendChild(panel);
    document.body.appendChild(gate);

    const setOpen = (open) => {
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      gate.classList.toggle("is-open", open);
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(panel.hidden);
    });

    document.addEventListener("click", (e) => {
      if (!gate.contains(e.target)) setOpen(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    panel.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", (e) => {
        const mode = weatherModeFromHref(a.getAttribute("href") || "");
        if (!mode) return;
        e.preventDefault();
        setOpen(false);
        writeStoredRainMode(mode);
        const url = new URL(window.location.href);
        url.searchParams.set("rain", mode);
        ["storm", "heavy", "light", "sunny", "clear", "rainbow", "after"].forEach((k) => {
          url.searchParams.delete(k);
        });
        window.location.assign(`${url.pathname}${url.search}${url.hash}`);
      });
    });

    const current = rainModeFromBody() || readStoredRainMode();
    if (current) {
      panel.querySelectorAll("a").forEach((a) => {
        const key = weatherModeFromHref(a.getAttribute("href") || "");
        a.classList.toggle("is-current", key === current);
      });
    }
  }

  /** @param {"light"|"heavy"|"storm"|"sunny"|boolean} modeOrHeavy */
  function applyRainTheme(modeOrHeavy) {
    const mode = typeof modeOrHeavy === "string"
      ? normalizeRainMode(modeOrHeavy)
      : (modeOrHeavy ? "heavy" : "light");
    writeStoredRainMode(mode);
    const heavy = mode === "heavy" || mode === "storm";
    const storm = mode === "storm";
    const sunny = mode === "sunny";
    document.body.classList.toggle("heavy-rain", heavy);
    document.body.classList.toggle("storm-rain", storm);
    document.body.classList.toggle("light-rain", mode === "light");
    document.body.classList.toggle("sunny-sky", sunny);
    document.body.classList.toggle("after-rain", false);
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) {
      const color = storm
        ? "#141c2c"
        : heavy
          ? "#243448"
          : sunny
            ? "#7ec8e8"
            : "#f7f8fc";
      theme.setAttribute("content", color);
    }
    document.querySelectorAll(".weather-gate__panel a").forEach((a) => {
      const key = weatherModeFromHref(a.getAttribute("href") || "");
      a.classList.toggle("is-current", key === mode);
    });
  }

  function initHomeIntro() {
    const intro = document.getElementById("home-intro");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phoneLike = window.KayaPerfGovernor?.isPhoneLike?.()
      ?? window.matchMedia("(max-width: 720px)").matches;
    const heavySession = document.body.classList.contains("heavy-rain")
      || document.body.classList.contains("storm-rain");
    /* URL 测试入口，或会话已是晴/虹：跳过开场，避免遮罩 + 错挂小雨 */
    const drySession = document.body.classList.contains("sunny-sky");
    const play = !forceSpecialWeatherFromUrl() && !drySession && shouldPlayHomeIntro("/");

    if (!intro || reduced || !play || (phoneLike && heavySession)) {
      document.body.classList.add("home-ready");
      document.body.classList.add("home-revealed");
      intro?.remove();
      return;
    }

    document.body.classList.add("home-intro-playing");
    const stopRain = startIntroRain(document.getElementById("intro-rain"));
    const HOLD_MS = 250;
    const OUT_MS = 650;
    const REVEAL_DELAY = 140;
    /* 液体字 + hold/out；超时强制收场，防止 ?heavy 深色底黑屏 */
    const INTRO_HARD_MS = 4200;
    let finished = false;
    let stopLiquid = null;
    let hardTimer = 0;

    const finishIntro = (force = false) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(hardTimer);
      delete window.__kayaForceFinishIntro;
      if (force) {
        document.body.classList.add("home-ready", "home-revealed");
        document.body.classList.remove("home-intro-playing");
        stopRain();
        try { stopLiquid?.(); } catch { /* ignore */ }
        intro.remove();
        return;
      }
      intro.classList.add("is-done");
      window.setTimeout(() => {
        document.body.classList.add("home-ready");
        /* 入场动画结束后强制揭幕，防小米等机关闭/卡住 CSS 动画后正文永不可见 */
        window.setTimeout(() => {
          document.body.classList.add("home-revealed");
        }, phoneLike ? 80 : 1600);
      }, REVEAL_DELAY);
      window.setTimeout(() => {
        document.body.classList.remove("home-intro-playing");
        stopRain();
        try { stopLiquid?.(); } catch { /* ignore */ }
        intro.remove();
      }, OUT_MS);
    };

    window.__kayaForceFinishIntro = () => finishIntro(true);
    hardTimer = window.setTimeout(finishIntro, INTRO_HARD_MS);

    startIntroLiquid(
      document.getElementById("intro-liquid"),
      "assets/images/script-en.png"
    ).then((stop) => {
      if (finished) {
        try { stop?.(); } catch { /* ignore */ }
        return;
      }
      stopLiquid = stop;
      window.setTimeout(finishIntro, HOLD_MS);
    }).catch(() => {
      finishIntro();
    });
  }

  function mvData() {
    return window.MV_MATERIALS || { rows: [] };
  }

  function mvRows() {
    return mvData().rows || [];
  }

  function mvAllItems() {
    return mvRows().flatMap((row) => row.items || []);
  }

  function mvSrcKey(src) {
    try {
      return new URL(src, window.location.origin).pathname;
    } catch {
      return src;
    }
  }

  /** MV 原图 → WebP 缩略图（80% 尺寸，见 scripts/generate-mv-thumbs.mjs） */
  function mvThumbSrc(src) {
    if (!src || src.includes("/thumbs/") || !/^assets\/images\/mv-materials\/.+\.(png|jpe?g|webp)$/i.test(src)) {
      return src;
    }
    const base = src.replace(/^assets\/images\/mv-materials\//, "").replace(/\.(png|jpe?g|webp)$/i, "");
    return `assets/images/mv-materials/thumbs/${base}.webp`;
  }

  /** 路径逐段编码，避免文件名中的 + 被 CDN 当成空格（如 小叶子+耶芙娜） */
  function mvAssetUrl(src) {
    if (!src || /^https?:\/\//i.test(src)) return src;
    return src.split("/").map((seg) => encodeURIComponent(seg)).join("/");
  }

  function mvImgOnError(img) {
    img.onerror = null;
    const full = img.dataset.full;
    if (full) img.src = mvAssetUrl(full);
  }

  function mvPreviewImages() {
    const listed = mvData().preview;
    if (Array.isArray(listed) && listed.length) return listed;
    return mvRows().map((row) => row.items?.[0]?.src).filter(Boolean).slice(0, 4);
  }

  function mvRowColumns(items) {
    return items.map((item) => {
      const [w, h] = item.aspect || [1, 1];
      return `${w / h}fr`;
    }).join(" ");
  }

  function createMvBoardItem(item) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mv-board__item";
    const [w, h] = item.aspect || [1, 1];
    btn.style.aspectRatio = `${w} / ${h}`;
    btn.setAttribute("aria-label", "查看大图");
    const image = document.createElement("img");
    image.src = mvAssetUrl(mvThumbSrc(item.src));
    image.dataset.full = item.src;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.onerror = () => mvImgOnError(image);
    btn.appendChild(image);
    return btn;
  }

  function renderMvHomePreview(container) {
    if (!container) return;
    container.innerHTML = "";
    mvPreviewImages().forEach((src) => {
      const cell = document.createElement("span");
      cell.className = "home-card__preview-cell";
      const image = document.createElement("img");
      image.src = mvAssetUrl(mvThumbSrc(src));
      image.dataset.full = src;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.onerror = () => mvImgOnError(image);
      cell.appendChild(image);
      container.appendChild(cell);
    });
  }

  function renderMvGallery(container) {
    if (!container) return;
    container.innerHTML = "";
    mvRows().forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "mv-board__row";
      rowEl.style.gridTemplateColumns = mvRowColumns(row.items || []);
      (row.items || []).forEach((item) => rowEl.appendChild(createMvBoardItem(item)));
      container.appendChild(rowEl);
    });
  }

  function initMvLightbox() {
    ensureMvLightboxDom();
    const dialog = document.getElementById("mv-lightbox");
    const imgEl = document.getElementById("mv-lightbox-img");
    const closeBtn = document.getElementById("mv-lightbox-close");
    const railEl = document.getElementById("mv-lightbox-rail");
    if (!dialog || !imgEl || !railEl) return;
    if (mvLightboxInited) return;
    mvLightboxInited = true;

    let currentIndex = 0;
    let wheelLocked = false;

    function items() {
      return mvAllItems();
    }

    function renderRail() {
      const list = items();
      railEl.innerHTML = "";
      list.forEach((item, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mv-lightbox__thumb";
        btn.setAttribute("aria-label", `查看第 ${index + 1} 张`);
        if (index === currentIndex) {
          btn.classList.add("is-active");
          btn.setAttribute("aria-current", "true");
        }
        const thumb = document.createElement("img");
        thumb.src = mvAssetUrl(mvThumbSrc(item.src));
        thumb.dataset.full = item.src;
        thumb.alt = "";
        thumb.loading = "lazy";
        thumb.decoding = "async";
        thumb.onerror = () => mvImgOnError(thumb);
        btn.appendChild(thumb);
        btn.addEventListener("click", () => show(index));
        railEl.appendChild(btn);
      });
    }

    function scrollActiveThumbIntoView() {
      railEl.querySelector(".mv-lightbox__thumb.is-active")
        ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }

    function show(index) {
      const list = items();
      if (!list.length) return;
      currentIndex = (index + list.length) % list.length;
      const item = list[currentIndex];
      imgEl.src = mvAssetUrl(item.src);
      imgEl.alt = "";
      railEl.querySelectorAll(".mv-lightbox__thumb").forEach((el, i) => {
        const on = i === currentIndex;
        el.classList.toggle("is-active", on);
        el.setAttribute("aria-current", on ? "true" : "false");
      });
      scrollActiveThumbIntoView();
    }

    function step(delta) {
      show(currentIndex + delta);
    }

    function openAt(src) {
      const list = items();
      const key = mvSrcKey(src);
      const idx = list.findIndex((item) => mvSrcKey(item.src) === key);
      currentIndex = idx >= 0 ? idx : 0;
      renderRail();
      show(currentIndex);
      dialog.showModal();
    }

    function close() {
      dialog.close();
      imgEl.src = "";
      railEl.innerHTML = "";
    }

    document.addEventListener("click", (e) => {
      const gallery = document.getElementById("mv-gallery");
      const btn = e.target.closest?.(".mv-board__item");
      if (!gallery || !btn || !gallery.contains(btn)) return;
      const image = btn.querySelector("img");
      if (!image) return;
      openAt(image.dataset.full || image.src);
    });

    closeBtn?.addEventListener("click", close);
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close();
    });
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });

    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    });

    dialog.addEventListener("wheel", (e) => {
      if (!dialog.open) return;
      e.preventDefault();
      if (wheelLocked) return;
      wheelLocked = true;
      window.setTimeout(() => { wheelLocked = false; }, 180);
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
  }

  function initMvMaterials() {
    const mode = pickInitialRainMode();
    applyRainTheme(mode);
    initCommon(mode);
    spaPage = "mv";
    renderMvGallery(document.getElementById("mv-gallery"));
    initMvLightbox();
    refreshRainLedges();
    markPageReady();
  }

  function initHome() {
    /* 开幕前先定雨模式，大雨/雷暴开场才能用冷蓝底+密雨丝 */
    const mode = pickInitialRainMode();
    applyRainTheme(mode);
    if (mode === "sunny") {
      window.KayaSunnySky?.preloadRainbow?.();
    }
    initHomeIntro();
    initCommon(mode);
    spaPage = "home";
    initHero();
    renderMvHomePreview(document.getElementById("mv-preview"));
  }

  function initWorks() {
    const mode = pickInitialRainMode();
    applyRainTheme(mode);
    initCommon(mode);
    spaPage = "works";
    renderGrid(document.getElementById("works-grid"), data().videos);
    refreshRainLedges();
    markPageReady();
  }

  function initLinks() {
    const mode = pickInitialRainMode();
    applyRainTheme(mode);
    initCommon(mode);
    spaPage = "links";
    renderLinkCards(document.getElementById("link-cards"));
    refreshRainLedges();
    markPageReady();
  }

  function mountQuizStaticBg() {
    applyRainTheme("light");
    document.body.classList.add("kaya-ambient-eco");
    const host = document.querySelector(".site-bg");
    if (!host || host.querySelector(".site-bg__light-scene")) return;
    const scene = document.createElement("div");
    scene.className = "site-bg__light-scene is-on";
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML =
      '<div class="site-bg__light-scene-orbs"></div>' +
      '<div class="site-bg__light-scene-grain"></div>' +
      '<div class="site-bg__light-scene-mist"></div>';
    host.appendChild(scene);
  }

  function initQuiz() {
    initCommon(null);
    markPageReady();
  }

  function initSedai() {
    mountQuizStaticBg();
    initCommon(null);
    markPageReady();
  }

  return { initHome, initWorks, initLinks, initMvMaterials, initQuiz, initSedai, data };
})();

/* kaya-boot 通过 window.Kaya 调用；const 不会挂到 window */
window.Kaya = Kaya;
