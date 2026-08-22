/**
 * 时雨榧 · 晴天特效
 *
 * 澄澈蓝天渐变 + 柔日（不刺眼），无云。
 * 入口：`?sunny` / `/sunny/`。
 */
(() => {
  const FRAME_MS = 1000 / 24;

  function isPhoneLike() {
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)
      || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) <= 920);
  }

  /**
   * @param {HTMLElement} host
   */
  function attach(host) {
    if (!host) return null;
    const phone = isPhoneLike();

    const canvas = document.createElement("canvas");
    canvas.className = "site-bg__sunny";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const haze = document.createElement("div");
    haze.className = "site-bg__sunny-haze";
    haze.setAttribute("aria-hidden", "true");
    host.appendChild(haze);

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let running = false;
    let raf = 0;
    let last = 0;
    let t = 0;

    const paintSky = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#2e6fa8");
      sky.addColorStop(0.18, "#4a8ec4");
      sky.addColorStop(0.42, "#72aed8");
      sky.addColorStop(0.65, "#a8cce8");
      sky.addColorStop(0.82, "#d4e8f4");
      sky.addColorStop(0.94, "#eef4fa");
      sky.addColorStop(1, "#f6f8fc");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      const zen = ctx.createRadialGradient(w * 0.5, -h * 0.08, 0, w * 0.5, h * 0.2, Math.max(w, h) * 0.85);
      zen.addColorStop(0, "rgba(20,70,130,0.28)");
      zen.addColorStop(0.55, "rgba(40,100,160,0.08)");
      zen.addColorStop(1, "rgba(40,100,160,0)");
      ctx.fillStyle = zen;
      ctx.fillRect(0, 0, w, h);

      const hor = ctx.createLinearGradient(0, h * 0.55, 0, h);
      hor.addColorStop(0, "rgba(255,255,255,0)");
      hor.addColorStop(0.5, "rgba(255,248,235,0.06)");
      hor.addColorStop(1, "rgba(255,252,248,0.18)");
      ctx.fillStyle = hor;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
    };

    const paintSun = () => {
      const sx = w * (phone ? 0.74 : 0.78);
      const sy = h * (phone ? 0.17 : 0.15);
      const sunR = Math.min(w, h) * (phone ? 0.032 : 0.038);
      const pulse = 0.94 + 0.06 * Math.sin(t * 0.35);

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      const far = ctx.createRadialGradient(sx, sy, sunR * 0.5, sx, sy, sunR * 14);
      far.addColorStop(0, `rgba(255,245,220,${0.18 * pulse})`);
      far.addColorStop(0.25, `rgba(255,238,200,${0.08 * pulse})`);
      far.addColorStop(0.55, "rgba(200,225,255,0.03)");
      far.addColorStop(1, "rgba(200,225,255,0)");
      ctx.fillStyle = far;
      ctx.beginPath();
      ctx.arc(sx, sy, sunR * 14, 0, Math.PI * 2);
      ctx.fill();

      const mid = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunR * 4.2);
      mid.addColorStop(0, `rgba(255,250,235,${0.32 * pulse})`);
      mid.addColorStop(0.5, `rgba(255,236,190,${0.1 * pulse})`);
      mid.addColorStop(1, "rgba(255,230,180,0)");
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.arc(sx, sy, sunR * 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunR * 1.35);
      core.addColorStop(0, `rgba(255,252,240,${0.88 * pulse})`);
      core.addColorStop(0.55, `rgba(255,242,210,${0.55 * pulse})`);
      core.addColorStop(0.85, `rgba(255,228,170,${0.15 * pulse})`);
      core.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(sx, sy, sunR * 1.35, 0, Math.PI * 2);
      ctx.fill();
    };

    const paintHaze = () => {
      const mist = ctx.createLinearGradient(0, h * 0.5, 0, h);
      mist.addColorStop(0, "rgba(255,255,255,0)");
      mist.addColorStop(0.45, "rgba(245,250,255,0.08)");
      mist.addColorStop(1, "rgba(255,255,255,0.22)");
      ctx.fillStyle = mist;
      ctx.fillRect(0, h * 0.5, w, h * 0.5);
    };

    const paint = (dt) => {
      t += dt;
      paintSky();
      paintSun();
      paintHaze();
    };

    const loop = (now) => {
      if (!running) return;
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
      dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.65);
      w = Math.max(1, Math.round(cssW));
      h = Math.max(1, Math.round(cssH));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(0);
    };

    return {
      start() {
        if (running) return;
        running = true;
        haze.classList.add("is-on");
        resize();
        last = performance.now();
        raf = window.requestAnimationFrame(loop);
      },
      stop() {
        running = false;
        window.cancelAnimationFrame(raf);
        raf = 0;
        haze.classList.remove("is-on");
      },
      resize,
      destroy() {
        this.stop();
        canvas.remove();
        haze.remove();
      },
    };
  }

  window.KayaSunnySky = { attach };
})();
