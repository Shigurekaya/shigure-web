/** Gal Quiz 背景浮游光点 — 与 fuyuu/js/fy-app.js startIntroFloat 同款 */
(() => {
  const MOBILE_MAX = 768;
  /* 与浮游片头 RGB 色差呼应：粉 / 青 / 琥珀 / 紫 / 薄荷 */
  const PALETTE = [
    [214, 69, 106],
    [78, 156, 200],
    [232, 168, 72],
    [148, 112, 214],
    [72, 186, 158],
  ];

  let stopFn = null;

  function isMobile() {
    return window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;
  }

  function motionEnabled() {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function startFloat(canvas) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {};

    const dotCount = () => (isMobile() ? 44 : 88);
    const dots = [];
    let raf = 0;
    let stopped = false;
    let paused = document.hidden;
    let t0 = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const columnCount = () => {
      const w = window.innerWidth;
      const h = window.innerHeight || 1;
      const minCols = isMobile() ? 6 : 8;
      return Math.max(minCols, Math.round(Math.sqrt(dotCount() * (w / h))));
    };

    const pickX = (col, cols) => {
      const cellW = window.innerWidth / cols;
      return (col + 0.12 + Math.random() * 0.76) * cellW;
    };

    const makeDot = (opts = {}) => {
      const [r, g, b] = PALETTE[(Math.random() * PALETTE.length) | 0];
      const glow = Math.random() < 0.42;
      const cols = columnCount();
      const col = opts.col ?? ((Math.random() * cols) | 0);
      const x = opts.x ?? pickX(col, cols);
      const y = opts.y ?? (
        opts.fromBottom
          ? window.innerHeight + 8 + Math.random() * 40
          : Math.random() * window.innerHeight
      );
      return {
        x,
        y,
        r: glow ? 1.4 + Math.random() * 2.8 : 0.55 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * (glow ? 0.32 : 0.5),
        vy: -(glow ? 0.22 : 0.35) - Math.random() * (glow ? 0.55 : 0.9),
        alpha: glow ? 0.35 + Math.random() * 0.45 : 0.16 + Math.random() * 0.35,
        rgb: [r, g, b],
        glow,
        phase: Math.random() * Math.PI * 2,
        pulse: 0.6 + Math.random() * 1.4,
      };
    };

    const spawnEven = (n) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cols = columnCount();
      const rows = Math.ceil(n / cols);
      const cellW = w / cols;
      const cellH = h / rows;
      for (let i = 0; i < n; i += 1) {
        const row = (i / cols) | 0;
        const col = i % cols;
        dots.push(makeDot({
          x: (col + 0.12 + Math.random() * 0.76) * cellW,
          y: (row + 0.12 + Math.random() * 0.76) * cellH,
        }));
      }
    };

    const respawnDot = (d) => {
      const cols = columnCount();
      const col = (Math.random() * cols) | 0;
      Object.assign(d, makeDot({ fromBottom: true, col, x: pickX(col, cols) }));
    };

    const tick = (now) => {
      if (stopped || paused) return;
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      dots.forEach((d) => {
        const breathe = 0.72 + 0.28 * Math.sin(t * d.pulse + d.phase);
        const a = d.alpha * breathe;
        const [cr, cg, cb] = d.rgb;

        if (d.glow) {
          const glowR = d.r * (3.2 + breathe);
          const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, glowR);
          grad.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 0.85})`);
          grad.addColorStop(0.35, `rgba(${cr},${cg},${cb},${a * 0.28})`);
          grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.beginPath();
          ctx.fillStyle = grad;
          ctx.arc(d.x, d.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${a * (d.glow ? 0.95 : 0.55)})`;
        ctx.arc(d.x, d.y, d.r * (d.glow ? 0.55 + 0.2 * breathe : 1), 0, Math.PI * 2);
        ctx.fill();

        d.x += d.vx + Math.sin(t * 0.7 + d.phase) * 0.08;
        d.y += d.vy;
        if (d.y < -12) respawnDot(d);
        if (d.x < -12) d.x = window.innerWidth + 12;
        if (d.x > window.innerWidth + 12) d.x = -12;
      });
      raf = window.requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (stopped) return;
      paused = document.hidden;
      if (paused) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else {
        t0 = performance.now();
        raf = window.requestAnimationFrame(tick);
      }
    };

    const syncDots = () => {
      const target = dotCount();
      if (dots.length === target) return;
      dots.length = 0;
      spawnEven(target);
    };

    let floatResizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(floatResizeTimer);
      floatResizeTimer = window.setTimeout(() => {
        resize();
        syncDots();
      }, 120);
    };

    resize();
    spawnEven(dotCount());
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    if (!paused) raf = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(floatResizeTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  function init() {
    if (!motionEnabled()) return;
    const canvas = document.getElementById("quiz-bg-float");
    if (!canvas || stopFn) return;
    stopFn = startFloat(canvas);
  }

  window.KayaQuizFloat = { init };
})();
