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
    xShifting: [0, 0.02],
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
    smoothRaindrop: [0.95, 0.99],
    refractBase: 0.48,
    refractScale: 0.9,
    raindropCompose: "harder",
    raindropLightPos: [-0.5, 1.35, 2.7, 0],
    /* 中亮青白：靠折射显形；勿过亮（水泥）/过暗（墨泪痕） */
    raindropDiffuseLight: [0.58, 0.66, 0.78],
    raindropShadowOffset: 0.13,
    raindropEraserSize: [0.92, 1.0],
    raindropSpecularLight: [0.86, 0.91, 0.97],
    raindropSpecularShininess: 272,
    raindropLightBump: 0.9,
  };

  /* 固定中档：大雨 / 雷暴共用同一基准，雷暴仅在 qualityFor 内叠加 STORM_MUL */
  const QUALITY = {
    streak: 1850,
    dprCap: 1.4,
    frameMs: 1000 / 30,
    wind: 0.36,
    speedMul: 1.24,
    glassMain: 74,
    glassMicro: 820,
    splashRate: 1.48,
    glassMaxW: 1280,
    glass: {
      spawnInterval: [0.07, 0.14],
      spawnLimit: 480,
      dropletsPerSeconds: 400,
      dropletSize: [10, 26],
      backgroundBlurSteps: 0,
      mistBlurStep: 0,
    },
  };

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /** 手机：统一走 perf-governor，避免各模块判定不一致。 */
  function isPhoneLike() {
    if (window.KayaPerfGovernor?.isPhoneLike) return window.KayaPerfGovernor.isPhoneLike();
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

  function fadeRgbaColor(c0, factor) {
    const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(c0);
    if (!m) return c0;
    const a = m[4] != null ? parseFloat(m[4]) : 1;
    return `rgba(${m[1]},${m[2]},${m[3]},${Math.max(0, a * factor)})`;
  }

  function streakCapFor(storm, phone) {
    /* 暴雨：效果优先，拉高雨丝上限 */
    if (phone) return storm ? 5200 : 1400;
    return storm ? 15000 : 3600;
  }

  /**
   * 自研积雨纹理（Canvas）：多层软椭圆 + 细噪声，模仿 REF 云体起伏。
   * 禁止视频截帧。
   */
  function paintSelfSkyClouds(canvas, cssW, cssH, storm, loRes = false) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, loRes ? 0.78 : 1.2);
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
      g.addColorStop(hard, fadeRgbaColor(c0, 0.55));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    if (storm) {
      /* 暴雨 FBM 积雨：暗核 + 冷亮缝，体积感对齐参考片 */
      const cw = Math.max(64, Math.floor(tw / (loRes ? 2.4 : 1.85)));
      const ch = Math.max(80, Math.floor(th / (loRes ? 2.4 : 1.85)));
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
        let amp = 0.58;
        let f = 1;
        for (let o = 0; o < 6; o += 1) {
          a += amp * vnoise(x * f, y * f);
          amp *= 0.48;
          f *= 2.08;
        }
        return a;
      };
      for (let y = 0; y < ch; y += 1) {
        const ny = y / ch;
        for (let x = 0; x < cw; x += 1) {
          const nx = x / cw;
          let d = fbm(nx * 3.1 + 2.2, ny * 5.2 + 0.6);
          d += 0.32 * fbm(nx * 7.4 - 1.8, ny * 2.4 + 4.1);
          const envelope = 0.48
            + 0.22 * Math.sin(ny * Math.PI)
            + 0.1 * Math.sin(nx * Math.PI * 2.8);
          d = d * 0.7 + envelope * 0.42;
          let dens = Math.max(0, Math.min(1, (d - 0.42) / 0.4));
          dens = dens * dens * (3 - 2 * dens);
          const gap = Math.pow(Math.max(0, 1 - dens * 0.96), 1.12);
          const r = Math.round(12 * dens + 118 * gap + 48 * (1 - dens) * (1 - gap));
          const gch = Math.round(22 * dens + 138 * gap + 62 * (1 - dens) * (1 - gap));
          const b = Math.round(42 * dens + 168 * gap + 88 * (1 - dens) * (1 - gap));
          const a = Math.round(255 * (0.14 + 0.34 * dens + 0.42 * gap));
          const i = (y * cw + x) * 4;
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, gch));
          data[i + 2] = Math.max(0, Math.min(255, b));
          data[i + 3] = Math.max(28, Math.min(196, a));
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
        ctx.globalAlpha = 0.92;
        ctx.drawImage(off, 0, 0, tw, th);
        ctx.globalAlpha = 1;
      }
      blob(0.14, 0.06, 0.52, 0.14, "rgba(4,10,24,0.55)", 0.2);
      blob(0.86, 0.1, 0.48, 0.13, "rgba(2,8,20,0.52)", 0.2);
      blob(0.5, 0.2, 0.58, 0.11, "rgba(145,178,228,0.28)", 0.26);
      blob(0.28, 0.38, 0.42, 0.12, "rgba(8,18,38,0.48)", 0.22);
      blob(0.72, 0.42, 0.4, 0.11, "rgba(10,20,40,0.45)", 0.22);
      blob(0.5, 0.88, 0.82, 0.16, "rgba(4,12,28,0.42)", 0.3);
    } else {
      /* R18c：自研 FBM 积雨密度场（非视频截帧）——团块起伏可辨 */
      const cw = Math.max(56, Math.floor(tw / (loRes ? 2.8 : 2.2)));
      const ch = Math.max(72, Math.floor(th / (loRes ? 2.8 : 2.2)));
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
          /* 层状包络：减弱横向条带（loRes 放大后横纹明显） */
          const envelope = 0.56
            + 0.18 * Math.sin(ny * Math.PI)
            + 0.08 * Math.sin(nx * Math.PI * 3.1);
          d = d * 0.75 + envelope * 0.45;
          /* 高对比密度：拉开暗核/亮缝（R18d） */
          let dens = Math.max(0, Math.min(1, (d - 0.48) / 0.36));
          dens = dens * dens * (3 - 2 * dens);
          const gap = Math.pow(Math.max(0, 1 - dens * 0.98), 1.08);
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
    const n = Math.min(loRes ? 3200 : 5200, Math.floor((tw * th) / (loRes ? 200 : 140)));
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
      /* 暴雨折射底：层状暗核 + 冷亮缝（非纯径向糊） */
      const bands = [
        { y: 0.04, h: 0.2, c0: "rgba(6,12,24,0.92)", sx: 1.55, ox: 0 },
        { y: 0.16, h: 0.14, c0: "rgba(18,30,48,0.82)", sx: 1.2, ox: -0.18 },
        { y: 0.14, h: 0.12, c0: "rgba(14,24,42,0.78)", sx: 1.1, ox: 0.22 },
        { y: 0.28, h: 0.16, c0: "rgba(110,148,198,0.42)", sx: 1.35, ox: 0.04 },
        { y: 0.32, h: 0.1, c0: "rgba(78,110,152,0.32)", sx: 0.6, ox: -0.2 },
        { y: 0.44, h: 0.16, c0: "rgba(16,28,48,0.76)", sx: 1.05, ox: 0.14 },
        { y: 0.58, h: 0.18, c0: "rgba(10,20,38,0.78)", sx: 1.25, ox: -0.1 },
        { y: 0.72, h: 0.16, c0: "rgba(22,36,58,0.7)", sx: 1.3, ox: 0.1 },
        { y: 0.9, h: 0.24, c0: "rgba(4,10,22,0.9)", sx: 1.55, ox: 0 },
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
        g.addColorStop(1, "rgba(34,50,74,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      const blobs = [
        { x: tw * 0.18, y: th * 0.22, r: tw * 0.7, c: "rgba(90,132,180,0.38)" },
        { x: tw * 0.78, y: th * 0.16, r: tw * 0.6, c: "rgba(42,64,94,0.48)" },
        { x: tw * 0.52, y: th * 0.7, r: tw * 0.7, c: "rgba(28,46,74,0.46)" },
        { x: tw * 0.4, y: th * 0.06, r: tw * 0.5, c: "rgba(145,180,224,0.22)" },
        { x: tw * 0.08, y: th * 0.55, r: tw * 0.45, c: "rgba(64,92,132,0.24)" },
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

  /** 与 light-rain.js 一致的短针雨丝 + 尾渐隐（暗色背景用略亮色相） */
  const STREAK_HUE_RGB = {
    lilac: "174,160,230",
    silver: "215,225,245",
    mist: "188,204,232",
  };

  const STREAK_DROP_SPEC = {
    far: {
      len: [0.012, 0.022],
      speed: [245, 380],
      alpha: [0.28, 0.46],
      width: [1.1, 1.5],
      drift: [8, 16],
    },
    mid: {
      len: [0.018, 0.034],
      speed: [325, 515],
      alpha: [0.36, 0.58],
      width: [1.25, 1.7],
      drift: [10, 20],
    },
    near: {
      len: [0.024, 0.045],
      speed: [430, 650],
      alpha: [0.44, 0.68],
      width: [1.4, 2.0],
      drift: [12, 24],
    },
  };

  function createLightRainLayerPainter() {
    return function paintLayerBatch(ctx, arr, wind) {
      ctx.lineCap = "round";
      for (let i = 0; i < arr.length; i += 1) {
        const d = arr[i];
        d.wobble += 0.015;
        const sway = Math.sin(d.wobble + d.phase * 6) * (d.drift * 0.04);
        d._tilt = wind * d.drift * 0.12 + d.drift * 0.03 + sway;
        const x1 = d.x;
        const y1 = d.y;
        const x2 = d.x + d._tilt;
        const y2 = d.y + d.len;
        const rgb = STREAK_HUE_RGB[d.hue] || STREAK_HUE_RGB.mist;
        const a = d.alpha;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        const profile = window.KayaRainStreakProfile;
        if (profile) {
          profile.applyCanvasGradient(grad, rgb, a);
        } else {
          grad.addColorStop(0, `rgba(${rgb},0)`);
          grad.addColorStop(0.15, `rgba(${rgb},${a * 0.25})`);
          grad.addColorStop(0.42, `rgba(${rgb},${a * 0.46})`);
          grad.addColorStop(0.72, `rgba(${rgb},${a * 0.84})`);
          grad.addColorStop(1, `rgba(${rgb},${Math.min(1, a)})`);
        }
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = Math.max(1, d.width);
        ctx.strokeStyle = grad;
        ctx.stroke();
      }
    };
  }

  /** 小雨雨丝场：供大雨叠层/背景直接复用（无独立 rAF）。 */
  function createLightRainStreakEngine(canvas, opts = {}) {
    const paintLayerBatch = createLightRainLayerPainter();
    const DROP_COUNTS = opts.dropCounts || { far: 185, mid: 250, near: 150 };
    const densityMul = opts.densityMul ?? 1;
    const speedMul = opts.speedMul ?? 1;
    const alphaMul = opts.alphaMul ?? 1;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) {
      return { resize() {}, paint() {}, clear() {} };
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    const far = [];
    const mid = [];
    const near = [];

    const makeDrop = (layer) => {
      const H = Math.max(h, 640);
      const spec = STREAK_DROP_SPEC[layer];
      const roll = Math.random();
      return {
        x: Math.random() * Math.max(1, w),
        y: Math.random() * Math.max(1, h),
        len: rand(spec.len[0], spec.len[1]) * H,
        speed: rand(spec.speed[0], spec.speed[1]) * speedMul,
        alpha: rand(spec.alpha[0], spec.alpha[1]) * alphaMul,
        width: rand(spec.width[0], spec.width[1]) * (opts.widthMul ?? 1),
        drift: rand(spec.drift[0], spec.drift[1]),
        hue: roll < 0.28 ? "lilac" : (roll < 0.62 ? "mist" : "silver"),
        wobble: rand(0, Math.PI * 2),
        phase: Math.random(),
      };
    };

    const rebuild = () => {
      if (w < 2 || h < 2) return;
      const q = DROP_COUNTS;
      const areaScale = clamp((w * h) / (1280 * 720), 0.65, 1.4) * densityMul;
      const fill = (arr, n, layer) => {
        const count = Math.max(8, Math.round(n * areaScale));
        while (arr.length < count) arr.push(makeDrop(layer));
        if (arr.length > count) arr.length = count;
        for (let i = 0; i < arr.length; i += 1) {
          if (arr[i].x > w) arr[i].x = Math.random() * w;
          if (arr[i].y > h) arr[i].y = Math.random() * h;
        }
      };
      fill(far, q.far, "far");
      fill(mid, q.mid, "mid");
      fill(near, q.near, "near");
    };

    const stepDrop = (d, dt, wind) => {
      d.y += d.speed * dt;
      d.x += (wind * 28 + d.drift * 0.45) * dt;
      if (d.y > h + d.len) {
        d.y = -d.len - Math.random() * 60;
        d.x = Math.random() * w;
        d.phase = Math.random();
      } else if (d.x > w + 28) {
        d.x = -14;
      } else if (d.x < -28) {
        d.x = w + 14;
      }
    };

    return {
      resize(cssW, cssH, _tier = "mid", dprCap = 1.4) {
        w = cssW;
        h = cssH;
        dpr = Math.min(window.devicePixelRatio || 1, dprCap);
        const cw = Math.max(1, Math.floor(w * dpr));
        const ch = Math.max(1, Math.floor(h * dpr));
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineCap = "round";
        rebuild();
      },
      paint(dtSec, wind) {
        if (w < 2) return;
        const dt = clamp(dtSec || 0.016, 0.004, 0.05);
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < far.length; i += 1) stepDrop(far[i], dt, wind);
        for (let i = 0; i < mid.length; i += 1) stepDrop(mid[i], dt, wind);
        for (let i = 0; i < near.length; i += 1) stepDrop(near[i], dt, wind);
        paintLayerBatch(ctx, far, wind);
        paintLayerBatch(ctx, mid, wind);
        paintLayerBatch(ctx, near, wind);
      },
      clear() {
        if (w > 1) ctx.clearRect(0, 0, w, h);
      },
    };
  }

  /**
   * 截图像素探测：
   * 1) 整屏近黑 → 放弃
   * 2) 几乎没有亮色 UI 块（正文仍 opacity:0 时截到纯天空）→ 也放弃
   *    否则贴屏 WebGL 会用不含正文的底图盖满 z-index:50，表现为「只剩雨」。
   */
  function sampleRegionBrightness(cx, canvas, rx, ry, rw, rh) {
    const x0 = Math.max(0, Math.min(canvas.width - 1, Math.floor(rx * canvas.width)));
    const y0 = Math.max(0, Math.min(canvas.height - 1, Math.floor(ry * canvas.height)));
    const sw = Math.max(4, Math.min(64, Math.floor(rw * canvas.width), canvas.width - x0));
    const sh = Math.max(4, Math.min(64, Math.floor(rh * canvas.height), canvas.height - y0));
    const img = cx.getImageData(x0, y0, sw, sh).data;
    let sum = 0;
    let dark = 0;
    let bright = 0;
    const n = sw * sh;
    for (let i = 0; i < img.length; i += 4) {
      const y = 0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2];
      sum += y;
      if (y < 8) dark += 1;
      if (y > 72) bright += 1;
    }
    return {
      mean: sum / n,
      darkRatio: dark / n,
      brightRatio: bright / n,
    };
  }

  function captureLooksBlack(canvas) {
    try {
      const cx = canvas.getContext("2d");
      if (!cx || canvas.width < 8) return true;
      const full = sampleRegionBrightness(cx, canvas, 0, 0, 1, 1);
      if (full.mean < 10 || full.darkRatio > 0.94) return true;
      /* 暗色暴风雨底 mean 可到 40～90，但正常有面板/头像时应有一定亮像素 */
      if (full.brightRatio < 0.012 && full.mean < 95) return true;
      /* 正文区（头像/名字）应在画面中上部；仅顶栏+天空通过时仍会黑屏 */
      const hero = sampleRegionBrightness(cx, canvas, 0.18, 0.16, 0.64, 0.34);
      if (hero.brightRatio < 0.018 && hero.mean < 88) return true;
      return false;
    } catch {
      return true;
    }
  }

  /** 主页正文是否已揭幕到可截图（避免 opacity:0 时截出纯天空） */
  function isHomeUiCaptureReady() {
    const body = document.body;
    if (!body.classList.contains("page-home")) return true;
    if (body.classList.contains("home-intro-playing")) return false;
    /* home-ready 且正文已可见即可截；勿强依赖 home-revealed（跳过 intro 时可能未加） */
    if (!body.classList.contains("home-ready")
      && !body.classList.contains("home-revealed")) return false;
    const probes = document.querySelectorAll(".profile-avatar, .profile-name, .intro-panel");
    if (!probes.length) return body.classList.contains("home-ready")
      || body.classList.contains("home-revealed");
    try {
      return Array.from(probes).some((el) => {
        const st = getComputedStyle(el);
        const op = parseFloat(st.opacity || "0");
        return op > 0.55 && st.visibility !== "hidden" && st.display !== "none";
      });
    } catch {
      return true;
    }
  }

  /** 2D 打屏溅冠密度（贴屏大折射珠由 raindrop-fx；暴雨与大雨共用） */
  function condenseMicroN(_storm, phone) {
    return phone ? 88 : 120;
  }

  /**
   * 暴雨相对大雨（效果优先，不限制性能）：
   * 短密近竖直雨帘 + 更强贴屏水珠；风只做轻横移，勿大倾角。
   */
  const STORM_MUL = {
    streak: 3.45,
    wind: 1.44,
    speed: 1.68,
    splash: 4.2,
    glassMain: 2.75,
    glassMicro: 3.35,
    sizeMul: 1.12,
  };

  /** 暴雨雨量缩放（0.6 = 减 40%） */
  const STORM_RAIN_SCALE = 0.6;

  /** 暴雨专用：叠层/背景雨丝密度与速度（大雨仍走 GitHub 小雨对齐值） */
  const STORM_STREAK = {
    amount: 0.408,
    speed: 2.95,
    bgMul: 0.51,
    overlayMul: 0.69,
    dropCounts: { far: 384, mid: 516, near: 312 },
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

  function qualityFor(storm, phone) {
    const q = {
      ...QUALITY,
      glass: { ...QUALITY.glass },
    };
    if (!storm) {
      if (phone) {
        q.dprCap = Math.min(q.dprCap, 1.1);
        q.frameMs = Math.max(q.frameMs, 1000 / 24);
      }
      return q;
    }
    const mul = STORM_MUL;
    q.streak = Math.round(q.streak * mul.streak * STORM_RAIN_SCALE);
    q.wind = q.wind * mul.wind;
    q.speedMul = q.speedMul * mul.speed;
    q.splashRate = (q.splashRate || 1) * mul.splash;
    q.glassMain = Math.round((q.glassMain || 34) * mul.glassMain);
    q.glassMicro = Math.min(
      phone ? 980 : 1800,
      Math.max(phone ? 620 : 980, Math.round((q.glassMicro || 420) * mul.glassMicro)),
    );
    q.sizeMul = mul.sizeMul;
    q.dprCap = phone ? 1.65 : 2.5;
    q.frameMs = 1000 / 60;
    q.glassMaxW = 2560;
    q.glass = {
      spawnInterval: [0.006, 0.018],
      spawnLimit: 4800,
      dropletsPerSeconds: 2800,
      dropletSize: [8, 54],
      backgroundBlurSteps: 0,
      mistBlurStep: 0,
    };
    return q;
  }

  function glassOptsFor(storm, phone, screenGlass) {
    const g = qualityFor(storm, phone).glass;
    /* 贴屏必须始终覆盖 raindrop-fx 默认值，避免 mistBlur 等回落到库内置黑雾。 */
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
    /*
     * 贴屏折射珠 + 2D 打屏溅冠：暴雨与大雨共用同一套参数（无独立冷凝珠层）。
     * 冷凝微珠禁 raindrop droplets，避免与 2D 溅冠叠成双套圆点。
     */
    opts.spawnSize = phone ? [28, 58] : [34, 68];
    opts.slipRate = 0.94;
    opts.trailDropDensity = 0;
    opts.trailDropSize = [0.14, 0.24];
    opts.trailDistance = [16, 32];
    opts.trailSpread = 0.34;
    opts.initialSpread = 0.38;
    opts.shrinkRate = 0.02;
    opts.velocitySpread = 0.26;
    opts.evaporate = 18;
    opts.gravity = 2850;
    opts.xShifting = [0, 0.018];
    opts.colliderSize = 0.84;
    opts.refractBase = 0.48;
    opts.refractScale = 0.9;
    opts.raindropCompose = "harder";
    opts.smoothRaindrop = [0.95, 0.99];
    opts.backgroundBlurSteps = 0;
    opts.mist = false;
    opts.mistBlurStep = 0;
    opts.mistColor = [0.02, 0.03, 0.04, 0.0];
    opts.raindropSpecularLight = [0.86, 0.91, 0.97];
    opts.raindropSpecularShininess = 272;
    opts.raindropLightBump = 0.9;
    opts.raindropDiffuseLight = [0.58, 0.66, 0.78];
    opts.raindropShadowOffset = 0.13;
    opts.raindropLightPos = [-0.48, 1.38, 2.75, 0];
    opts.raindropEraserSize = [0.92, 1.0];
    opts.motionInterval = [0.035, 0.08];
    opts.dropletsPerSeconds = 0;
    opts.dropletSize = [4, 8];
    opts.spawnLimit = Math.min(
      opts.spawnLimit || 400,
      screenGlass ? (phone ? 88 : 140) : 96,
    );
    opts.spawnInterval = screenGlass ? [0.08, 0.15] : [0.07, 0.13];
    if (phone && !screenGlass) {
      opts.spawnSize = [24, 52];
      opts.spawnLimit = 120;
      opts.trailDropDensity = 0.18;
    }
    return opts;
  }

  function applyGlassOpts(fx, storm, phone, screenGlass) {
    const gOpts = glassOptsFor(storm, phone, screenGlass);
    if (!fx || !gOpts) return;
    Object.keys(gOpts).forEach((k) => {
      try { fx.options[k] = gOpts[k]; } catch { /* ignore */ }
    });
  }

  function glassBufferSize(cssW, cssH, storm, phone) {
    const maxW = storm
      ? (phone ? 1600 : 2560)
      : (phone ? 900 : QUALITY.glassMaxW);
    const dprN = storm
      ? (phone ? 1.65 : 2.5)
      : (phone ? 1.25 : QUALITY.dprCap);
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
    const useStaticBg = !!bgHost;
    const storm = !!opts.storm;
    if (useStaticBg && !storm) {
      document.body.classList.add("kaya-ambient-eco");
    }
    const RaindropCtor = typeof window.RaindropFX === "function"
      ? window.RaindropFX
      : window.RaindropFX?.default;

    const realPhone = isPhoneLike();
    const phone = storm ? false : realPhone;
    const q0 = qualityFor(storm, realPhone);
    const mobileLite = storm ? false : realPhone;
    const perfGovernor = storm
      ? null
      : (window.KayaPerfGovernor?.createRuntimeGovernor?.({
        min: 0.72,
        max: 1,
        initial: 1,
        weakGpu: !!window.KayaPerfGovernor?.isWeakGpu?.(),
        slowMs: 20,
        recoverMs: 14,
      }) || null);
    /* 贴屏 raindrop+html2canvas：用户要半透明大折射珠。
     * 关键：贴屏时不创建 GPU 雨丝（手机双 WebGL 会抢上下文 → raindrop 静默失败）。
     * 雨丝画进折射底图；失败 demote 后再挂 GPU + 2D 珠。 */
    const h2cOk = typeof window.html2canvas === "function";
    /* 手机禁用贴屏折射：html2canvas 常截不到正文 → 全屏黑底只剩雨丝，顶栏 z-index 仍可见 */
    let useScreenGlass = !!(RaindropCtor && h2cOk) && !realPhone;
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

    let streakCanvas = document.createElement("canvas");
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
    const syncCloudBlur = () => {
      if (storm) {
        cloudCanvas.style.filter = "blur(7px) saturate(0.9) contrast(1.08)";
        cloudCanvas.style.transform = "scale(1.08)";
      } else {
        cloudCanvas.style.filter = "blur(10px) saturate(0.97)";
        cloudCanvas.style.transform = "scale(1.06)";
      }
      cloudCanvas.style.transformOrigin = "center center";
    };
    const syncClouds = () => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      if (Math.abs(cw - cloudW) < 2 && Math.abs(ch - cloudH) < 2) return;
      cloudW = cw;
      cloudH = ch;
      paintSelfSkyClouds(cloudCanvas, cw, ch, storm, false);
      syncCloudBlur();
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

    /* 暴雨专属：远景雨幕 + 地面溅雾 + 阵风霾 */
    const stormAtmo = storm && window.KayaStormAtmosphere?.attach
      ? window.KayaStormAtmosphere.attach(fxRoot, { bgHost })
      : null;
    /* 暴雨后处理：镜头水珠 / 积水涟漪 / 风丝 / 侧流 / 色散震屏 */
    const stormPost = storm && window.KayaStormPostFx?.attach
      ? window.KayaStormPostFx.attach(fxRoot)
      : null;
    /* 暴雨叠层：视差雨帘 / bokeh / 杂物 / 雾卷 / 湿面高光 / 颗粒 / 擦玻璃 */
    const stormOverlay = storm && window.KayaStormOverlay?.attach
      ? window.KayaStormOverlay.attach(fxRoot, { bgHost })
      : null;
    /* 全屏 WebGL 折射（采样 DOM 快照） */
    const stormRefract = storm && window.KayaStormRefract?.attach
      ? window.KayaStormRefract.attach({
        getSource: () => {
          const src = (useScreenGlass && stormDomReady && stormDomBg.width > 2)
            ? stormDomBg
            : stormBg;
          return { canvas: src, w: src.width, h: src.height };
        },
      })
      : null;
    /* 雷声驱动整页低频震动 */
    const stormRumble = storm && window.KayaStormThunderRumble?.attach
      ? window.KayaStormThunderRumble.attach()
      : null;

    /* 贴屏 WebGL 盖住 site-bg 雨丝：用 Canvas2D 叠层画银丝（不占第二 WebGL） */
    const streakOverlay = document.createElement("canvas");
    streakOverlay.className = "site-fx__streak-overlay";
    streakOverlay.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(streakOverlay);
    /* 相对 GitHub 小雨：大雨减量对齐；暴雨走独立高密度雨帘 */
    const STREAK_AMOUNT_HEAVY = 0.07776;
    const STREAK_SPEED_HEAVY = 2.09088;
    const STREAK_AMOUNT = storm ? STORM_STREAK.amount : STREAK_AMOUNT_HEAVY;
    const STREAK_SPEED = storm ? STORM_STREAK.speed : STREAK_SPEED_HEAVY;
    const overlayLight = createLightRainStreakEngine(streakOverlay, {
      densityMul: STREAK_AMOUNT * (storm ? STORM_STREAK.overlayMul : 1),
      speedMul: STREAK_SPEED,
      dropCounts: storm ? STORM_STREAK.dropCounts : undefined,
      alphaMul: storm ? 1.22 : 1,
      widthMul: storm ? 1.12 : 1,
    });

    const sctx = splashCanvas.getContext("2d", { alpha: true });
    if (sctx) {
      splashCanvas.style.background = "transparent";
    }
    const stormBg = document.createElement("canvas");
    const stormDomBg = document.createElement("canvas");
    let stormDomReady = false;
    let lastDomCaptureAt = 0;
    let lastBgStreakAt = performance.now();

    const areaScale = clamp(
      (window.innerWidth * window.innerHeight) / (1280 * 720),
      0.7,
      storm ? (phone ? 1.35 : 1.85) : (phone ? 1.0 : 1.35),
    );
    const streakCount = Math.round(q0.streak * areaScale * (storm ? 1.0 : 0.82));
    const maxStreak = streakCapFor(storm, phone);

    const gpuOpts = () => ({
      count: Math.min(streakCount, maxStreak),
      countCap: storm ? 16000 : 7200,
      dprCap: storm
        ? (realPhone ? 1.85 : 2.5)
        : (realPhone ? Math.min(q0.dprCap, 1.2) : q0.dprCap),
      wind: q0.wind,
      speedMul: q0.speedMul,
      wanderWind: storm,
      tilt: storm ? 0.06 : 0.055,
      sizeMul: storm ? (q0.sizeMul || 1.12) : 1,
      sheet: storm ? 1 : 0.28,
      preserveDrawingBuffer: !!storm,
      adaptive: !storm,
    });

    /* 贴屏路径禁止先占 WebGL；非贴屏先挂 GPU，避免与 2D 上下文冲突 */
    let gpu = useScreenGlass
      ? null
      : window.KayaGpuStreakRain?.attach?.(streakCanvas, gpuOpts());

    const noopStreak = { resize() {}, paint() {}, clear() {} };
    const bgLight = (useScreenGlass || !gpu)
      ? createLightRainStreakEngine(streakCanvas, {
        densityMul: (storm ? STORM_STREAK.bgMul : 0.92) * STREAK_AMOUNT,
        speedMul: STREAK_SPEED,
        dropCounts: storm ? STORM_STREAK.dropCounts : undefined,
        alphaMul: storm ? 1.15 : 1,
        widthMul: storm ? 1.08 : 1,
      })
      : noopStreak;

    const ensureGpuStreaks = () => {
      if (gpu) return gpu;
      gpu = window.KayaGpuStreakRain?.attach?.(streakCanvas, gpuOpts()) || null;
      return gpu;
    };

    const useGpuStreaks = () => !!gpu;

    /* 贴屏成功时 2D 仅绘静态冷凝；未就绪时全开 2D 水珠 */
    const wantSplash = true;
    splashCanvas.style.display = wantSplash ? "" : "none";
    glassDropCanvas.style.display = "";
    if (storm) glassDropCanvas.classList.add("is-storm-glass");
    glassDropCanvas.classList.add("is-clear-glass");

    const glassMainN = realPhone ? 22 : 28;
    const glassMicroN = condenseMicroN(storm, realPhone);

    const glassDrops = window.KayaGlassDrops?.attach
      ? window.KayaGlassDrops.attach(glassDropCanvas, {
        main: glassMainN,
        micro: glassMicroN,
        dprCap: realPhone ? 1.2 : Math.min(q0.dprCap, 2),
        slideRatio: 0.28,
        storm: false,
        lite: mobileLite,
        noSpray: false,
        microSplashOnly: true,
      })
      : null;
    if (!glassDrops) glassDropCanvas.style.display = "none";

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
    let captureInFlight = false;
    /** @type {{ bw: number, bh: number } | null} */
    let captureQueued = null;
    let glassFx = null;
    let glassReady = false;
    let glassFailed = false;
    let glassAnimating = false;
    /* 贴屏真折射优先；无 GPU 时也可用背景 raindrop 兜底 */
    let wantRaindropFx = (useScreenGlass || !useGpuStreaks())
      && !!RaindropCtor
      && qualityFor(storm, realPhone).glass != null;
    /** 溅花 / 兜底雨丝跟随时风速（含符号） */
    let windLive = q0.wind * (storm && Math.random() < 0.5 ? -1 : 1);
    let windTarget = windLive;
    let windTimer = storm ? 0.35 : 2.0;
    let cloudDrift = 0;

    /** @type {Array<any>} */
    const splashes = [];
    /** @type {Array<any>} */
    const rims = [];

    const syncLightRainSize = () => {
      if (w < 2 || h < 2) return;
      const q = qualityFor(storm, phone);
      const dprCap = q.dprCap ?? 1.4;
      const odpr = Math.min(
        window.devicePixelRatio || 1,
        phone ? 1.15 : Math.min(dprCap, 1.4),
      );
      bgLight.resize(w, h, "mid", dprCap);
      overlayLight.resize(w, h, "mid", odpr);
    };

    const stepWind = (dt) => {
      if (gpu?.getWind) {
        windLive = gpu.getWind();
        return;
      }
      const q = qualityFor(storm, phone);
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
      stormAtmo?.setWind?.(windLive);
      stormPost?.setWind?.(windLive);
      stormPost?.setGust?.(stormAtmo?.gust ?? 0);
      stormOverlay?.setWind?.(windLive);
      stormOverlay?.setGust?.(stormAtmo?.gust ?? 0);
      stormRefract?.setWind?.(windLive);
    };

    const fitSplash = () => {
      dpr = Math.min(
        window.devicePixelRatio || 1,
        phone ? 1.05 : (storm ? 2.5 : QUALITY.dprCap),
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
      glassDrops?.resize(w, h);
      syncLightRainSize();
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
      /* 贴屏降级：替换 canvas 释放 2D 上下文，再挂 WebGL 雨丝 */
      const swapStreakCanvasForGpu = () => {
        const old = streakCanvas;
        const fresh = document.createElement("canvas");
        fresh.className = old.className;
        fresh.setAttribute("aria-hidden", "true");
        if (old.parentNode) old.parentNode.replaceChild(fresh, old);
        streakCanvas = fresh;
      };
      swapStreakCanvasForGpu();
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
      /* 贴屏折射珠 raindrop-fx；2D 仅打屏溅冠（暴雨与大雨一致，无独立冷凝珠层） */
      if (glassDrops) {
        const condenseOn = intensity > 0.05;
        glassDrops.setCondenseOnly?.(true);
        glassDrops.setEnabled?.(condenseOn);
        glassDrops.setIntensity(condenseOn ? intensity : 0);
        glassDropCanvas.style.display = condenseOn ? "" : "none";
        const condenseAlpha = screenOn ? intensity * 0.96 : intensity;
        glassDropCanvas.style.opacity = String(clamp(condenseAlpha, 0, 1));
      }
      mist.classList.toggle("is-on", intensity > 0.05 && (!screenOn || storm));
      /* 贴屏：背景层雨丝（site-bg__heavy）+ 前景叠层 */
      if (!gpu) {
        streakCanvas.style.opacity = String(
          screenOn
            ? clamp(intensity * 0.88, 0, 0.92)
            : clamp(intensity * 0.9, 0, 0.9),
        );
        streakCanvas.style.mixBlendMode = "normal";
      }
      const wantOverlay = screenOn && intensity > 0.05;
      streakOverlay.classList.toggle("is-on", wantOverlay);
      streakOverlay.style.display = wantOverlay ? "block" : "none";
      streakOverlay.style.opacity = String(clamp(
        wantOverlay ? intensity * (storm ? 1.08 : 1) : 0,
        0,
        storm ? 1 : 1,
      ));
      stormAtmo?.setIntensity?.(intensity);
      stormPost?.setIntensity?.(intensity);
      stormOverlay?.setIntensity?.(intensity);
      stormRumble?.setIntensity?.(intensity);
      stormRefract?.setIntensity?.(intensity);
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
        || cls.contains("site-fx")
        || [...cls].some((c) => c.startsWith("site-fx__storm-"));
    };

    /** 贴屏：天空 + DOM 快照 + GitHub 小雨雨丝。绝不 drawImage WebGL */
    const paintBgStreaksDense = (bx, bw, bh, dtSec) => {
      bgLight.paint(dtSec, windLive);
      if (streakCanvas.width > 2 && streakCanvas.height > 2) {
        bx.setTransform(1, 0, 0, 1, 0, 0);
        bx.drawImage(streakCanvas, 0, 0, streakCanvas.width, streakCanvas.height, 0, 0, bw, bh);
      }
    };

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
        if (glassReady && streakCanvas.width > 2 && streakCanvas.height > 2) {
          bx.drawImage(streakCanvas, 0, 0, streakCanvas.width, streakCanvas.height, 0, 0, bw, bh);
        } else {
          paintBgStreaksDense(bx, bw, bh, dtSec);
        }
        return stormBg;
      }
      if (glassReady && streakCanvas.width > 2 && streakCanvas.height > 2) {
        bx.setTransform(1, 0, 0, 1, 0, 0);
        bx.drawImage(streakCanvas, 0, 0, streakCanvas.width, streakCanvas.height, 0, 0, bw, bh);
      } else {
        paintBgStreaksDense(bx, bw, bh, dtSec);
      }
      return stormBg;
    };

    let captureUiRetries = 0;
    let captureWatchdog = 0;
    let captureWatchdogFails = 0;
    let bgPushInFlight = false;
    let bgPushQueued = false;
    let glassStartGen = 0;

    const pauseCaptureWork = () => {
      window.clearTimeout(captureTimer);
      window.clearInterval(captureInterval);
      window.clearTimeout(captureWatchdog);
      captureTimer = 0;
      captureInterval = 0;
      captureWatchdog = 0;
      captureQueued = null;
      /* 后台/异常中断时勿让 in-flight 锁死后续截图 */
      captureInFlight = false;
      bgPushQueued = false;
    };

    /** raindrop-fx.start() 每次都会再挂一条 RAF；必须先 stop，避免双循环卡死主线程 */
    const safeGlassStart = () => {
      if (!glassFx || !glassReady || screenGlassDemoted || document.hidden) return;
      const gen = ++glassStartGen;
      try { glassFx.stop(); } catch { /* ignore */ }
      glassAnimating = false;
      try {
        const ret = glassFx.start();
        void Promise.resolve(ret).then(() => {
          if (gen !== glassStartGen || document.hidden || !running || targetIntensity <= 0) {
            try { glassFx?.stop(); } catch { /* ignore */ }
            return;
          }
          glassAnimating = true;
        }).catch(() => {
          glassAnimating = false;
        });
        glassAnimating = true;
      } catch {
        glassAnimating = false;
      }
    };

    const safeGlassStop = () => {
      glassStartGen += 1;
      try { glassFx?.stop(); } catch { /* ignore */ }
      glassAnimating = false;
    };

    const startCaptureInterval = () => {
      if (!useScreenGlass || !glassReady || screenGlassDemoted || document.hidden) return;
      window.clearInterval(captureInterval);
      /* 旧值 24–72ms 会并发 setBackground→reloadBackground 毁掉纹理，切回前台必卡 */
      const pushMs = storm ? 180 : (realPhone ? 360 : 220);
      const recaptureMs = storm ? 2500 : (realPhone ? 6000 : 4000);
      captureInterval = window.setInterval(() => {
        if (!glassReady || !running || document.hidden || screenGlassDemoted || targetIntensity <= 0) return;
        void pushGlassBackground();
        if (performance.now() - lastDomCaptureAt > recaptureMs) scheduleDomCapture(240);
      }, pushMs);
    };

    const ensureGpuRunning = () => {
      if (!gpu) return;
      if (gpu.ok) {
        gpu.start();
        return;
      }
      try { gpu.destroy?.(); } catch { /* ignore */ }
      gpu = window.KayaGpuStreakRain?.attach?.(streakCanvas, gpuOpts()) || null;
      if (!gpu) return;
      gpu.resize(w, h);
      const q = qualityFor(storm, phone);
      const n = Math.round(q.streak * clamp((w * h) / (1280 * 720), 0.7, storm ? 1.6 : (realPhone ? 1.0 : 1.55)));
      gpu.setCount(Math.min(n, streakCapFor(storm, phone)));
      gpu.setFrameBudget(q.frameMs);
      gpu.setWind?.(q.wind);
      gpu.setSpeedMul?.(q.speedMul);
      gpu.setSheet?.(storm ? 1 : 0.9);
      gpu.setTilt?.(storm ? 0.045 : 0.065);
      gpu.setSizeMul?.(storm ? (q.sizeMul || 1.12) : 1);
      gpu.setAdaptive?.(!storm);
      gpu.start();
    };

    const runCaptureStormDom = async (bw, bh) => {
      if (!useScreenGlass || screenGlassDemoted) return stormDomReady;
      if (document.hidden) {
        scheduleDomCapture(480);
        return stormDomReady;
      }
      if (!isHomeUiCaptureReady()) {
        captureUiRetries += 1;
        if (captureUiRetries > 24) {
          demoteScreenGlass("ui never visible for capture");
          return false;
        }
        /* 正文尚未可见：延后截图，切勿用纯天空底图启用贴屏 */
        scheduleDomCapture(160);
        return false;
      }
      if (captureInFlight) {
        captureQueued = { bw, bh };
        return stormDomReady;
      }
      const h2c = typeof window.html2canvas === "function" ? window.html2canvas : null;
      if (!h2c) return false;
      captureInFlight = true;
      window.clearTimeout(captureWatchdog);
      /* html2canvas 偶发永不 resolve；暴雨层多，超时放宽并先重试再降级 */
      captureWatchdog = window.setTimeout(() => {
        if (!captureInFlight) return;
        console.warn("[kaya] storm glass capture watchdog");
        captureInFlight = false;
        captureQueued = null;
        captureWatchdogFails += 1;
        if (captureWatchdogFails >= 3 && storm) {
          demoteScreenGlass("capture watchdog");
        } else if (!storm) {
          scheduleDomCapture(480);
        } else {
          scheduleDomCapture(storm ? 480 : 240);
        }
      }, storm ? 18000 : 10000);
      const prevGlass = glassCanvas.style.display;
      const prevSplash = splashCanvas.style.display;
      const prevDrops = glassDropCanvas.style.display;
      const prevMist = mist.style.display;
      const prevStreak = streakCanvas.style.display;
      const refractNode = document.querySelector(".site-fx__storm-refract");
      const prevRefract = refractNode?.style.display ?? "";
      glassCanvas.style.display = "none";
      splashCanvas.style.display = "none";
      glassDropCanvas.style.display = "none";
      mist.style.display = "none";
      streakCanvas.style.display = "none";
      if (refractNode) refractNode.style.display = "none";
      /** 暴雨：截图时暂藏整层 site-fx，加速 html2canvas 并避免截进半透明特效 */
      const hiddenStormLayers = [];
      if (storm) {
        document.querySelectorAll(".site-fx").forEach((el) => {
          hiddenStormLayers.push({ el, display: el.style.display });
          el.style.display = "none";
        });
      }
      const skyHex = storm ? "#1a283c" : "#455f7a";
      try {
        const scale = Math.min(
          bw / Math.max(1, window.innerWidth),
          storm ? 1.12 : 2.5,
        );
        const captureRoot = storm ? document.body : document.documentElement;
        const shot = await h2c(captureRoot, {
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
          imageTimeout: 4000,
          ignoreElements: ignoreCaptureEl,
        });
        if (document.hidden || screenGlassDemoted) return stormDomReady && useScreenGlass;
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
            captureUiRetries += 1;
            if (captureUiRetries > 8 && storm) {
              demoteScreenGlass("capture too dark or no UI");
            } else if (!storm) {
              scheduleDomCapture(480);
            } else {
              scheduleDomCapture(220);
            }
          } else {
            stormDomReady = true;
            captureUiRetries = 0;
            captureWatchdogFails = 0;
            lastDomCaptureAt = performance.now();
            stormRefract?.refreshTexture?.();
          }
        }
      } catch (err) {
        console.warn("[kaya] storm glass capture failed", err);
        if (storm) {
          demoteScreenGlass("capture threw");
        } else {
          /* 大雨：快照失败不 demote；冷凝溅冠不依赖 DOM 截图 */
          stormDomReady = false;
          captureWatchdogFails += 1;
        }
      } finally {
        window.clearTimeout(captureWatchdog);
        captureWatchdog = 0;
        hiddenStormLayers.forEach(({ el, display }) => { el.style.display = display; });
        glassCanvas.style.display = prevGlass;
        splashCanvas.style.display = prevSplash;
        glassDropCanvas.style.display = prevDrops;
        mist.style.display = prevMist;
        streakCanvas.style.display = prevStreak;
        if (refractNode) refractNode.style.display = prevRefract;
        captureInFlight = false;
        if (captureQueued && !document.hidden) {
          const next = captureQueued;
          captureQueued = null;
          void runCaptureStormDom(next.bw, next.bh);
        } else {
          captureQueued = null;
        }
      }
      return stormDomReady && useScreenGlass;
    };

    const captureStormDom = (bw, bh) => runCaptureStormDom(bw, bh);

    const pushGlassBackground = async () => {
      if (!glassReady || !glassFx || screenGlassDemoted || document.hidden) return;
      if (bgPushInFlight) {
        bgPushQueued = true;
        return;
      }
      bgPushInFlight = true;
      try {
        const { bw, bh } = glassBufferSize(w || window.innerWidth, h || window.innerHeight, storm, realPhone);
        composeGlassBackground(bw, bh);
        await glassFx.setBackground(stormBg);
      } catch { /* ignore */ }
      finally {
        bgPushInFlight = false;
        if (bgPushQueued && !document.hidden && running && targetIntensity > 0) {
          bgPushQueued = false;
          void pushGlassBackground();
        } else {
          bgPushQueued = false;
        }
      }
    };

    const scheduleDomCapture = (delay = 420) => {
      if (!useScreenGlass || !wantRaindropFx || screenGlassDemoted || document.hidden) return;
      window.clearTimeout(captureTimer);
      captureTimer = window.setTimeout(() => {
        void (async () => {
          if (document.hidden || !running || targetIntensity <= 0 || screenGlassDemoted) return;
          const { bw, bh } = glassBufferSize(w || window.innerWidth, h || window.innerHeight, storm, realPhone);
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
        const { bw, bh } = glassBufferSize(w || window.innerWidth, h || window.innerHeight, storm, realPhone);
        if (useScreenGlass) {
          /* 等正文可见再截；超时则 demote，避免黑底贴屏 */
          const waitUi = async () => {
            for (let i = 0; i < 40; i += 1) {
              if (screenGlassDemoted) return false;
              if (isHomeUiCaptureReady()) return true;
              await new Promise((r) => setTimeout(r, 80));
            }
            if (storm) {
              demoteScreenGlass("ui wait timeout");
              return false;
            }
            return true;
          };
          if (!(await waitUi())) return false;
          if (storm) {
            const captureOk = await Promise.race([
              captureStormDom(bw, bh),
              new Promise((resolve) => {
                window.setTimeout(() => resolve(false), 14000);
              }),
            ]);
            if (screenGlassDemoted) return false;
            if (!captureOk) {
              composeGlassBackground(bw, bh);
              scheduleDomCapture(520);
            }
          } else {
            /* 大雨：先天空+雨丝启贴屏；DOM 快照后台重试（color-mix 常致 h2c 失败） */
            composeGlassBackground(bw, bh);
            void captureStormDom(bw, bh).then((ok) => {
              if (ok && glassReady && !screenGlassDemoted) {
                void pushGlassBackground();
              }
            });
          }
        }
        if (storm || useScreenGlass) composeGlassBackground(bw, bh);
        glassCanvas.width = bw;
        glassCanvas.height = bh;
        const gOpts = glassOptsFor(storm, realPhone, useScreenGlass) || {};
        glassFx = new RaindropCtor({
          canvas: glassCanvas,
          width: bw,
          height: bh,
          background: stormBg,
          ...gOpts,
          mist: false,
          backgroundBlurSteps: 0,
          mistBlurStep: 0,
          /* 亮漫反射 + shadow≤0.18（库默认 0.8 会发黑） */
          raindropShadowOffset: Math.min(gOpts.raindropShadowOffset ?? 0.13, 0.16),
          raindropCompose: gOpts.raindropCompose || "harder",
          raindropDiffuseLight: gOpts.raindropDiffuseLight || [0.58, 0.66, 0.78],
        });
        applyGlassOpts(glassFx, storm, realPhone, useScreenGlass);
        try {
          glassFx.options.mist = false;
          glassFx.options.backgroundBlurSteps = 0;
          glassFx.options.mistBlurStep = 0;
          glassFx.options.raindropShadowOffset = Math.min(
            glassFx.options.raindropShadowOffset || 0.13,
            0.16,
          );
          glassFx.options.raindropDiffuseLight = gOpts.raindropDiffuseLight
            || [0.58, 0.66, 0.78];
          glassFx.options.raindropSpecularLight = gOpts.raindropSpecularLight
            || [0.86, 0.91, 0.97];
          glassFx.options.raindropLightBump = gOpts.raindropLightBump ?? 0.9;
          glassFx.options.refractBase = gOpts.refractBase ?? 0.48;
          glassFx.options.refractScale = gOpts.refractScale ?? 0.9;
          glassFx.options.raindropCompose = gOpts.raindropCompose || "harder";
          glassFx.options.smoothRaindrop = gOpts.smoothRaindrop || [0.95, 0.99];
          glassFx.options.spawnSize = gOpts.spawnSize || glassFx.options.spawnSize;
          glassFx.options.dropletsPerSeconds = gOpts.dropletsPerSeconds ?? 0;
          glassFx.options.trailDropDensity = gOpts.trailDropDensity ?? 0;
          glassFx.options.slipRate = gOpts.slipRate ?? 0.98;
          glassFx.options.gravity = gOpts.gravity ?? 3100;
          glassFx.options.motionInterval = gOpts.motionInterval || [0.02, 0.055];
          glassFx.options.evaporate = gOpts.evaporate ?? 20;
          glassFx.options.velocitySpread = gOpts.velocitySpread ?? 0.26;
        } catch { /* ignore */ }
        await glassFx.setBackground(stormBg);
        await glassFx.start();
        glassReady = true;
        glassAnimating = true;
        console.info("[kaya] screen glass ready", storm ? "storm" : "heavy");
        syncGlassOpacity();
        if (useScreenGlass && !screenGlassDemoted) {
          scheduleDomCapture(storm ? 420 : (realPhone ? 1100 : 600));
          startCaptureInterval();
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
        const { bw, bh } = glassBufferSize(w, h, storm, realPhone);
        if (useScreenGlass) await captureStormDom(bw, bh);
        if (screenGlassDemoted) return;
        composeGlassBackground(bw, bh);
        glassFx.resize(bw, bh);
        await glassFx.setBackground(stormBg);
        applyGlassOpts(glassFx, storm, realPhone, useScreenGlass);
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
      const q = qualityFor(storm, realPhone);
      syncCloudBlur();
      wantRaindropFx = (useScreenGlass || !useGpuStreaks()) && !!RaindropCtor && q.glass != null;
      fitSplash();
      gpu?.resize(w, h);
      const n = Math.round(q.streak * clamp((w * h) / (1280 * 720), 0.7, storm ? 1.6 : (realPhone ? 1.0 : 1.55)));
      gpu?.setCount(Math.min(n, streakCapFor(storm, phone)));
      gpu?.setFrameBudget(q.frameMs);
      gpu?.setWind?.(q.wind);
      gpu?.setSpeedMul?.(q.speedMul);
      gpu?.setSizeMul?.(1);
      gpu?.setSheet?.(storm ? 1 : 0.9);
      gpu?.setTilt?.(storm ? 0.045 : 0.065);
      gpu?.setSizeMul?.(storm ? (q.sizeMul || 1.12) : 1);
      gpu?.setAdaptive?.(!storm);
      glassDrops?.setCounts(
        realPhone ? 22 : 28,
        condenseMicroN(storm, realPhone),
      );
      const ledgeSnap = (opts.collectLedges
        ? opts.collectLedges()
        : opts.getLedges?.()) || [];
      glassDrops?.setLedges?.(ledgeSnap);
      scheduleResizeGlass();
      syncClouds();
      syncLightRainSize();
      syncGlassOpacity();
      stormAtmo?.resize?.(w, h);
      stormPost?.resize?.(w, h);
      stormOverlay?.resize?.(w, h);
      stormRefract?.resize?.();
    };

    const hitPointOnLedge = (ledge) => {
      const inset = Math.min(ledge.radius * 0.55, ledge.w * 0.05);
      return {
        x: ledge.x + inset + Math.random() * Math.max(4, ledge.w - inset * 2),
        y: ledge.y + Math.random() * 1.2,
      };
    };

    const pushSplash = (opts) => {
      const cap = phone ? (storm ? 320 : 70) : (storm ? 1600 : 320);
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
        stormAtmo?.hit?.(hit.x, hit.y, phone ? 0.85 : 1.35);
      }

      if (storm) {
        pushSplash({
          x: hit.x, y: hit.y,
          vx: windBias * 0.18, vy: rand(-28, -10),
          life: rand(0.18, 0.34), r: rand(2.8, 5.2),
          soft: true, kind: "soft", a: 0.82,
        });
        const n = phone ? (5 + ((Math.random() * 5) | 0)) : (10 + ((Math.random() * 12) | 0));
        for (let i = 0; i < n; i += 1) {
          const ang = -Math.PI * 0.02 - Math.random() * Math.PI * 0.98;
          const spd = rand(50, phone ? 160 : 220);
          const fine = Math.random() < 0.5;
          pushSplash({
            x: hit.x + rand(-6, 6),
            y: hit.y + rand(-1.5, 2),
            vx: Math.cos(ang) * spd + windBias,
            vy: Math.sin(ang) * spd,
            life: fine ? rand(0.1, 0.22) : rand(0.16, 0.38),
            r: fine ? rand(0.55, 1.6) : rand(1.6, 3.8),
            soft: Math.random() < 0.45,
            kind: fine ? "hard" : (Math.random() < 0.5 ? "soft" : "hard"),
            a: fine ? 0.98 : 0.9,
          });
        }
        if (Math.random() < 0.72) {
          pushSplash({
            x: hit.x + rand(-8, 8),
            y: hit.y + rand(1, 5),
            vx: windBias * 0.25 + rand(-16, 16),
            vy: rand(40, 110),
            life: rand(0.32, 0.62),
            r: rand(1.4, 3.2),
            soft: true, kind: "soft", drip: true, a: 0.82,
          });
        }
        if (!phone && Math.random() < 0.4) {
          for (let c = 0; c < 3; c += 1) {
            pushSplash({
              x: hit.x + rand(-10, 10),
              y: hit.y + rand(-2, 2),
              vx: windBias * 0.1 + rand(-40, 40),
              vy: rand(-55, -15),
              life: rand(0.08, 0.16),
              r: rand(0.4, 1.1),
              soft: false, kind: "hard", a: 0.95,
            });
          }
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

    /** 顶缘湿珠：暴雨更密（效果优先，手机也开） */
    const ensureRimBeads = (rectLedges, dt, aMul) => {
      if (!rectLedges.length) return;
      if (!storm && phone) return;
      const densDiv = storm ? 12 : 28;
      const chanceMul = storm ? 34 : 12;
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
      raf = 0;
      window.clearTimeout(stopTimer);
      window.clearTimeout(resizeGlassTimer);
      pauseCaptureWork();
      bgPushInFlight = false;
      bgPushQueued = false;
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
      stormAtmo?.clear?.();
      stormPost?.clear?.();
      stormOverlay?.clear?.();
      stormRefract?.clear?.();
    };

    /** 切后台立刻停，不做淡出（淡出期间 RAF/截图仍会拖垮恢复） */
    const pauseNow = () => {
      window.clearTimeout(stopTimer);
      stopTimer = 0;
      targetIntensity = 0;
      pauseCaptureWork();
      bgPushQueued = false;
      cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      gpu?.stop();
      safeGlassStop();
    };

    const tick = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const qNow = qualityFor(storm, phone);
      const frameMs = qNow.frameMs;
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
      if (storm) {
        cloudDrift += dt * (0.1 + Math.abs(windLive) * 0.05);
        const ox = Math.sin(cloudDrift) * 1.4;
        const oy = Math.cos(cloudDrift * 0.72) * 0.75;
        cloudCanvas.style.transform = `scale(1.08) translate(${ox}%, ${oy}%)`;
      }
      stormAtmo?.draw?.(dt);
      stormPost?.draw?.(dt);
      stormOverlay?.draw?.(dt);
      stormRefract?.draw?.(dt);
      const frameStart = performance.now();

      const scrolling = !!opts.isScrolling?.();
      const ledges = (opts.collectLedges
        ? opts.collectLedges()
        : opts.getLedges?.()) || [];
      glassDrops?.setLedges?.(ledges);
      stormOverlay?.setLedges?.(ledges);

      const screenOnNow = useScreenGlass && glassReady && !screenGlassDemoted;
      if (intensity > 0.001 && !gpu) {
        bgLight.paint(dt, windLive);
      }
      /* 贴屏银丝叠层：GitHub 小雨合批 stroke，盖在冷凝珠之上 */
      if (screenOnNow && intensity > 0.001) {
        if (!perfGovernor?.shouldSkipExtras?.()) {
          overlayLight.paint(dt, windLive);
        } else {
          overlayLight.clear();
        }
      } else {
        overlayLight.clear();
      }
      glassDrops?.draw(dt);
      perfGovernor?.noteFrame?.(qNow.frameMs, performance.now() - frameStart);

      if (!wantSplash || !sctx || intensity <= 0.001) {
        if (sctx && wantSplash) sctx.clearRect(0, 0, w, h);
        return;
      }
      /* 性能治理：帧成本高时跳过溅花绘制 */
      if (perfGovernor?.shouldSkipSplashes?.()) {
        sctx.clearRect(0, 0, w, h);
        return;
      }

      sctx.clearRect(0, 0, w, h);
      const aMul = intensity;
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
        const ledgeBase = (storm ? (phone ? 12 : 38) : (phone ? 4.5 : 16))
          + rectLedges.length * (storm ? (phone ? 2.2 : 5.2) : (phone ? 0.9 : 2.8));
        const rateCap = storm ? (phone ? 32 : 180) : (phone ? 10 : 42);
        const rate = Math.min(rateCap, ledgeBase * splashMul) * aMul;
        const burstCap = storm ? (phone ? 10 : 64) : (phone ? 3 : 14);
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
        pauseNow();
        return;
      }
      /* 由 main 统一 resume（start）；这里只兜底 GPU/玻璃，避免双 start 叠 RAF */
      if (!running || targetIntensity <= 0) return;
      const now = performance.now();
      last = now;
      if (!raf) raf = requestAnimationFrame(tick);
      ensureGpuRunning();
      safeGlassStart();
      lastDomCaptureAt = now;
      window.setTimeout(() => {
        if (document.hidden || !running || targetIntensity <= 0) return;
        if (useScreenGlass && glassReady && !screenGlassDemoted) {
          startCaptureInterval();
          scheduleDomCapture(2000);
        }
      }, 2500);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return {
      start() {
        window.clearTimeout(stopTimer);
        targetIntensity = 1;
        const now = performance.now();
        if (!running) {
          running = true;
          resize();
          if (intensity <= 0) intensity = 0.02;
          t0 = now;
          last = now;
          raf = requestAnimationFrame(tick);
        } else {
          last = now;
          if (!raf) raf = requestAnimationFrame(tick);
        }
        ensureGpuRunning();
        if (wantRaindropFx) {
          void ensureGlass().then((ok) => {
            if (!ok || !running || targetIntensity <= 0 || document.hidden) return;
            safeGlassStart();
          });
        }
      },
      pause: pauseNow,
      stop() {
        targetIntensity = 0;
        window.clearTimeout(stopTimer);
        pauseCaptureWork();
        /* 可见时淡出；后台由 pauseNow 硬停 */
        if (document.hidden) {
          pauseNow();
          return;
        }
        stopTimer = window.setTimeout(hardStop, FADE_SEC * 1000 + 60);
      },
      onScroll() {
        splashes.length = 0;
        rims.length = 0;
        splashAcc = 0;
        if (useScreenGlass && glassReady && !document.hidden) scheduleDomCapture(280);
      },
      resize,
      destroy() {
        document.removeEventListener("visibilitychange", onVisibility);
        hardStop();
        try { glassFx?.stop(); } catch { /* ignore */ }
        glassFx = null;
        gpu?.destroy();
        glassDrops?.destroy();
        cloudCanvas.remove();
        glassCanvas.remove();
        streakCanvas.remove();
        streakOverlay.remove();
        splashCanvas.remove();
        glassDropCanvas.remove();
        mist.remove();
        stormAtmo?.destroy?.();
        stormPost?.destroy?.();
        stormOverlay?.destroy?.();
        stormRefract?.destroy?.();
        stormRumble?.destroy?.();
        if (useStaticBg && !storm
          && !document.body.classList.contains("light-rain")
          && !document.body.classList.contains("sunny-sky")) {
          document.body.classList.remove("kaya-ambient-eco");
        }
      },
    };
  }

  window.KayaHeavyRain = { attach };
})();
