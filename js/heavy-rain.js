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
    spawnSize: [20, 72],
    slipRate: 0.86,
    motionInterval: [0.2, 0.5],
    xShifting: [0, 0.03],
    colliderSize: 0.88,
    trailDropDensity: 0.18,
    trailDropSize: [0.3, 0.45],
    trailDistance: [14, 28],
    trailSpread: 0.45,
    initialSpread: 0.5,
    shrinkRate: 0.016,
    velocitySpread: 0.3,
    evaporate: 18,
    gravity: 3000,
    mist: false,
    mistColor: [0.18, 0.24, 0.32, 0.08],
    mistTime: 7,
    smoothRaindrop: [0.96, 1],
    refractBase: 0.34,
    refractScale: 0.52,
    raindropCompose: "smoother",
    raindropLightPos: [-0.4, 1.15, 2.4, 0],
    raindropDiffuseLight: [0.42, 0.48, 0.55],
    raindropShadowOffset: 0.32,
    raindropEraserSize: [0.93, 1],
    raindropSpecularLight: [0.35, 0.4, 0.48],
    raindropSpecularShininess: 56,
    raindropLightBump: 0.55,
  };

  const QUALITY = {
    low: {
      streak: 1100,
      dprCap: 1.2,
      frameMs: 1000 / 24,
      wind: 0.3,
      speedMul: 1.18,
      glassMain: 44,
      glassMicro: 460,
      splashRate: 1.3,
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
    high: {
      streak: 2800,
      dprCap: 1.6,
      frameMs: 1000 / 30,
      wind: 0.42,
      speedMul: 1.3,
      glassMain: 104,
      glassMicro: 1280,
      splashRate: 1.65,
      glassMaxW: 1400,
      glass: {
        spawnInterval: [0.045, 0.1],
        spawnLimit: 720,
        dropletsPerSeconds: 580,
        dropletSize: [8, 24],
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

  /** 手机/平板：勿用「CSS 宽度」误判为桌面（横屏常 >720） */
  function isPhoneLike() {
    try {
      if (navigator.connection?.saveData) return true;
    } catch { /* ignore */ }
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)) return true;
    try {
      if (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) <= 920) return true;
      if (window.matchMedia("(pointer: coarse)").matches
        && window.matchMedia("(max-width: 1100px)").matches) return true;
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
    const mem = navigator.deviceMemory || 8;
    const area = window.innerWidth * window.innerHeight;
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (narrow || cores <= 4 || mem <= 4 || area > 2.8e6) return "low";
    if (cores <= 6 || mem <= 6 || area > 2e6) return "mid";
    return "high";
  }

  function streakCapFor(storm, phone) {
    /* 暴雨效果优先，桌面/手机都拉高雨丝上限 */
    if (phone) return storm ? 2400 : 720;
    return storm ? 7000 : 2800;
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
    /* 参考片天空偏冷蓝灰（非纯黑），暴雨略深于大雨 */
    ctx.fillStyle = storm ? "#1a283c" : "#243448";
    ctx.fillRect(0, 0, tw, th);
    const layers = storm
      ? [
        { x: tw * 0.2, y: th * 0.26, r: tw * 0.62, c: "rgba(80,120,170,0.48)" },
        { x: tw * 0.78, y: th * 0.18, r: tw * 0.55, c: "rgba(40,58,88,0.72)" },
        { x: tw * 0.55, y: th * 0.72, r: tw * 0.62, c: "rgba(28,44,72,0.7)" },
        { x: tw * 0.42, y: th * 0.08, r: tw * 0.46, c: "rgba(120,160,210,0.28)" },
      ]
      : [
        { x: tw * 0.22, y: th * 0.3, r: tw * 0.55, c: "rgba(90,125,170,0.55)" },
        { x: tw * 0.78, y: th * 0.22, r: tw * 0.5, c: "rgba(52,73,97,0.58)" },
        { x: tw * 0.55, y: th * 0.7, r: tw * 0.58, c: "rgba(45,68,100,0.55)" },
        { x: tw * 0.4, y: th * 0.12, r: tw * 0.42, c: "rgba(120,155,195,0.28)" },
      ];
    for (let i = 0; i < layers.length; i += 1) {
      const L = layers[i];
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, L.c);
      g.addColorStop(1, storm ? "rgba(18,28,44,0)" : "rgba(26,36,54,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tw, th);
    }
    return canvas;
  }

  /** 把短密雨丝画进折射底图（勿读 WebGL，避免预乘发黑） */
  function paintBgStreaks(ctx, tw, th, storm, seed) {
    if (!ctx || tw < 2) return;
    let s = (seed * 1000) | 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) | 0;
      return (s >>> 0) / 4294967296;
    };
    const n = storm ? 420 : 280;
    ctx.save();
    for (let i = 0; i < n; i += 1) {
      const x = rnd() * tw;
      const y = rnd() * th;
      const len = (storm ? 8 : 10) + rnd() * (storm ? 14 : 18);
      const a = (storm ? 0.12 : 0.08) + rnd() * (storm ? 0.28 : 0.2);
      ctx.strokeStyle = `rgba(230,242,255,${a})`;
      ctx.lineWidth = 0.6 + rnd() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 2.2, y + len);
      ctx.stroke();
    }
    ctx.restore();
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
    q.dprCap = Math.max(q.dprCap || 1.4, 1.75);
    q.frameMs = Math.min(q.frameMs || 33, 1000 / 30);
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
      /* 贴屏真折射：开冷凝微珠（droplets），关 mist 灰雾；提亮高光 */
      opts.spawnSize = [22, 96];
      opts.slipRate = 0.94;
      opts.trailDropDensity = 0.36;
      opts.gravity = 3800;
      opts.refractBase = 0.42;
      opts.refractScale = 0.78;
      opts.backgroundBlurSteps = 0;
      opts.mist = false;
      opts.mistBlurStep = 0;
      opts.mistColor = [0.55, 0.65, 0.78, 0.04];
      opts.raindropSpecularLight = [0.62, 0.7, 0.8];
      opts.raindropSpecularShininess = 92;
      opts.raindropLightBump = 0.88;
      opts.raindropDiffuseLight = [0.58, 0.64, 0.72];
      opts.raindropShadowOffset = 0.14;
      /* 冷凝少一些：大折射珠为主 */
      opts.dropletsPerSeconds = screenGlass ? (phone ? 70 : 120) : 0;
      opts.dropletSize = screenGlass ? [10, 24] : [8, 20];
      opts.spawnLimit = screenGlass
        ? Math.min(opts.spawnLimit || 1800, phone ? 520 : 900)
        : Math.min(opts.spawnLimit || 800, 600);
      opts.spawnInterval = screenGlass ? [0.035, 0.08] : [0.04, 0.09];
    } else {
      /* 大雨贴屏：清透、提亮 */
      opts.spawnSize = [16, 58];
      opts.slipRate = 0.88;
      opts.trailDropDensity = 0.2;
      opts.gravity = 3000;
      opts.refractBase = 0.34;
      opts.refractScale = 0.58;
      opts.backgroundBlurSteps = 0;
      opts.mist = false;
      opts.mistBlurStep = 0;
      opts.mistColor = [0.5, 0.6, 0.72, 0.03];
      opts.raindropSpecularLight = [0.5, 0.56, 0.64];
      opts.raindropSpecularShininess = 78;
      opts.raindropLightBump = 0.75;
      opts.raindropDiffuseLight = [0.52, 0.58, 0.66];
      opts.raindropShadowOffset = 0.18;
      opts.dropletsPerSeconds = screenGlass ? (phone ? 50 : 90) : 0;
      opts.spawnLimit = Math.min(opts.spawnLimit || 900, screenGlass ? (phone ? 280 : 420) : 400);
      if (phone) {
        opts.spawnSize = [14, 48];
        opts.spawnInterval = [0.06, 0.14];
        opts.spawnLimit = screenGlass ? 280 : 220;
        opts.trailDropDensity = 0.14;
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
    const maxW = storm ? (phone ? 1280 : 1920) : (phone ? 720 : (qualityFor(mode, storm, phone).glassMaxW || 960));
    const dprN = storm ? (phone ? 1.25 : 1.5) : (phone ? 1.15 : 1.25);
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

    /* 暴雨效果优先：强制 high；真实手机仍用于冷凝密度/部分 dpr，避免糊罩 */
    let quality = storm ? "high" : detectQuality();
    const realPhone = isPhoneLike();
    const phone = storm ? false : realPhone;
    const q0 = qualityFor(quality, storm, realPhone);
    const mobileLite = realPhone || quality === "low"
      || window.matchMedia("(max-width: 720px)").matches;
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

    const sctx = splashCanvas.getContext("2d", { alpha: true });
    if (sctx) {
      splashCanvas.style.background = "transparent";
    }
    const stormBg = document.createElement("canvas");
    const stormDomBg = document.createElement("canvas");
    let stormDomReady = false;
    let lastDomCaptureAt = 0;
    let bgStreakSeed = Math.random() * 1000;

    const areaScale = clamp((window.innerWidth * window.innerHeight) / (1280 * 720), 0.7, phone ? 1.0 : 1.35);
    const streakCount = Math.round(q0.streak * areaScale);
    const maxStreak = streakCapFor(storm, phone);

    const gpuOpts = () => ({
      count: Math.min(streakCount, maxStreak),
      dprCap: realPhone ? Math.min(q0.dprCap, 1.2) : (storm ? Math.min(q0.dprCap, 1.55) : q0.dprCap),
      wind: q0.wind,
      speedMul: q0.speedMul,
      wanderWind: storm,
      tilt: storm ? 0.05 : 0.065,
      sizeMul: storm ? (q0.sizeMul || STORM_MUL.sizeMul) : 0.96,
      sheet: storm ? 1 : 0.85,
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
      : (realPhone ? Math.max(36, Math.round((q0.glassMain || 34) * 1.0)) : (q0.glassMain || 52));
    /* 冷凝珠少一些 */
    const glassMicroN = storm
      ? (realPhone || mobileLite
        ? Math.max(120, Math.min(220, Math.round((q0.glassMicro || 560) * 0.28)))
        : Math.max(160, Math.min(280, Math.round((q0.glassMicro || 980) * 0.22))))
      : (realPhone || mobileLite
        ? Math.max(90, Math.round((q0.glassMicro || 360) * 0.28))
        : Math.max(120, Math.round((q0.glassMicro || 560) * 0.3)));

    const glassDrops = window.KayaGlassDrops?.attach
      ? window.KayaGlassDrops.attach(glassDropCanvas, {
        main: glassMainN,
        micro: glassMicroN,
        dprCap: storm ? Math.min(q0.dprCap, realPhone ? 1.4 : 2) : (realPhone ? 1.2 : Math.min(q0.dprCap, 1.55)),
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
      dpr = Math.min(window.devicePixelRatio || 1, phone || quality === "low" ? 1.05 : 1.35);
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
    };

    const ignoreCaptureEl = (el) => {
      if (!el) return false;
      /* 一切 canvas（含 WebGL 雨丝）勿进截图——手机读 WebGL 常整屏黑 */
      if (el.tagName === "CANVAS") return true;
      if (el === glassCanvas || el === splashCanvas || el === glassDropCanvas || el === streakCanvas) return true;
      const cls = el.classList;
      if (!cls) return false;
      return cls.contains("site-fx__rain-glass")
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
      if (useScreenGlass && stormDomReady && stormDomBg.width > 2) {
        bx.setTransform(1, 0, 0, 1, 0, 0);
        bx.drawImage(stormDomBg, 0, 0, bw, bh);
        bgStreakSeed += 0.37;
        paintBgStreaks(bx, bw, bh, storm, bgStreakSeed);
        return stormBg;
      }
      paintBgStreaks(bx, bw, bh, storm, bgStreakSeed);
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
      const skyHex = storm ? "#1a283c" : "#243448";
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
          dx.filter = "brightness(1.28) contrast(1.08) saturate(1.05)";
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
          raindropShadowOffset: Math.min(gOpts.raindropShadowOffset ?? 0.3, 0.28),
        });
        applyGlassOpts(glassFx, quality, storm, realPhone, useScreenGlass);
        try {
          glassFx.options.mist = false;
          glassFx.options.backgroundBlurSteps = 0;
          glassFx.options.mistBlurStep = 0;
          glassFx.options.raindropShadowOffset = Math.min(glassFx.options.raindropShadowOffset || 0.3, 0.28);
        } catch { /* ignore */ }
        await glassFx.setBackground(stormBg);
        await glassFx.start();
        glassReady = true;
        glassAnimating = true;
        console.info("[kaya] screen glass ready", storm ? "storm" : "heavy");
        syncGlassOpacity();
        if (useScreenGlass && !screenGlassDemoted) {
          scheduleDomCapture(storm ? 700 : (realPhone ? 1100 : 900));
          const pushMs = storm ? 140 : (realPhone ? 300 : 220);
          const recaptureMs = storm ? 1800 : (realPhone ? 4000 : 2800);
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
      quality = storm ? "high" : detectQuality();
      const q = qualityFor(quality, storm, realPhone);
      wantRaindropFx = (useScreenGlass || !useGpuStreaks()) && !!RaindropCtor && q.glass != null;
      fitSplash();
      gpu?.resize(w, h);
      const n = Math.round(q.streak * clamp((w * h) / (1280 * 720), 0.7, storm ? 1.5 : (realPhone ? 1.0 : 1.35)));
      gpu?.setCount(Math.min(n, streakCapFor(storm, phone)));
      gpu?.setFrameBudget(q.frameMs);
      gpu?.setWind?.(q.wind);
      gpu?.setSpeedMul?.(q.speedMul);
      gpu?.setSizeMul?.(storm ? (q.sizeMul || STORM_MUL.sizeMul) : 0.96);
      gpu?.setSheet?.(storm ? 1 : 0.85);
      gpu?.setTilt?.(storm ? 0.05 : 0.065);
      glassDrops?.setCounts(
        storm
          ? Math.max(realPhone ? 72 : 100, q.glassMain || 100)
          : (realPhone ? Math.max(36, Math.round((q.glassMain || 34) * 1.0)) : (q.glassMain || 52)),
        storm
          ? (realPhone || mobileLite
            ? Math.max(120, Math.min(220, Math.round((q.glassMicro || 560) * 0.28)))
            : Math.max(160, Math.min(280, Math.round((q.glassMicro || 980) * 0.22))))
          : (realPhone || mobileLite
            ? Math.max(90, Math.round((q.glassMicro || 360) * 0.28))
            : Math.max(120, Math.round((q.glassMicro || 560) * 0.3))),
      );
      const ledgeSnap = (opts.collectLedges
        ? opts.collectLedges()
        : opts.getLedges?.()) || [];
      glassDrops?.setLedges?.(ledgeSnap);
      rebuildFallback();
      scheduleResizeGlass();
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
      const cap = phone ? (storm ? 120 : 70) : (storm ? 520 : 200);
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
        /* 大雨溅花：柔晕 + 扇形细滴 + 偶发下淌 */
        pushSplash({
          x: hit.x, y: hit.y,
          vx: windBias * 0.12, vy: rand(-16, -4),
          life: rand(0.14, 0.24), r: rand(1.8, 3.2),
          soft: true, kind: "soft", a: 0.65,
        });
        const n = phone ? (2 + ((Math.random() * 2) | 0)) : (3 + ((Math.random() * 4) | 0));
        for (let i = 0; i < n; i += 1) {
          const ang = -Math.PI * 0.05 - Math.random() * Math.PI * 0.82;
          const spd = rand(42, phone ? 115 : 145);
          const fine = Math.random() < 0.5;
          pushSplash({
            x: hit.x + rand(-3, 3),
            y: hit.y + rand(-0.8, 1),
            vx: Math.cos(ang) * spd + windBias,
            vy: Math.sin(ang) * spd,
            life: fine ? rand(0.1, 0.2) : rand(0.14, 0.28),
            r: fine ? rand(0.5, 1.25) : rand(1.15, 2.5),
            soft: Math.random() < 0.35,
            kind: fine ? "hard" : (Math.random() < 0.45 ? "soft" : "hard"),
            a: fine ? 0.92 : 0.8,
          });
        }
        if (!phone && Math.random() < 0.35) {
          pushSplash({
            x: hit.x + rand(-4, 4),
            y: hit.y + rand(0.5, 3),
            vx: windBias * 0.15 + rand(-10, 10),
            vy: rand(24, 70),
            life: rand(0.22, 0.42),
            r: rand(1.0, 2.1),
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

      if (intensity > 0.001) drawFallback(dt, intensity);
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

      /* 仅矩形卡片顶缘：短湿划 + 持续细珠 */
      const wetChance = (storm ? 0.55 : 0.38) * aMul;
      for (let i = 0; i < ledges.length; i += 1) {
        const L = ledges[i];
        if (L.shape === "circle") continue;
        const pulse = 0.55 + 0.45 * Math.sin(time * 5.6 + i * 1.25);
        const wetA = scrolling ? 0.4 : 1;
        if (!scrolling && Math.random() < wetChance) {
          const dashN = storm
            ? (2 + ((Math.random() * 4) | 0))
            : (2 + ((Math.random() * 3) | 0));
          for (let d = 0; d < dashN; d += 1) {
            const dx = L.x + L.w * (0.04 + Math.random() * 0.92);
            const dw = storm ? rand(3, 16) : rand(5, 18);
            sctx.fillStyle = `rgba(235,245,255,${rand(0.18, storm ? 0.45 : 0.38) * pulse * aMul * wetA})`;
            sctx.fillRect(dx, L.y - 0.8, dw, storm ? 2.2 : 1.9);
          }
          /* 顶缘连续湿膜 */
          if (!storm && Math.random() < 0.45) {
            sctx.fillStyle = `rgba(210,230,250,${0.1 * pulse * aMul * wetA})`;
            sctx.fillRect(L.x + L.w * 0.08, L.y - 0.4, L.w * 0.84, 1.2);
          }
        }
      }

      if (!scrolling) {
        const rectLedges = ledges.filter((L) => L.shape !== "circle");
        splashAcc += dt;
        const ledgeBase = (storm ? (phone ? 7 : 22) : (phone ? 4.5 : 9.5))
          + rectLedges.length * (storm ? (phone ? 1.1 : 3.2) : (phone ? 0.9 : 1.85));
        const rateCap = storm ? (phone ? 14 : 72) : (phone ? 10 : 22);
        const rate = Math.min(rateCap, ledgeBase * splashMul) * aMul;
        const burstCap = storm ? (phone ? 4 : 22) : (phone ? 3 : 8);
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
