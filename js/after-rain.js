/**
 * 时雨榧 · 雨后彩虹特效（写实向）
 *
 * 借鉴：krazydad HSL 柔边双虹 + zaur-world「破云光遇上 clearing」叙事
 *       + 本站 FBM 软云（大雨同族，低密度残云）。
 * 仅 URL / 会话强制：`?rainbow` / `/rainbow/`。
 */
(() => {
  const FRAME_MS = 1000 / 24;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function isPhoneLike() {
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)
      || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) <= 920);
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

  /** 雨后残云：略灰、破开留缝 */
  function bakeResidualClouds(cw, ch) {
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
        let d = fbm(nx * 2.6 + 0.4, ny * 3.8 + 1.2, 5);
        d += 0.25 * fbm(nx * 8 - 1.5, ny * 2.2 + 2.8, 3);
        /* 左侧破开：密度被压掉，露出阳光 */
        const breakGap = clamp(1 - Math.exp(-Math.pow((nx - 0.22) / 0.28, 2)), 0, 1);
        const envelope = 0.35 + 0.55 * Math.exp(-Math.pow((ny - 0.2) / 0.35, 2));
        let dens = clamp((d - 0.5) / 0.34, 0, 1) * envelope * (0.35 + 0.65 * breakGap);
        dens = dens * dens * (3 - 2 * dens);

        const cool = 0.88 + 0.08 * (1 - dens);
        const r = Math.round(210 * cool + 20);
        const g = Math.round(220 * cool + 18);
        const b = Math.round(235 * cool + 12);
        const a = Math.round(255 * dens * 0.62);
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

  /**
   * @param {HTMLElement} host
   */
  function attach(host) {
    if (!host) return null;
    const phone = isPhoneLike();

    const canvas = document.createElement("canvas");
    canvas.className = "site-bg__rainbow";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const mist = document.createElement("div");
    mist.className = "site-bg__after-mist";
    mist.setAttribute("aria-hidden", "true");
    host.appendChild(mist);

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return null;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let running = false;
    let raf = 0;
    let last = 0;
    let t = 0;
    /** @type {HTMLCanvasElement | null} */
    let cloudLayer = null;
    let bakeKey = "";
    /** @type {Array<{x:number,y:number,vy:number,len:number,a:number,wind:number}>} */
    let drips = [];

    const rebuildDrips = () => {
      drips = [];
      const n = phone ? 10 : 22;
      for (let i = 0; i < n; i += 1) {
        drips.push({
          x: rand(0.05, 0.95),
          y: rand(0.2, 1.05),
          vy: rand(22, 55),
          len: rand(5, 14),
          a: rand(0.035, 0.1),
          wind: rand(0.2, 0.8),
        });
      }
    };

    const bake = () => {
      const key = `${w}x${h}`;
      const sizeChanged = key !== bakeKey;
      if (!sizeChanged && cloudLayer) return;
      bakeKey = key;
      const scale = phone ? 3.0 : 2.35;
      const cw = Math.max(96, Math.floor(w / scale));
      const ch = Math.max(64, Math.floor(h / scale));
      cloudLayer = bakeResidualClouds(cw, ch);
      rebuildDrips();
    };

    const paintSky = () => {
      /* 雨后略灰的澄澈蓝，比晴天冷一点 */
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#4a7eae");
      sky.addColorStop(0.25, "#6a9ec8");
      sky.addColorStop(0.55, "#9bc0dc");
      sky.addColorStop(0.8, "#c8dcec");
      sky.addColorStop(1, "#e6eef6");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
    };

    const paintSunBreak = () => {
      /* 太阳在左上（彩虹在对面偏右）—— zaur 叙事 */
      const sx = w * 0.18;
      const sy = h * 0.14;
      const R = Math.min(w, h) * 0.55;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
      glow.addColorStop(0, "rgba(255,248,220,0.72)");
      glow.addColorStop(0.2, "rgba(255,236,180,0.32)");
      glow.addColorStop(0.5, "rgba(190,220,255,0.1)");
      glow.addColorStop(1, "rgba(180,210,240,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      if (!phone) {
        ctx.save();
        const sway = Math.sin(t * 0.09) * 0.02;
        ctx.translate(sx, sy);
        ctx.rotate(0.35 + sway);
        const beam = ctx.createLinearGradient(0, 0, w * 0.55, h * 0.5);
        beam.addColorStop(0, "rgba(255,245,210,0.2)");
        beam.addColorStop(0.4, "rgba(255,235,190,0.06)");
        beam.addColorStop(1, "rgba(255,235,190,0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(0, 8);
        ctx.lineTo(w * 0.5, h * 0.55);
        ctx.lineTo(w * 0.42, h * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      const coreR = Math.min(w, h) * 0.022;
      const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR * 2.2);
      core.addColorStop(0, "rgba(255,252,240,0.95)");
      core.addColorStop(0.5, "rgba(255,230,150,0.45)");
      core.addColorStop(1, "rgba(255,220,120,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(sx, sy, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();
    };

    /**
     * krazydad 式：HSL 细带 + 两端 alpha 衰减 + screen
     * @param {number} cx
     * @param {number} cy
     * @param {number} rOuter
     * @param {number} bandW
     * @param {number} alphaMul
     * @param {boolean} reverse 副虹色序相反
     */
    const paintBow = (cx, cy, rOuter, bandW, alphaMul, reverse) => {
      const bands = phone ? 28 : 48;
      const a0 = Math.PI * 1.06;
      const a1 = Math.PI * 1.94;
      const breath = 0.88 + 0.1 * Math.sin(t * 0.22);

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "butt";

      for (let i = 0; i < bands; i += 1) {
        const u = i / (bands - 1);
        const hue = reverse ? (280 - u * 260) : (u * 260);
        const radius = rOuter - u * bandW;
        /* 虹带中间更亮，内外缘更淡 → 柔边雾虹 */
        const edge = Math.sin(u * Math.PI);
        const alpha = alphaMul * breath * (0.22 + 0.55 * edge * edge);

        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2, radius), a0, a1);
        ctx.strokeStyle = `hsla(${hue}, 78%, ${reverse ? 62 : 58}%, ${alpha})`;
        ctx.lineWidth = (bandW / bands) * 1.35;
        ctx.stroke();
      }

      /* 内侧极淡白晕 */
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, rOuter - bandW - bandW * 0.08), a0 + 0.04, a1 - 0.04);
      ctx.strokeStyle = `rgba(255,255,255,${0.06 * alphaMul * breath})`;
      ctx.lineWidth = bandW * 0.12;
      ctx.stroke();
      ctx.restore();
    };

    const paintRainbow = () => {
      const cx = w * 0.58;
      const cy = h * (phone ? 1.08 : 1.14);
      const r0 = Math.min(w * 0.78, h * 1.05);
      const band = Math.max(14, Math.min(w, h) * (phone ? 0.055 : 0.07));

      paintBow(cx, cy, r0, band, phone ? 0.85 : 1, false);

      /* 副虹：更淡、更外、色序反 */
      if (!phone) {
        const r2 = r0 + band * 1.35;
        paintBow(cx, cy, r2, band * 0.72, 0.28, true);
      }
    };

    const paintClouds = () => {
      if (!cloudLayer) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const drift = (t * 5) % (w * 0.8);
      ctx.globalAlpha = phone ? 0.55 : 0.68;
      ctx.drawImage(cloudLayer, -w * 0.08 - drift * 0.06, -h * 0.02, w * 1.15, h * 0.62);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(cloudLayer, w * 0.35 + drift * 0.04, h * 0.05, w * 0.75, h * 0.45);
      ctx.globalAlpha = 1;
    };

    const paintDrips = (dt) => {
      ctx.lineWidth = 1;
      for (const d of drips) {
        d.y += (d.vy / Math.max(h, 1)) * dt;
        d.x += (d.wind * 8 * dt) / Math.max(w, 1);
        if (d.y > 1.12) {
          d.y = rand(-0.08, 0.15);
          d.x = rand(0.05, 0.95);
        }
        const x = d.x * w;
        const y = d.y * h;
        ctx.strokeStyle = `rgba(200,218,235,${d.a})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + d.wind * 1.2, y + d.len);
        ctx.stroke();
      }
    };

    const paintWet = () => {
      const wet = ctx.createLinearGradient(0, h * 0.62, 0, h);
      wet.addColorStop(0, "rgba(140,170,200,0)");
      wet.addColorStop(0.5, "rgba(120,150,180,0.08)");
      wet.addColorStop(1, "rgba(90,120,150,0.18)");
      ctx.fillStyle = wet;
      ctx.fillRect(0, h * 0.62, w, h * 0.38);

      /* 空气湿雾 */
      const fog = ctx.createRadialGradient(w * 0.5, h * 0.95, 0, w * 0.5, h, w * 0.55);
      fog.addColorStop(0, "rgba(200,220,235,0.16)");
      fog.addColorStop(1, "rgba(200,220,235,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
    };

    const paint = (dt) => {
      t += dt;
      paintSky();
      paintSunBreak();
      paintClouds();
      paintRainbow();
      paintDrips(dt);
      paintWet();
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
      dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.2 : 1.5);
      w = Math.max(1, Math.round(cssW));
      h = Math.max(1, Math.round(cssH));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bake();
      paint(0);
    };

    return {
      start() {
        if (running) return;
        running = true;
        mist.classList.add("is-on");
        resize();
        last = performance.now();
        raf = window.requestAnimationFrame(loop);
      },
      stop() {
        running = false;
        window.cancelAnimationFrame(raf);
        raf = 0;
        mist.classList.remove("is-on");
      },
      resize,
      destroy() {
        this.stop();
        canvas.remove();
        mist.remove();
      },
    };
  }

  window.KayaAfterRain = { attach };
})();
