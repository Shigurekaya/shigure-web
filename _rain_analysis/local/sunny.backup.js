/**
 * 时雨榧 · 晴天特效
 *
 * 澄澈蓝天渐变 + 柔日（不刺眼），无云。
 * 入口：`?rain=sunny` / `?sunny` / `/sunny/`。
 *
 * 性能：天空/雾为静态离屏烘焙；太阳微光用极低频局部刷新（或 prefers-reduced-motion 时完全静态）。
 */
(() => {
  const SUN_FPS_MS = 1000 / 12;

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
    /** @type {HTMLCanvasElement | null} */
    let skyBuf = null;
    /** @type {CanvasRenderingContext2D | null} */
    let skyCtx = null;
    /** @type {HTMLCanvasElement | null} */
    let sunBuf = null;
    /** @type {CanvasRenderingContext2D | null} */
    let sunCtx = null;
    let sunSx = 0;
    let sunSy = 0;
    let sunR = 0;
    let sunKey = -1;
    let paused = false;

    const ensureBuf = (buf, cw, ch) => {
      if (!buf) {
        buf = document.createElement("canvas");
      }
      if (buf.width !== cw || buf.height !== ch) {
        buf.width = cw;
        buf.height = ch;
      }
      return buf;
    };

    const bakeSky = () => {
      if (!skyCtx || w < 2 || h < 2) return;
      const g = skyCtx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#2e6fa8");
      g.addColorStop(0.18, "#4a8ec4");
      g.addColorStop(0.42, "#72aed8");
      g.addColorStop(0.65, "#a8cce8");
      g.addColorStop(0.82, "#d4e8f4");
      g.addColorStop(0.94, "#eef4fa");
      g.addColorStop(1, "#f6f8fc");
      skyCtx.fillStyle = g;
      skyCtx.fillRect(0, 0, w, h);

      const zen = skyCtx.createRadialGradient(w * 0.5, -h * 0.08, 0, w * 0.5, h * 0.2, Math.max(w, h) * 0.85);
      zen.addColorStop(0, "rgba(20,70,130,0.28)");
      zen.addColorStop(0.55, "rgba(40,100,160,0.08)");
      zen.addColorStop(1, "rgba(40,100,160,0)");
      skyCtx.fillStyle = zen;
      skyCtx.fillRect(0, 0, w, h);

      const hor = skyCtx.createLinearGradient(0, h * 0.55, 0, h);
      hor.addColorStop(0, "rgba(255,255,255,0)");
      hor.addColorStop(0.5, "rgba(255,248,235,0.06)");
      hor.addColorStop(1, "rgba(255,252,248,0.18)");
      skyCtx.fillStyle = hor;
      skyCtx.fillRect(0, h * 0.55, w, h * 0.45);

      const mist = skyCtx.createLinearGradient(0, h * 0.5, 0, h);
      mist.addColorStop(0, "rgba(255,255,255,0)");
      mist.addColorStop(0.45, "rgba(245,250,255,0.08)");
      mist.addColorStop(1, "rgba(255,255,255,0.22)");
      skyCtx.fillStyle = mist;
      skyCtx.fillRect(0, h * 0.5, w, h * 0.5);
    };

    const bakeSun = (pulse) => {
      if (!sunCtx || sunR < 1) return;
      sunCtx.clearRect(0, 0, w, h);
      const sx = sunSx;
      const sy = sunSy;

      sunCtx.save();
      sunCtx.globalCompositeOperation = "screen";

      const far = sunCtx.createRadialGradient(sx, sy, sunR * 0.5, sx, sy, sunR * 14);
      far.addColorStop(0, `rgba(255,245,220,${0.18 * pulse})`);
      far.addColorStop(0.25, `rgba(255,238,200,${0.08 * pulse})`);
      far.addColorStop(0.55, "rgba(200,225,255,0.03)");
      far.addColorStop(1, "rgba(200,225,255,0)");
      sunCtx.fillStyle = far;
      sunCtx.beginPath();
      sunCtx.arc(sx, sy, sunR * 14, 0, Math.PI * 2);
      sunCtx.fill();

      const mid = sunCtx.createRadialGradient(sx, sy, 0, sx, sy, sunR * 4.2);
      mid.addColorStop(0, `rgba(255,250,235,${0.32 * pulse})`);
      mid.addColorStop(0.5, `rgba(255,236,190,${0.1 * pulse})`);
      mid.addColorStop(1, "rgba(255,230,180,0)");
      sunCtx.fillStyle = mid;
      sunCtx.beginPath();
      sunCtx.arc(sx, sy, sunR * 4.2, 0, Math.PI * 2);
      sunCtx.fill();
      sunCtx.restore();

      const core = sunCtx.createRadialGradient(sx, sy, 0, sx, sy, sunR * 1.35);
      core.addColorStop(0, `rgba(255,252,240,${0.88 * pulse})`);
      core.addColorStop(0.55, `rgba(255,242,210,${0.55 * pulse})`);
      core.addColorStop(0.85, `rgba(255,228,170,${0.15 * pulse})`);
      core.addColorStop(1, "rgba(255,220,150,0)");
      sunCtx.fillStyle = core;
      sunCtx.beginPath();
      sunCtx.arc(sx, sy, sunR * 1.35, 0, Math.PI * 2);
      sunCtx.fill();
    };

    const blit = (pulse) => {
      if (!skyBuf || !sunBuf) return;
      const key = Math.round(pulse * 32);
      if (key !== sunKey) {
        sunKey = key;
        bakeSun(key / 32);
      }
      ctx.drawImage(skyBuf, 0, 0, w, h);
      ctx.drawImage(sunBuf, 0, 0, w, h);
    };

    const rebuild = () => {
      sunSx = w * (phone ? 0.74 : 0.78);
      sunSy = h * (phone ? 0.17 : 0.15);
      sunR = Math.min(w, h) * (phone ? 0.032 : 0.038);
      skyBuf = ensureBuf(skyBuf, w, h);
      sunBuf = ensureBuf(sunBuf, w, h);
      skyCtx = skyBuf.getContext("2d");
      sunCtx = sunBuf.getContext("2d");
      sunKey = -1;
      bakeSky();
      const pulse = reduced ? 1 : 0.97;
      blit(pulse);
    };

    const loop = (now) => {
      if (!running || paused || reduced) return;
      raf = window.requestAnimationFrame(loop);
      if (now - last < SUN_FPS_MS) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      blit(0.94 + 0.06 * Math.sin(t * 0.35));
    };

    const resize = () => {
      let cssW = window.innerWidth;
      let cssH = window.innerHeight;
      if (window.visualViewport) {
        cssW = Math.round(window.visualViewport.width);
        cssH = Math.round(window.visualViewport.height);
      }
      const weak = window.KayaPerfGovernor?.isWeakGpu?.() ?? false;
      const cap = phone ? 1.25 : (weak ? 1.15 : 1.65);
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
      rebuild();
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

    let lastFrameMs = 0;
    window.__KayaSunnyStats = () => ({
      frameMs: lastFrameMs,
      static: reduced,
      dpr,
      w,
      h,
    });

    return {
      start() {
        if (running) return;
        running = true;
        haze.classList.add("is-on");
        resize();
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
        canvas.remove();
        haze.remove();
        delete window.__KayaSunnyStats;
      },
    };
  }

  window.KayaSunnySky = { attach };
})();
