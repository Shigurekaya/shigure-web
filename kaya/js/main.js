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

  const HEAVY_RAIN_KEY = "kaya-heavy-rain";
  const SPLASH_SELECTORS = [
    ".site-bar",
    ".profile-avatar",
    ".intro-panel__body",
    ".home-card",
    ".work-card",
    ".link-card",
    ".page-head",
  ].join(",");

  function readHeavyRainPref() {
    try {
      return localStorage.getItem(HEAVY_RAIN_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeHeavyRainPref(on) {
    try {
      localStorage.setItem(HEAVY_RAIN_KEY, on ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }

  function initSiteRain(host) {
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

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "rain-toggle";
    toggle.id = "rain-toggle";
    toggle.innerHTML = `<span class="rain-toggle__dot" aria-hidden="true"></span><span class="rain-toggle__text">大雨</span>`;
    document.body.appendChild(toggle);

    let heavy = readHeavyRainPref();
    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let last = performance.now();
    let resizeTimer = 0;
    let ledgeTimer = 0;
    const FRAME_MS = 1000 / 30;
    const classic = [];
    let ledges = [];
    let heavyFx = null;

    const clampCount = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

    const makeClassic = () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      len: 7 + Math.random() * 12,
      speed: 150 + Math.random() * 170,
      alpha: 0.08 + Math.random() * 0.18,
      drift: 16 + Math.random() * 22,
    });

    const syncToggle = () => {
      toggle.setAttribute("aria-pressed", heavy ? "true" : "false");
      toggle.classList.toggle("is-on", heavy);
      toggle.title = heavy ? "关闭大雨特效" : "开启大雨特效（类小米天气）";
      document.body.classList.toggle("heavy-rain", heavy);
      fx.classList.toggle("is-active", heavy);
      const theme = document.querySelector('meta[name="theme-color"]');
      if (theme) theme.setAttribute("content", heavy ? "#121a28" : "#f7f8fc");
    };

    const rebuildClassic = () => {
      const n = clampCount(Math.round((w * h) / 15000), 43, 86);
      while (classic.length < n) classic.push(makeClassic());
      if (classic.length > n) classic.length = n;
    };

    const refreshLedges = () => {
      const nodes = document.querySelectorAll(SPLASH_SELECTORS);
      const next = [];
      const max = 32;
      for (let i = 0; i < nodes.length && next.length < max; i += 1) {
        const el = nodes[i];
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 36 || r.height < 16) continue;
        if (r.bottom < -20 || r.top > h + 20 || r.right < 0 || r.left > w) continue;
        const cs = getComputedStyle(el);
        next.push({
          x: r.left,
          y: r.top,
          w: r.width,
          radius: Math.min(22, parseFloat(cs.borderTopLeftRadius) || 14),
        });
      }
      ledges = next;
    };

    const ensureHeavyFx = () => {
      if (heavyFx) return heavyFx;
      if (!window.KayaHeavyRain?.attach) {
        console.warn("[kaya] KayaHeavyRain missing");
        return null;
      }
      heavyFx = window.KayaHeavyRain.attach(fx, {
        getLedges: () => ledges,
      });
      return heavyFx;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, w > 1200 ? 1.25 : 1.5);
      bgCanvas.width = Math.floor(w * dpr);
      bgCanvas.height = Math.floor(h * dpr);
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bgCtx.lineCap = "round";
      rebuildClassic();
      refreshLedges();
      heavyFx?.resize();
    };

    const drawClassic = (dt) => {
      bgCtx.clearRect(0, 0, w, h);
      bgCtx.strokeStyle = "rgba(107, 79, 184, 1)";
      bgCtx.lineWidth = 1;
      for (let i = 0; i < classic.length; i += 1) {
        const d = classic[i];
        bgCtx.globalAlpha = d.alpha;
        bgCtx.beginPath();
        bgCtx.moveTo(d.x, d.y);
        bgCtx.lineTo(d.x + d.drift * 0.04, d.y + d.len);
        bgCtx.stroke();
        d.y += d.speed * dt;
        d.x += d.drift * dt;
        if (d.y > h + 16) {
          d.y = -16;
          d.x = Math.random() * w;
        } else if (d.x > w + 12) {
          d.x = -8;
        }
      }
      bgCtx.globalAlpha = 1;
    };

    const tick = (now) => {
      if (!running || heavy) return;
      raf = window.requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < FRAME_MS) return;
      const dt = Math.min(0.05, elapsed / 1000);
      last = now;
      drawClassic(dt);
    };

    const setHeavy = (on) => {
      heavy = !!on;
      writeHeavyRainPref(heavy);
      syncToggle();
      if (heavy) {
        window.cancelAnimationFrame(raf);
        refreshLedges();
        const fxApi = ensureHeavyFx();
        fxApi?.start();
        bgCtx.clearRect(0, 0, w, h);
      } else {
        heavyFx?.stop();
        last = performance.now();
        if (running) raf = window.requestAnimationFrame(tick);
      }
    };

    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 120);
    };

    const onScroll = () => {
      window.clearTimeout(ledgeTimer);
      ledgeTimer = window.setTimeout(refreshLedges, 80);
    };

    const onVisibility = () => {
      const hidden = document.hidden;
      host.classList.toggle("is-paused", hidden);
      if (hidden) {
        running = false;
        window.cancelAnimationFrame(raf);
        heavyFx?.stop();
        return;
      }
      if (!running) {
        running = true;
        last = performance.now();
        if (heavy) ensureHeavyFx()?.start();
        else raf = window.requestAnimationFrame(tick);
      }
    };

    toggle.addEventListener("click", () => setHeavy(!heavy));

    syncToggle();
    resize();
    host.classList.toggle("is-paused", document.hidden);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    raf = window.requestAnimationFrame(tick);

    if (heavy) {
      ensureHeavyFx()?.start();
    }

    window.setTimeout(refreshLedges, 400);
    window.setTimeout(refreshLedges, 1200);
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

  function initCommon() {
    initNav();
    initSiteRain(document.querySelector(".site-bg"));
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
    const ctx = canvas?.getContext("2d");
    if (!ctx) return () => {};

    const drops = [];
    let raf = 0;
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (n) => {
      for (let i = 0; i < n; i += 1) {
        drops.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          len: 8 + Math.random() * 16,
          speed: 4.2 + Math.random() * 6.5,
          alpha: 0.12 + Math.random() * 0.28,
        });
      }
    };

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.strokeStyle = "rgba(107, 79, 184, 0.45)";
      ctx.lineWidth = 1;
      drops.forEach((d) => {
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 1.4, d.y + d.len);
        ctx.stroke();
        d.y += d.speed;
        d.x += 0.55;
        if (d.y > window.innerHeight + 20) {
          d.y = -20;
          d.x = Math.random() * window.innerWidth;
        }
      });
      ctx.globalAlpha = 1;
      raf = window.requestAnimationFrame(tick);
    };

    resize();
    spawn(90);
    window.addEventListener("resize", resize);
    tick();

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }

  function shouldPlayHomeIntro(sitePrefix) {
    const nav = performance.getEntriesByType("navigation")[0];
    if (nav?.type === "reload") return true;
    if (nav?.type === "back_forward") return false;

    const ref = document.referrer;
    if (!ref) return true;

    try {
      const refUrl = new URL(ref);
      if (refUrl.origin !== location.origin) return true;
      const p = refUrl.pathname;
      if (!p.includes(sitePrefix)) return true;
      const home = p.endsWith(sitePrefix) || p.endsWith(`${sitePrefix}index.html`);
      return home;
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

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        let raf = 0;
        let running = true;
        let settled = false;
        const started = performance.now();
        const FILL_MS = 1550;
        const SETTLE_MS = 550;
        const mask = document.createElement("canvas");
        const mctx = mask.getContext("2d");
        if (!mctx) {
          resolve(() => {});
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

        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.max(1, Math.floor(rect.width * dpr));
          const h = Math.max(1, Math.floor(rect.height * dpr));
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

          // 接近收束时用大团抹平空隙，避免留白
          if (level > 0.72) {
            const fin = easeOutCubic((level - 0.72) / 0.28);
            drawOrganicBlob(target, w * 0.5, h * 0.5, maxR * 0.95 * fin, t, 3.1);
            drawOrganicBlob(target, w * 0.3, h * 0.5, maxR * 0.7 * fin, t, 4.2);
            drawOrganicBlob(target, w * 0.7, h * 0.5, maxR * 0.7 * fin, t, 5.0);
          }
        };

        const drawWord = (target, w, h) => {
          const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          target.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        };

        const paint = (now) => {
          if (!running) return;
          resize();
          const w = canvas.width;
          const h = canvas.height;
          if (w < 2 || h < 2) {
            raf = window.requestAnimationFrame(paint);
            return;
          }

          const elapsed = now - started;
          const fillRaw = Math.min(1, elapsed / FILL_MS);
          const level = easeInOutCubic(fillRaw);
          const settleRaw = elapsed <= FILL_MS
            ? 0
            : Math.min(1, (elapsed - FILL_MS) / SETTLE_MS);
          const settle = easeInOutCubic(settleRaw);
          const t = elapsed / 1000;

          if (!settled && settleRaw >= 1) {
            settled = true;
            ctx.clearRect(0, 0, w, h);
            drawWord(ctx, w, h);
            resolve(() => {
              running = false;
              window.cancelAnimationFrame(raf);
              window.removeEventListener("resize", onResize);
            });
            return;
          }

          mctx.clearRect(0, 0, w, h);
          mctx.globalCompositeOperation = "source-over";
          mctx.fillStyle = "#fff";
          fillBloomMask(mctx, level, t, w, h);
          mctx.globalCompositeOperation = "destination-in";
          drawWord(mctx, w, h);

          ctx.clearRect(0, 0, w, h);

          // 紫色水洗：收束阶段淡出，颜色同步向墨色靠拢
          const washAlpha = (1 - settle) * (0.75 + level * 0.25);
          if (washAlpha > 0.02) {
            ctx.save();
            ctx.globalAlpha = washAlpha;
            ctx.drawImage(mask, 0, 0);
            ctx.globalCompositeOperation = "source-in";
            const u = settle;
            const r1 = Math.round(210 - 50 * u);
            const g1 = Math.round(195 - 70 * u);
            const b1 = Math.round(235 - 100 * u);
            const r2 = Math.round(115 - 70 * u);
            const g2 = Math.round(90 - 55 * u);
            const b2 = Math.round(175 - 100 * u);
            const grad = ctx.createLinearGradient(0, h * 0.2, w, h * 0.85);
            grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0.5)`);
            grad.addColorStop(0.55, `rgba(${r2}, ${g2}, ${b2}, 0.78)`);
            grad.addColorStop(1, "rgba(26, 21, 32, 0.88)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
          }

          // 墨色独立叠上（不依赖水洗），透明度平滑升到 1
          ctx.save();
          ctx.globalAlpha = Math.min(1, 0.22 + level * 0.4 + settle * 0.55);
          drawWord(ctx, w, h);
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
        window.addEventListener("resize", onResize, { passive: true });
        raf = window.requestAnimationFrame(paint);
      };
      img.onerror = () => resolve(() => {});
      img.src = src;
    });
  }

  function initHomeIntro() {
    const intro = document.getElementById("home-intro");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const play = shouldPlayHomeIntro("/kaya/");

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

    startIntroLiquid(
      document.getElementById("intro-liquid"),
      "assets/images/script-en.png"
    ).then((stopLiquid) => {
      window.setTimeout(() => {
        intro.classList.add("is-done");
        window.setTimeout(() => {
          document.body.classList.add("home-ready");
        }, REVEAL_DELAY);
        window.setTimeout(() => {
          document.body.classList.remove("home-intro-playing");
          stopRain();
          stopLiquid?.();
          intro.remove();
        }, OUT_MS);
      }, HOLD_MS);
    });
  }

  function initHome() {
    initHomeIntro();
    initCommon();
    initHero();
  }

  function initWorks() {
    initCommon();
    renderGrid(document.getElementById("works-grid"), data().videos);
    markPageReady();
  }

  function initLinks() {
    initCommon();
    renderLinkCards(document.getElementById("link-cards"));
    markPageReady();
  }

  return { initHome, initWorks, initLinks, data };
})();
