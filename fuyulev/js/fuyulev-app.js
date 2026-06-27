/** 浮游Lev 轻量静态站 — 页面逻辑 */
const FuyulevApp = (() => {
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

  function motionEnabled() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function revealItems(nodes, { stagger = 45, base = 0 } = {}) {
    const list = [...nodes];
    if (!list.length) return;
    if (!motionEnabled()) {
      list.forEach((el) => el.classList.add("fy-in"));
      return;
    }
    list.forEach((el, i) => {
      el.classList.add("fy-motion-item");
      el.style.setProperty("--fy-i", String(i));
      el.style.setProperty("--fy-base", `${base}ms`);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add("fy-in"));
      });
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
    Site.fillUserHero();
    const sign = document.getElementById("hero-sign");
    if (sign && window.SITE_DATA?.user?.sign) {
      sign.textContent = window.SITE_DATA.user.sign;
    }
    const band = document.getElementById("link-band");
    if (band) Site.renderLinkBand(band);
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

  function renderWorkList() {
    const ul = document.getElementById("work-list");
    const videos = window.SITE_DATA?.videos;
    if (!ul || !videos?.length) return;

    ul.innerHTML = videos
      .slice(0, 30)
      .map((v, i) => {
        const thumb = v.thumb || `assets/images/video_${i}.jpg`;
        const meta = [v.date, v.length].filter(Boolean).join(" · ");
        return `<li class="fuyulev-work-item"><a href="https://www.bilibili.com/video/${esc(v.bvid)}" target="_blank" rel="noopener">`
          + `<img src="${esc(thumb)}" alt="${esc(v.title)}" loading="lazy" decoding="async" />`
          + `<span class="fuyulev-work-meta"><strong>${esc(v.title)}</strong>`
          + (meta ? `<small>${esc(meta)}</small>` : "")
          + `</span></a></li>`;
      })
      .join("");

    if (videos.length > 30) {
      const p = document.createElement("p");
      p.className = "fuyulev-more-link";
      p.innerHTML = `更多投稿见 <a href="${BILI}" target="_blank" rel="noopener">哔哩哔哩主页</a>。`;
      ul.after(p);
    }

    revealItems(ul.querySelectorAll(".fuyulev-work-item"), { stagger: 35, base: 280 });
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

    revealItems(grid.querySelectorAll(".fuyulev-portfolio-thumb"), { stagger: 35, base: 280 });
  }

  function initHome() {
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

  function initPortfolio() {
    initShell();
    renderPortfolioGrid();
  }

  return { initHome, initWork, initAbout, initPortfolio };
})();
