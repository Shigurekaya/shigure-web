/**
 * 时雨榧个人站
 */
const Kaya = (() => {
  const data = () => window.SITE_DATA || { user: {}, videos: [], stats: {} };

  const PORTAL = "../index.html";
  const PARTNER = {
    name: "浮游Lev",
    site: "../komowata/",
    desc: "同人插画",
    bili: "https://space.bilibili.com/353604313",
    avatar: "../komowata/assets/images/avatar.jpg",
  };

  const FILTERS = [
    { label: "全部", match: () => true },
    { label: "手书", match: (t) => /手书/.test(t) },
    { label: "GAL", match: (t) => /GAL|galgame|柚子|宁宁|白色相簿|素晴日|魔女审判|糖糖/i.test(t) },
    { label: "Mujica", match: (t) => /Mujica|Ave/i.test(t) },
    { label: "人物志", match: (t) => /人物志/.test(t) },
  ];

  function formatNum(n) {
    if (!n && n !== 0) return "—";
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, "") + "万";
    return String(n);
  }

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

    const meta = [v.date, v.length, v.play ? `${formatNum(v.play)} 播放` : ""]
      .filter(Boolean)
      .join(" · ");

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

  function renderStats(el) {
    if (!el) return;
    const s = data().stats;
    el.innerHTML = `
      <div class="stat-item"><strong>${formatNum(s.follower)}</strong><span>粉丝</span></div>
      <div class="stat-item"><strong>${s.videos || data().videos.length}</strong><span>投稿</span></div>
      <div class="stat-item"><strong>${formatNum(s.likes)}</strong><span>获赞</span></div>
      <div class="stat-item"><strong>Lv.${data().user.level || "—"}</strong><span>等级</span></div>
    `;
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
          <a href="${PORTAL}" class="link-band-card">← 切换创作者</a>
          <a href="${PARTNER.site}" class="link-band-card">
            <img src="${PARTNER.avatar}" alt="${escapeHtml(PARTNER.name)}" width="40" height="40" loading="lazy" onerror="this.style.display='none'" />
            <span><strong>${escapeHtml(PARTNER.name)}</strong><small>${escapeHtml(PARTNER.desc)}</small></span>
          </a>
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
    ["bili-space-btn", "bili-space-link", "about-bili-btn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.href = url;
    });
  }

  function initNav() {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("site-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => nav.classList.toggle("open"));
    }
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
    const pendantEl = document.getElementById("hero-pendant");
    if (pendantEl && d.user.pendant) {
      pendantEl.src = d.user.pendant;
      pendantEl.hidden = false;
    }
    renderStats(document.getElementById("hero-stats"));
  }

  function initHome() {
    initCommon();
    initHero();
    renderGrid(document.getElementById("featured-grid"), data().videos.slice(0, 6));
  }

  function initWorks() {
    initCommon();
    const countEl = document.getElementById("works-count");
    if (countEl) countEl.textContent = data().stats.videos || data().videos.length;
    const grid = document.getElementById("works-grid");
    const bar = document.getElementById("filter-bar");
    let active = 0;

    function applyFilter() {
      const rule = FILTERS[active];
      const filtered = data().videos.filter((v) => rule.match(v.title + " " + (v.typename || "")));
      renderGrid(grid, filtered);
    }

    if (bar) {
      FILTERS.forEach((f, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filter-btn" + (i === 0 ? " active" : "");
        btn.textContent = f.label;
        btn.addEventListener("click", () => {
          active = i;
          bar.querySelectorAll(".filter-btn").forEach((b, j) => b.classList.toggle("active", j === i));
          applyFilter();
        });
        bar.appendChild(btn);
      });
    }
    applyFilter();
  }

  function initAbout() {
    initCommon();
    initHero();
    const signInline = document.getElementById("about-sign-inline");
    if (signInline) signInline.textContent = data().user.sign || "";
    const partnerSite = document.getElementById("partner-site");
    if (partnerSite) partnerSite.href = PARTNER.site;
  }

  function initLinks() {
    initCommon();
    initHero();
    const partnerLink = document.getElementById("partner-link");
    if (partnerLink) partnerLink.href = PARTNER.site;
  }

  return { initHome, initWorks, initAbout, initLinks, data, formatNum };
})();
