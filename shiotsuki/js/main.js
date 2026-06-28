/**
 * 汐月空_poi 个人站
 */
const Shiotsuki = (() => {
  const data = () => window.SITE_DATA || { user: {}, videos: [], seasons: [] };

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
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

  function spaceUrl() {
    const d = data();
    return d.bilibili_url || `https://space.bilibili.com/${d.mid || 354947753}`;
  }

  function cardMeta(v) {
    return [v.date, v.length].filter(Boolean).join(" · ");
  }

  function createWorkCard(v, index) {
    const card = document.createElement("a");
    card.className = "work-card";
    card.href = biliUrl(v.bvid);
    card.target = "_blank";
    card.rel = "noopener";

    const meta = cardMeta(v);
    const thumb = videoThumb(v);

    card.innerHTML = `
      <div class="work-card-thumb">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title)}" loading="lazy" decoding="async"
             ${videoThumbOnError(v)} />
        <div class="work-card-play"><i>▶</i></div>
      </div>
      <div class="work-card-body">
        <span class="work-card-no">${String(index + 1).padStart(2, "0")}</span>
        <h3 class="work-card-title">${escapeHtml(v.title)}</h3>
        ${meta ? `<p class="work-card-meta">${escapeHtml(meta)}</p>` : ""}
      </div>
    `;
    return card;
  }

  function createSeasonBlock(season, index) {
    const block = document.createElement("section");
    block.className = "season-block";

    const cover = season.cover || "assets/images/avatar.jpg";
    const videos = season.videos || [];

    block.innerHTML = `
      <header class="season-head">
        <img class="season-cover" src="${escapeHtml(cover)}" alt="" loading="lazy"
             onerror="this.style.display='none'" />
        <div>
          <p class="season-index">合集 ${String(index + 1).padStart(2, "0")}</p>
          <h3 class="season-name">${escapeHtml(season.name || "未命名合集")}</h3>
          ${season.description ? `<p class="season-desc">${escapeHtml(season.description)}</p>` : ""}
        </div>
      </header>
      <div class="season-videos"></div>
    `;

    const list = block.querySelector(".season-videos");
    videos.forEach((v, i) => {
      const link = document.createElement("a");
      link.className = "season-video";
      link.href = biliUrl(v.bvid);
      link.target = "_blank";
      link.rel = "noopener";
      const meta = cardMeta(v);
      link.innerHTML = `
        <span class="season-video-index">${String(i + 1).padStart(2, "0")}</span>
        <span class="season-video-title">${escapeHtml(v.title)}</span>
        ${meta ? `<span class="season-video-meta">${escapeHtml(meta)}</span>` : ""}
      `;
      list.appendChild(link);
    });

    return block;
  }

  function renderGrid(grid, videos, startIndex = 0) {
    if (!grid) return;
    grid.innerHTML = "";
    if (!videos.length) {
      grid.innerHTML = '<p class="st-empty">暂无作品数据</p>';
      return;
    }
    videos.forEach((v, i) => grid.appendChild(createWorkCard(v, startIndex + i)));
  }

  function renderSeasons(container, seasons, limit) {
    if (!container) return;
    const section = container.closest(".st-section");
    const prevHead = container.previousElementSibling;
    const list = limit ? (seasons || []).slice(0, limit) : seasons || [];
    if (!list.length) {
      if (section) section.hidden = true;
      if (prevHead?.classList.contains("st-section-head")) prevHead.hidden = true;
      container.hidden = true;
      return;
    }
    if (section) section.hidden = false;
    if (prevHead?.classList.contains("st-section-head")) prevHead.hidden = false;
    container.hidden = false;
    container.innerHTML = "";
    list.forEach((season, i) => container.appendChild(createSeasonBlock(season, i)));
  }

  function applyBiliLinks() {
    const url = spaceUrl();
    document.querySelectorAll("[data-bili-space]").forEach((el) => { el.href = url; });
    const urlEl = document.getElementById("bili-space-url");
    if (urlEl) urlEl.textContent = url.replace("https://", "");
    ["bili-space-btn", "bili-space-link"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.href = url;
    });
  }

  function initNav() {
    const inner = document.querySelector(".st-topbar-inner");
    const nav = document.querySelector(".st-nav");
    if (!inner || !nav || document.getElementById("st-menu-toggle")) return;

    const mobileMq = window.matchMedia("(max-width: 768px)");
    const logoMark = document.querySelector(".st-logo-mark")?.textContent || "汐";

    const backdrop = document.createElement("div");
    backdrop.className = "st-menu-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);

    const drawerHead = document.createElement("div");
    drawerHead.className = "st-drawer-head";
    drawerHead.innerHTML =
      `<span class="st-drawer-logo" aria-hidden="true">${escapeHtml(logoMark)}</span>`
      + '<button type="button" class="st-drawer-close" aria-label="关闭菜单">×</button>';
    nav.insertBefore(drawerHead, nav.firstChild);
    nav.id = "st-site-nav";
    nav.classList.add("st-mobile-drawer");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "st-menu-toggle";
    btn.className = "st-menu-toggle";
    btn.setAttribute("aria-label", "菜单");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "st-site-nav");
    btn.innerHTML =
      '<span class="st-menu-toggle-icon" aria-hidden="true"><span></span><span></span><span></span></span>';
    inner.insertBefore(btn, nav);

    const closeMenu = () => {
      nav.classList.remove("is-open");
      btn.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("st-menu-open");
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420;
      setTimeout(() => {
        if (!nav.classList.contains("is-open")) backdrop.hidden = true;
      }, delay);
    };

    const placeNav = () => {
      if (mobileMq.matches) {
        if (nav.parentElement !== document.body) document.body.appendChild(nav);
      } else if (nav.parentElement !== inner) {
        inner.appendChild(nav);
        closeMenu();
      }
    };

    placeNav();
    mobileMq.addEventListener("change", () => {
      closeMenu();
      placeNav();
    });

    const openMenu = () => {
      placeNav();
      backdrop.hidden = false;
      requestAnimationFrame(() => {
        nav.classList.add("is-open");
        btn.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        document.body.classList.add("st-menu-open");
      });
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (nav.classList.contains("is-open")) closeMenu();
      else openMenu();
    });

    backdrop.addEventListener("click", closeMenu);
    drawerHead.querySelector(".st-drawer-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  function syncHeaderHeights() {
    const wip = document.querySelector(".st-wip");
    const topbar = document.querySelector(".st-topbar");
    const wipH = wip?.offsetHeight ?? 0;
    const topbarH = topbar?.offsetHeight ?? 0;
    const root = document.documentElement;
    root.style.setProperty("--st-wip-h", `${wipH}px`);
    root.style.setProperty("--st-site-head-h", `${wipH + topbarH}px`);
  }

  function initWipBanner() {
    if (document.getElementById("shiotsuki-wip")) return;
    const topbar = document.querySelector(".st-topbar");
    if (!topbar) return;
    const banner = document.createElement("p");
    banner.id = "shiotsuki-wip";
    banner.className = "st-wip";
    banner.setAttribute("role", "status");
    banner.innerHTML = "<strong>建设中</strong> · 本站尚未完成，内容与版式仍在调整。若您并非预期访客，敬请见谅。";
    topbar.parentNode.insertBefore(banner, topbar);
    syncHeaderHeights();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(syncHeaderHeights);
      ro.observe(banner);
      if (topbar) ro.observe(topbar);
    }
    window.addEventListener("resize", syncHeaderHeights, { passive: true });
  }

  function renderDataSyncNote() {
    const footer = document.querySelector(".st-footer");
    const updated = data().data_updated;
    if (!footer || !updated) return;
    let el = footer.querySelector(".st-data-note");
    if (!el) {
      el = document.createElement("p");
      el.className = "st-data-note";
      footer.insertBefore(el, footer.firstChild);
    }
    el.textContent = `作品数据同步于 ${updated}`;
  }

  function initHero() {
    const user = data().user || {};
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    set("hero-name", user.name || "汐月空_poi");
    set("hero-sign", user.sign || "暂无签名");

    const avatarEl = document.getElementById("hero-avatar");
    if (avatarEl && user.avatar) {
      avatarEl.src = user.avatar;
      avatarEl.alt = user.name || "";
    }

    const tagsEl = document.getElementById("hero-tags");
    if (tagsEl) {
      tagsEl.innerHTML = "";
      const tags = [];
      if (user.pendant_name) tags.push(user.pendant_name);
      tags.push("绘画", "Gal");
      tags.forEach((t) => {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        tagsEl.appendChild(span);
      });
    }
  }

  function initCommon() {
    initWipBanner();
    initNav();
    applyBiliLinks();
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
    renderDataSyncNote();
  }

  function initHome() {
    initCommon();
    initHero();
    renderGrid(document.getElementById("featured-grid"), data().videos.slice(0, 6));
    renderSeasons(document.getElementById("featured-seasons"), data().seasons, 3);
  }

  const WORKS_BATCH = 24;
  let worksShown = WORKS_BATCH;

  function updateWorksLoadMore(videos) {
    let btn = document.getElementById("works-load-more");
    if (worksShown >= videos.length) {
      btn?.remove();
      return;
    }
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "works-load-more";
      btn.className = "st-btn st-btn--ghost st-load-more";
      btn.textContent = "加载更多";
      document.getElementById("works-grid")?.after(btn);
      btn.addEventListener("click", () => {
        worksShown = Math.min(worksShown + WORKS_BATCH, videos.length);
        renderGrid(document.getElementById("works-grid"), videos.slice(0, worksShown));
        updateWorksLoadMore(videos);
      });
    }
    btn.textContent = `加载更多（${worksShown}/${videos.length}）`;
  }

  function initWorks() {
    initCommon();
    worksShown = WORKS_BATCH;
    const videos = data().videos || [];
    renderGrid(document.getElementById("works-grid"), videos.slice(0, worksShown));
    updateWorksLoadMore(videos);
    renderSeasons(document.getElementById("seasons-list"), data().seasons);
  }

  function initLinks() {
    initCommon();
  }

  return { initHome, initWorks, initLinks, data };
})();
