from pathlib import Path

p = Path(r"E:\网站\测试框架\shigure-web\kaya\js\main.js")
text = p.read_text(encoding="utf-8")
start = text.index("  function initSiteRain(host) {")
end = text.index("  function markPageReady()")

new = r'''  function initSiteRain(host) {
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
      bgCanvas.style.opacity = heavy ? "0" : "";
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

'''

p.write_text(text[:start] + new + text[end:], encoding="utf-8")
print("ok", p.stat().st_size)
