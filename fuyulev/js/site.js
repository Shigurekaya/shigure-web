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
    return videoThumb(v);
  }

  /** 视频封面：优先 site-data 中的 thumb，回退到 bvid 路径（永不使用序号） */
  function videoThumb(v) {
    if (v?.thumb && !v.thumb.includes("..")) return v.thumb;
    if (v?.bvid) return `assets/images/covers/${v.bvid}.jpg`;
    return avatarSrc();
  }

  function videoThumbOnError(v) {
    const fb = v?.bvid ? `assets/images/covers/${v.bvid}.jpg` : avatarSrc();
    return `onerror="if(!this.dataset.fbf){this.dataset.fbf='1';this.src='${fb}'}else{this.src='${avatarSrc()}'}"`;
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
    const altText = bvid ? (title || "视频") : "插画";
    imgEl.alt = altText;
    imgEl.classList.remove("lightbox-img--in");
    lb.classList.remove("lightbox--loading");

    const titleEl = document.getElementById("lightbox-title");
    if (titleEl) {
      titleEl.textContent = bvid ? (title || "") : "";
      titleEl.hidden = !bvid || !title;
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

    const mobileMq = window.matchMedia("(max-width: 768px)");

    const backdrop = document.createElement("div");
    backdrop.className = "fy-menu-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);

    const drawerHead = document.createElement("div");
    drawerHead.className = "fy-drawer-head";
    drawerHead.innerHTML =
      '<span class="fy-drawer-logo" aria-hidden="true">F</span>'
      + '<button type="button" class="fy-drawer-close" aria-label="关闭菜单">×</button>';
    nav.insertBefore(drawerHead, nav.firstChild);
    nav.id = "fy-site-nav";
    nav.classList.add("fy-mobile-drawer");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "fy-menu-toggle";
    btn.className = "fy-menu-toggle";
    btn.setAttribute("aria-label", "菜单");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "fy-site-nav");
    btn.innerHTML =
      '<span class="fy-menu-toggle-icon" aria-hidden="true"><span></span><span></span><span></span></span>';
    inner.insertBefore(btn, nav);

    const closeMenu = () => {
      nav.classList.remove("is-open");
      btn.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("fy-menu-open");
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
        document.body.classList.add("fy-menu-open");
      });
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (nav.classList.contains("is-open")) closeMenu();
      else openMenu();
    });

    backdrop.addEventListener("click", closeMenu);
    drawerHead.querySelector(".fy-drawer-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
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
    const src = videoThumb(v);
    const meta = [v.date, v.length].filter(Boolean).join(" · ");
    btn.innerHTML = `
      <img src="${esc(src)}" alt="${esc(v.title)}" decoding="async" ${videoThumbOnError(v)} />
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
    const thumb = galleryThumbSrc(src);
    btn.setAttribute("aria-label", "查看大图");
    btn.innerHTML = `
      <img src="${esc(thumb)}" alt="${esc(galleryAlt(src))}" loading="lazy" decoding="async"
           data-full="${esc(src)}"
           onerror="this.onerror=null;this.src='${esc(src)}'" />
    `;
    btn.addEventListener("click", () => openLightbox("", src));
    return btn;
  }

  function createPortfolioItem(src) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fuyulev-portfolio-thumb";
    const thumb = galleryThumbSrc(src);
    btn.setAttribute("aria-label", `查看 ${galleryAlt(src)}`);
    btn.innerHTML = `
      <img src="${esc(thumb)}" alt="${esc(galleryAlt(src))}" loading="lazy" decoding="async"
           data-full="${esc(src)}"
           onerror="this.onerror=null;this.src='${esc(src)}'" />
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

  function shuffleArray(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickRandomGallery(count = 7) {
    const gallery = bannerGallery();
    if (gallery.length <= count) return shuffleArray(gallery);
    return shuffleArray(gallery).slice(0, count);
  }

  function createBannerButton(src, { lead = false, kind = "profile" } = {}) {
    const btn = document.createElement("button");
    btn.type = "button";
    const base = kind === "link" ? "link-banner" : "profile-banner";
    btn.className = lead && kind === "profile" ? `${base} profile-banner--lead` : base;
    btn.setAttribute("aria-label", "查看大图");

    const thumb = galleryThumbSrc(src);
    const display = thumb !== src ? thumb : src;
    const img = document.createElement("img");
    img.src = display;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.dataset.full = src;
    img.onerror = function onBannerErr() {
      this.onerror = null;
      this.src = src;
      this.onerror = function fallback() {
        this.src = avatarSrc();
      };
    };
    btn.appendChild(img);
    btn.addEventListener("click", () => openLightbox("", src));
    return btn;
  }

  function bannerGallery() {
    if (window.HOME_GALLERY?.length) return window.HOME_GALLERY;
    return [
      "image/alice.jpg",
      "image/key.jpg",
      "image/q.jpg",
      "image/rance.jpg",
      "image/shining2.jpg",
      "image/yiji.jpg",
      "image/白琴里.jpg",
    ];
  }

  /** 首页 profile 下横幅 — 7 张横排，每次随机，可点击查看高清原图 */
  function renderProfileBanners(container) {
    if (!container) return;
    const row = document.createElement("div");
    row.className = "profile-banners-row";
    pickRandomGallery(7).forEach((src, i) => {
      row.appendChild(createBannerButton(src, { lead: i === 0, kind: "profile" }));
    });
    container.replaceChildren(row);
  }

  /** 黑色 LINK 底栏 — 7 张横排，每次随机，可点击查看高清原图 */
  function renderLinkBand(container) {
    if (!container) return;
    const isHome = document.body.dataset.page === "home";
    const bannerRow = document.createElement("div");
    bannerRow.className = "link-banners";
    pickRandomGallery(7).forEach((src) => {
      bannerRow.appendChild(createBannerButton(src, { kind: "link" }));
    });
    const desc = isHome
      ? "绘画过程与投稿发布在哔哩哔哩。插画见首页，视频见「作品」与「作品集」。"
      : "绘画视频发布在哔哩哔哩。欢迎订阅与私信约稿。";
    container.innerHTML = `
      <div class="link-band-inner">
        <h5 class="link-heading">链接</h5>
        <hr class="link-band-line" />
        <h6 class="link-desc">${desc}</h6>
        <p class="site-copyright">&copy;浮游Lev / FUYU LEV</p>
      </div>
    `;
    container.querySelector(".link-desc")?.after(bannerRow);
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
    initFooter();
    initLightbox();
  }

  return {
    data, esc, thumb, videoThumb, videoThumbOnError, bili, biliSpace, initCommon, fillUserHero,
    createWorkItem, createVideoItem, createMasonryItem, createGalleryItem,
    createPortfolioItem, createSdMasonryItem, openLightbox, renderLinkBand,
    renderProfileBanners, galleryThumbSrc, isGalleryImage, galleryAlt,
  };
})();
