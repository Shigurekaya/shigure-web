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
      if (bvid) window.open(bili(bvid), "_blank");
      return;
    }
    document.getElementById("lightbox-img").src = src;
    document.getElementById("lightbox-img").alt = title;
    const titleEl = document.getElementById("lightbox-title");
    if (titleEl) {
      titleEl.textContent = title;
      titleEl.hidden = !title;
    }
    const link = document.getElementById("lightbox-link");
    if (link) {
      if (bvid) {
        link.href = bili(bvid);
        link.hidden = false;
      } else {
        link.hidden = true;
      }
    }
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
    btn.className = "masonry-item";
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

  function createGalleryItem(src) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "masonry-item masonry-item--gallery";
    btn.innerHTML = `
      <img src="${esc(src)}" alt="" loading="lazy" decoding="async" />
    `;
    btn.addEventListener("click", () => openLightbox("", src));
    return btn;
  }

  /** @deprecated use createGalleryItem */
  function createSdMasonryItem(item) {
    const src = typeof item === "string" ? item : item.src;
    return createGalleryItem(src);
  }

  function avatarSrc() {
    const av = data().user?.avatar;
    if (!av || av.includes("..")) return "assets/images/avatar.jpg";
    return av;
  }

  function bannerImg(src, w, h, alt) {
    return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" width="${w}" height="${h}" onerror="this.src='assets/images/avatar.jpg'" />`;
  }

  /** 首页 profile 下横幅 — komowata：7 张横排一行（166 + 6×156） */
  function renderProfileBanners(container) {
    if (!container) return;
    const gallery = window.HOME_GALLERY || [];
    const space = biliSpace();
    const links = [
      { href: space, img: gallery[0], alt: "哔哩哔哩", lead: true },
      { href: "work.html", img: gallery[1], alt: "Work", internal: true },
      { href: "portfolio.html", img: gallery[2], alt: "Portfolio", internal: true },
      { href: bili(data().videos[0]?.bvid), img: gallery[3], alt: "视频" },
      { href: bili(data().videos[1]?.bvid), img: gallery[4], alt: "视频" },
      { href: bili(data().videos[2]?.bvid), img: gallery[5], alt: "视频" },
      { href: "about.html", img: gallery[6], alt: "About", internal: true },
    ];

    const rowHtml = links.map((b) => {
      const target = b.internal ? "" : ' target="_blank" rel="noopener"';
      const cls = b.lead ? "profile-banner profile-banner--lead" : "profile-banner";
      const w = b.lead ? 166 : 156;
      const src = b.img || avatarSrc();
      return `<a href="${esc(b.href)}"${target} class="${cls}" title="${esc(b.alt)}">${bannerImg(src, w, 78, b.alt)}</a>`;
    }).join("");

    container.innerHTML = `<div class="profile-banners-row">${rowHtml}</div>`;
  }

  /** 黑色 LINK 底栏 */
  function renderLinkBand(container) {
    if (!container) return;
    const videos = data().videos;
    const isHome = document.body.dataset.page === "home";
    const linkItems = [
      { href: biliSpace(), src: avatarSrc(), alt: "哔哩哔哩" },
      { href: "work.html", src: thumb(videos[0], 0), alt: "Work", internal: true },
      { href: "portfolio.html", src: thumb(videos[1], 1), alt: "Portfolio", internal: true },
      ...videos.slice(2, 6).map((v, i) => ({
        href: bili(v.bvid),
        src: thumb(v, i + 2),
        alt: v.title,
      })),
    ];
    const bannerHtml = linkItems.map((b) => {
      const target = b.internal ? "" : ' target="_blank" rel="noopener"';
      return `<a href="${esc(b.href)}"${target} class="link-banner" title="${esc(b.alt)}">${bannerImg(b.src, 156, 78, b.alt)}</a>`;
    }).join("");
    const desc = isHome
      ? "绘画过程与投稿发布在哔哩哔哩。插画见首页，视频见 <a href=\"work.html\">Work</a> / <a href=\"portfolio.html\">Portfolio</a>。"
      : "绘画视频发布在哔哩哔哩。欢迎订阅与私信约稿。";
    const headingTag = isHome ? "h5" : "h2";
    container.innerHTML = `
      <div class="link-band-inner">
        <${headingTag} class="link-heading">LINK</${headingTag}>
        <hr class="link-band-line" />
        <p class="link-desc">${desc}</p>
        <div class="link-banners">${bannerHtml}</div>
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
    if (typeof Masonry !== "undefined") Masonry.init();
    initNav();
    initFooter();
    initLightbox();
    initSecretCorner();
    if (document.body.dataset.page === "home") {
      document.body.classList.add("page-ready");
    }
    if (typeof Motion !== "undefined") Motion.init();
  }

  return {
    data, esc, thumb, bili, biliSpace, initCommon, fillUserHero,
    createWorkItem, createMasonryItem, createGalleryItem, createSdMasonryItem, openLightbox, renderLinkBand, renderProfileBanners,
  };
})();
