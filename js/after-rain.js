/**
 * 时雨榧 · 雨后彩虹特效
 *
 * 无太阳 · 澄澈冷蓝天空 · 不对称放大虹弧 · 残云 · 地面反光。
 * 入口：`?rainbow` / `/rainbow/`。
 */
(() => {
  const FRAME_MS = 1000 / 24;

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

  /** 雨后残云：顶暗边亮，中部留虹带空隙 */
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
        let d = fbm(nx * 2.4 + 0.5, ny * 3.6 + 1.0, 5);
        d += 0.22 * fbm(nx * 7.5 - 1.2, ny * 2.4 + 2.5, 3);
        /* 虹带上方留晴空：中部偏上压低云量 */
        const rainbowGap = 1 - 0.55 * Math.exp(-Math.pow((nx - 0.5) / 0.38, 2)) * Math.exp(-Math.pow((ny - 0.22) / 0.28, 2));
        const envelope = 0.3 + 0.6 * Math.exp(-Math.pow((ny - 0.14) / 0.38, 2));
        let dens = clamp((d - 0.52) / 0.32, 0, 1) * envelope * rainbowGap;
        dens = dens * dens * (3 - 2 * dens);

        const silver = clamp(1 - ny * 1.2, 0.4, 1);
        const r = Math.round(lerp(175, 245, silver) + dens * 8);
        const g = Math.round(lerp(188, 250, silver) + dens * 6);
        const b = Math.round(lerp(210, 255, silver));
        const a = Math.round(255 * dens * 0.58);
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
    let cloudLayer = null;
    let bakeKey = "";

    const bake = () => {
      const key = `${w}x${h}`;
      if (key === bakeKey && cloudLayer) return;
      bakeKey = key;
      const scale = phone ? 2.8 : 2.1;
      const cw = Math.max(96, Math.floor(w / scale));
      const ch = Math.max(64, Math.floor(h / scale));
      cloudLayer = bakeResidualClouds(cw, ch);
    };

    const paintSky = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#3a5f82");
      sky.addColorStop(0.2, "#527a9e");
      sky.addColorStop(0.45, "#7a9ebf");
      sky.addColorStop(0.68, "#a8c4d8");
      sky.addColorStop(0.85, "#d0e2ee");
      sky.addColorStop(1, "#eaf0f6");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      /* 天顶微紫（雨后大气感），非太阳 */
      const zen = ctx.createRadialGradient(w * 0.48, h * 0.08, 0, w * 0.5, h * 0.25, Math.max(w, h) * 0.7);
      zen.addColorStop(0, "rgba(120,140,180,0.14)");
      zen.addColorStop(0.5, "rgba(150,170,210,0.05)");
      zen.addColorStop(1, "rgba(150,170,210,0)");
      ctx.fillStyle = zen;
      ctx.fillRect(0, 0, w, h);

      /* 虹弧后方漫射亮区（偏左，无日盘） */
      const clear = ctx.createRadialGradient(w * 0.46, h * 0.32, 0, w * 0.48, h * 0.36, w * 0.45);
      clear.addColorStop(0, "rgba(220,235,250,0.22)");
      clear.addColorStop(0.6, "rgba(200,220,245,0.06)");
      clear.addColorStop(1, "rgba(200,220,245,0)");
      ctx.fillStyle = clear;
      ctx.fillRect(0, 0, w, h);
    };


    const layoutRainbow = () => {
      if (phone) {
        const r0 = w * 2.1;
        return {
          cx: w * 0.5,
          cy: h + r0 * 0.1,
          r0,
          band: Math.max(10, r0 * 0.04),
          a0: Math.PI * 1.435,
          a1: Math.PI * 1.565,
        };
      }
      return {
        cx: w * 0.48,
        cy: h * 1.1,
        r0: Math.min(w * 1.0, h * 1.0),
        band: Math.max(12, Math.min(w, h) * 0.042),
        a0: Math.PI * 1.36,
        a1: Math.PI * 1.64,
      };
    };

    /** 弧长方向两端渐隐，避免硬切 */
    const arcFade = (u) => Math.pow(Math.sin(clamp(u, 0, 1) * Math.PI), 0.82);

    const paintRainbow = () => {
      const { cx, cy, r0, band, a0, a1 } = layoutRainbow();
      const breath = 0.92 + 0.06 * Math.sin(t * 0.18);
      const span = a1 - a0;
      const arcSegs = phone ? 10 : 14;
      const colorBands = phone ? 32 : 44;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const glow = ctx.createRadialGradient(cx, h * 0.22, 0, cx, h * 0.3, w * 0.42);
      glow.addColorStop(0, `rgba(210,225,250,${0.08 + 0.03 * Math.sin(t * 0.2)})`);
      glow.addColorStop(0.6, "rgba(190,210,245,0.03)");
      glow.addColorStop(1, "rgba(190,210,245,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h * 0.55);
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let seg = 0; seg < arcSegs; seg += 1) {
        const t0 = seg / arcSegs;
        const t1 = (seg + 1) / arcSegs;
        const fade = arcFade((t0 + t1) * 0.5);
        if (fade < 0.02) continue;
        const sa = a0 + span * t0;
        const ea = a0 + span * t1;

        for (let i = 0; i < colorBands; i += 1) {
          const u = i / (colorBands - 1);
          const hue = 10 + u * 262;
          const radius = r0 - u * band;
          const bandEdge = Math.pow(Math.sin(u * Math.PI), 1.1);
          const alpha = breath * fade * (0.16 + 0.5 * bandEdge);

          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(2, radius), sa, ea);
          ctx.strokeStyle = `hsla(${hue}, ${58 + u * 10}%, ${54 + u * 4}%, ${alpha})`;
          ctx.lineWidth = (band / colorBands) * 2.0;
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const paintClouds = () => {
      if (!cloudLayer) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      const drift = (t * 3.5) % (w * 0.9);

      ctx.globalAlpha = phone ? 0.2 : 0.26;
      ctx.drawImage(cloudLayer, -w * 0.06 - drift * 0.05, -h * 0.03, w * 1.12, h * 0.42);
      ctx.globalAlpha = 0.14;
      ctx.drawImage(cloudLayer, w * 0.28 + drift * 0.035, h * 0.02, w * 0.78, h * 0.28);
      ctx.globalAlpha = 1;
    };

    const paintGround = () => {
      const cx = w * 0.48;
      const gy = h * 0.9;
      const gr = w * 0.32;

      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const bands = 10;
      for (let i = 0; i < bands; i += 1) {
        const u = i / (bands - 1);
        const hue = u * 260;
        const r = gr - u * gr * 0.3;
        ctx.beginPath();
        ctx.arc(cx, gy, r, Math.PI * 0.95, Math.PI * 1.55);
        ctx.strokeStyle = `hsla(${hue}, 55%, 62%, ${0.025 + 0.035 * (1 - Math.abs(u - 0.45) * 1.8)})`;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
      ctx.restore();

      const wet = ctx.createLinearGradient(0, h * 0.68, 0, h);
      wet.addColorStop(0, "rgba(130,155,180,0)");
      wet.addColorStop(0.4, "rgba(110,140,170,0.06)");
      wet.addColorStop(1, "rgba(90,115,145,0.16)");
      ctx.fillStyle = wet;
      ctx.fillRect(0, h * 0.68, w, h * 0.32);

      const fog = ctx.createRadialGradient(w * 0.5, h, 0, w * 0.5, h * 0.92, w * 0.5);
      fog.addColorStop(0, "rgba(190,210,230,0.14)");
      fog.addColorStop(1, "rgba(190,210,230,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
    };

    const paint = (dt) => {
      t += dt;
      paintSky();
      paintClouds();
      paintRainbow();
      paintGround();
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
