/** 浮游Lev 轻量静态站 — 页面逻辑 */
const FyApp = (() => {
  const BILI = "https://space.bilibili.com/353604313";
  const MOBILE_MAX = 768;
  const SCROLL_LOAD_THRESHOLD = 160;

  function pageSize() {
    return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches ? 10 : 18;
  }

  function isMobile() {
    return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
  }

  let shown = pageSize();
  let loadBound = false;
  let scrollLoadBound = false;
  let loadingMore = false;
  let galleryAnimated = 0;
  let scrollRaf = 0;
  let lastMobile = isMobile();
  let revealObserver = null;

  function motionEnabled() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** komowata 风格：滚入视口时透明度 0 → 1 */
  function getRevealObserver() {
    if (revealObserver || !("IntersectionObserver" in window)) return revealObserver;
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("fy-in");
          revealObserver.unobserve(entry.target);
        });
      },
      { root: null, rootMargin: "0px 0px -4% 0px", threshold: 0.06 },
    );
    return revealObserver;
  }

  function revealItems(nodes, { stagger = 45, base = 0 } = {}) {
    const list = [...nodes].filter((el) => el && !el.classList.contains("fy-in"));
    if (!list.length) return;
    if (!motionEnabled()) {
      list.forEach((el) => el.classList.add("fy-in"));
      return;
    }
    const io = getRevealObserver();
    list.forEach((el, i) => {
      el.classList.add("fy-motion-item");
      el.style.setProperty("--fy-i", String(i));
      el.style.setProperty("--fy-base", `${base}ms`);
      if (io) io.observe(el);
      else el.classList.add("fy-in");
    });
  }

  function observeFooter() {
    const footer = document.querySelector(".fy-footer");
    if (!footer) return;
    if (!motionEnabled()) {
      footer.classList.add("fy-footer--in");
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        footer.classList.add("fy-footer--in");
        io.disconnect();
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(footer);
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function gallery() {
    return window.HOME_GALLERY || [];
  }

  function galleryWrap() {
    return document.querySelector(".fy-gallery-section .km-gallery-wrap");
  }

  function canLoadMore() {
    return shown < gallery().length;
  }

  function loadMoreBatch() {
    if (loadingMore || !canLoadMore()) return false;
    loadingMore = true;
    galleryWrap()?.classList.add("km-gallery-wrap--loading");
    shown = Math.min(shown + pageSize(), gallery().length);
    renderGrid();
    loadingMore = false;
    return true;
  }

  /** 内容不够横向滚动时，自动继续加载 */
  function ensureScrollable() {
    if (!isMobile() || !canLoadMore()) return;
    const wrap = galleryWrap();
    if (!wrap) return;

    let guard = 0;
    while (canLoadMore() && wrap.scrollWidth <= wrap.clientWidth + 8 && guard < 24) {
      if (!loadMoreBatch()) break;
      guard += 1;
    }
  }

  function checkScrollLoad() {
    if (!isMobile() || !canLoadMore()) return;
    const wrap = galleryWrap();
    if (!wrap) return;

    const nearEnd = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - SCROLL_LOAD_THRESHOLD;
    if (nearEnd) loadMoreBatch();
  }

  function bindMobileScrollLoad() {
    if (scrollLoadBound) return;
    const wrap = galleryWrap();
    if (!wrap) return;

    wrap.addEventListener(
      "scroll",
      () => {
        if (!isMobile()) return;
        cancelAnimationFrame(scrollRaf);
        scrollRaf = requestAnimationFrame(checkScrollLoad);
      },
      { passive: true },
    );

    scrollLoadBound = true;
  }

  let ensureTimer;

  function afterGridLayout() {
    clearTimeout(ensureTimer);
    ensureTimer = setTimeout(() => {
      ensureScrollable();
      requestAnimationFrame(ensureScrollable);
      galleryWrap()?.classList.remove("km-gallery-wrap--loading");
      updateScrollHint();
    }, 100);
  }

  function handleResize() {
    const nowMobile = isMobile();
    if (nowMobile !== lastMobile) {
      shown = pageSize();
      galleryAnimated = 0;
      lastMobile = nowMobile;
      renderGrid();
      return;
    }
    const grid = document.getElementById("work-grid");
    if (grid && typeof CollageGallery !== "undefined") CollageGallery.refresh(grid);
    updateLoadMore(document.getElementById("load-more"), gallery().length);
    afterGridLayout();
  }

  function updateScrollHint() {
    const hint = document.getElementById("gallery-scroll-hint");
    if (!hint) return;
    const show = isMobile() && canLoadMore();
    hint.hidden = !show;
  }

  function ensureScrollHint() {
    const section = document.querySelector(".fy-gallery-section");
    if (!section || document.getElementById("gallery-scroll-hint")) return;
    const hint = document.createElement("p");
    hint.id = "gallery-scroll-hint";
    hint.className = "fy-gallery-scroll-hint";
    hint.textContent = "← 左右滑动查看更多 →";
    hint.hidden = true;
    section.querySelector(".km-gallery-wrap")?.after(hint);
  }

  function initShell() {
    Site.initCommon();
    const isHome = document.body.dataset.page === "home";
    if (isHome) {
      Site.fillUserHero();
      const sign = document.getElementById("hero-sign");
      if (sign && window.SITE_DATA?.user?.sign) {
        sign.textContent = window.SITE_DATA.user.sign;
      }
      const band = document.getElementById("link-band");
      if (band) Site.renderLinkBand(band);
    }
    observeFooter();
  }

  function bindLoadMore() {
    if (loadBound) return;
    const wrap = document.querySelector(".fy-gallery-section");
    if (!wrap) return;
    wrap.addEventListener("click", (e) => {
      if (isMobile()) return;
      const btn = e.target.closest("#load-more");
      if (!btn || btn.classList.contains("hidden")) return;
      e.preventDefault();
      loadMoreBatch();
    });
    loadBound = true;
  }

  function updateLoadMore(btn, total) {
    if (!btn) return;
    const hide = shown >= total || isMobile();
    btn.classList.toggle("hidden", hide);
    btn.closest(".km-load-wrap")?.classList.toggle("km-load-wrap--mobile-off", isMobile());
  }

  function renderGrid() {
    const grid = document.getElementById("work-grid");
    const loadBtn = document.getElementById("load-more");
    if (!grid) return;

    const sources = gallery().slice(0, shown);
    const prevCount = grid.querySelectorAll(".km-gallery-item").length;

    if (prevCount === 0) {
      const items = sources.map((src) => Site.createGalleryItem(src));
      if (typeof CollageGallery !== "undefined") {
        CollageGallery.fill(grid, items);
      } else {
        items.forEach((el) => grid.appendChild(el));
      }
    } else if (sources.length > prevCount) {
      const newItems = sources.slice(prevCount).map((src) => Site.createGalleryItem(src));
      if (typeof CollageGallery !== "undefined") {
        CollageGallery.append(grid, newItems);
      } else {
        newItems.forEach((el) => grid.appendChild(el));
      }
    } else if (sources.length < prevCount) {
      const items = sources.map((src) => Site.createGalleryItem(src));
      if (typeof CollageGallery !== "undefined") {
        CollageGallery.fill(grid, items);
      } else {
        grid.innerHTML = "";
        items.forEach((el) => grid.appendChild(el));
      }
      galleryAnimated = 0;
    } else if (typeof CollageGallery !== "undefined") {
      CollageGallery.refresh(grid);
    }

    const allItems = grid.querySelectorAll(".km-gallery-item");
    revealItems([...allItems].slice(galleryAnimated), { stagger: 40, base: 80 });
    galleryAnimated = allItems.length;

    updateLoadMore(loadBtn, gallery().length);
    afterGridLayout();
  }

  function renderWorkSyncNote() {
    const lead = document.querySelector(".fy-page-lead");
    const updated = window.SITE_DATA?.data_updated;
    if (!lead || !updated) return;
    let note = document.getElementById("work-sync-note");
    if (!note) {
      note = document.createElement("p");
      note.id = "work-sync-note";
      note.className = "data-sync-note";
      lead.after(note);
    }
    note.textContent = `B 站数据同步于 ${updated}`;
  }

  function renderWorkList() {
    const ul = document.getElementById("work-list");
    const videos = window.SITE_DATA?.videos;
    if (!ul || !videos?.length) return;

    ul.innerHTML = videos
      .map((v) => {
        const thumb = Site.videoThumb(v);
        const meta = [v.date, v.length].filter(Boolean).join(" · ");
        return `<li class="fy-work-item"><a href="${Site.bili(v.bvid)}" target="_blank" rel="noopener">`
          + `<img src="${esc(thumb)}" alt="${esc(v.title)}" loading="lazy" decoding="async" ${Site.videoThumbOnError(v)} />`
          + `<span class="fy-work-meta"><strong>${esc(v.title)}</strong>`
          + (meta ? `<small>${esc(meta)}</small>` : "")
          + `</span></a></li>`;
      })
      .join("");

    const existingMore = ul.parentElement?.querySelector(".fy-more-link");
    if (existingMore) existingMore.remove();

    revealItems(ul.querySelectorAll(".fy-work-item"), { stagger: 35, base: 280 });
    renderWorkSyncNote();
  }

  function renderAboutPicks() {
    const ul = document.getElementById("about-picks");
    const videos = window.SITE_DATA?.videos;
    if (!ul || !videos?.length) return;
    ul.innerHTML = videos
      .slice(0, 6)
      .map(
        (v) =>
          `<li><a href="https://www.bilibili.com/video/${esc(v.bvid)}" target="_blank" rel="noopener">${esc(v.title)}</a></li>`
      )
      .join("");
    revealItems(ul.querySelectorAll("li"), { stagger: 55, base: 320 });
  }

  function renderPortfolioGrid() {
    const grid = document.getElementById("portfolio-grid");
    if (!grid) return;

    grid.innerHTML = "";
    gallery().forEach((src) => grid.appendChild(Site.createPortfolioItem(src)));

    revealItems(grid.querySelectorAll(".fy-portfolio-thumb"), { stagger: 35, base: 280 });
  }

  function initPortfolio() {
    initShell();
    renderPortfolioGrid();
  }

  function startIntroFloat(canvas) {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return () => {};

    // 与片头 RGB 色差呼应：粉 / 青 / 琥珀 / 紫 / 薄荷
    const PALETTE = [
      [214, 69, 106],
      [78, 156, 200],
      [232, 168, 72],
      [148, 112, 214],
      [72, 186, 158],
    ];

    const dots = [];
    let raf = 0;
    let running = true;
    let t0 = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const makeDot = (ySpread) => {
      const [r, g, b] = PALETTE[(Math.random() * PALETTE.length) | 0];
      const glow = Math.random() < 0.42;
      return {
        x: Math.random() * window.innerWidth,
        y: ySpread
          ? Math.random() * window.innerHeight
          : window.innerHeight + 8 + Math.random() * 40,
        r: glow ? 1.4 + Math.random() * 2.8 : 0.55 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * (glow ? 0.32 : 0.5),
        vy: -(glow ? 0.22 : 0.35) - Math.random() * (glow ? 0.55 : 0.9),
        alpha: glow ? 0.35 + Math.random() * 0.45 : 0.16 + Math.random() * 0.35,
        rgb: [r, g, b],
        glow,
        phase: Math.random() * Math.PI * 2,
        pulse: 0.6 + Math.random() * 1.4,
      };
    };

    const spawn = (n) => {
      for (let i = 0; i < n; i += 1) dots.push(makeDot(true));
    };

    const tick = (now) => {
      if (!running) return;
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      dots.forEach((d) => {
        const breathe = 0.72 + 0.28 * Math.sin(t * d.pulse + d.phase);
        const a = d.alpha * breathe;
        const [cr, cg, cb] = d.rgb;

        if (d.glow) {
          const glowR = d.r * (3.2 + breathe);
          const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, glowR);
          grad.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 0.85})`);
          grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},${a * 0.28})`);
          grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.beginPath();
          ctx.fillStyle = grad;
          ctx.arc(d.x, d.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * (d.glow ? 0.95 : 0.55)})`;
        ctx.arc(d.x, d.y, d.r * (d.glow ? 0.55 + 0.2 * breathe : 1), 0, Math.PI * 2);
        ctx.fill();

        d.x += d.vx + Math.sin(t * 0.7 + d.phase) * 0.08;
        d.y += d.vy;
        if (d.y < -12) {
          Object.assign(d, makeDot(false), { y: window.innerHeight + 8 });
        }
        if (d.x < -12) d.x = window.innerWidth + 12;
        if (d.x > window.innerWidth + 12) d.x = -12;
      });
      raf = window.requestAnimationFrame(tick);
    };

    resize();
    spawn(88);
    window.addEventListener("resize", resize);
    raf = window.requestAnimationFrame(tick);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }

  function shouldPlayHomeIntro(sitePrefix) {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "reload") return true;
    if (nav?.type === "back_forward") return false;

    const ref = document.referrer;
    if (!ref) return true;

    try {
      const refUrl = new URL(ref);
      if (refUrl.origin !== location.origin) return true;
      const p = refUrl.pathname;
      if (!p.includes(sitePrefix)) return true;
      const home = p.endsWith(sitePrefix) || p.endsWith(`${sitePrefix}index.html`);
      return home;
    } catch {
      return true;
    }
  }

  function initHomeIntro() {
    const intro = document.getElementById("fy-intro");
    const reduced = !motionEnabled();
    const play = shouldPlayHomeIntro("/fuyuu/");

    if (!intro || reduced || !play) {
      document.body.classList.add("fy-home-ready");
      intro?.remove();
      return;
    }

    document.body.classList.add("fy-intro-playing");
    const stop = startIntroFloat(document.getElementById("fy-intro-float"));

    window.setTimeout(() => {
      document.body.classList.remove("fy-intro-playing");
      document.body.classList.add("fy-home-ready");
      intro.classList.add("is-done");
      stop();
      window.setTimeout(() => intro.remove(), 800);
    }, 2600);
  }

  function initHome() {
    initHomeIntro();
    initShell();
    ensureScrollHint();
    bindLoadMore();
    bindMobileScrollLoad();
    document.getElementById("work-grid")?.addEventListener("collage-layout", () => {
      ensureScrollable();
      updateScrollHint();
    });
    renderGrid();
    revealItems(document.querySelectorAll(".profile-banner"), { stagger: 55, base: 380 });
    window.addEventListener("resize", handleResize);
  }

  function initWork() {
    initShell();
    renderWorkList();
  }

  function initAbout() {
    initShell();
    renderAboutPicks();
  }

  return { initHome, initWork, initAbout, initPortfolio };
})();
