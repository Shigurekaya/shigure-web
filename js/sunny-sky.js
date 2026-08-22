/**
 * 时雨榧 · 晴天特效（写实向）
 *
 * 借鉴：weather-canvas sunny / Climatic 天空层 / 本站 heavy-rain FBM 云。
 * 真蓝天顶 → 地平漂白 + 柔太阳晕 + 低覆盖 FBM 软云（禁卡通椭圆贴纸）。
 * 仅 URL / 会话强制：`?sunny` / `/sunny/`。
 */
(() => {
  const FRAME_MS = 1000 / 24;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
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

  /**
   * 低覆盖晴空云：卷云丝 + 少量积云团，烘焙到离屏再慢漂。
   * @param {number} cw
   * @param {number} ch
   * @param {"cirrus"|"cumulus"} kind
   */
  function bakeCloudLayer(cw, ch, kind) {
    const off = document.createElement("canvas");
    off.width = cw;
    off.height = ch;
    const ox = off.getContext("2d");
    if (!ox) return off;
    const img = ox.createImageData(cw, ch);
    const data = img.data;
    const cirrus = kind === "cirrus";

    for (let y = 0; y < ch; y += 1) {
      const ny = y / ch;
      for (let x = 0; x < cw; x += 1) {
        const nx = x / cw;
        let dens;
        if (cirrus) {
          /* 高空卷云：细丝、低对比 */
          let d = fbm(nx * 5.5 + 0.3, ny * 1.8 + 2.1, 4);
          d += 0.35 * fbm(nx * 14 - 1.2, ny * 3.4 + 0.7, 3);
          const band = Math.exp(-Math.pow((ny - 0.18) / 0.22, 2));
          dens = clamp((d - 0.52) / 0.28, 0, 1) * band * 0.55;
          dens = dens * dens * (3 - 2 * dens);
        } else {
          /* 中低积云：团块，覆盖率约 20% */
          let d = fbm(nx * 2.4 + 1.1, ny * 3.2 + 0.8, 5);
          d += 0.22 * fbm(nx * 7.1 - 2, ny * 5.5 + 1.4, 3);
          const envelope = Math.exp(-Math.pow((ny - 0.28) / 0.32, 2));
          dens = clamp((d - 0.58) / 0.3, 0, 1) * envelope;
          dens = dens * dens * (3 - 2 * dens);
        }

        const lit = 0.82 + 0.18 * dens;
        const r = Math.round(255 * lit);
        const g = Math.round(252 * lit + 2);
        const b = Math.round(248 * lit + 4);
        const a = Math.round(255 * dens * (cirrus ? 0.42 : 0.58));
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
    /** @type {HTMLCanvasElement | null} */
    let cirrusLayer = null;
    /** @type {HTMLCanvasElement | null} */
    let cumulusLayer = null;
    let bakeKey = "";

    const bake = () => {
      const key = `${w}x${h}:${phone ? 1 : 0}`;
      if (key === bakeKey && cirrusLayer && cumulusLayer) return;
      bakeKey = key;
      const scale = phone ? 3.2 : 2.4;
      const cw = Math.max(96, Math.floor(w / scale));
      const ch = Math.max(64, Math.floor(h / scale));
      cirrusLayer = bakeCloudLayer(cw, ch, "cirrus");
      cumulusLayer = bakeCloudLayer(
        Math.max(80, Math.floor(cw * 0.85)),
        Math.max(56, Math.floor(ch * 0.85)),
        "cumulus",
      );
    };

    const paintSky = () => {
      /* 真蓝天顶 → 地平近白（weather-canvas / Climatic 气质） */
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#3d8fd4");
      sky.addColorStop(0.22, "#5aade8");
      sky.addColorStop(0.48, "#8ec8f2");
      sky.addColorStop(0.72, "#c5e0f6");
      sky.addColorStop(0.9, "#e8f2fa");
      sky.addColorStop(1, "#f4f7fb");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      /* 天顶略加深 + 微冷 */
      const zenith = ctx.createRadialGradient(
        w * 0.5, h * -0.05, 0,
        w * 0.5, h * 0.15, Math.max(w, h) * 0.7,
      );
      zenith.addColorStop(0, "rgba(30,110,190,0.22)");
      zenith.addColorStop(1, "rgba(30,110,190,0)");
      ctx.fillStyle = zenith;
      ctx.fillRect(0, 0, w, h);
    };

    const paintSun = () => {
      const sx = w * (phone ? 0.76 : 0.8);
      const sy = h * 0.16;
      const sunR = Math.min(w, h) * (phone ? 0.028 : 0.032);

      ctx.save();
      ctx.globalCompositeOperation = "screen";

      /* 大气散射大晕 */
      const far = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunR * 18);
      far.addColorStop(0, "rgba(255,248,220,0.55)");
      far.addColorStop(0.12, "rgba(255,236,180,0.28)");
      far.addColorStop(0.35, "rgba(200,230,255,0.1)");
      far.addColorStop(0.65, "rgba(160,210,255,0.04)");
      far.addColorStop(1, "rgba(160,210,255,0)");
      ctx.fillStyle = far;
      ctx.beginPath();
      ctx.arc(sx, sy, sunR * 18, 0, Math.PI * 2);
      ctx.fill();

      /* 中晕 */
      const mid = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunR * 5);
      mid.addColorStop(0, "rgba(255,250,235,0.85)");
      mid.addColorStop(0.4, "rgba(255,230,160,0.35)");
      mid.addColorStop(1, "rgba(255,220,140,0)");
      ctx.fillStyle = mid;
      ctx.beginPath();
      ctx.arc(sx, sy, sunR * 5, 0, Math.PI * 2);
      ctx.fill();

      /* 轻光柱（桌面） */
      if (!phone) {
        ctx.save();
        const sway = Math.sin(t * 0.07) * 0.025;
        ctx.translate(sx, sy);
        ctx.rotate(-0.12 + sway);
        const beam = ctx.createLinearGradient(0, 0, 0, h * 0.75);
        beam.addColorStop(0, "rgba(255,245,210,0.16)");
        beam.addColorStop(0.35, "rgba(255,235,190,0.05)");
        beam.addColorStop(1, "rgba(255,235,190,0)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(-sunR * 0.9, 0);
        ctx.lineTo(sunR * 0.9, 0);
        ctx.lineTo(w * 0.14, h * 0.78);
        ctx.lineTo(-w * 0.1, h * 0.78);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      /* 日核（source-over，避免过曝刺眼） */
      const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, sunR);
      core.addColorStop(0, "#fffef8");
      core.addColorStop(0.45, "#fff4c8");
      core.addColorStop(0.85, "rgba(255,220,120,0.55)");
      core.addColorStop(1, "rgba(255,200,80,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(sx, sy, sunR * 1.15, 0, Math.PI * 2);
      ctx.fill();
    };

    const paintClouds = () => {
      if (!cirrusLayer || !cumulusLayer) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const drift1 = (t * 6) % (w * 1.2);
      const drift2 = (t * 11) % (w * 1.4);

      ctx.globalAlpha = phone ? 0.55 : 0.7;
      ctx.drawImage(cirrusLayer, -drift1 * 0.15, h * 0.02, w * 1.15, h * 0.55);
      ctx.drawImage(cirrusLayer, w * 0.55 - drift1 * 0.1, h * 0.08, w * 0.7, h * 0.4);

      ctx.globalAlpha = phone ? 0.5 : 0.62;
      const cy = h * 0.12 + Math.sin(t * 0.12) * h * 0.008;
      ctx.drawImage(cumulusLayer, -w * 0.05 + drift2 * 0.08, cy, w * 0.95, h * 0.48);
      ctx.drawImage(cumulusLayer, w * 0.45 - drift2 * 0.05, h * 0.2, w * 0.65, h * 0.38);
      ctx.globalAlpha = 1;
    };

    const paintHaze = () => {
      const mist = ctx.createLinearGradient(0, h * 0.55, 0, h);
      mist.addColorStop(0, "rgba(255,255,255,0)");
      mist.addColorStop(0.55, "rgba(240,248,255,0.12)");
      mist.addColorStop(1, "rgba(255,255,255,0.28)");
      ctx.fillStyle = mist;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);

      /* 细空气尘（极少） */
      if (!phone) {
        const n = 28;
        for (let i = 0; i < n; i += 1) {
          const px = ((i * 97.3 + t * 4) % w + w) % w;
          const py = ((i * 61.7 + t * 1.2) % (h * 0.55));
          const a = 0.04 + 0.06 * Math.sin(t * 0.8 + i);
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(px, py, 1.2, 1.2);
        }
      }
    };

    const paint = (dt) => {
      t += dt;
      paintSky();
      paintSun();
      paintClouds();
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
