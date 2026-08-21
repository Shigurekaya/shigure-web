/**
 * 时雨榧个人站
 */
const Kaya = (() => {
  /* 品牌色略降饱和，更贴页面色调 */
  const ICONS = {
    bilibili: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#3BA3C4" d="M6.35 2.55a.9.9 0 0 1 1.26.2L10.4 6.2a.75.75 0 0 1-1.2.9L6.55 3.8a.9.9 0 0 1-.2-1.25zm11.3 0a.9.9 0 0 1-.2 1.25l-2.65 3.3a.75.75 0 1 1-1.2-.9l2.79-3.45a.9.9 0 0 1 1.26-.2z"/><rect x="2.4" y="6.4" width="19.2" height="14.2" rx="4.2" fill="#3BA3C4"/><rect x="4.55" y="8.55" width="14.9" height="9.9" rx="2.2" fill="#EEF8FB"/><circle cx="9.05" cy="12.55" r="1.15" fill="#2A6F85"/><circle cx="14.95" cy="12.55" r="1.15" fill="#2A6F85"/><path fill="none" stroke="#2A6F85" stroke-width="1.25" stroke-linecap="round" d="M10.15 15.35c.85.75 2.85.75 3.7 0"/></svg>`,
    youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#D94F4F" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="#3A3A3A" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.991ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>`,
  };

  const data = () => window.SITE_DATA || { user: {}, videos: [], links: [] };

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
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

  function createWorkCard(v, index) {
    const card = document.createElement("a");
    card.className = "work-card";
    card.href = biliUrl(v.bvid);
    card.target = "_blank";
    card.rel = "noopener";

    const meta = [v.date, v.length].filter(Boolean).join(" · ");
    const thumb = videoThumb(v);

    card.innerHTML = `
      <div class="work-card__thumb">
        <img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" width="480" height="270"
             ${videoThumbOnError(v)} />
        <span class="work-card__play" aria-hidden="true">▶</span>
      </div>
      <div class="work-card__body">
        <span class="work-card__index">${String(index + 1).padStart(2, "0")}</span>
        <h2 class="work-card__title">${escapeHtml(v.title)}</h2>
        ${meta ? `<p class="work-card__meta">${escapeHtml(meta)}</p>` : ""}
      </div>
    `;
    return card;
  }

  function renderGrid(grid, videos, startIndex = 0) {
    if (!grid) return;
    grid.innerHTML = "";
    videos.forEach((v, i) => grid.appendChild(createWorkCard(v, startIndex + i)));
  }

  function spaceUrl() {
    const d = data();
    if (d.bilibili_url) return d.bilibili_url;
    return `https://space.bilibili.com/${d.mid || 109084234}`;
  }

  function externalLinks() {
    const d = data();
    if (d.links?.length) return d.links;
    return [
      { icon: "bilibili", title: "B 站空间", url: spaceUrl(), label: "space.bilibili.com" },
      { icon: "youtube", title: "YouTube", url: d.youtube_url || "https://www.youtube.com/@ShigureKaya", label: "@ShigureKaya" },
      { icon: "x", title: "X", url: d.twitter_url || "https://x.com/ShigureKaya", label: "@ShigureKaya" },
    ];
  }

  function renderSocialIcons(container) {
    if (!container) return;
    container.innerHTML = externalLinks().map((link) => `
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
         class="social-pill social-pill--${escapeHtml(link.icon)}" title="${escapeHtml(link.title)}" aria-label="${escapeHtml(link.title)}">
        <span class="social-pill__icon">${ICONS[link.icon] || ""}</span>
      </a>
    `).join("");
  }

  function renderLinkCards(container) {
    if (!container) return;
    container.innerHTML = externalLinks().map((link) => `
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-card link-card--${escapeHtml(link.icon)}">
        <span class="link-card__icon">${ICONS[link.icon] || ""}</span>
        <span class="link-card__text">
          <strong>${escapeHtml(link.title)}</strong>
          <small>${escapeHtml(link.label || link.url.replace(/^https?:\/\//, ""))}</small>
        </span>
        <span class="link-card__arrow" aria-hidden="true">↗</span>
      </a>
    `).join("");
  }

  function renderIntro(container) {
    if (!container) return;
    const intro = data().intro;
    if (!intro) {
      container.innerHTML = "";
      container.closest(".intro-panel")?.classList.add("is-empty");
      return;
    }
    container.closest(".intro-panel")?.classList.remove("is-empty");
    if (typeof intro === "string") {
      container.innerHTML = intro.split("\n\n").map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      return;
    }
    if (Array.isArray(intro.paragraphs)) {
      container.innerHTML = intro.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    }
  }

  function initNav() {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    const closeNav = () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target) && e.target !== toggle) closeNav();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });
  }

  const HEAVY_RAIN_CHANCE = 0.1;
  const RAIN_MODE_KEY = "kaya-rain-heavy";
  const SPLASH_SELECTORS = [
    ".intro-panel__body",
    ".home-card",
    ".work-card",
    ".link-card",
    ".footer-fuyuu",
    ".profile-avatar",
  ].join(",");

  /** @type {{ refreshLedges?: () => void } | null} */
  let rainApi = null;

  /** URL `?rain=storm`（或 `?storm`）强制暴雨，供隐藏测试入口使用 */
  function forceStormFromUrl() {
    try {
      const q = new URLSearchParams(window.location.search);
      const rain = (q.get("rain") || "").toLowerCase();
      return rain === "storm" || rain === "heavy" || q.has("storm");
    } catch {
      return false;
    }
  }

  function navigationType() {
    try {
      const entry = performance.getEntriesByType?.("navigation")?.[0];
      if (entry?.type) return entry.type;
    } catch { /* ignore */ }
    try {
      // 0=navigate 1=reload 2=back_forward
      const t = performance.navigation?.type;
      if (t === 1) return "reload";
      if (t === 2) return "back_forward";
    } catch { /* ignore */ }
    return "navigate";
  }

  function readStoredHeavy() {
    try {
      const v = sessionStorage.getItem(RAIN_MODE_KEY);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch { /* ignore */ }
    return null;
  }

  function writeStoredHeavy(heavy) {
    try {
      sessionStorage.setItem(RAIN_MODE_KEY, heavy ? "1" : "0");
    } catch { /* ignore */ }
  }

  /**
   * 雨效模式：
   * - URL 强制暴雨优先
   * - 刷新（reload）才重新 10% 抽签
   * - 站内点「作品 / 链接 / 首页」沿用本次会话已选模式，不重抽
   */
  function pickInitialHeavy() {
    if (forceStormFromUrl()) {
      writeStoredHeavy(true);
      return true;
    }

    const isReload = navigationType() === "reload";
    if (!isReload) {
      const saved = readStoredHeavy();
      if (saved !== null) return saved;
    }

    const heavy = Math.random() < HEAVY_RAIN_CHANCE;
    writeStoredHeavy(heavy);
    return heavy;
  }

  function initSiteRain(host, heavyOverride) {
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bgCanvas = document.createElement("canvas");
    bgCanvas.className = "site-bg__rain";
    bgCanvas.setAttribute("aria-hidden", "true");
    host.appendChild(bgCanvas);

    const fx = document.createElement("div");
    fx.className = "site-fx";
    fx.setAttribute("aria-hidden", "true");
    document.body.appendChild(fx);

    const bgCtx = bgCanvas.getContext("2d", { alpha: true });
    if (!bgCtx) return;

    /* 与开场主题共用同一次抽签，避免 refresh 时抽两次不一致 */
    const heavy = typeof heavyOverride === "boolean" ? heavyOverride : pickInitialHeavy();
    let running = true;
    let w = 0;
    let h = 0;
    let resizeTimer = 0;
    let lastScrollAt = 0;
    let scrollRaf = 0;
    let lastScrollY = window.scrollY || 0;
    /** @type {Array<{x:number,y:number,w:number,radius:number}>} */
    let ledges = [];
    /** @type {WeakMap<Element, number>} */
    const radiusCache = new WeakMap();
    let heavyFx = null;
    let lightFx = null;
    let splashNodes = null;
    let splashNodesAt = 0;

    const applyRainMode = () => {
      applyRainTheme(heavy);
      fx.classList.toggle("is-active", heavy);
    };

    const ensureSplashNodes = (force = false) => {
      const now = performance.now();
      if (!force && splashNodes && now - splashNodesAt < 1000) return splashNodes;
      splashNodes = document.querySelectorAll(SPLASH_SELECTORS);
      splashNodesAt = now;
      return splashNodes;
    };

    const collectLedges = () => {
      const nodes = ensureSplashNodes();
      const next = [];
      const max = 32;
      const vh = h || window.innerHeight;
      const vw = w || window.innerWidth;
      for (let i = 0; i < nodes.length && next.length < max; i += 1) {
        const el = nodes[i];
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 36 || r.height < 16) continue;
        if (r.bottom < -40 || r.top > vh + 40 || r.right < -20 || r.left > vw + 20) continue;
        let radius = radiusCache.get(el);
        if (radius == null) {
          radius = Math.min(22, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 14);
          radiusCache.set(el, radius);
        }
        const minSide = Math.min(r.width, r.height);
        const roundish = el.classList.contains("profile-avatar")
          || radius >= minSide * 0.42
          || getComputedStyle(el).borderRadius === "50%";
        next.push({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          radius,
          shape: roundish ? "circle" : "rect",
        });
      }
      ledges = next;
      return ledges;
    };

    const isScrolling = () => performance.now() - lastScrollAt < 140;

    const ensureHeavyFx = () => {
      if (heavyFx) return heavyFx;
      if (!window.KayaHeavyRain?.attach) {
        console.warn("[kaya] KayaHeavyRain missing");
        return null;
      }
      heavyFx = window.KayaHeavyRain.attach(fx, {
        getLedges: () => ledges,
        collectLedges,
        isScrolling,
        bgHost: host,
      });
      return heavyFx;
    };

    const ensureLightFx = () => {
      if (lightFx) return lightFx;
      if (!window.KayaLightRain?.attach) {
        console.warn("[kaya] KayaLightRain missing");
        return null;
      }
      lightFx = window.KayaLightRain.attach(bgCanvas, { mistHost: host });
      return lightFx;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      if (heavy) {
        ensureSplashNodes(true);
        collectLedges();
        heavyFx?.resize();
      } else {
        lightFx?.resize();
      }
    };

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 100);
    };

    const flushScroll = () => {
      scrollRaf = 0;
      if (!heavy) return;
      const y = window.scrollY || 0;
      const dy = Math.abs(y - lastScrollY);
      lastScrollY = y;
      collectLedges();
      if (dy > 2) heavyFx?.onScroll?.(dy);
    };

    const onScroll = () => {
      if (!heavy) return;
      lastScrollAt = performance.now();
      if (!scrollRaf) scrollRaf = window.requestAnimationFrame(flushScroll);
    };

    const onVisibility = () => {
      const hidden = document.hidden;
      host.classList.toggle("is-paused", hidden);
      if (hidden) {
        running = false;
        window.cancelAnimationFrame(scrollRaf);
        scrollRaf = 0;
        heavyFx?.stop();
        lightFx?.stop();
        return;
      }
      if (!running) {
        running = true;
        if (heavy) ensureHeavyFx()?.start();
        else ensureLightFx()?.start();
      }
    };

    applyRainMode();
    host.classList.toggle("is-paused", document.hidden);
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    if (heavy) {
      window.addEventListener("scroll", onScroll, { passive: true, capture: true });
      resize();
      /* 开幕播放中延迟启动主雨，避免叠两层雨 + 抢资源 */
      const introPlaying = document.body.classList.contains("home-intro-playing");
      const startHeavy = () => {
        if (!running) return;
        ensureHeavyFx()?.start();
        ensureSplashNodes(true);
        collectLedges();
      };
      if (introPlaying) {
        const waitIntro = () => {
          if (!document.body.classList.contains("home-intro-playing")) {
            startHeavy();
            return;
          }
          window.setTimeout(waitIntro, 120);
        };
        window.setTimeout(waitIntro, 200);
      } else {
        startHeavy();
      }
      window.setTimeout(() => {
        ensureSplashNodes(true);
        collectLedges();
      }, 1100);
    } else {
      resize();
      ensureLightFx()?.start();
    }

    rainApi = {
      refreshLedges: () => {
        if (!heavy || !running) return;
        ensureSplashNodes(true);
        collectLedges();
      },
    };
  }

  function refreshRainLedges() {
    rainApi?.refreshLedges?.();
    window.requestAnimationFrame(() => rainApi?.refreshLedges?.());
  }

  function markPageReady() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      document.body.classList.add("page-ready");
      return;
    }
    window.requestAnimationFrame(() => {
      document.body.classList.add("page-ready");
    });
  }

  function initCommon(rainHeavy) {
    initNav();
    initSiteRain(document.querySelector(".site-bg"), rainHeavy);
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function initHero() {
    const d = data();
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set("hero-name", d.user.name || "时雨榧");

    const signEl = document.getElementById("hero-sign");
    if (signEl) {
      const sign = d.user.sign || "";
      signEl.innerHTML = sign.split("\n").map((line) => escapeHtml(line)).join("<br />");
    }

    const avatarEl = document.getElementById("hero-avatar");
    if (avatarEl && d.user.avatar) {
      avatarEl.src = d.user.avatar;
      avatarEl.alt = d.user.name || "";
    }

    renderSocialIcons(document.getElementById("social-icons"));
    renderIntro(document.getElementById("intro-body"));
  }

  function startIntroRain(canvas) {
    /* 开幕只用 2D，避免与主站 GPU 雨丝抢 WebGL 上下文 */
    const ctx = canvas?.getContext("2d");
    if (!ctx) return () => {};

    const heavy = document.body.classList.contains("heavy-rain");
    const drops = [];
    let raf = 0;
    let running = true;
    let last = performance.now();
    let w = window.innerWidth;
    let h = window.innerHeight;
    const area = clamp((w * h) / (1280 * 720), 0.7, 1.5);
    const n = Math.round((heavy ? 360 : 90) * area);

    for (let i = 0; i < n; i += 1) {
      drops.push({
        x: Math.random() * w,
        y: Math.random() * h,
        len: h * (heavy ? (0.008 + Math.random() * 0.02) : (0.01 + Math.random() * 0.016)),
        speed: heavy ? (900 + Math.random() * 700) : (180 + Math.random() * 200),
        alpha: heavy ? (0.14 + Math.random() * 0.36) : (0.1 + Math.random() * 0.22),
        width: heavy ? (0.9 + Math.random() * 0.7) : (0.8 + Math.random() * 0.5),
      });
    }

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
    };

    const tick = (now) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < drops.length; i += 1) {
        const d = drops[i];
        const g = ctx.createLinearGradient(d.x, d.y, d.x + 1.2, d.y + d.len);
        if (heavy) {
          g.addColorStop(0, "rgba(160,200,224,0)");
          g.addColorStop(0.45, `rgba(230,245,255,${d.alpha})`);
          g.addColorStop(1, "rgba(140,180,210,0)");
        } else {
          g.addColorStop(0, "rgba(139,111,212,0)");
          g.addColorStop(0.5, `rgba(174,160,230,${d.alpha})`);
          g.addColorStop(1, "rgba(174,194,224,0)");
        }
        ctx.strokeStyle = g;
        ctx.lineWidth = d.width;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + (heavy ? 1.2 : 2.2), d.y + d.len);
        ctx.stroke();
        d.y += d.speed * dt;
        if (d.y > h + d.len) {
          d.y = -d.len;
          d.x = Math.random() * w;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }

  function normalizePathname(pathname) {
    let p = pathname || "/";
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p || "/";
  }

  /** Home intro: play on direct/external/reload; skip when arriving from another page of the same site. */
  function shouldPlayHomeIntro(sitePrefix) {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "reload") return true;
    if (nav?.type === "back_forward") return false;

    const ref = document.referrer;
    if (!ref) return true;

    try {
      const refUrl = new URL(ref);
      if (refUrl.origin !== location.origin) return true;

      const p = normalizePathname(refUrl.pathname);
      const prefix = sitePrefix === "/" ? "" : String(sitePrefix || "").replace(/\/+$/, "");

      if (!prefix) {
        // Root site: treat /fuyuu and deferred creator paths as outside.
        if (
          p === "/fuyuu" ||
          p.startsWith("/fuyuu/") ||
          p.startsWith("/koharu") ||
          p.startsWith("/shiotsuki") ||
          p.startsWith("/tianhu") ||
          p.startsWith("/api")
        ) {
          return true;
        }
        return p === "/" || p === "/index.html";
      }

      if (p !== prefix && !p.startsWith(`${prefix}/`)) return true;
      return p === prefix || p === `${prefix}/index.html`;
    } catch {
      return true;
    }
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
  }

  function easeOutCubic(t) {
    return 1 - ((1 - t) ** 3);
  }

  function startIntroLiquid(canvas, src) {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return Promise.resolve(() => {});
    const heavy = document.body.classList.contains("heavy-rain");
    /* 正常约 2.1s；超时则跳过，避免手机端 canvas 尺寸为 0 时永远卡住 */
    const LIQUID_HARD_MS = 3200;
    const SIZE_WAIT_MS = 480;

    return new Promise((resolve) => {
      let settled = false;
      let raf = 0;
      let running = true;
      let hardTimer = 0;
      let cleanup = () => {};

      const finish = (stopFn) => {
        if (settled) return;
        settled = true;
        running = false;
        window.clearTimeout(hardTimer);
        window.cancelAnimationFrame(raf);
        try { cleanup(); } catch { /* ignore */ }
        cleanup = () => {};
        resolve(typeof stopFn === "function" ? stopFn : () => {});
      };

      hardTimer = window.setTimeout(() => finish(() => {}), LIQUID_HARD_MS);

      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        if (settled) return;
        const started = performance.now();
        const FILL_MS = 1550;
        const SETTLE_MS = 550;
        const mask = document.createElement("canvas");
        const mctx = mask.getContext("2d");
        if (!mctx) {
          finish(() => {});
          return;
        }

        // 多点有机绽放：错落生长，汇成整字
        const blooms = [
          { x: 0.08, y: 0.52, delay: 0.00, grow: 1.15, seed: 0.7 },
          { x: 0.18, y: 0.38, delay: 0.04, grow: 1.00, seed: 1.4 },
          { x: 0.27, y: 0.62, delay: 0.08, grow: 1.08, seed: 2.1 },
          { x: 0.36, y: 0.44, delay: 0.12, grow: 0.95, seed: 0.3 },
          { x: 0.46, y: 0.58, delay: 0.16, grow: 1.12, seed: 1.9 },
          { x: 0.55, y: 0.36, delay: 0.20, grow: 1.05, seed: 2.6 },
          { x: 0.64, y: 0.55, delay: 0.24, grow: 1.18, seed: 0.9 },
          { x: 0.74, y: 0.42, delay: 0.28, grow: 1.02, seed: 1.6 },
          { x: 0.84, y: 0.60, delay: 0.32, grow: 1.10, seed: 2.3 },
          { x: 0.92, y: 0.48, delay: 0.36, grow: 0.98, seed: 0.5 },
          { x: 0.22, y: 0.78, delay: 0.10, grow: 0.72, seed: 1.1 },
          { x: 0.68, y: 0.78, delay: 0.26, grow: 0.70, seed: 1.8 },
          { x: 0.50, y: 0.22, delay: 0.18, grow: 0.68, seed: 2.4 },
        ];

        const fallbackCssSize = () => {
          const parent = canvas.parentElement;
          const pr = parent?.getBoundingClientRect?.();
          let cssW = pr?.width || 0;
          let cssH = pr?.height || 0;
          if (cssW < 2) cssW = Math.min(window.innerWidth * 0.86, 576) || 280;
          if (cssH < 2) cssH = cssW * (440 / 1400);
          return { cssW, cssH };
        };

        const resize = () => {
          let rect = canvas.getBoundingClientRect();
          let cssW = rect.width;
          let cssH = rect.height;
          if (cssW < 2 || cssH < 2) {
            const fb = fallbackCssSize();
            cssW = fb.cssW;
            cssH = fb.cssH;
          }
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.max(1, Math.floor(cssW * dpr));
          const h = Math.max(1, Math.floor(cssH * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            mask.width = w;
            mask.height = h;
          }
        };

        const drawOrganicBlob = (target, cx, cy, radius, t, seed) => {
          if (radius < 0.8) return;
          target.beginPath();
          const steps = 56;
          for (let i = 0; i <= steps; i += 1) {
            const a = (i / steps) * Math.PI * 2;
            const n =
              Math.sin(a * 2.0 + t * 1.6 + seed) * 0.18 +
              Math.sin(a * 3.5 - t * 1.2 + seed * 1.7) * 0.12 +
              Math.sin(a * 5.0 + t * 2.1 + seed * 0.6) * 0.07 +
              Math.sin(a * 1.0 + t * 0.7 + seed * 2.2) * 0.1;
            const r = radius * (1 + n);
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r * (0.82 + 0.08 * Math.sin(seed + t));
            if (i === 0) target.moveTo(x, y);
            else target.lineTo(x, y);
          }
          target.closePath();
          target.fill();
        };

        const fillBloomMask = (target, level, t, w, h) => {
          const maxR = Math.hypot(w, h) * 0.42;
          blooms.forEach((b) => {
            const local = Math.max(0, Math.min(1, (level - b.delay) / Math.max(0.001, 1 - b.delay)));
            if (local <= 0) return;
            const grown = easeOutCubic(local);
            const radius = maxR * grown * b.grow * (0.22 + 0.78 * level);
            const cx = w * (b.x + Math.sin(t * 0.55 + b.seed) * 0.012 * (1 - level));
            const cy = h * (b.y + Math.cos(t * 0.65 + b.seed) * 0.018 * (1 - level));
            drawOrganicBlob(target, cx, cy, radius, t, b.seed);
          });

          if (level > 0.72) {
            const fin = easeOutCubic((level - 0.72) / 0.28);
            drawOrganicBlob(target, w * 0.5, h * 0.5, maxR * 0.95 * fin, t, 3.1);
            drawOrganicBlob(target, w * 0.3, h * 0.5, maxR * 0.7 * fin, t, 4.2);
            drawOrganicBlob(target, w * 0.7, h * 0.5, maxR * 0.7 * fin, t, 5.0);
          }
        };

        const drawWord = (target, w, h) => {
          if (!img.naturalWidth || !img.naturalHeight) return;
          const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          target.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        };

        /* 暴雨开幕：墨色字改白，深色底上才可读 */
        const paintInkGlyph = (target, w, h) => {
          drawWord(target, w, h);
          if (!heavy) return;
          target.save();
          target.globalCompositeOperation = "source-in";
          target.fillStyle = "#f5f8ff";
          target.fillRect(0, 0, w, h);
          target.restore();
        };

        const stop = () => {
          running = false;
          window.cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
        };

        const paint = (now) => {
          if (!running || settled) return;
          resize();
          const w = canvas.width;
          const h = canvas.height;
          const elapsed = now - started;

          /* 布局未就绪过久则放弃液体字，避免深色开场黑屏死锁 */
          if (w < 2 || h < 2) {
            if (elapsed > SIZE_WAIT_MS) {
              finish(stop);
              return;
            }
            raf = window.requestAnimationFrame(paint);
            return;
          }

          const fillRaw = Math.min(1, elapsed / FILL_MS);
          const level = easeInOutCubic(fillRaw);
          const settleRaw = elapsed <= FILL_MS
            ? 0
            : Math.min(1, (elapsed - FILL_MS) / SETTLE_MS);
          const settle = easeInOutCubic(settleRaw);
          const t = elapsed / 1000;

          if (settleRaw >= 1) {
            ctx.clearRect(0, 0, w, h);
            paintInkGlyph(ctx, w, h);
            finish(stop);
            return;
          }

          mctx.clearRect(0, 0, w, h);
          mctx.globalCompositeOperation = "source-over";
          mctx.fillStyle = "#fff";
          fillBloomMask(mctx, level, t, w, h);
          mctx.globalCompositeOperation = "destination-in";
          drawWord(mctx, w, h);

          ctx.clearRect(0, 0, w, h);

          const washAlpha = (1 - settle) * (0.75 + level * 0.25);
          if (washAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = washAlpha;
            ctx.drawImage(mask, 0, 0);
            ctx.globalCompositeOperation = "source-in";
            const u = settle;
            let grad;
            if (heavy) {
              grad = ctx.createLinearGradient(0, h * 0.2, w, h * 0.85);
              grad.addColorStop(0, `rgba(245, 250, 255, ${0.75 - 0.15 * u})`);
              grad.addColorStop(0.55, `rgba(200, 220, 245, ${0.85 - 0.1 * u})`);
              grad.addColorStop(1, `rgba(170, 195, 230, ${0.9 - 0.05 * u})`);
            } else {
              const r1 = Math.round(210 - 50 * u);
              const g1 = Math.round(195 - 70 * u);
              const b1 = Math.round(235 - 100 * u);
              const r2 = Math.round(115 - 70 * u);
              const g2 = Math.round(90 - 55 * u);
              const b2 = Math.round(175 - 100 * u);
              grad = ctx.createLinearGradient(0, h * 0.2, w, h * 0.85);
              grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0.5)`);
              grad.addColorStop(0.55, `rgba(${r2}, ${g2}, ${b2}, 0.78)`);
              grad.addColorStop(1, "rgba(26, 21, 32, 0.88)");
            }
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
          }

          ctx.save();
          ctx.globalAlpha = Math.min(1, 0.22 + level * 0.4 + settle * 0.55);
          paintInkGlyph(ctx, w, h);
          ctx.globalCompositeOperation = "destination-in";
          ctx.drawImage(mask, 0, 0);
          ctx.restore();

          raf = window.requestAnimationFrame(paint);
        };

        const onResize = () => {
          if (!running) return;
          resize();
        };

        resize();
        cleanup = () => {
          window.removeEventListener("resize", onResize);
        };
        window.addEventListener("resize", onResize, { passive: true });
        raf = window.requestAnimationFrame(paint);
      };
      img.onerror = () => finish(() => {});
      img.src = src;
    });
  }

  function applyRainTheme(heavy) {
    document.body.classList.toggle("heavy-rain", heavy);
    document.body.classList.toggle("light-rain", !heavy);
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.setAttribute("content", heavy ? "#243448" : "#f7f8fc");
  }

  function initHomeIntro() {
    const intro = document.getElementById("home-intro");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* ?storm 测试入口跳过开场，避免深色遮罩 + 重画布拖死主线程 */
    const play = !forceStormFromUrl() && shouldPlayHomeIntro("/");

    if (!intro || reduced || !play) {
      document.body.classList.add("home-ready");
      intro?.remove();
      return;
    }

    document.body.classList.add("home-intro-playing");
    const stopRain = startIntroRain(document.getElementById("intro-rain"));
    const HOLD_MS = 250;
    const OUT_MS = 650;
    const REVEAL_DELAY = 140;
    /* 液体字 + hold/out；超时强制收场，防止 ?storm 深色底黑屏 */
    const INTRO_HARD_MS = 4200;
    let finished = false;
    let stopLiquid = null;
    let hardTimer = 0;

    const finishIntro = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(hardTimer);
      intro.classList.add("is-done");
      window.setTimeout(() => {
        document.body.classList.add("home-ready");
      }, REVEAL_DELAY);
      window.setTimeout(() => {
        document.body.classList.remove("home-intro-playing");
        stopRain();
        try { stopLiquid?.(); } catch { /* ignore */ }
        intro.remove();
      }, OUT_MS);
    };

    hardTimer = window.setTimeout(finishIntro, INTRO_HARD_MS);

    startIntroLiquid(
      document.getElementById("intro-liquid"),
      "assets/images/script-en.png"
    ).then((stop) => {
      stopLiquid = stop;
      window.setTimeout(finishIntro, HOLD_MS);
    }).catch(() => {
      finishIntro();
    });
  }

  function initHome() {
    /* 开幕前先定雨模式，暴雨开场才能用冷蓝底+密雨丝 */
    const heavy = pickInitialHeavy();
    applyRainTheme(heavy);
    initHomeIntro();
    initCommon(heavy);
    initHero();
  }

  function initWorks() {
    const heavy = pickInitialHeavy();
    applyRainTheme(heavy);
    initCommon(heavy);
    renderGrid(document.getElementById("works-grid"), data().videos);
    refreshRainLedges();
    markPageReady();
  }

  function initLinks() {
    const heavy = pickInitialHeavy();
    applyRainTheme(heavy);
    initCommon(heavy);
    renderLinkCards(document.getElementById("link-cards"));
    refreshRainLedges();
    markPageReady();
  }

  return { initHome, initWorks, initLinks, data };
})();
