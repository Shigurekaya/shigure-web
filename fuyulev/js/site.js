/**
 * 全站共享 — komowata.com 复刻
 */
const Site = (() => {
  const data = () => window.SITE_DATA || { user: {}, videos: [], stats: {} };

  const KAYA_SITE = "../kaya/";

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
      a.classList.toggle("active", a.dataset.nav === page);
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

  /** 画廊原图 → WebP 缩略图 */
  function galleryThumbSrc(src) {
    if (!src || src.includes("/thumbs/") || !/^image\/.+\.(png|jpe?g|webp)$/i.test(src)) {
      return src;
    }
    const base = src.replace(/^image\//, "").replace(/\.(png|jpe?g|webp)$/i, "");
    return `image/thumbs/${base}.webp`;
  }

  function isGalleryImage(src) {
    return !!src && /^image\/.+\.(png|jpe?g|webp)$/i.test(src) && !src.includes("/thumbs/");
  }

  function galleryAlt(src) {
    if (!src) return "插画";
    const name = src.replace(/^image\//, "").replace(/\.(png|jpe?g|webp)$/i, "");
    return name || "插画";
  }

  let lightboxTrigger = null;

  function openLightbox(title, src, bvid) {
    const lb = document.getElementById("lightbox");
    if (!lb) {
      if (bvid) window.open(bili(bvid), "_blank");
      return;
    }
    const imgEl = document.getElementById("lightbox-img");
    const fullSrc = src;
    const previewSrc = isGalleryImage(fullSrc) ? galleryThumbSrc(fullSrc) : fullSrc;
    const altText = title || galleryAlt(fullSrc);
    imgEl.alt = altText;
    imgEl.classList.remove("lightbox-img--in");
    lb.classList.remove("lightbox--loading");

    const titleEl = document.getElementById("lightbox-title");
    if (titleEl) {
      titleEl.textContent = altText;
      titleEl.hidden = !bvid && !title;
    }

    const showImage = (url) => {
      imgEl.src = url;
      requestAnimationFrame(() => imgEl.classList.add("lightbox-img--in"));
    };

    if (isGalleryImage(fullSrc) && previewSrc !== fullSrc) {
      imgEl.src = previewSrc;
      requestAnimationFrame(() => imgEl.classList.add("lightbox-img--in"));
      lb.classList.add("lightbox--loading");
      const hd = new Image();
      hd.onload = () => {
        lb.classList.remove("lightbox--loading");
        showImage(fullSrc);
      };
      hd.onerror = () => lb.classList.remove("lightbox--loading");
      hd.src = fullSrc;
    } else {
      showImage(fullSrc);
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
    lightboxTrigger = document.activeElement;
    requestAnimationFrame(() => {
      lb.classList.add("lightbox--open");
      document.getElementById("lightbox-close")?.focus();
    });
  }

  function closeLightbox() {
    const lb = document.getElementById("lightbox");
    if (!lb) return;
    lb.classList.remove("lightbox--open");
    setTimeout(() => {
      lb.hidden = true;
      document.body.style.overflow = "";
      if (lightboxTrigger?.focus) lightboxTrigger.focus();
      lightboxTrigger = null;
    }, reducedMotion() ? 0 : 220);
  }

  function initFyTopbar() {
    const inner = document.querySelector(".fy-topbar-inner");
    const nav = document.querySelector(".fy-topbar-nav");
    if (!inner || !nav || document.getElementById("fy-menu-toggle")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "fy-menu-toggle";
    btn.className = "fy-menu-toggle";
    btn.setAttribute("aria-label", "菜单");
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "≡";
    inner.insertBefore(btn, nav);

    const closeMenu = () => {
      nav.classList.remove("is-open");
      btn.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("fy-menu-open");
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      btn.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("fy-menu-open", open);
    });

    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
    document.addEventListener("click", (e) => {
      if (!inner.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
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

  /** 视频拼贴项 — 带标题叠层 */
  function createVideoItem(v, index) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "km-gallery-item km-gallery-item--video";
    const src = thumb(v, index);
    const meta = [v.date, v.length].filter(Boolean).join(" · ");
    btn.innerHTML = `
      <img src="${esc(src)}" alt="${esc(v.title)}" decoding="async" onerror="this.src='assets/images/avatar.jpg'" />
      <span class="km-gallery-item-cap">
        <span class="km-gallery-item-title">${esc(v.title)}</span>
        ${meta ? `<span class="km-gallery-item-meta">${esc(meta)}</span>` : ""}
      </span>
    `;
    btn.addEventListener("click", () => openLightbox(v.title, src, v.bvid));
    return btn;
  }

  function createWorkItem(v, index) {
    return createVideoItem(v, index);
  }

  /** @deprecated alias */
  function createMasonryItem(v, index) {
    return createVideoItem(v, index);
  }

  function createGalleryItem(src) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "km-gallery-item";
    const alt = galleryAlt(src);
    const thumb = galleryThumbSrc(src);
    btn.setAttribute("aria-label", `查看大图：${alt}`);
    btn.innerHTML = `
      <img src="${esc(thumb)}" alt="${esc(alt)}" loading="lazy" decoding="async"
           data-full="${esc(src)}"
           onerror="this.onerror=null;this.src='${esc(src)}'" />
    `;
    btn.addEventListener("click", () => openLightbox(alt, src));
    return btn;
  }

  function createPortfolioItem(src) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fuyulev-portfolio-thumb";
    const alt = galleryAlt(src);
    const thumb = galleryThumbSrc(src);
    btn.innerHTML = `
      <img src="${esc(thumb)}" alt="${esc(alt)}" loading="lazy" decoding="async"
           data-full="${esc(src)}"
           onerror="this.onerror=null;this.src='${esc(src)}'" />
    `;
    btn.addEventListener("click", () => openLightbox(alt, src));
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
    const thumb = galleryThumbSrc(src);
    const display = thumb !== src ? thumb : src;
    return `<img src="${esc(display)}" alt="${esc(alt)}" loading="lazy" width="${w}" height="${h}" onerror="this.onerror=null;this.src='${esc(src)}';this.onerror=function(){this.src='assets/images/avatar.jpg'}" />`;
  }

  function bannerGallery() {
    if (window.HOME_GALLERY?.length) return window.HOME_GALLERY;
    return [
      "image/alice.png",
      "image/key.png",
      "image/q.png",
      "image/rance.png",
      "image/shining2.png",
      "image/yiji.png",
      "image/白琴里.png",
    ];
  }

  function bannerSrc(i) {
    const gallery = bannerGallery();
    return gallery[i] || avatarSrc();
  }

  /** 首页 profile 下横幅 — komowata：7 张横排（166 + 6×156），仅展示不跳转 */
  function renderProfileBanners(container) {
    if (!container) return;
    const gallery = bannerGallery();
    const pick = (i) => gallery[i] || avatarSrc();
    const items = [
      { img: pick(0), alt: "哔哩哔哩", lead: true },
      { img: pick(1), alt: "Work" },
      { img: pick(2), alt: "Portfolio" },
      { img: pick(3), alt: "视频" },
      { img: pick(4), alt: "视频" },
      { img: pick(5), alt: "视频" },
      { img: pick(6), alt: "About" },
    ];

    const rowHtml = items.map((b) => {
      const cls = b.lead ? "profile-banner profile-banner--lead" : "profile-banner";
      const w = b.lead ? 166 : 156;
      const src = b.img || avatarSrc();
      return `<span class="${cls}" role="presentation">${bannerImg(src, w, 78, b.alt)}</span>`;
    }).join("");

    container.innerHTML = `<div class="profile-banners-row">${rowHtml}</div>`;
  }

  /** 黑色 LINK 底栏 — komowata SITE_FOOTER */
  function renderLinkBand(container) {
    if (!container) return;
    const videos = data().videos;
    const isHome = document.body.dataset.page === "home";
    const linkItems = [
      { src: bannerSrc(0), alt: "哔哩哔哩" },
      { src: bannerSrc(1), alt: "Work" },
      { src: bannerSrc(2), alt: "Portfolio" },
      { src: bannerSrc(3), alt: videos[0]?.title || "视频" },
      { src: bannerSrc(4), alt: videos[1]?.title || "视频" },
      { src: bannerSrc(5), alt: videos[2]?.title || "视频" },
      { src: bannerSrc(6), alt: "About" },
    ];
    const bannerHtml = linkItems.map((b) =>
      `<span class="link-banner" role="presentation" title="${esc(b.alt)}">${bannerImg(b.src, 156, 78, b.alt)}</span>`
    ).join("");
    const desc = isHome
      ? "绘画过程与投稿发布在哔哩哔哩。插画见首页，视频见「作品」与「作品集」。"
      : "绘画视频发布在哔哩哔哩。欢迎订阅与私信约稿。";
    container.innerHTML = `
      <div class="link-band-inner">
        <h5 class="link-heading">链接</h5>
        <hr class="link-band-line" />
        <h6 class="link-desc">${desc}</h6>
        <div class="link-banners">${bannerHtml}</div>
        <p class="site-copyright">&copy;浮游Lev / FUYU LEV</p>
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

  function initCommon(options = {}) {
    if (typeof CollageGallery !== "undefined") CollageGallery.init();
    initFyTopbar();
    initNav();
    initFooter();
    initLightbox();
  }

  return {
    data, esc, thumb, bili, biliSpace, initCommon, fillUserHero,
    createWorkItem, createVideoItem, createMasonryItem, createGalleryItem,
    createPortfolioItem, createSdMasonryItem, openLightbox, renderLinkBand,
    renderProfileBanners, galleryThumbSrc, isGalleryImage, galleryAlt,
  };
})();
