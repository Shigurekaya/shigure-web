/** 浮游Lev 轻量静态站 — 页面逻辑 */
const FuyulevApp = (() => {
  const BILI = "https://space.bilibili.com/353604313";
  const PAGE_SIZE = 18;

  let shown = PAGE_SIZE;
  let loadBound = false;
  let galleryAnimated = 0;

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
      const btn = e.target.closest("#load-more");
      if (!btn || btn.classList.contains("hidden")) return;
      e.preventDefault();
      shown = Math.min(shown + PAGE_SIZE, gallery().length);
      renderGrid();
    });
    loadBound = true;
  }

  function updateLoadMore(btn, total) {
    if (!btn) return;
    btn.classList.toggle("hidden", shown >= total);
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

    const items = gallery().map((src) => Site.createGalleryItem(src));

    if (typeof CollageGallery !== "undefined") {
      CollageGallery.fill(grid, items);
    } else {
      grid.innerHTML = "";
      items.forEach((el) => grid.appendChild(el));
    }

    revealItems(grid.querySelectorAll(".km-gallery-item"), { stagger: 35, base: 280 });
  }

  function initHome() {
    initShell();
    bindLoadMore();
    renderGrid();
    revealItems(document.querySelectorAll(".profile-banner"), { stagger: 55, base: 380 });
    window.addEventListener("resize", () => {
      const grid = document.getElementById("work-grid");
      if (grid && typeof CollageGallery !== "undefined") CollageGallery.refresh(grid);
    });
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
    window.addEventListener("resize", () => {
      const grid = document.getElementById("portfolio-grid");
      if (grid && typeof CollageGallery !== "undefined") CollageGallery.refresh(grid);
    });
  }

  return { initHome, initWork, initAbout, initPortfolio };
})();
