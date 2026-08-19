/**
 * 时雨榧个人站
 */
const Kaya = (() => {
  /* 官方品牌 SVG（fill 跟随 currentColor） */
  const ICONS = {
    bilibili: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.012-.01c.291-.291.638-.434 1.04-.434.4 0 .748.143 1.038.433l2.222 2.12h3.48L14.5 1.44c.29-.29.638-.433 1.038-.433.4 0 .748.143 1.039.433.25.249.373.551.373.907 0 .355-.124.657-.373.906zM5.333 7.24c-.732.022-1.341.27-1.832.748-.49.478-.741 1.074-.76 1.784v7.36c.02.71.27 1.306.76 1.784.49.478 1.1.726 1.832.748h13.334c.73-.022 1.34-.27 1.83-.748.49-.478.74-1.074.76-1.784v-7.36c-.02-.71-.27-1.306-.76-1.784-.49-.478-1.1-.726-1.83-.748zM8 11.107c.55 0 1 .45 1 1v1.333a1 1 0 0 1-2 0V12.107c0-.55.45-1 1-1m4.667-.667c.62 0 1.133.447 1.247 1.043l.622 3.287a1.28 1.28 0 0 1-1.244 1.523 1.28 1.28 0 0 1-1.222-.886l-.427-1.28-.427 1.28a1.28 1.28 0 0 1-1.222.886 1.28 1.28 0 0 1-1.244-1.523l.622-3.287A1.28 1.28 0 0 1 11.333 10.44zm4.666.667c.55 0 1 .45 1 1v1.333a1 1 0 1 1-2 0V12.107c0-.55.45-1 1-1"/></svg>`,
    youtube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    x: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.991ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>`,
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
         class="social-pill" title="${escapeHtml(link.title)}" aria-label="${escapeHtml(link.title)}">
        <span class="social-pill__icon">${ICONS[link.icon] || ""}</span>
      </a>
    `).join("");
  }

  function renderLinkCards(container) {
    if (!container) return;
    container.innerHTML = externalLinks().map((link) => `
      <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-card">
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

  function initCommon() {
    initNav();
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

    window.setTimeout(() => {
      document.body.classList.remove("home-intro-playing");
      document.body.classList.add("home-ready");
      intro.classList.add("is-done");
      stopRain();
      window.setTimeout(() => intro.remove(), 800);
    }, 2600);
  }

  function initHome() {
    initHomeIntro();
    initCommon();
    initHero();
  }

  function initWorks() {
    initCommon();
    renderGrid(document.getElementById("works-grid"), data().videos);
  }

  function initLinks() {
    initCommon();
    renderLinkCards(document.getElementById("link-cards"));
  }

  return { initHome, initWorks, initLinks, data };
})();
