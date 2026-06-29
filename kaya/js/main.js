/**
 * 时雨榧个人站
 */
const Kaya = (() => {
  const data = () => window.SITE_DATA || { user: {}, videos: [], stats: {} };

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

  function createTapeCard(v, index) {
    const card = document.createElement("a");
    card.className = "tape-card";
    card.href = biliUrl(v.bvid);
    card.target = "_blank";
    card.rel = "noopener";

    const meta = [v.date, v.length].filter(Boolean).join(" · ");
    const thumb = videoThumb(v);

    card.innerHTML = `
      <div class="tape-thumb">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(v.title)}" loading="lazy" decoding="async" width="400" height="250"
             ${videoThumbOnError(v)} />
        <div class="tape-play"><i>▶</i></div>
      </div>
      <div class="tape-body">
        <span class="tape-index">${String(index + 1).padStart(2, "0")}</span>
        <h3 class="tape-title">${escapeHtml(v.title)}</h3>
        ${meta ? `<p class="tape-meta">${escapeHtml(meta)}</p>` : ""}
      </div>
    `;
    return card;
  }

  function renderGrid(grid, videos, startIndex = 0) {
    if (!grid) return;
    grid.innerHTML = "";
    videos.forEach((v, i) => grid.appendChild(createTapeCard(v, startIndex + i)));
  }

  function renderLinkBand(el) {
    if (!el) return;
    el.innerHTML = `
      <div class="link-band-inner">
        <div class="link-band-cards">
          <a href="${spaceUrl()}" target="_blank" rel="noopener" class="link-band-card link-band-card--ghost">
            <span><strong>B 站空间</strong><small>${escapeHtml(data().user.name || "时雨榧")}</small></span>
          </a>
        </div>
      </div>
    `;
  }

  function spaceUrl() {
    const d = data();
    if (d.bilibili_url) return d.bilibili_url;
    return `https://space.bilibili.com/${d.mid || 109084234}`;
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
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    const closeNav = () => nav.classList.remove("open");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      nav.classList.toggle("open");
    });

    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target) && e.target !== toggle) closeNav();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });
  }

  function syncHeaderHeights() {
    const wip = document.querySelector(".kaya-wip-banner");
    const header = document.querySelector(".site-header, .radio-header");
    const wipH = wip?.offsetHeight ?? 0;
    const headerH = header?.offsetHeight ?? 52;
    const root = document.documentElement;
    root.style.setProperty("--kaya-wip-h", `${wipH}px`);
    root.style.setProperty("--kaya-site-head-h", `${wipH + headerH}px`);
  }

  function initWipBanner() {
    if (document.getElementById("kaya-wip-banner")) return;
    const header = document.querySelector(".site-header, .radio-header");
    if (!header) return;
    const banner = document.createElement("p");
    banner.id = "kaya-wip-banner";
    banner.className = "kaya-wip-banner";
    banner.setAttribute("role", "status");
    banner.textContent = "暂未完成全部网页设计，仍需整改";
    header.parentNode.insertBefore(banner, header);
    syncHeaderHeights();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(syncHeaderHeights);
      ro.observe(banner);
      if (header) ro.observe(header);
    }
    window.addEventListener("resize", syncHeaderHeights, { passive: true });
  }

  function renderDataSyncNote() {
    const footer = document.querySelector(".site-footer");
    const updated = data().data_updated;
    if (!footer || !updated) return;
    let el = footer.querySelector(".data-sync-note");
    if (!el) {
      el = document.createElement("p");
      el.className = "data-sync-note";
      footer.insertBefore(el, footer.firstChild);
    }
    el.textContent = `B 站数据同步于 ${updated}`;
  }

  function initCommon() {
    initWipBanner();
    initNav();
    applyBiliLinks();
    renderLinkBand(document.getElementById("link-band"));
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
    renderDataSyncNote();
  }

  function initHero() {
    const d = data();
    applyBiliLinks();
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set("hero-name", d.user.name || "时雨榧");
    set("hero-sign", d.user.sign || "");
    const avatarEl = document.getElementById("hero-avatar");
    if (avatarEl && d.user.avatar) {
      avatarEl.src = d.user.avatar;
      avatarEl.alt = d.user.name || "";
    }
  }

  function initHome() {
    initCommon();
    initHero();
    renderHeroOtherSites(document.getElementById("hero-other-sites"));
    renderGrid(document.getElementById("featured-grid"), data().videos.slice(0, 6));
  }

  function initWorks() {
    initCommon();
    renderGrid(document.getElementById("works-grid"), data().videos);
  }

  function initLinks() {
    initCommon();
  }

  const PERSONAL_SITES = [
    {
      name: "浮游Lev",
      url: "/fuyuu/",
      avatar: "/fuyuu/assets/images/avatar.jpg",
      note: "Galgame 同人插画",
      status: "online",
    },
    {
      name: "小春日向",
      url: "/koharu/",
      avatar: "/koharu/assets/images/avatar.jpg",
      note: "插画与创作",
      status: "wip",
    },
    {
      name: "汐月空_poi",
      url: "/shiotsuki/",
      avatar: "/shiotsuki/assets/images/avatar.jpg",
      note: "绘画与创作",
      status: "wip",
    },
  ];

  const PLANNED_SITES = [
    "更多个人站陆续筹备中，上线后将在此更新。",
  ];

  function siteStatusLabel(status) {
    if (status === "online") return "已上线";
    if (status === "wip") return "暂未完成";
    return "筹备中";
  }

  function createSiteCard(site, variant = "page") {
    const card = document.createElement("a");
    card.className = `site-card site-card--${variant}`;
    card.href = site.url;
    card.innerHTML = `
      <img class="site-card-avatar" src="${escapeHtml(site.avatar)}" alt="${escapeHtml(site.name)}"
           width="112" height="112" loading="lazy" decoding="async"
           onerror="this.src='assets/images/avatar.jpg'" />
      <strong class="site-card-name">${escapeHtml(site.name)}</strong>
      <span class="site-card-note">${escapeHtml(site.note)}</span>
      <span class="site-card-status site-card-status--${escapeHtml(site.status)}">${escapeHtml(siteStatusLabel(site.status))}</span>
    `;
    return card;
  }

  function renderSiteRoster(container, variant = "page") {
    if (!container) return;
    container.innerHTML = "";
    PERSONAL_SITES.forEach((site) => {
      container.appendChild(createSiteCard(site, variant));
    });
  }

  function renderPlannedSites(list) {
    if (!list) return;
    list.innerHTML = "";
    PLANNED_SITES.forEach((text) => {
      const item = document.createElement("li");
      item.className = "site-planned-item";
      item.textContent = text;
      list.appendChild(item);
    });
  }

  function renderHeroOtherSites(el) {
    if (!el) return;
    el.innerHTML = `<a href="sites.html" class="hero-other-sites-link">其它个人站</a>`;
  }

  function initSites() {
    initCommon();
    renderSiteRoster(document.getElementById("site-roster"), "page");
    renderPlannedSites(document.getElementById("site-planned"));
  }

  return { initHome, initWorks, initLinks, initSites, data };
})();
