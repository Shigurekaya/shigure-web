/**
 * 时雨榧 · 晴天 + 彩虹（融合）
 *
 * 澄澈蓝天 + FBM 薄卷云 + 参考虹弧贴图（黑底 screen 屏混，与参考图一致）。
 * 入口：`?rain=sunny` / `?sunny` / `/sunny/`；彩虹同视觉 `?rainbow` / `/rainbow/`。
 */
(() => {
  const FRAME_MS = 1000 / 24;
  const RAINBOW_TEX = "assets/images/rainbow-glow.png";

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function isPhoneLike() {
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)
      || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) <= 920);
  }

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  function hash(ix, iy) {
    let n = ix * 374761393 + iy * 668265263;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function vnoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = hash(x0, y0);
    const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1);
    const d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  function fbm(x, y, oct = 5) {
    let a = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < oct; o += 1) {
      a += amp * vnoise(x * f, y * f);
      amp *= 0.5;
      f *= 2.03;
    }
    return a;
  }

  /** 薄卷云：亮白丝缕 */
  function bakeWispyClouds(cw, ch) {
    const off = document.createElement("canvas");
    off.width = cw;
    off.height = ch;
    const ox = off.getContext("2d");
    if (!ox) return off;
    const img = ox.createImageData(cw, ch);
    const data = img.data;

    for (let y = 0; y < ch; y += 1) {
      const ny = y / ch;
      for (let x = 0; x < cw; x += 1) {
        const nx = x / cw;
        let d = fbm(nx * 3.4 + 0.2, ny * 5.6 + 0.6, 5);
        d += 0.2 * fbm(nx * 9.5 - 1.0, ny * 3.0 + 1.4, 3);
        const envelope = 0.12 + 0.58 * Math.exp(-Math.pow((ny - 0.24) / 0.4, 2));
        let dens = clamp((d - 0.56) / 0.26, 0, 1) * envelope;
        dens = dens * dens * (3 - 2 * dens);

        const bright = clamp(1 - ny * 0.8, 0.6, 1);
        const r = Math.round(lerp(225, 255, bright));
        const g = Math.round(lerp(235, 253, bright));
        const b = Math.round(lerp(245, 255, bright));
        const a = Math.round(255 * dens * 0.48);
        const i = (y * cw + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    ox.putImageData(img, 0, 0);
    return off;
  }

  /** 参考虹弧贴图（黑底 PNG，screen 合成） */
  let rainbowTex = null;
  let rainbowTexReady = false;
  let rainbowTexLoading = false;

  function loadRainbowTex(onReady) {
    if (rainbowTexReady) {
      onReady?.();
      return;
    }
    if (rainbowTexLoading) return;
    rainbowTexLoading = true;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      rainbowTex = img;
      rainbowTexReady = true;
      rainbowTexLoading = false;
      onReady?.();
    };
    img.onerror = () => {
      rainbowTexLoading = false;
      console.warn("[kaya] rainbow texture missing:", RAINBOW_TEX);
    };
    img.src = RAINBOW_TEX;
  }

  /** 参考图构图：左下起弧 → 顶右峰 → 右侧出屏；手机略放大 */
  function layoutRainbowDraw(w, h, phone) {
    const padX = w * (phone ? 0.04 : 0.02);
    const padY = h * (phone ? 0.03 : 0.01);
    const scale = phone ? 1.06 : 1.02;
    const drawW = (w + padX * 2) * scale;
    const drawH = (h + padY * 2) * scale;
    return {
      x: -(padX + (drawW - w) * 0.5),
      y: -(padY + (drawH - h) * 0.42),
      w: drawW,
      h: drawH,
    };
  }

  function paintSoftRainbow(ctx, w, h, phone, breath, rainbowBuf) {
    if (!rainbowBuf || !rainbowTexReady || !rainbowTex) return;
    const rctx = rainbowBuf.getContext("2d");
    if (!rctx) return;

    const box = layoutRainbowDraw(w, h, phone);
    rctx.clearRect(0, 0, w, h);
    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = "high";
    rctx.drawImage(rainbowTex, box.x, box.y, box.w, box.h);

    const drawBloom = (blurPx, alpha) => {
      ctx.save();
      ctx.filter = `blur(${blurPx}px)`;
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = alpha * breath;
      ctx.drawImage(rainbowBuf, 0, 0, w, h);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    drawBloom(18, 0.38);
    drawBloom(6, 0.52);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.9 * breath;
    ctx.drawImage(rainbowBuf, 0, 0, w, h);
    ctx.restore();
  }

  /**
   * @param {HTMLElement} host
   */
  function attach(host) {
    if (!host) return null;
    const phone = isPhoneLike();
    const reduced = prefersReducedMotion();

    const canvas = document.createElement("canvas");
    canvas.className = "site-bg__sunny";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const haze = document.createElement("div");
    haze.className = "site-bg__sunny-haze";
    haze.setAttribute("aria-hidden", "true");
    host.appendChild(haze);

    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return null;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let running = false;
    let raf = 0;
    let last = 0;
    let t = 0;
    let paused = false;
    let cloudLayer = null;
    let bakeKey = "";
    /** @type {HTMLCanvasElement | null} */
    let skyBuf = null;
    /** @type {HTMLCanvasElement | null} */
    let rainbowBuf = null;
    let sunPulse = 1;

    host.classList.add("has-sunny-css");

    const bakeSky = () => {
      if (!skyBuf) return;
      const skyCtx = skyBuf.getContext("2d");
      if (!skyCtx) return;

      const g = skyCtx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#1e6cb8");
      g.addColorStop(0.15, "#2e82cc");
      g.addColorStop(0.35, "#52a0dc");
      g.addColorStop(0.55, "#7abce8");
      g.addColorStop(0.72, "#a8d4f0");
      g.addColorStop(0.88, "#d0eaf8");
      g.addColorStop(1, "#eef6fc");
      skyCtx.fillStyle = g;
      skyCtx.fillRect(0, 0, w, h);

      const zen = skyCtx.createRadialGradient(w * 0.5, -h * 0.05, 0, w * 0.5, h * 0.16, Math.max(w, h) * 0.85);
      zen.addColorStop(0, "rgba(25,95,175,0.28)");
      zen.addColorStop(0.55, "rgba(45,120,190,0.08)");
      zen.addColorStop(1, "rgba(45,120,190,0)");
      skyCtx.fillStyle = zen;
      skyCtx.fillRect(0, 0, w, h);

      const warm = skyCtx.createRadialGradient(w * 0.92, h * 0.88, 0, w * 0.85, h * 0.75, w * 0.55);
      warm.addColorStop(0, "rgba(255,240,210,0.18)");
      warm.addColorStop(0.45, "rgba(255,248,235,0.08)");
      warm.addColorStop(1, "rgba(255,248,235,0)");
      skyCtx.fillStyle = warm;
      skyCtx.fillRect(0, 0, w, h);

      const hor = skyCtx.createLinearGradient(0, h * 0.5, 0, h);
      hor.addColorStop(0, "rgba(255,255,255,0)");
      hor.addColorStop(0.6, "rgba(255,252,245,0.1)");
      hor.addColorStop(1, "rgba(255,252,248,0.22)");
      skyCtx.fillStyle = hor;
      skyCtx.fillRect(0, h * 0.5, w, h * 0.5);
    };

    const bakeClouds = () => {
      const key = `${w}x${h}`;
      if (key === bakeKey && cloudLayer) return;
      bakeKey = key;
      const scale = phone ? 2.4 : 1.8;
      const cw = Math.max(96, Math.floor(w / scale));
      const ch = Math.max(64, Math.floor(h / scale));
      cloudLayer = bakeWispyClouds(cw, ch);
    };

    /** @param {"back"|"front"} layer */
    const paintClouds = (layer) => {
      if (!cloudLayer) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const drift = (t * 2.2) % (w * 0.9);

      ctx.save();
      if (layer === "back") {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = phone ? 0.42 : 0.48;
        ctx.drawImage(cloudLayer, -w * 0.05 - drift * 0.035, -h * 0.02, w * 1.1, h * 0.5);
        ctx.globalAlpha = 0.3;
        ctx.drawImage(cloudLayer, w * 0.18 + drift * 0.025, h * 0.06, w * 0.85, h * 0.34);
      } else {
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = phone ? 0.28 : 0.32;
        ctx.drawImage(cloudLayer, w * 0.08 + drift * 0.02, h * 0.08, w * 0.92, h * 0.42);
        ctx.globalAlpha = 0.22;
        ctx.drawImage(cloudLayer, -w * 0.08 - drift * 0.018, h * 0.14, w * 0.88, h * 0.36);
        ctx.globalAlpha = 0.16;
        ctx.drawImage(cloudLayer, w * 0.35 + drift * 0.015, -h * 0.01, w * 0.7, h * 0.28);
      }
      ctx.restore();
    };

    const paint = (dt) => {
      t += dt;
      sunPulse = reduced ? 1 : 0.94 + 0.06 * Math.sin(t * 0.32);
      const breath = 0.92 + 0.06 * Math.sin(t * 0.14);

      if (skyBuf) {
        ctx.drawImage(skyBuf, 0, 0, w, h);
      }

      paintClouds("back");
      paintSoftRainbow(ctx, w, h, phone, breath, rainbowBuf);
      paintClouds("front");

      const sx = w * (phone ? 0.88 : 0.9);
      const sy = h * (phone ? 0.14 : 0.12);
      const sunR = Math.min(w, h) * (phone ? 0.32 : 0.36);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunR);
      sun.addColorStop(0, `rgba(255,248,225,${0.16 * sunPulse})`);
      sun.addColorStop(0.3, `rgba(255,238,195,${0.07 * sunPulse})`);
      sun.addColorStop(0.65, "rgba(255,225,170,0.02)");
      sun.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(sx - sunR, sy - sunR, sunR * 2, sunR * 2);
      ctx.restore();
    };

    const loop = (now) => {
      if (!running || paused || reduced) return;
      raf = window.requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      paint(dt);
    };

    const resize = () => {
      let cssW = window.innerWidth;
      let cssH = window.innerHeight;
      if (window.visualViewport) {
        cssW = Math.round(window.visualViewport.width);
        cssH = Math.round(window.visualViewport.height);
      }
      const weak = window.KayaPerfGovernor?.isWeakGpu?.() ?? false;
      const cap = phone ? 1.25 : (weak ? 1.2 : 1.65);
      dpr = Math.min(window.devicePixelRatio || 1, cap);
      w = Math.max(1, Math.round(cssW));
      h = Math.max(1, Math.round(cssH));
      const cw = Math.max(1, Math.round(w * dpr));
      const ch = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!skyBuf) skyBuf = document.createElement("canvas");
      skyBuf.width = w;
      skyBuf.height = h;
      if (!rainbowBuf) rainbowBuf = document.createElement("canvas");
      rainbowBuf.width = w;
      rainbowBuf.height = h;

      bakeSky();
      bakeClouds();
      paint(0);
    };

    const onVisibility = () => {
      if (document.hidden) {
        paused = true;
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (paused && running) {
        paused = false;
        last = performance.now();
        if (!reduced) raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    window.__KayaSunnyStats = () => ({
      frameMs: FRAME_MS,
      static: reduced,
      dpr,
      w,
      h,
      rainbow: rainbowTexReady,
      weakGpu: window.KayaPerfGovernor?.isWeakGpu?.() ?? false,
    });

    return {
      start() {
        if (running) return;
        running = true;
        haze.classList.add("is-on");
        resize();
        loadRainbowTex(() => {
          if (running) paint(0);
        });
        last = performance.now();
        if (!reduced) raf = window.requestAnimationFrame(loop);
      },
      stop() {
        running = false;
        paused = false;
        cancelAnimationFrame(raf);
        raf = 0;
        haze.classList.remove("is-on");
      },
      resize,
      destroy() {
        document.removeEventListener("visibilitychange", onVisibility);
        this.stop();
        host.classList.remove("has-sunny-css");
        canvas.remove();
        haze.remove();
        delete window.__KayaSunnyStats;
      },
    };
  }

  window.KayaSunnySky = { attach };
})();
