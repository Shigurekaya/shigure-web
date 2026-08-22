/**
 * 时雨榧 · 大雨特效
 *
 * 对齐参考片盘点：
 * 1 雨丝 WebGL  2–4 玻璃主珠/微珠/拖尾（Canvas2D）
 * 5–6 卡片顶缘湿边+溅花  7–8 雾/天空 CSS
 * 无 GPU 时：2D 雨丝 + raindrop-fx 兜底
 */
(() => {
  const FADE_SEC = 0.75;

  const GLASS_BASE = {
    spawnSize: [50, 100],
    slipRate: 0.9,
    motionInterval: [0.16, 0.4],
    xShifting: [0, 0.035],
    colliderSize: 0.92,
    trailDropDensity: 0.32,
    trailDropSize: [0.32, 0.55],
    trailDistance: [20, 48],
    trailSpread: 0.45,
    initialSpread: 0.72,
    shrinkRate: 0.01,
    velocitySpread: 0.3,
    evaporate: 12,
    gravity: 2750,
    mist: false,
    mistColor: [0.18, 0.24, 0.32, 0.08],
    mistTime: 7,
    smoothRaindrop: [0.9, 0.975],
    refractBase: 0.58,
    refractScale: 0.98,
    raindropCompose: "harder",
    raindropLightPos: [-0.5, 1.35, 2.7, 0],
    /* 中亮漫反射：过高→白糊团；过低→墨团。靠折射+高光成形 */
    raindropDiffuseLight: [0.42, 0.5, 0.6],
    raindropShadowOffset: 0.14,
    raindropEraserSize: [0.88, 1],
    raindropSpecularLight: [1.0, 1.0, 1.0],
    raindropSpecularShininess: 220,
    raindropLightBump: 1.2,
  };

  const QUALITY = {
    low: {
      streak: 1600,
      dprCap: 1.2,
      frameMs: 1000 / 24,
      wind: 0.3,
      speedMul: 1.18,
      glassMain: 44,
      glassMicro: 460,
      splashRate: 1.55,
      glass: {
        spawnInterval: [0.06, 0.12],
        spawnLimit: 360,
        dropletsPerSeconds: 240,
        dropletSize: [8, 20],
        backgroundBlurSteps: 0,
        mistBlurStep: 0,
      },
    },
    mid: {
      streak: 1850,
      dprCap: 1.4,
      frameMs: 1000 / 30,
      wind: 0.36,
      speedMul: 1.24,
      glassMain: 74,
      glassMicro: 820,
      splashRate: 1.48,
      glassMaxW: 1040,
      glass: {
        spawnInterval: [0.07, 0.14],
        spawnLimit: 480,
        dropletsPerSeconds: 400,
        dropletSize: [8, 21],
        backgroundBlurSteps: 0,
        mistBlurStep: 0,
      },
    },
    /* 桌面高配：60fps + 更高贴屏缓冲；冷凝仍由 glassOpts 压低 */
    high: {
      /* 对齐 REF：可辨长细丝，密度介于白帘与过稀之间 */
      streak: 3200,
      dprCap: 2,
      frameMs: 1000 / 60,
      wind: 0.32,
      speedMul: 1.16,
      glassMain: 48,
      glassMicro: 520,
      splashRate: 1.55,
      glassMaxW: 1920,
      glass: {
        spawnInterval: [0.028, 0.07],
        spawnLimit: 1100,
        dropletsPerSeconds: 720,
        dropletSize: [6, 18],
        backgroundBlurSteps: 0,
        mistBlurStep: 0,
      },
    },
  };

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /** 手机：仅 UA / 窄屏粗指针。勿用 maxTouchPoints（Win 触屏本会误判）。 */
  function isPhoneLike() {
    try {
      if (navigator.connection?.saveData) return true;
    } catch { /* ignore */ }
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)) return true;
    try {
      if (window.matchMedia("(max-width: 720px)").matches
        && window.matchMedia("(pointer: coarse)").matches) return true;
    } catch { /* ignore */ }
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function detectQuality() {
    try {
      if (navigator.connection?.saveData) return "low";
    } catch { /* ignore */ }
    /* 触屏手机即使用旗舰 SoC，浏览器多层全屏 canvas 仍易卡死 */
    if (isPhoneLike()) return "low";
    const cores = navigator.hardwareConcurrency || 8;
    /* deviceMemory 桌面常为 undefined → 勿当 0；大分辨率不再降档（1440p+ 曾误判 low） */
    let mem = 8;
    try {
      if (typeof navigator.deviceMemory === "number" && navigator.deviceMemory > 0) {
        mem = navigator.deviceMemory;
      }
    } catch { /* ignore */ }
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (narrow || cores <= 4 || mem <= 4) return "low";
    if (cores <= 6 || mem <= 6) return "mid";
    return "high";
  }

  function streakCapFor(storm, phone) {
    /* 大雨对齐 REF 可辨银丝帘；暴雨才拉高上限 */
    if (phone) return storm ? 2200 : 1400;
    return storm ? 5600 : 3600;
  }

  /**
   * 自研积雨纹理（Canvas）：多层软椭圆 + 细噪声，模仿 REF 云体起伏。
   * 禁止视频截帧。
   */
  function paintSelfSkyClouds(canvas, cssW, cssH, storm) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const tw = Math.max(2, Math.floor(cssW * dpr));
    const th = Math.max(2, Math.floor(cssH * dpr));
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw;
      canvas.height = th;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, tw, th);

    /* 底色：冷灰蓝，给 FBM 积雨场留空间（R18c） */
    const base = ctx.createLinearGradient(0, 0, 0, th);
    if (storm) {
      base.addColorStop(0, "#24364e");
      base.addColorStop(0.5, "#2e4664");
      base.addColorStop(1, "#1a2a3e");
    } else {
      base.addColorStop(0, "#546e85");
      base.addColorStop(0.28, "#617b95");
      base.addColorStop(0.52, "#5c768f");
      base.addColorStop(0.78, "#546e85");
      base.addColorStop(1, "#4b6278");
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, tw, th);

    const blob = (x, y, rx, ry, c0, hard = 0.45) => {
      const cx = tw * x;
      const cy = th * y;
      const R = tw * rx;
      const ryPx = th * ry;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, Math.max(0.06, ryPx / Math.max(R, 1)));
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, c0);
      g.addColorStop(hard, c0.replace(/[\d.]+\)$/, (m) => `${Math.max(0, parseFloat(m) * 0.55)})`));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    if (storm) {
      blob(0.2, 0.18, 0.55, 0.16, "rgba(70,110,160,0.5)", 0.4);
      blob(0.75, 0.14, 0.5, 0.14, "rgba(30,50,80,0.6)", 0.4);
      blob(0.5, 0.55, 0.65, 0.22, "rgba(22,40,68,0.55)", 0.42);
    } else {
      /* R18c：自研 FBM 积雨密度场（非视频截帧）——团块起伏可辨 */
      const cw = Math.max(64, Math.floor(tw / 2.2));
      const ch = Math.max(88, Math.floor(th / 2.2));
      const img = ctx.createImageData(cw, ch);
      const data = img.data;
      const hash = (ix, iy) => {
        let n = ix * 374761393 + iy * 668265263;
        n = (n ^ (n >>> 13)) * 1274126177;
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
      };
      const smooth = (t) => t * t * (3 - 2 * t);
      const vnoise = (x, y) => {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = smooth(x - x0);
        const fy = smooth(y - y0);
        const a = hash(x0, y0);
        const b = hash(x0 + 1, y0);
        const c = hash(x0, y0 + 1);
        const d = hash(x0 + 1, y0 + 1);
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
      };
      const fbm = (x, y) => {
        let a = 0;
        let amp = 0.55;
        let f = 1;
        for (let o = 0; o < 5; o += 1) {
          a += amp * vnoise(x * f, y * f);
          amp *= 0.5;
          f *= 2.05;
        }
        return a;
      };
      for (let y = 0; y < ch; y += 1) {
        const ny = y / ch;
        for (let x = 0; x < cw; x += 1) {
          const nx = x / cw;
          let d = fbm(nx * 2.8 + 1.7, ny * 4.6 + 0.4);
          d += 0.28 * fbm(nx * 6.2 - 2.1, ny * 1.9 + 3.3);
          /* 层状包络：中部略亮、顶底略暗 */
          const envelope = 0.54
            + 0.34 * Math.sin(ny * Math.PI)
            + 0.1 * Math.sin((nx * 2.2 + ny * 0.7) * Math.PI * 2);
          d = d * 0.75 + envelope * 0.45;
          /* 高对比密度：拉开暗核/亮缝（R18d） */
          let dens = Math.max(0, Math.min(1, (d - 0.48) / 0.36));
          dens = dens * dens * (3 - 2 * dens);
          const gap = Math.pow(Math.max(0, 1 - dens * 0.98), 1.08);
          /* R24: 略抬中缝亮度（sky），冷蓝 sat */
          const r = Math.round(18 * dens + 160 * gap + 62 * (1 - dens) * (1 - gap));
          const gch = Math.round(34 * dens + 182 * gap + 81 * (1 - dens) * (1 - gap));
          const b = Math.round(58 * dens + 206 * gap + 117 * (1 - dens) * (1 - gap));
          const a = Math.round(255 * (0.11 + 0.3 * dens + 0.39 * gap));
          const i = (y * cw + x) * 4;
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, gch));
          data[i + 2] = Math.max(0, Math.min(255, b));
          data[i + 3] = Math.max(24, Math.min(168, a));
        }
      }
      const off = document.createElement("canvas");
      off.width = cw;
      off.height = ch;
      const ox = off.getContext("2d");
      if (ox) {
        ox.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.globalAlpha = 0.8;
        ctx.drawImage(off, 0, 0, tw, th);
        ctx.globalAlpha = 1;
      }
      /* R23b: 大尺度暗核/亮缘，压细噪体积感；守 mean/sky */
      blob(0.12, 0.08, 0.48, 0.12, "rgba(6,16,38,0.4)", 0.22);
      blob(0.88, 0.12, 0.44, 0.12, "rgba(4,14,36,0.4)", 0.2);
      blob(0.5, 0.22, 0.55, 0.1, "rgba(204,224,246,0.32)", 0.28);
      blob(0.32, 0.32, 0.34, 0.09, "rgba(188,210,238,0.22)", 0.28);
      blob(0.18, 0.52, 0.5, 0.14, "rgba(8,20,44,0.36)", 0.22);
      blob(0.82, 0.54, 0.46, 0.13, "rgba(10,22,46,0.34)", 0.22);
      blob(0.5, 0.38, 0.38, 0.07, "rgba(196,216,242,0.2)", 0.3);
      blob(0.5, 0.9, 0.78, 0.15, "rgba(6,16,36,0.3)", 0.32);
    }

    /* 细噪声：打破塑料渐变 */
    const n = Math.min(5200, Math.floor((tw * th) / 140));
    for (let i = 0; i < n; i += 1) {
      const x = Math.random() * tw;
      const y = Math.random() * th;
      const a = 0.018 + Math.random() * 0.045;
      const s = 0.7 + Math.random() * 2.4;
      ctx.fillStyle = Math.random() < 0.55
        ? `rgba(200,216,236,${a})`
        : `rgba(22,34,52,${a})`;
      ctx.fillRect(x, y, s, s * (0.35 + Math.random() * 0.9));
    }

    const fog = ctx.createLinearGradient(0, 0, 0, th);
    fog.addColorStop(0, "rgba(150,170,198,0.1)");
    fog.addColorStop(0.45, "rgba(0,0,0,0)");
    fog.addColorStop(1, "rgba(24,38,56,0.1)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, tw, th);
  }

  function paintStormBg(canvas, w, h, storm) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const tw = Math.max(2, Math.floor(w));
    const th = Math.max(2, Math.floor(h));
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw;
      canvas.height = th;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    /* 自研冷灰蓝积雨（非视频截帧）；对齐 R14 CSS 对比 */
    ctx.fillStyle = storm ? "#22324a" : "#455f7a";
    ctx.fillRect(0, 0, tw, th);

    if (storm) {
      const blobs = [
        { x: tw * 0.18, y: th * 0.22, r: tw * 0.7, c: "rgba(90,132,180,0.48)" },
        { x: tw * 0.78, y: th * 0.16, r: tw * 0.6, c: "rgba(42,64,94,0.54)" },
        { x: tw * 0.52, y: th * 0.7, r: tw * 0.7, c: "rgba(28,46,74,0.52)" },
        { x: tw * 0.4, y: th * 0.06, r: tw * 0.5, c: "rgba(145,180,224,0.28)" },
        { x: tw * 0.08, y: th * 0.55, r: tw * 0.45, c: "rgba(64,92,132,0.28)" },
      ];
      for (let i = 0; i < blobs.length; i += 1) {
        const L = blobs[i];
        const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
        g.addColorStop(0, L.c);
        g.addColorStop(1, "rgba(22,36,55,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, tw, th);
      }
    } else {
      /* 层状积雨：暗顶 + 中亮缝 + 错位暗核（降低径向糊感） */
      const bands = [
        { y: 0.02, h: 0.18, c0: "rgba(10,16,26,0.92)", sx: 1.5, ox: 0 },
        { y: 0.14, h: 0.14, c0: "rgba(28,40,56,0.78)", sx: 1.15, ox: -0.16 },
        { y: 0.12, h: 0.12, c0: "rgba(22,34,50,0.72)", sx: 1.05, ox: 0.2 },
        { y: 0.3, h: 0.2, c0: "rgba(168,186,208,0.52)", sx: 1.4, ox: 0.02 },
        { y: 0.28, h: 0.1, c0: "rgba(120,140,162,0.38)", sx: 0.55, ox: -0.18 },
        { y: 0.42, h: 0.14, c0: "rgba(24,36,52,0.7)", sx: 0.95, ox: 0.16 },
        { y: 0.52, h: 0.16, c0: "rgba(18,28,42,0.68)", sx: 1.2, ox: -0.12 },
        { y: 0.62, h: 0.18, c0: "rgba(30,44,60,0.62)", sx: 1.3, ox: 0.08 },
        { y: 0.88, h: 0.22, c0: "rgba(8,14,24,0.85)", sx: 1.5, ox: 0 },
      ];
      for (let i = 0; i < bands.length; i += 1) {
        const B = bands[i];
        const cy = th * B.y;
        const rx = tw * 0.55 * B.sx;
        const ry = th * B.h;
        ctx.save();
        ctx.translate(tw * (0.5 + (B.ox || 0)), cy);
        ctx.scale(1, Math.max(0.1, ry / Math.max(rx, 1)));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, B.c0);
        g.addColorStop(1, "rgba(53,76,96,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const side = [
        { x: 0, y: th * 0.38, r: tw * 0.55, c: "rgba(12,20,32,0.68)" },
        { x: tw, y: th * 0.46, r: tw * 0.52, c: "rgba(10,18,30,0.62)" },
        { x: tw * 0.75, y: th * 0.2, r: tw * 0.36, c: "rgba(20,32,48,0.45)" },
        { x: tw * 0.2, y: th * 0.7, r: tw * 0.4, c: "rgba(14,22,34,0.42)" },
      ];
      for (let i = 0; i < side.length; i += 1) {
        const S = side[i];
        const g = ctx.createRadialGradient(S.x, S.y, 0, S.x, S.y, S.r);
        g.addColorStop(0, S.c);
        g.addColorStop(1, "rgba(53,76,96,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, tw, th);
      }
    }

    /* 轻雾：去饱和，忌过蓝 */
    const fog = ctx.createLinearGradient(0, 0, 0, th);
    fog.addColorStop(0, storm ? "rgba(140,170,210,0.12)" : "rgba(150,165,180,0.12)");
    fog.addColorStop(0.35, storm ? "rgba(100,130,170,0.04)" : "rgba(120,135,150,0.05)");
    fog.addColorStop(0.7, storm ? "rgba(60,90,130,0.06)" : "rgba(70,85,100,0.05)");
    fog.addColorStop(1, storm ? "rgba(18,28,44,0.22)" : "rgba(20,28,38,0.2)");
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, tw, th);
    return canvas;
  }

  /**
   * 贴屏折射底图雨丝场：连续下落（勿每帧重随机钉死）。
   * 对齐参考片：近竖直、短密、头亮尾淡、外圈轻柔光（忌硬针）。
   */
  function createBgStreakField() {
    /** @type {Array<{x:number,y:number,len:number,speed:number,a:number,w:number,slant:number,layer:number}>} */
    const drops = [];
    let lastW = 0;
    let lastH = 0;
    let stormMode = false;

    const rebuild = (tw, th, storm) => {
      drops.length = 0;
      lastW = tw;
      lastH = th;
      stormMode = !!storm;
      /* 手机竖屏：铺满但忌白帘；REF 是可辨软丝而非噪点帘 */
      const areaMul = clamp((tw * th) / (1280 * 720), 0.95, storm ? 1.7 : 1.35);
      /*
       * R24：单笔软晕（去掉多叠鬼影，避免竖向锐度反升）；更淡更短。
       */
      const layers = [
        { n: Math.round((storm ? 920 : 800) * areaMul), len0: 0.008, len1: 0.017, a0: 0.03, a1: 0.068, w0: 0.18, w1: 0.42, spd0: 1260, spd1: 1640 },
        { n: Math.round((storm ? 460 : 380) * areaMul), len0: 0.011, len1: 0.021, a0: 0.046, a1: 0.1, w0: 0.26, w1: 0.54, spd0: 1380, spd1: 1800 },
        { n: Math.round((storm ? 76 : 64) * areaMul), len0: 0.013, len1: 0.022, a0: 0.064, a1: 0.125, w0: 0.28, w1: 0.54, spd0: 1540, spd1: 2080 },
      ];
      for (let L = 0; L < layers.length; L += 1) {
        const layer = layers[L];
        for (let i = 0; i < layer.n; i += 1) {
          /* 近竖直，轻倾角（REF ~2–6°） */
          const slant = (storm ? 0.04 : 0.05) + (Math.random() - 0.3) * 0.035;
          drops.push({
            x: Math.random() * tw,
            y: Math.random() * (th + 40) - 20,
            len: th * (layer.len0 + Math.random() * (layer.len1 - layer.len0)),
            speed: layer.spd0 + Math.random() * (layer.spd1 - layer.spd0),
            a: layer.a0 + Math.random() * (layer.a1 - layer.a0),
            w: layer.w0 + Math.random() * (layer.w1 - layer.w0),
            slant,
            layer: L,
          });
        }
      }
    };

    /**
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} tw
     * @param {number} th
     * @param {boolean} storm
     * @param {number} dtSec
     * @param {number} wind
     */
    const paint = (ctx, tw, th, storm, dtSec, wind) => {
      if (!ctx || tw < 2) return;
      if (drops.length === 0 || lastW !== tw || lastH !== th || stormMode !== !!storm) {
        rebuild(tw, th, storm);
      }
      const dt = clamp(dtSec || 0.016, 0.004, 0.05);
      const windPx = (wind || 0) * (storm ? 18 : 10);
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let i = 0; i < drops.length; i += 1) {
        const d = drops[i];
        d.y += d.speed * dt;
        d.x += (windPx * (0.3 + d.layer * 0.18) + d.slant * 28) * dt;
        if (d.y > th + d.len) {
          d.y = -d.len - Math.random() * 30;
          d.x = Math.random() * tw;
        } else if (d.x < -20) {
          d.x = tw + 10;
        } else if (d.x > tw + 20) {
          d.x = -10;
        }
        const x1 = d.x;
        const y1 = d.y;
        const x2 = d.x + d.len * d.slant;
        const y2 = d.y + d.len;
        const aCore = Math.min(0.16, d.a);
        const coreW = Math.max(0.18, d.w * (d.layer >= 2 ? 0.22 : 0.3));
        /* R24: 单芯 + 宽软晕；不做多叠鬼影（会抬竖向锐度） */
        ctx.save();
        ctx.strokeStyle = `rgba(170,194,220,${aCore * 0.1})`;
        ctx.lineWidth = coreW * 2.0;
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.shadowColor = `rgba(174,198,226,${Math.min(0.2, aCore * 0.72)})`;
        ctx.shadowBlur = d.layer >= 2 ? 1.3 : (d.layer >= 1 ? 1.0 : 0.7);
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.addColorStop(0, `rgba(148,170,196,0)`);
        grad.addColorStop(0.22, `rgba(164,186,210,${aCore * 0.06})`);
        grad.addColorStop(0.5, `rgba(192,210,232,${aCore * 0.24})`);
        grad.addColorStop(0.84, `rgba(206,224,242,${aCore * 0.08})`);
        grad.addColorStop(1, `rgba(216,230,244,0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = coreW * 0.56;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    };

    return { paint, rebuild };
  }

  /**
   * 截图像素探测：仅整屏近黑才放弃（过严会误杀正常暗色暴风雨底）。
   */
  function captureLooksBlack(canvas) {
    try {
      const cx = canvas.getContext("2d");
      if (!cx || canvas.width < 8) return true;
      const sw = Math.min(64, canvas.width);
      const sh = Math.min(64, canvas.height);
      const img = cx.getImageData(0, 0, sw, sh).data;
      let sum = 0;
      let dark = 0;
      const n = sw * sh;
      for (let i = 0; i < img.length; i += 4) {
        const y = 0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2];
        sum += y;
        if (y < 8) dark += 1;
      }
      const mean = sum / n;
      const darkRatio = dark / n;
      return mean < 10 || darkRatio > 0.94;
    } catch {
      return true;
    }
  }

  /**
   * 暴雨相对大雨（对齐小米天气大雨参考片）：
   * 短密近竖直雨帘 + 更强贴屏水珠；风只做轻横移，勿大倾角。
   */
  const STORM_MUL = {
    streak: 2.05,
    wind: 1.28,
    speed: 1.48,
    splash: 2.85,
    glassMain: 2.15,
    glassMicro: 2.55,
    sizeMul: 0.92,
  };

  /** 精致溅花精灵：柔边冠 + 亮核（参考片顶缘白簇） */
  function bakeSplashSprites() {
    const make = (size, soft) => {
      const pad = Math.ceil(size * 0.55);
      const dim = size + pad * 2;
      const c = document.createElement("canvas");
      c.width = dim;
      c.height = dim;
      const cx = c.getContext("2d");
      if (!cx) return c;
      const o = dim * 0.5;
      const g = cx.createRadialGradient(o, o, 0, o, o, size * 0.5);
      if (soft) {
        g.addColorStop(0, "rgba(255,255,255,0.85)");
        g.addColorStop(0.35, "rgba(220,235,255,0.35)");
        g.addColorStop(0.7, "rgba(180,210,240,0.12)");
        g.addColorStop(1, "rgba(160,190,230,0)");
      } else {
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.25, "rgba(245,250,255,0.9)");
        g.addColorStop(0.55, "rgba(200,225,245,0.35)");
        g.addColorStop(1, "rgba(180,210,240,0)");
      }
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(o, o, size * 0.48, 0, Math.PI * 2);
      cx.fill();
      return c;
    };
    return {
      soft: [10, 16, 22, 30].map((s) => make(s, true)),
      hard: [6, 10, 14, 18].map((s) => make(s, false)),
    };
  }

  const SPLASH_SPR = bakeSplashSprites();

  function pickSplashSpr(kind, r) {
    const list = kind === "soft" ? SPLASH_SPR.soft : SPLASH_SPR.hard;
    const px = r * 2.8;
    let best = 0;
    let diff = Infinity;
    for (let i = 0; i < list.length; i += 1) {
      const d = Math.abs(list[i].width - px);
      if (d < diff) { diff = d; best = i; }
    }
    return list[best];
  }

  function qualityFor(mode, storm, phone) {
    const base = QUALITY[mode];
    const q = {
      ...base,
      glass: base.glass && typeof base.glass === "object" ? { ...base.glass } : base.glass,
    };
    if (!storm) {
      if (phone) {
        q.dprCap = Math.min(q.dprCap, 1.1);
        q.frameMs = Math.max(q.frameMs, 1000 / 24);
      }
      return q;
    }
    /* 暴雨效果优先：短密雨帘 + 真玻璃折射（raindrop-fx）参数拉满 */
    const mul = STORM_MUL;
    q.streak = Math.round(q.streak * mul.streak);
    q.wind = q.wind * mul.wind;
    q.speedMul = q.speedMul * mul.speed;
    q.splashRate = (q.splashRate || 1) * mul.splash;
    q.glassMain = Math.round((q.glassMain || 34) * mul.glassMain);
    /* 冷凝微珠：对齐参考片 ~650/MP 细亮点；手机略降但仍密 */
    q.glassMicro = Math.min(
      phone ? 720 : 1200,
      Math.max(phone ? 480 : 780, Math.round((q.glassMicro || 420) * 0.85)),
    );
    q.sizeMul = mul.sizeMul;
    q.dprCap = Math.max(q.dprCap || 1.4, 2);
    q.frameMs = Math.min(q.frameMs || 16.7, 1000 / 60);
    q.glassMaxW = 1920;
    q.glass = {
      spawnInterval: [0.016, 0.036],
      spawnLimit: 2600,
      dropletsPerSeconds: 1600,
      dropletSize: [10, 44],
      backgroundBlurSteps: 0,
      mistBlurStep: 0,
    };
    return q;
  }

  function glassOptsFor(mode, storm, phone, screenGlass) {
    const g = qualityFor(mode, storm, phone).glass;
    /* 手机 detectQuality=low 时 glass 曾为 null → apply 直接跳过 → 落到库默认
       mistColor≈黑且 mistBlurStep=4，整屏灰蒙。贴屏必须始终覆盖默认值。 */
    const fallbackGlass = {
      spawnInterval: [0.05, 0.11],
      spawnLimit: phone ? 420 : 640,
      dropletsPerSeconds: phone ? 280 : 480,
      dropletSize: [8, 22],
      backgroundBlurSteps: 0,
      mistBlurStep: 0,
    };
    const opts = {
      ...GLASS_BASE,
      ...(g && typeof g === "object" ? g : fallbackGlass),
    };
    if (storm) {
      /*
       * 水色大珠：清透折射 + 白高光 + 极弱阴影（勿暗漫反射/高阴影 → 墨团）。
       */
      opts.spawnSize = phone ? [60, 130] : [70, 140];
      opts.slipRate = 0.92;
      opts.trailDropDensity = 0.36;
      opts.trailDropSize = [0.36, 0.6];
      opts.trailDistance = [28, 62];
      opts.gravity = 2700;
      opts.refractBase = 0.62;
      opts.refractScale = 1.05;
      opts.raindropCompose = "harder";
      opts.smoothRaindrop = [0.88, 0.97];
      opts.backgroundBlurSteps = 0;
      opts.mist = false;
      opts.mistBlurStep = 0;
      opts.mistColor = [0.02, 0.03, 0.04, 0.0];
      opts.raindropSpecularLight = [1.0, 1.0, 1.0];
      opts.raindropSpecularShininess = 240;
      opts.raindropLightBump = 1.25;
      opts.raindropDiffuseLight = [0.4, 0.48, 0.58];
      opts.raindropShadowOffset = 0.12;
      opts.raindropLightPos = [-0.45, 1.35, 2.7, 0];
      opts.raindropEraserSize = [0.86, 1];
      opts.dropletsPerSeconds = screenGlass ? (phone ? 55 : 110) : 0;
      opts.dropletSize = screenGlass ? [5, 16] : [6, 14];
      opts.spawnLimit = screenGlass
        ? Math.min(opts.spawnLimit || 1800, phone ? 240 : 420)
        : Math.min(opts.spawnLimit || 800, 420);
      opts.spawnInterval = screenGlass ? [0.04, 0.1] : [0.05, 0.11];
    } else {
      /*
       * REF：前景清透折射珠 + 竖向泪痕；忌巨大 soft bokeh 白团。
       * 珠略少、泪痕更长更细，贴在深色 UI 上才显。
       */
      opts.spawnSize = phone ? [8, 18] : [10, 22];
      opts.slipRate = 0.97;
      opts.trailDropDensity = 0.9;
      opts.trailDropSize = [0.07, 0.15];
      opts.trailDistance = [22, 78];
      opts.trailSpread = 0.08;
      opts.initialSpread = 0.38;
      opts.gravity = 2800;
      opts.refractBase = 0.72;
      opts.refractScale = 1.18;
      opts.raindropCompose = "harder";
      opts.smoothRaindrop = [0.4, 0.7];
      opts.backgroundBlurSteps = 0;
      opts.mist = false;
      opts.mistBlurStep = 0;
      opts.mistColor = [0.02, 0.03, 0.04, 0.0];
      opts.raindropSpecularLight = [0.92, 0.95, 0.98];
      opts.raindropSpecularShininess = 260;
      opts.raindropLightBump = 1.15;
      opts.raindropDiffuseLight = [0.4, 0.5, 0.6];
      opts.raindropShadowOffset = 0.07;
      opts.raindropLightPos = [-0.5, 1.5, 2.9, 0];
      opts.raindropEraserSize = [0.72, 0.92];
      opts.motionInterval = [0.05, 0.18];
      opts.dropletsPerSeconds = screenGlass ? (phone ? 6 : 12) : 0;
      opts.dropletSize = screenGlass ? [2, 3.0] : [2, 6];
      opts.spawnLimit = Math.min(
        opts.spawnLimit || 400,
        screenGlass ? (phone ? 42 : 70) : 180,
      );
      opts.spawnInterval = screenGlass ? [0.08, 0.18] : [0.08, 0.16];
      if (phone && !screenGlass) {
        opts.spawnSize = [12, 28];
        opts.spawnLimit = 200;
        opts.trailDropDensity = 0.35;
      }
    }
    return opts;
  }

  function applyGlassOpts(fx, mode, storm, phone, screenGlass) {
    const gOpts = glassOptsFor(mode, storm, phone, screenGlass);
    if (!fx || !gOpts) return;
    Object.keys(gOpts).forEach((k) => {
      try { fx.options[k] = gOpts[k]; } catch { /* ignore */ }
    });
  }

  function glassBufferSize(cssW, cssH, mode, storm, phone) {
    const maxW = storm
      ? (phone ? 1280 : 1920)
      : (phone ? 900 : 1920);
    /* 桌面贴近原生分辨率，避免珠边发糊 */
    const dprN = storm
      ? (phone ? 1.35 : 2)
      : (phone ? 1.25 : 1.85);
    const scale = Math.min(1, maxW / Math.max(1, cssW)) * Math.min(window.devicePixelRatio || 1, dprN);
    return {
      bw: Math.max(1, Math.floor(cssW * scale)),
      bh: Math.max(1, Math.floor(cssH * scale)),
    };
  }

  /**
   * @param {HTMLElement} fxRoot
   * @param {{
   *   getLedges?: () => Array<{x:number,y:number,w:number,radius:number}>,
   *   collectLedges?: () => Array<{x:number,y:number,w:number,radius:number}>,
   *   isScrolling?: () => boolean,
   *   bgHost?: HTMLElement | null,
   *   storm?: boolean,
   * }} opts
   */
  function attach(fxRoot, opts) {
    const bgHost = opts.bgHost || null;
    const storm = !!opts.storm;
    const RaindropCtor = typeof window.RaindropFX === "function"
      ? window.RaindropFX
      : window.RaindropFX?.default;

    /* 暴雨 / 桌面大雨：强制 high（本机高配不再被分辨率误判） */
    let quality = storm || !isPhoneLike() ? "high" : detectQuality();
    const realPhone = isPhoneLike();
    const phone = storm ? false : realPhone;
    const q0 = qualityFor(quality, storm, realPhone);
    const mobileLite = realPhone || (quality === "low" && window.matchMedia("(max-width: 720px)").matches);
    /* 贴屏 raindrop+html2canvas：用户要半透明大折射珠。
     * 关键：贴屏时不创建 GPU 雨丝（手机双 WebGL 会抢上下文 → raindrop 静默失败）。
     * 雨丝画进折射底图；失败 demote 后再挂 GPU + 2D 珠。 */
    const h2cOk = typeof window.html2canvas === "function";
    let useScreenGlass = !!(RaindropCtor && h2cOk);
    let screenGlassDemoted = !useScreenGlass;

    const glassCanvas = document.createElement("canvas");
    glassCanvas.setAttribute("aria-hidden", "true");
    glassCanvas.style.pointerEvents = "none";
    if (useScreenGlass) {
      glassCanvas.className = "site-fx__rain-glass";
      fxRoot.appendChild(glassCanvas);
    } else {
      glassCanvas.className = "site-bg__glass";
      if (bgHost) bgHost.appendChild(glassCanvas);
      glassCanvas.style.display = "none";
    }

    const streakCanvas = document.createElement("canvas");
    streakCanvas.className = "site-bg__heavy";
    streakCanvas.setAttribute("aria-hidden", "true");
    if (bgHost) bgHost.appendChild(streakCanvas);

    /* 自研积雨云底：盖住 CSS 纯渐变，仍禁止视频截帧 */
    const cloudCanvas = document.createElement("canvas");
    cloudCanvas.className = "site-bg__clouds";
    cloudCanvas.setAttribute("aria-hidden", "true");
    if (bgHost) bgHost.insertBefore(cloudCanvas, streakCanvas);
    else fxRoot.appendChild(cloudCanvas);
    let cloudW = 0;
    let cloudH = 0;
    const syncClouds = () => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      if (Math.abs(cw - cloudW) < 2 && Math.abs(ch - cloudH) < 2) return;
      cloudW = cw;
      cloudH = ch;
      paintSelfSkyClouds(cloudCanvas, cw, ch, storm);
    };
    syncClouds();

    /* 雾放进背景层：勿盖在正文上，否则手机端只剩溅花的「黑幕」 */
    const mist = document.createElement("div");
    mist.className = "site-bg__heavy-mist";
    mist.setAttribute("aria-hidden", "true");
    if (storm) mist.classList.add("is-storm");
    if (bgHost) bgHost.appendChild(mist);
    else fxRoot.appendChild(mist);

    const splashCanvas = document.createElement("canvas");
    splashCanvas.className = "site-fx__splash";
    splashCanvas.setAttribute("aria-hidden", "true");
    const glassDropCanvas = document.createElement("canvas");
    glassDropCanvas.className = "site-fx__glass-drops";
    glassDropCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(splashCanvas);
    fxRoot.appendChild(glassDropCanvas);

    /* 贴屏 WebGL 盖住 site-bg 雨丝：用 Canvas2D 叠层画银丝（不占第二 WebGL） */
    const streakOverlay = document.createElement("canvas");
    streakOverlay.className = "site-fx__streak-overlay";
    streakOverlay.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(streakOverlay);
    const overlayStreaks = createBgStreakField();
    let overlayCtx = null;
    let lastOverlayAt = performance.now();
    /* 半分辨率离屏：放大时自然软晕，忌硬针 */
    const overlayLo = document.createElement("canvas");
    const overlayLoCtx = overlayLo.getContext("2d", { alpha: true });

    const sctx = splashCanvas.getContext("2d", { alpha: true });
    if (sctx) {
      splashCanvas.style.background = "transparent";
    }
    const stormBg = document.createElement("canvas");
    const stormDomBg = document.createElement("canvas");
    let stormDomReady = false;
    let lastDomCaptureAt = 0;
    const bgStreaks = createBgStreakField();
    let lastBgStreakAt = performance.now();

    const areaScale = clamp((window.innerWidth * window.innerHeight) / (1280 * 720), 0.7, phone ? 1.0 : 1.35);
    const streakCount = Math.round(q0.streak * areaScale);
    const maxStreak = streakCapFor(storm, phone);

    const gpuOpts = () => ({
      count: Math.min(streakCount, maxStreak),
      dprCap: realPhone ? Math.min(q0.dprCap, 1.2) : (storm ? Math.min(q0.dprCap, 1.85) : q0.dprCap),
      wind: q0.wind,
      speedMul: q0.speedMul,
      wanderWind: storm,
      tilt: storm ? 0.07 : 0.055,
      sizeMul: storm ? (q0.sizeMul || STORM_MUL.sizeMul) : 1.08,
      sheet: storm ? 1 : 0.28,
      preserveDrawingBuffer: false,
    });

    /* 贴屏路径禁止先占 WebGL；仅非贴屏或 demote 后挂 GPU */
    let gpu = useScreenGlass
      ? null
      : window.KayaGpuStreakRain?.attach?.(streakCanvas, gpuOpts());

    const ensureGpuStreaks = () => {
      if (gpu) return gpu;
      gpu = window.KayaGpuStreakRain?.attach?.(streakCanvas, gpuOpts()) || null;
      return gpu;
    };

    const useGpuStreaks = () => !!gpu;

    /* 贴屏未就绪时仍显示 2D 珠；就绪后关掉避免叠两层 */
    const wantSplash = true;
    splashCanvas.style.display = wantSplash ? "" : "none";
    glassDropCanvas.style.display = "";
    if (storm) glassDropCanvas.classList.add("is-storm-glass");
    glassDropCanvas.classList.add("is-clear-glass");

    const glassMainN = storm
      ? Math.max(realPhone ? 72 : 100, q0.glassMain || 100)
      : (realPhone ? Math.max(36, Math.round((q0.glassMain || 34) * 1.0)) : (q0.glassMain || 90));
    /* 冷凝珠少一些（桌面略增仍远低于糊罩） */
    const glassMicroN = storm
      ? (realPhone || mobileLite
        ? Math.max(120, Math.min(220, Math.round((q0.glassMicro || 560) * 0.28)))
        : Math.max(180, Math.min(320, Math.round((q0.glassMicro || 980) * 0.24))))
      : (realPhone || mobileLite
        ? Math.max(90, Math.round((q0.glassMicro || 360) * 0.28))
        : Math.max(140, Math.round((q0.glassMicro || 560) * 0.32)));

    const glassDrops = window.KayaGlassDrops?.attach
      ? window.KayaGlassDrops.attach(glassDropCanvas, {
        main: glassMainN,
        micro: glassMicroN,
        dprCap: storm ? Math.min(q0.dprCap, realPhone ? 1.4 : 2) : (realPhone ? 1.2 : Math.min(q0.dprCap, 2)),
        slideRatio: storm ? 0.42 : 0.28,
        storm,
        lite: mobileLite,
        noSpray: false,
      })
      : null;
    if (!glassDrops) glassDropCanvas.style.display = "none";

    let fallbackDrops = null;
    let fallbackCtx = null;
    if (!gpu) {
      fallbackCtx = streakCanvas.getContext("2d", { alpha: true });
      fallbackDrops = [];
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let t0 = performance.now();
    let last = t0;
    let intensity = 0;
    let targetIntensity = 0;
    let stopTimer = 0;
    let splashAcc = 0;
    let resizeGlassTimer = 0;
    let captureTimer = 0;
    let captureInterval = 0;
    let capturing = false;
    let glassFx = null;
    let glassReady = false;
    let glassFailed = false;
    let glassAnimating = false;
    /* 贴屏真折射优先；无 GPU 时也可用背景 raindrop 兜底 */
    let wantRaindropFx = (useScreenGlass || !useGpuStreaks())
      && !!RaindropCtor
      && qualityFor(quality, storm, realPhone).glass != null;
    /** 溅花 / 兜底雨丝跟随时风速（含符号） */
    let windLive = q0.wind * (storm && Math.random() < 0.5 ? -1 : 1);
    let windTarget = windLive;
    let windTimer = storm ? 0.35 : 2.0;

    /** @type {Array<any>} */
    const splashes = [];
    /** @type {Array<any>} */
    const rims = [];

    const stepWind = (dt) => {
      if (gpu?.getWind) {
        windLive = gpu.getWind();
        return;
      }
      const q = qualityFor(quality, storm, phone);
      const mag = Math.max(0.18, Math.abs(q.wind || 0.3));
      windTimer -= dt;
      if (windTimer <= 0) {
        windTimer = storm ? rand(0.9, 2.6) : rand(2.4, 5.0);
        const sign = storm
          ? (Math.random() < 0.5 ? -1 : 1)
          : ((Math.random() < 0.12 ? -1 : 1) * (Math.sign(windLive || 1) || 1));
        windTarget = sign * mag * (storm ? rand(0.55, 1.25) : rand(0.7, 1.1));
      }
      windLive += (windTarget - windLive) * Math.min(1, dt * (storm ? 1.3 : 0.65));
    };

    const rebuildFallback = () => {
      if (!fallbackDrops || !fallbackCtx) return;
      const q = qualityFor(quality, storm, phone);
      const n = Math.round(q.streak * 0.55 * clamp((w * h) / (1280 * 720), 0.7, 1.2));
      fallbackDrops.length = 0;
      for (let i = 0; i < n; i += 1) {
        fallbackDrops.push({
          x: Math.random() * w,
          y: Math.random() * h,
          len: h * rand(0.01, 0.03),
          speed: rand(950, 1600) * (q.speedMul || 1),
          alpha: rand(0.12, 0.42),
          drift: rand(0.7, 1.3),
        });
      }
    };

    const drawFallback = (dt, aMul) => {
      if (!fallbackCtx || !fallbackDrops) return;
      fallbackCtx.clearRect(0, 0, w, h);
      fallbackCtx.lineWidth = 1.2;
      fallbackCtx.lineCap = "round";
      const tilt = windLive * (storm ? 18 : 10);
      for (let i = 0; i < fallbackDrops.length; i += 1) {
        const d = fallbackDrops[i];
        const a = d.alpha * aMul;
        const dx = tilt * d.drift * 0.08;
        fallbackCtx.strokeStyle = `rgba(200,225,245,${a})`;
        fallbackCtx.beginPath();
        fallbackCtx.moveTo(d.x, d.y);
        fallbackCtx.lineTo(d.x + dx, d.y + d.len);
        fallbackCtx.stroke();
        d.y += d.speed * dt;
        d.x += windLive * 28 * d.drift * dt;
        if (d.y > h + d.len) {
          d.y = -d.len;
          d.x = Math.random() * w;
        } else if (d.x > w + 40) {
          d.x = -20;
        } else if (d.x < -40) {
          d.x = w + 20;
        }
      }
    };

    const fitSplash = () => {
      dpr = Math.min(
        window.devicePixelRatio || 1,
        phone || quality === "low" ? 1.05 : (quality === "high" ? 1.85 : 1.45),
      );
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (sctx) {
        if (splashCanvas.width !== cw || splashCanvas.height !== ch) {
          splashCanvas.width = cw;
          splashCanvas.height = ch;
        }
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (fallbackCtx) {
        if (streakCanvas.width !== cw || streakCanvas.height !== ch) {
          streakCanvas.width = cw;
          streakCanvas.height = ch;
        }
        fallbackCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      glassDrops?.resize(w, h);
      const odpr = Math.min(window.devicePixelRatio || 1, phone ? 1.15 : 1.6);
      const ow = Math.max(1, Math.floor(w * odpr));
      const oh = Math.max(1, Math.floor(h * odpr));
      if (streakOverlay.width !== ow || streakOverlay.height !== oh) {
        streakOverlay.width = ow;
        streakOverlay.height = oh;
      }
      overlayCtx = streakOverlay.getContext("2d", { alpha: true });
      if (overlayCtx) overlayCtx.setTransform(odpr, 0, 0, odpr, 0, 0);
    };

    const demoteScreenGlass = (reason) => {
      if (!useScreenGlass || screenGlassDemoted) return;
      screenGlassDemoted = true;
      useScreenGlass = false;
      console.warn("[kaya] screen glass demoted → GPU+2D drops", reason || "");
      try { glassFx?.stop(); } catch { /* ignore */ }
      glassFx = null;
      glassReady = false;
      glassAnimating = false;
      glassFailed = true;
      wantRaindropFx = false;
      glassCanvas.style.display = "none";
      glassCanvas.style.opacity = "0";
      glassCanvas.classList.remove("is-on");
      /* 释放贴屏 WebGL 后再挂雨丝 GPU */
      const g = ensureGpuStreaks();
      try {
        g?.resize?.(w || window.innerWidth, h || window.innerHeight);
        g?.setIntensity?.(intensity);
        if (running && targetIntensity > 0) g?.start?.();
      } catch { /* ignore */ }
      if (glassDrops) {
        glassDropCanvas.style.display = "";
        glassDrops.setEnabled?.(true);
        glassDrops.setIntensity(intensity);
      }
      syncGlassOpacity();
    };

    const syncGlassOpacity = () => {
      if (window.__kayaFreezeFx) {
        streakOverlay.classList.remove("is-on");
        streakOverlay.style.display = "none";
        streakOverlay.style.opacity = "0";
        glassCanvas.style.opacity = "0";
        glassCanvas.classList.remove("is-on");
        splashCanvas.style.display = "none";
        return;
      }
      const screenOn = useScreenGlass && glassReady && !screenGlassDemoted;
      if (wantRaindropFx && !screenGlassDemoted) {
        glassCanvas.style.display = "";
        glassCanvas.style.opacity = String(clamp(intensity * (glassReady ? 1 : 0), 0, 1));
        glassCanvas.classList.toggle("is-on", intensity > 0.05 && glassReady);
      } else {
        glassCanvas.style.display = "none";
        glassCanvas.style.opacity = "0";
        glassCanvas.classList.remove("is-on");
      }
      /* 贴屏成功后停 GPU（本来也可能未创建）；雨丝在折射底图里 */
      gpu?.setIntensity(screenOn ? 0 : intensity);
      /* 贴屏未就绪 / 失败：开 2D 珠；成功后关掉 */
      if (glassDrops) {
        const dropsOn = !screenOn;
        glassDrops.setEnabled?.(dropsOn);
        glassDrops.setIntensity(dropsOn ? intensity : 0);
        glassDropCanvas.style.display = dropsOn ? "" : "none";
        glassDropCanvas.style.opacity = String(clamp(dropsOn ? intensity : 0, 0, 1));
      }
      mist.classList.toggle("is-on", intensity > 0.05 && !screenOn);
      /* 贴屏时开叠层雨丝；非贴屏靠 GPU/fallback */
      const wantOverlay = screenOn && intensity > 0.05;
      streakOverlay.classList.toggle("is-on", wantOverlay);
      streakOverlay.style.display = wantOverlay ? "block" : "none";
      /* REF 银丝：叠层可见但忌白帘；软丝靠笔触本身 */
      /* 叠层 opacity 只走 CSS 一处，勿再乘 canvas globalAlpha（会叠成过淡） */
      streakOverlay.style.opacity = String(clamp(wantOverlay ? intensity * 0.94 : 0, 0, 1));
    };

    const ignoreCaptureEl = (el) => {
      if (!el) return false;
      /* 一切 canvas（含 WebGL 雨丝）勿进截图——手机读 WebGL 常整屏黑 */
      /* WebGL/特效 canvas 勿进截图；自研积雨 2D 云底需保留 */
      if (el.tagName === "CANVAS") {
        if (el.classList?.contains("site-bg__clouds")) return false;
        return true;
      }
      if (el === glassCanvas || el === splashCanvas || el === glassDropCanvas || el === streakCanvas) return true;
      const cls = el.classList;
      if (!cls) return false;
      return cls.contains("site-fx__rain-glass")
        || cls.contains("site-fx__streak-overlay")
        || cls.contains("site-fx__splash")
        || cls.contains("site-fx__glass-drops")
        || cls.contains("site-fx__lightning")
        || cls.contains("site-fx__thunder-flash")
        || cls.contains("site-fx__thunder-sheet")
        || cls.contains("site-bg__heavy-mist")
        || cls.contains("site-bg__heavy")
        || cls.contains("site-bg__glass")
        || cls.contains("site-fx");
    };

    /** 贴屏：天空 + DOM 快照 + CPU 雨丝。绝不 drawImage WebGL */
    const composeGlassBackground = (bw, bh) => {
      if (stormBg.width !== bw || stormBg.height !== bh) {
        stormBg.width = bw;
        stormBg.height = bh;
      }
      const bx = stormBg.getContext("2d");
      if (!bx) return stormBg;
      paintStormBg(stormBg, bw, bh, storm);
      const now = performance.now();
      const dtSec = clamp((now - lastBgStreakAt) / 1000, 0.008, 0.05);
      lastBgStreakAt = now;
      if (useScreenGlass && stormDomReady && stormDomBg.width > 2) {
        bx.setTransform(1, 0, 0, 1, 0, 0);
        bx.drawImage(stormDomBg, 0, 0, bw, bh);
        bgStreaks.paint(bx, bw, bh, storm, dtSec, windLive);
        return stormBg;
      }
      bgStreaks.paint(bx, bw, bh, storm, dtSec, windLive);
      return stormBg;
    };

    const captureStormDom = async (bw, bh) => {
      if (!useScreenGlass || capturing || screenGlassDemoted) return stormDomReady;
      const h2c = typeof window.html2canvas === "function" ? window.html2canvas : null;
      if (!h2c) return false;
      capturing = true;
      const prevGlass = glassCanvas.style.display;
      const prevSplash = splashCanvas.style.display;
      const prevDrops = glassDropCanvas.style.display;
      const prevMist = mist.style.display;
      const prevStreak = streakCanvas.style.display;
      glassCanvas.style.display = "none";
      splashCanvas.style.display = "none";
      glassDropCanvas.style.display = "none";
      mist.style.display = "none";
      streakCanvas.style.display = "none";
      const skyHex = storm ? "#1a283c" : "#455f7a";
      try {
        const scale = bw / Math.max(1, window.innerWidth);
        const shot = await h2c(document.documentElement, {
          width: bw,
          height: bh,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          x: window.scrollX,
          y: window.scrollY,
          scrollX: -window.scrollX,
          scrollY: -window.scrollY,
          scale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: skyHex,
          logging: false,
          imageTimeout: 0,
          ignoreElements: ignoreCaptureEl,
        });
        if (stormDomBg.width !== bw || stormDomBg.height !== bh) {
          stormDomBg.width = bw;
          stormDomBg.height = bh;
        }
        const dx = stormDomBg.getContext("2d");
        if (dx && shot) {
          dx.setTransform(1, 0, 0, 1, 0, 0);
          dx.fillStyle = skyHex;
          dx.fillRect(0, 0, bw, bh);
          /* 提亮截图，缓解贴屏整体发暗（保留折射，略增可读） */
          dx.filter = "brightness(1.08) contrast(1.03) saturate(1.03)";
          dx.drawImage(shot, 0, 0, bw, bh);
          dx.filter = "none";
          if (captureLooksBlack(stormDomBg)) {
            stormDomReady = false;
            demoteScreenGlass("capture too dark");
          } else {
            stormDomReady = true;
            lastDomCaptureAt = performance.now();
          }
        }
      } catch (err) {
        console.warn("[kaya] storm glass capture failed", err);
        demoteScreenGlass("capture threw");
      } finally {
        glassCanvas.style.display = prevGlass;
        splashCanvas.style.display = prevSplash;
        glassDropCanvas.style.display = prevDrops;
        mist.style.display = prevMist;
        streakCanvas.style.display = prevStreak;
        capturing = false;
      }
      return stormDomReady && useScreenGlass;
    };

    const pushGlassBackground = async () => {
      if (!glassReady || !glassFx || screenGlassDemoted) return;
      const { bw, bh } = glassBufferSize(w || window.innerWidth, h || window.innerHeight, quality, storm, realPhone);
      composeGlassBackground(bw, bh);
      try {
        await glassFx.setBackground(stormBg);
      } catch { /* ignore */ }
    };

    const scheduleDomCapture = (delay = 420) => {
      if (!useScreenGlass || !wantRaindropFx || screenGlassDemoted) return;
      window.clearTimeout(captureTimer);
      captureTimer = window.setTimeout(() => {
        void (async () => {
          if (!running || targetIntensity <= 0 || screenGlassDemoted) return;
          const { bw, bh } = glassBufferSize(w || window.innerWidth, h || window.innerHeight, quality, storm, realPhone);
          const ok = await captureStormDom(bw, bh);
          if (ok) await pushGlassBackground();
        })();
      }, delay);
    };

    const ensureGlass = async () => {
      if (screenGlassDemoted) return false;
      if (!wantRaindropFx || glassReady || glassFailed) return glassReady;
      if (!RaindropCtor || (!useScreenGlass && !bgHost)) {
        glassFailed = true;
        if (useScreenGlass) demoteScreenGlass("no ctor/host");
        return false;
      }
      try {
        const { bw, bh } = glassBufferSize(w || window.innerWidth, h || window.innerHeight, quality, storm, realPhone);
        if (useScreenGlass) {
          const ok = await captureStormDom(bw, bh);
          if (!ok || screenGlassDemoted) return false;
        }
        composeGlassBackground(bw, bh);
        glassCanvas.width = bw;
        glassCanvas.height = bh;
        const gOpts = glassOptsFor(quality, storm, realPhone, useScreenGlass) || {};
        glassFx = new RaindropCtor({
          canvas: glassCanvas,
          width: bw,
          height: bh,
          background: stormBg,
          ...gOpts,
          mist: false,
          backgroundBlurSteps: 0,
          mistBlurStep: 0,
          /* 水色：弱阴影，靠折射+高光成形 */
          raindropShadowOffset: Math.min(gOpts.raindropShadowOffset ?? 0.13, 0.18),
          raindropCompose: gOpts.raindropCompose || "harder",
          raindropDiffuseLight: gOpts.raindropDiffuseLight || [0.4, 0.48, 0.58],
        });
        applyGlassOpts(glassFx, quality, storm, realPhone, useScreenGlass);
        try {
          glassFx.options.mist = false;
          glassFx.options.backgroundBlurSteps = 0;
          glassFx.options.mistBlurStep = 0;
          glassFx.options.raindropShadowOffset = Math.min(
            glassFx.options.raindropShadowOffset || 0.13,
            0.18,
          );
          glassFx.options.raindropDiffuseLight = gOpts.raindropDiffuseLight
            || [0.4, 0.48, 0.58];
          glassFx.options.raindropSpecularLight = gOpts.raindropSpecularLight
            || [1, 1, 1];
          glassFx.options.refractBase = gOpts.refractBase ?? 0.6;
          glassFx.options.refractScale = gOpts.refractScale ?? 1.0;
          glassFx.options.raindropCompose = gOpts.raindropCompose || "harder";
          glassFx.options.smoothRaindrop = gOpts.smoothRaindrop || [0.88, 0.97];
          glassFx.options.spawnSize = gOpts.spawnSize || glassFx.options.spawnSize;
          glassFx.options.dropletsPerSeconds = gOpts.dropletsPerSeconds ?? 0;
          glassFx.options.trailDropDensity = gOpts.trailDropDensity ?? 0.36;
          glassFx.options.slipRate = gOpts.slipRate ?? 0.9;
        } catch { /* ignore */ }
        await glassFx.setBackground(stormBg);
        await glassFx.start();
        glassReady = true;
        glassAnimating = true;
        console.info("[kaya] screen glass ready", storm ? "storm" : "heavy");
        syncGlassOpacity();
        if (useScreenGlass && !screenGlassDemoted) {
          scheduleDomCapture(storm ? 700 : (realPhone ? 1100 : 600));
          const pushMs = storm ? 48 : (realPhone ? 72 : 40);
          const recaptureMs = storm ? 1600 : (realPhone ? 4000 : 2000);
          window.clearInterval(captureInterval);
          captureInterval = window.setInterval(() => {
            if (!glassReady || !running || document.hidden || screenGlassDemoted) return;
            void pushGlassBackground();
            if (performance.now() - lastDomCaptureAt > recaptureMs) scheduleDomCapture(0);
          }, pushMs);
        }
        return true;
      } catch (err) {
        console.warn("[kaya] raindrop-fx skipped", err);
        if (useScreenGlass) demoteScreenGlass(err?.message || "raindrop failed");
        else {
          glassFailed = true;
          glassFx = null;
        }
        return false;
      }
    };

    const resizeGlassNow = async () => {
      if (!glassReady || !glassFx || w < 2 || screenGlassDemoted) return;
      try {
        const { bw, bh } = glassBufferSize(w, h, quality, storm, realPhone);
        if (useScreenGlass) await captureStormDom(bw, bh);
        if (screenGlassDemoted) return;
        composeGlassBackground(bw, bh);
        glassFx.resize(bw, bh);
        await glassFx.setBackground(stormBg);
        applyGlassOpts(glassFx, quality, storm, realPhone, useScreenGlass);
      } catch (err) {
        console.warn("[kaya] glass resize failed", err);
        if (useScreenGlass) demoteScreenGlass("resize failed");
      }
    };

    const scheduleResizeGlass = () => {
      window.clearTimeout(resizeGlassTimer);
      resizeGlassTimer = window.setTimeout(() => { void resizeGlassNow(); }, 180);
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      quality = storm || !realPhone ? "high" : detectQuality();
      const q = qualityFor(quality, storm, realPhone);
      wantRaindropFx = (useScreenGlass || !useGpuStreaks()) && !!RaindropCtor && q.glass != null;
      fitSplash();
      gpu?.resize(w, h);
      const n = Math.round(q.streak * clamp((w * h) / (1280 * 720), 0.7, storm ? 1.6 : (realPhone ? 1.0 : 1.55)));
      gpu?.setCount(Math.min(n, streakCapFor(storm, phone)));
      gpu?.setFrameBudget(q.frameMs);
      gpu?.setWind?.(q.wind);
      gpu?.setSpeedMul?.(q.speedMul);
      gpu?.setSizeMul?.(storm ? (q.sizeMul || STORM_MUL.sizeMul) : 0.96);
      gpu?.setSheet?.(storm ? 1 : 0.9);
      gpu?.setTilt?.(storm ? 0.05 : 0.065);
      glassDrops?.setCounts(
        storm
          ? Math.max(realPhone ? 72 : 100, q.glassMain || 100)
          : (realPhone ? Math.max(36, Math.round((q.glassMain || 34) * 1.0)) : (q.glassMain || 90)),
        storm
          ? (realPhone || mobileLite
            ? Math.max(120, Math.min(220, Math.round((q.glassMicro || 560) * 0.28)))
            : Math.max(180, Math.min(320, Math.round((q.glassMicro || 980) * 0.24))))
          : (realPhone || mobileLite
            ? Math.max(90, Math.round((q.glassMicro || 360) * 0.28))
            : Math.max(140, Math.round((q.glassMicro || 560) * 0.32))),
      );
      const ledgeSnap = (opts.collectLedges
        ? opts.collectLedges()
        : opts.getLedges?.()) || [];
      glassDrops?.setLedges?.(ledgeSnap);
      rebuildFallback();
      scheduleResizeGlass();
      syncClouds();
      syncGlassOpacity();
    };

    const hitPointOnLedge = (ledge) => {
      const inset = Math.min(ledge.radius * 0.55, ledge.w * 0.05);
      return {
        x: ledge.x + inset + Math.random() * Math.max(4, ledge.w - inset * 2),
        y: ledge.y + Math.random() * 1.2,
      };
    };

    const pushSplash = (opts) => {
      const cap = phone ? (storm ? 120 : 70) : (storm ? 520 : 320);
      if (splashes.length >= cap) return;
      splashes.push({
        x: opts.x,
        y: opts.y,
        vx: opts.vx,
        vy: opts.vy,
        life: opts.life,
        age: 0,
        r: opts.r,
        soft: !!opts.soft,
        kind: opts.kind || "hard",
        drip: !!opts.drip,
        a: opts.a ?? 1,
      });
    };

    const spawnSplash = (ledge) => {
      if (intensity < 0.12) return;
      if (ledge.shape === "circle") return;
      const hit = hitPointOnLedge(ledge);
      const windBias = windLive * (storm ? 24 : 10);

      if (storm) {
        if (!phone) {
          pushSplash({
            x: hit.x, y: hit.y,
            vx: windBias * 0.15, vy: rand(-20, -8),
            life: rand(0.16, 0.28), r: rand(2.4, 4.2),
            soft: true, kind: "soft", a: 0.7,
          });
        }
        const n = phone ? (2 + ((Math.random() * 3) | 0)) : (6 + ((Math.random() * 7) | 0));
        for (let i = 0; i < n; i += 1) {
          const ang = -Math.PI * 0.02 - Math.random() * Math.PI * 0.92;
          const spd = rand(40, phone ? 120 : 175);
          const fine = Math.random() < 0.55;
          pushSplash({
            x: hit.x + rand(-4, 4),
            y: hit.y + rand(-1, 1.5),
            vx: Math.cos(ang) * spd + windBias,
            vy: Math.sin(ang) * spd,
            life: fine ? rand(0.1, 0.2) : rand(0.14, 0.32),
            r: fine ? rand(0.55, 1.4) : rand(1.4, 3.2),
            soft: !phone && Math.random() < 0.4,
            kind: fine ? "hard" : (Math.random() < 0.5 ? "soft" : "hard"),
            a: fine ? 0.95 : 0.85,
          });
        }
        if (!phone && Math.random() < 0.55) {
          pushSplash({
            x: hit.x + rand(-6, 6),
            y: hit.y + rand(1, 4),
            vx: windBias * 0.2 + rand(-12, 12),
            vy: rand(30, 90),
            life: rand(0.28, 0.55),
            r: rand(1.2, 2.6),
            soft: true, kind: "soft", drip: true, a: 0.75,
          });
        }
      } else {
        /* 大雨溅花：更密顶缘白簇（对齐 REF 卡缘积水） */
        pushSplash({
          x: hit.x, y: hit.y,
          vx: windBias * 0.12, vy: rand(-18, -5),
          life: rand(0.16, 0.28), r: rand(2.0, 3.6),
          soft: true, kind: "soft", a: 0.72,
        });
        const n = phone ? (3 + ((Math.random() * 3) | 0)) : (5 + ((Math.random() * 5) | 0));
        for (let i = 0; i < n; i += 1) {
          const ang = -Math.PI * 0.05 - Math.random() * Math.PI * 0.85;
          const spd = rand(35, phone ? 110 : 150);
          const fine = Math.random() < 0.5;
          pushSplash({
            x: hit.x + rand(-5, 5),
            y: hit.y + rand(-1, 1.5),
            vx: Math.cos(ang) * spd + windBias,
            vy: Math.sin(ang) * spd,
            life: fine ? rand(0.1, 0.2) : rand(0.14, 0.3),
            r: fine ? rand(0.6, 1.5) : rand(1.3, 2.8),
            soft: !phone && Math.random() < 0.45,
            kind: fine ? "hard" : (Math.random() < 0.55 ? "soft" : "hard"),
            a: fine ? 0.95 : 0.88,
          });
        }
        if (Math.random() < 0.4) {
          pushSplash({
            x: hit.x + rand(-4, 4),
            y: hit.y + rand(1, 3),
            vx: windBias * 0.15 + rand(-10, 10),
            vy: rand(25, 70),
            life: rand(0.25, 0.48),
            r: rand(1.1, 2.2),
            soft: true, kind: "soft", drip: true, a: 0.7,
          });
        }
      }
    };

    /** 顶缘湿珠：大雨轻量、雷雨更密（手机跳过） */
    const ensureRimBeads = (rectLedges, dt, aMul) => {
      if (!rectLedges.length || phone) return;
      const densDiv = storm ? 18 : 28;
      const chanceMul = storm ? 22 : 12;
      for (let i = 0; i < rectLedges.length; i += 1) {
        const L = rectLedges[i];
        const dens = Math.max(3, Math.round(L.w / densDiv));
        for (let k = 0; k < dens; k += 1) {
          if (Math.random() > 0.5 * aMul * dt * chanceMul) continue;
          const x = L.x + L.w * (0.06 + Math.random() * 0.88);
          pushSplash({
            x, y: L.y + rand(-0.4, 1.2),
            vx: windLive * 8 + rand(-16, 16),
            vy: rand(-32, -6),
            life: rand(0.08, 0.18),
            r: rand(0.4, storm ? 1.6 : 1.35),
            soft: Math.random() < 0.45,
            kind: Math.random() < 0.6 ? "hard" : "soft",
            a: rand(0.5, 0.92),
          });
        }
      }
    };

    const hardStop = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(stopTimer);
      window.clearTimeout(resizeGlassTimer);
      window.clearTimeout(captureTimer);
      window.clearInterval(captureInterval);
      intensity = 0;
      targetIntensity = 0;
      splashes.length = 0;
      rims.length = 0;
      gpu?.stop();
      glassDrops?.clear();
      syncGlassOpacity();
      try {
        glassFx?.stop();
        glassAnimating = false;
      } catch { /* ignore */ }
      if (sctx) sctx.clearRect(0, 0, w, h);
    };

    const tick = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const frameMs = qualityFor(quality, storm, phone).frameMs;
      if (now - last < frameMs - 0.5) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = (now - t0) / 1000;

      const dir = Math.sign(targetIntensity - intensity);
      if (dir !== 0) {
        intensity += dir * (dt / FADE_SEC);
        if ((dir > 0 && intensity >= targetIntensity) || (dir < 0 && intensity <= targetIntensity)) {
          intensity = targetIntensity;
        }
      }
      syncGlassOpacity();
      stepWind(dt);

      const scrolling = !!opts.isScrolling?.();
      const ledges = (opts.collectLedges
        ? opts.collectLedges()
        : opts.getLedges?.()) || [];
      glassDrops?.setLedges?.(ledges);

      const screenOnNow = useScreenGlass && glassReady && !screenGlassDemoted;
      if (intensity > 0.001 && !screenOnNow) {
        drawFallback(dt, intensity);
      } else if (fallbackCtx && screenOnNow) {
        fallbackCtx.clearRect(0, 0, w, h);
      }
      /* 贴屏银丝叠层：半分辨率绘制再放大 → 细针+软晕运动模糊感 */
      if (overlayCtx && screenOnNow && intensity > 0.001) {
        const nowOv = performance.now();
        const dtOv = clamp((nowOv - lastOverlayAt) / 1000, 0.008, 0.05);
        lastOverlayAt = nowOv;
        /* R24: ~0.28 分辨率上采样 + 竖向微糊 */
        const loW = Math.max(2, Math.floor(w * 0.28));
        const loH = Math.max(2, Math.floor(h * 0.28));
        if (overlayLo.width !== loW || overlayLo.height !== loH) {
          overlayLo.width = loW;
          overlayLo.height = loH;
        }
        if (overlayLoCtx) {
          overlayLoCtx.setTransform(1, 0, 0, 1, 0, 0);
          overlayLoCtx.clearRect(0, 0, loW, loH);
          overlayStreaks.paint(overlayLoCtx, loW, loH, storm, dtOv, windLive * 0.85);
          overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
          overlayCtx.clearRect(0, 0, streakOverlay.width, streakOverlay.height);
          overlayCtx.imageSmoothingEnabled = true;
          overlayCtx.imageSmoothingQuality = "high";
          const dw = streakOverlay.width;
          const dh = streakOverlay.height;
          overlayCtx.globalAlpha = 0.18;
          overlayCtx.drawImage(overlayLo, 0, -0.8, dw, dh);
          overlayCtx.drawImage(overlayLo, 0, 0.8, dw, dh);
          overlayCtx.globalAlpha = 0.10;
          overlayCtx.drawImage(overlayLo, -0.34, 0, dw, dh);
          overlayCtx.drawImage(overlayLo, 0.34, 0, dw, dh);
          overlayCtx.globalAlpha = 0.26;
          overlayCtx.drawImage(overlayLo, 0, 0, dw, dh);
          overlayCtx.globalAlpha = 1;
        } else {
          overlayCtx.clearRect(0, 0, w, h);
          overlayStreaks.paint(overlayCtx, w, h, storm, dtOv, windLive * 0.85);
        }
      } else if (overlayCtx && !screenOnNow) {
        overlayCtx.clearRect(0, 0, w, h);
      }
      glassDrops?.draw(dt);

      if (!wantSplash || !sctx || intensity <= 0.001) {
        if (sctx && wantSplash) sctx.clearRect(0, 0, w, h);
        return;
      }

      sctx.clearRect(0, 0, w, h);
      const aMul = intensity;
      const qNow = qualityFor(quality, storm, phone);
      const splashMul = qNow.splashRate || 1;

      if (scrolling) {
        splashes.length = 0;
        rims.length = 0;
        splashAcc = 0;
      }

      /* 仅矩形卡片顶缘：短湿划 + 持续细珠 —— 对齐参考片卡缘积水 */
      const wetChance = (storm ? 0.7 : 0.55) * aMul;
      for (let i = 0; i < ledges.length; i += 1) {
        const L = ledges[i];
        if (L.shape === "circle") continue;
        const pulse = 0.55 + 0.45 * Math.sin(time * 5.6 + i * 1.25);
        const wetA = scrolling ? 0.4 : 1;
        if (!scrolling && Math.random() < wetChance) {
          const dashN = storm
            ? (3 + ((Math.random() * 5) | 0))
            : (3 + ((Math.random() * 4) | 0));
          for (let d = 0; d < dashN; d += 1) {
            const dx = L.x + L.w * (0.04 + Math.random() * 0.92);
            const dw = storm ? rand(3, 18) : rand(4, 20);
            sctx.fillStyle = `rgba(235,245,255,${rand(0.22, storm ? 0.55 : 0.48) * pulse * aMul * wetA})`;
            sctx.fillRect(dx, L.y - 1.0, dw, storm ? 2.6 : 2.3);
          }
          /* 顶缘连续湿膜 */
          if (Math.random() < (storm ? 0.55 : 0.62)) {
            sctx.fillStyle = `rgba(210,230,250,${(storm ? 0.14 : 0.16) * pulse * aMul * wetA})`;
            sctx.fillRect(L.x + L.w * 0.06, L.y - 0.6, L.w * 0.88, storm ? 1.8 : 1.5);
          }
        }
      }

      if (!scrolling) {
        const rectLedges = ledges.filter((L) => L.shape !== "circle");
        splashAcc += dt;
        const ledgeBase = (storm ? (phone ? 7 : 22) : (phone ? 4.5 : 16))
          + rectLedges.length * (storm ? (phone ? 1.1 : 3.2) : (phone ? 0.9 : 2.8));
        const rateCap = storm ? (phone ? 14 : 72) : (phone ? 10 : 42);
        const rate = Math.min(rateCap, ledgeBase * splashMul) * aMul;
        const burstCap = storm ? (phone ? 4 : 22) : (phone ? 3 : 14);
        let spawned = 0;
        while (rate > 0.2 && splashAcc > 1 / rate && rectLedges.length && spawned < burstCap) {
          splashAcc -= 1 / rate;
          spawnSplash(rectLedges[(Math.random() * rectLedges.length) | 0]);
          spawned += 1;
        }
        if (splashAcc > 1) splashAcc = 1;
        ensureRimBeads(rectLedges, dt, aMul);
      }

      rims.length = 0;

      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        const s = splashes[i];
        s.age += dt;
        const p = 1 - s.age / s.life;
        if (p <= 0) { splashes.splice(i, 1); continue; }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += (s.drip ? 420 : (storm ? 360 : 300)) * dt;
        if (s.drip) s.vx *= Math.exp(-dt * 1.8);
        const rad = s.r * (0.55 + p * 0.55);
        const alpha = (s.a ?? 1) * p * aMul;
        const spr = pickSplashSpr(s.kind || (s.soft ? "soft" : "hard"), rad * 2);
        if (spr) {
          const dw = rad * (s.soft ? 3.4 : 2.6);
          sctx.globalAlpha = alpha;
          sctx.drawImage(spr, s.x - dw * 0.5, s.y - dw * 0.5, dw, dw);
          sctx.globalAlpha = 1;
        } else {
          if (s.soft) {
            sctx.save();
            sctx.shadowColor = "rgba(210, 230, 255, 0.9)";
            sctx.shadowBlur = 5 + rad * 2;
            sctx.fillStyle = `rgba(255,255,255,${0.5 * alpha})`;
            sctx.beginPath();
            sctx.arc(s.x, s.y, rad * 1.3, 0, Math.PI * 2);
            sctx.fill();
            sctx.restore();
          }
          sctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`;
          sctx.beginPath();
          sctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
          sctx.fill();
        }
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        gpu?.stop();
        try { glassFx?.stop(); glassAnimating = false; } catch { /* ignore */ }
      } else if (running && targetIntensity > 0) {
        gpu?.start();
        if (glassReady && glassFx) {
          try { glassFx.start(); glassAnimating = true; } catch { /* ignore */ }
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return {
      start() {
        window.clearTimeout(stopTimer);
        targetIntensity = 1;
        if (!running) {
          running = true;
          resize();
          if (intensity <= 0) intensity = 0.02;
          t0 = performance.now();
          last = t0;
          raf = requestAnimationFrame(tick);
        }
        /* 短切标签后 running 仍为 true 时也要拉起 GPU */
        gpu?.start();
        if (wantRaindropFx) {
          void ensureGlass().then((ok) => {
            if (!ok || !running || targetIntensity <= 0) return;
            if (!glassAnimating) {
              try {
                glassFx.start();
                glassAnimating = true;
              } catch { /* ignore */ }
            }
          });
        }
      },
      stop() {
        targetIntensity = 0;
        window.clearTimeout(stopTimer);
        stopTimer = window.setTimeout(hardStop, FADE_SEC * 1000 + 60);
      },
      onScroll() {
        splashes.length = 0;
        rims.length = 0;
        splashAcc = 0;
        if (useScreenGlass && glassReady) scheduleDomCapture(180);
      },
      resize,
      destroy() {
        document.removeEventListener("visibilitychange", onVisibility);
        hardStop();
        gpu?.destroy();
        glassDrops?.destroy();
        glassCanvas.remove();
        streakCanvas.remove();
        splashCanvas.remove();
        glassDropCanvas.remove();
        mist.remove();
      },
    };
  }

  window.KayaHeavyRain = { attach };
})();
