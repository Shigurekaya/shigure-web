/**
 * 全站共享 — komowata.com 复刻
 */
const Site = (() => {
  const data = () => window.SITE_DATA || { user: {}, videos: [], stats: {} };

  const SECRET_SITE = "../kaya/";

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function thumb(v, i) {
    if (v.thumb && !v.thumb.includes("..")) return v.thumb;
    return `assets/images/video_${i}.jpg`;
  }

  function bili(bvid) {
    return `https://www.bilibili.com/video/${bvid}`;
  }

  function biliSpace() {
    return data().bilibili_url || "https://space.bilibili.com/353604313";
  }

  function initNav() {
    const btn = document.getElementById("menu-btn");
    const mobileNav = document.getElementById("site-nav");
    const page = document.body.dataset.page;

    document.querySelectorAll("[data-nav]").forEach((a) => {
      if (a.dataset.nav === page) a.classList.add("active");
    });

    if (!btn || !mobileNav) return;

    btn.addEventListener("click", () => {
      btn.classList.toggle("open");
      mobileNav.classList.toggle("open");
      document.body.classList.toggle("menu-open", mobileNav.classList.contains("open"));
    });

    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        btn.classList.remove("open");
        mobileNav.classList.remove("open");
        document.body.classList.remove("menu-open");
      });
    });
  }

  function initFooter() {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function openLightbox(title, src, bvid) {
    const lb = document.getElementById("lightbox");
    if (!lb) {
      window.open(bili(bvid), "_blank");
      return;
    }
    document.getElementById("lightbox-img").src = src;
    document.getElementById("lightbox-img").alt = title;
    document.getElementById("lightbox-title").textContent = title;
    document.getElementById("lightbox-link").href = bili(bvid);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    lb.classList.remove("lightbox--open");
    requestAnimationFrame(() => lb.classList.add("lightbox--open"));
  }

  function closeLightbox() {
    const lb = document.getElementById("lightbox");
    if (!lb) return;
    lb.classList.remove("lightbox--open");
    setTimeout(() => {
      lb.hidden = true;
      document.body.style.overflow = "";
    }, reducedMotion() ? 0 : 220);
  }

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initLightbox() {
    document.getElementById("lightbox-close")?.addEventListener("click", closeLightbox);
    document.getElementById("lightbox")?.addEventListener("click", (e) => {
      if (e.target.id === "lightbox") closeLightbox();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLightbox();
    });
  }

  /** 瀑布流项 — 悬停显示标题 */
  function createMasonryItem(v, index) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "masonry-item reveal";
    const src = thumb(v, index);
    const meta = [v.date, v.length].filter(Boolean).join(" · ");
    btn.innerHTML = `
      <img src="${esc(src)}" alt="${esc(v.title)}" loading="lazy" decoding="async" onerror="this.src='assets/images/avatar.jpg'" />
      <span class="masonry-item-cap">
        <span class="masonry-item-title">${esc(v.title)}</span>
        ${meta ? `<span class="masonry-item-meta">${esc(meta)}</span>` : ""}
      </span>
    `;
    btn.addEventListener("click", () => openLightbox(v.title, src, v.bvid));
    return btn;
  }

  function createWorkItem(v, index) {
    return createMasonryItem(v, index);
  }

  /** 首页顶栏外链小横幅（对应原站 Melon/Booth 等） */
  function renderProfileBanners(container) {
    if (!container) return;
    const videos = data().videos;
    const items = [
      { href: biliSpace(), src: "assets/images/avatar.jpg", alt: "哔哩哔哩" },
      ...videos.slice(0, 6).map((v, i) => ({
        href: bili(v.bvid),
        src: thumb(v, i),
        alt: v.title,
      })),
    ];

    container.innerHTML = items.map((b) => `
      <a href="${esc(b.href)}" target="_blank" rel="noopener" class="profile-banner" title="${esc(b.alt)}">
        <img src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy" width="120" height="60" onerror="this.src='assets/images/avatar.jpg'" />
      </a>
    `).join("");
  }

  /** 黑色 LINK 底栏 */
  function renderLinkBand(container) {
    if (!container) return;
    const videos = data().videos;
    container.innerHTML = `
      <div class="link-band-inner">
        <h2 class="link-heading">LINK</h2>
        <hr class="link-band-line" />
        <p class="link-desc">绘画视频发布在哔哩哔哩。</p>
        <div class="link-banners">
          <a href="${esc(biliSpace())}" target="_blank" rel="noopener" class="link-banner" title="哔哩哔哩">
            <img src="assets/images/avatar.jpg" alt="哔哩哔哩" loading="lazy" width="156" height="78" />
          </a>
          ${videos.slice(0, 4).map((v, i) => `
            <a href="${esc(bili(v.bvid))}" target="_blank" rel="noopener" class="link-banner" title="${esc(v.title)}">
              <img src="${esc(thumb(v, i))}" alt="${esc(v.title)}" loading="lazy" width="156" height="78" onerror="this.src='assets/images/avatar.jpg'" />
            </a>
          `).join("")}
        </div>
      </div>
    `;
  }

  function fillUserHero() {
    const { user } = data();
    const nameEl = document.getElementById("hero-name");
    if (nameEl && user.name) {
      nameEl.innerHTML = `<a href="about.html">${esc(user.name)} / FuYu Lev</a>`;
    }

    const avatar = document.getElementById("profile-avatar");
    if (avatar && user.avatar) {
      avatar.src = user.avatar.includes("..") ? "assets/images/avatar.jpg" : user.avatar;
    }

    renderProfileBanners(document.getElementById("profile-banners"));
  }

  function initSecretCorner() {
    if (document.getElementById("secret-corner")) return;
    const a = document.createElement("a");
    a.id = "secret-corner";
    a.className = "secret-corner";
    a.href = SECRET_SITE;
    a.setAttribute("aria-label", "时雨榧");
    a.textContent = "·";
    document.body.appendChild(a);
  }

  function initCommon() {
    initNav();
    initFooter();
    initLightbox();
    initSecretCorner();
    if (typeof Motion !== "undefined") Motion.init();
  }

  return {
    data, esc, thumb, bili, biliSpace, initCommon, fillUserHero,
    createWorkItem, createMasonryItem, openLightbox, renderLinkBand, renderProfileBanners,
  };
})();
