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

  function createTapeCard(v, index) {
    const card = document.createElement("a");
    card.className = "tape-card";
    card.href = biliUrl(v.bvid);
    card.target = "_blank";
    card.rel = "noopener";

    const meta = [v.date, v.length].filter(Boolean).join(" · ");

    card.innerHTML = `
      <div class="tape-thumb">
        <img src="${escapeHtml(v.thumb)}" alt="${escapeHtml(v.title)}" loading="lazy" decoding="async" width="400" height="250"
             onerror="this.src='assets/images/avatar.jpg'" />
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

  function initCommon() {
    initNav();
    applyBiliLinks();
    renderLinkBand(document.getElementById("link-band"));
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
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
    renderGrid(document.getElementById("featured-grid"), data().videos.slice(0, 6));
  }

  function initWorks() {
    initCommon();
    renderGrid(document.getElementById("works-grid"), data().videos);
  }

  function initLinks() {
    initCommon();
  }

  return { initHome, initWorks, initLinks, data };
})();
