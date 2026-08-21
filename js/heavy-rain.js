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
    mist: true,
    mistColor: [0.02, 0.04, 0.08, 0.7],
    mistTime: 7,
    smoothRaindrop: [0.96, 1],
    refractBase: 0.34,
    refractScale: 0.52,
    raindropCompose: "smoother",
    raindropLightPos: [-0.55, 1.05, 2.1, 0],
    raindropDiffuseLight: [0.26, 0.3, 0.36],
    raindropShadowOffset: 0.65,
    raindropEraserSize: [0.93, 1],
    raindropSpecularLight: [0.1, 0.13, 0.18],
    raindropSpecularShininess: 48,
    raindropLightBump: 0.45,
  };

  const QUALITY = {
    low: {
      streak: 860,
      dprCap: 1.15,
      frameMs: 1000 / 24,
      wind: 0.26,
      speedMul: 1.12,
      glassMain: 48,
      glassMicro: 520,
      splashRate: 1.15,
      glass: null,
    },
    mid: {
      streak: 1420,
      dprCap: 1.35,
      frameMs: 1000 / 30,
      wind: 0.32,
      speedMul: 1.16,
      glassMain: 52,
      glassMicro: 620,
      splashRate: 1.2,
      glassMaxW: 960,
      glass: {
        spawnInterval: [0.08, 0.16],
        spawnLimit: 420,
        dropletsPerSeconds: 360,
        dropletSize: [8, 20],
        backgroundBlurSteps: 2,
        mistBlurStep: 3,
      },
    },
    high: {
      streak: 2200,
      dprCap: 1.5,
      frameMs: 1000 / 30,
      wind: 0.36,
      speedMul: 1.2,
      glassMain: 72,
      glassMicro: 900,
      splashRate: 1.28,
      glassMaxW: 1280,
      glass: {
        spawnInterval: [0.055, 0.12],
        spawnLimit: 620,
        dropletsPerSeconds: 520,
        dropletSize: [8, 22],
        backgroundBlurSteps: 3,
        mistBlurStep: 4,
      },
    },
  };

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function detectQuality() {
    try {
      if (navigator.connection?.saveData) return "low";
    } catch { /* ignore */ }
    const cores = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    const area = window.innerWidth * window.innerHeight;
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (narrow || cores <= 4 || mem <= 4 || area > 2.8e6) return "low";
    if (cores <= 6 || mem <= 6 || area > 2e6) return "mid";
    return "high";
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
    ctx.fillStyle = storm ? "#141c2c" : "#243448";
    ctx.fillRect(0, 0, tw, th);
    const layers = storm
      ? [
        { x: tw * 0.2, y: th * 0.28, r: tw * 0.58, c: "rgba(70,100,150,0.42)" },
        { x: tw * 0.8, y: th * 0.2, r: tw * 0.52, c: "rgba(36,52,78,0.7)" },
        { x: tw * 0.55, y: th * 0.72, r: tw * 0.6, c: "rgba(28,44,72,0.62)" },
        { x: tw * 0.42, y: th * 0.1, r: tw * 0.4, c: "rgba(100,140,190,0.22)" },
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
      g.addColorStop(1, storm ? "rgba(14,20,36,0)" : "rgba(26,36,54,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tw, th);
    }
    return canvas;
  }

  /** 雷暴相对大雨的强度倍率（效果全开） */
  const STORM_MUL = {
    streak: 2.15,
    wind: 1.55,
    speed: 1.42,
    splash: 2.6,
    glassMain: 1.85,
    glassMicro: 2.1,
    sizeMul: 1.55,
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

  function qualityFor(mode, storm) {
    const base = QUALITY[mode];
    const q = {
      ...base,
      glass: base.glass && typeof base.glass === "object" ? { ...base.glass } : base.glass,
    };
    if (!storm) return q;
    q.streak = Math.round(q.streak * STORM_MUL.streak);
    q.wind = q.wind * STORM_MUL.wind;
    q.speedMul = q.speedMul * STORM_MUL.speed;
    q.splashRate = (q.splashRate || 1) * STORM_MUL.splash;
    q.glassMain = Math.round((q.glassMain || 34) * STORM_MUL.glassMain);
    q.glassMicro = Math.round((q.glassMicro || 160) * STORM_MUL.glassMicro);
    q.sizeMul = STORM_MUL.sizeMul;
    if (q.glass && typeof q.glass === "object") {
      q.glass = {
        ...q.glass,
        spawnLimit: Math.round((q.glass.spawnLimit || 400) * 1.35),
        dropletsPerSeconds: Math.round((q.glass.dropletsPerSeconds || 360) * 1.4),
      };
    }
    return q;
  }

  function glassOptsFor(mode, storm) {
    const g = qualityFor(mode, storm).glass;
    if (!g || g === true) return null;
    return { ...GLASS_BASE, ...g };
  }

  function applyGlassOpts(fx, mode, storm) {
    const gOpts = glassOptsFor(mode, storm);
    if (!fx || !gOpts) return;
    Object.keys(gOpts).forEach((k) => {
      try { fx.options[k] = gOpts[k]; } catch { /* ignore */ }
    });
  }

  function glassBufferSize(cssW, cssH, mode, storm) {
    const maxW = qualityFor(mode, storm).glassMaxW || 960;
    const scale = Math.min(1, maxW / Math.max(1, cssW)) * Math.min(window.devicePixelRatio || 1, 1.25);
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

    let quality = detectQuality();
    const q0 = qualityFor(quality, storm);

    const glassCanvas = document.createElement("canvas");
    glassCanvas.className = "site-bg__glass";
    glassCanvas.setAttribute("aria-hidden", "true");
    if (bgHost) bgHost.appendChild(glassCanvas);
    glassCanvas.style.display = "none";

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

    const areaScale = clamp((window.innerWidth * window.innerHeight) / (1280 * 720), 0.7, 1.35);
    const streakCount = Math.round(q0.streak * areaScale);
    const mobileLite = quality === "low"
      || window.matchMedia("(max-width: 720px)").matches;

    const gpu = window.KayaGpuStreakRain?.attach?.(streakCanvas, {
      count: mobileLite ? Math.min(streakCount, storm ? 2200 : 900) : Math.min(streakCount, storm ? 4200 : streakCount),
      dprCap: storm ? Math.min(q0.dprCap, 2) : (mobileLite ? Math.min(q0.dprCap, 1.15) : q0.dprCap),
      wind: q0.wind,
      speedMul: q0.speedMul,
      wanderWind: storm,
      tilt: storm ? 0.155 : 0.08,
      sizeMul: storm ? (q0.sizeMul || STORM_MUL.sizeMul) : 1,
    });

    const useGpuStreaks = !!gpu;

    /* 溅花全开。贴屏水珠：暴雨全端开启（效果优先） */
    const wantSplash = true;
    const wantGlassDrops = useGpuStreaks && (!mobileLite || storm);
    splashCanvas.style.display = wantSplash ? "" : "none";
    glassDropCanvas.style.display = wantGlassDrops ? "" : "none";
    if (storm) glassDropCanvas.classList.add("is-storm-glass");

    const glassMainN = q0.glassMain || 34;
    const glassMicroN = q0.glassMicro || 160;

    const glassDrops = wantGlassDrops && window.KayaGlassDrops?.attach
      ? window.KayaGlassDrops.attach(glassDropCanvas, {
        main: glassMainN,
        micro: glassMicroN,
        dprCap: Math.min(q0.dprCap, 1.5),
        slideRatio: 0.3,
        storm,
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
    let glassFx = null;
    let glassReady = false;
    let glassFailed = false;
    let glassAnimating = false;
    /* 无 GPU 时用 raindrop-fx 兜底（与 Canvas2D 玻璃珠互斥） */
    let wantRaindropFx = !useGpuStreaks && qualityFor(quality, storm).glass != null;
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
      const q = qualityFor(quality, storm);
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
      const q = qualityFor(quality, storm);
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
      dpr = Math.min(window.devicePixelRatio || 1, quality === "low" ? 1.1 : 1.35);
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

    const syncGlassOpacity = () => {
      if (wantRaindropFx) {
        glassCanvas.style.display = "";
        glassCanvas.style.opacity = String(clamp(intensity * (glassReady ? 1 : 0), 0, 1));
      } else {
        glassCanvas.style.display = "none";
        glassCanvas.style.opacity = "0";
      }
      gpu?.setIntensity(intensity);
      glassDrops?.setIntensity(intensity);
      mist.classList.toggle("is-on", intensity > 0.05);
      glassDropCanvas.style.opacity = String(clamp(glassDrops ? intensity : 0, 0, 1));
    };

    const ensureGlass = async () => {
      if (!wantRaindropFx || glassReady || glassFailed) return glassReady;
      if (!RaindropCtor || !bgHost) {
        glassFailed = true;
        return false;
      }
      try {
        const { bw, bh } = glassBufferSize(w || window.innerWidth, h || window.innerHeight, quality, storm);
        paintStormBg(stormBg, bw, bh, storm);
        glassCanvas.width = bw;
        glassCanvas.height = bh;
        const gOpts = glassOptsFor(quality, storm);
        glassFx = new RaindropCtor({
          canvas: glassCanvas,
          width: bw,
          height: bh,
          background: stormBg,
          ...gOpts,
        });
        applyGlassOpts(glassFx, quality, storm);
        await glassFx.setBackground(stormBg);
        await glassFx.start();
        glassReady = true;
        glassAnimating = true;
        return true;
      } catch (err) {
        console.warn("[kaya] raindrop-fx skipped", err);
        glassFailed = true;
        glassFx = null;
        return false;
      }
    };

    const resizeGlassNow = async () => {
      if (!glassReady || !glassFx || w < 2) return;
      try {
        const { bw, bh } = glassBufferSize(w, h, quality, storm);
        paintStormBg(stormBg, bw, bh, storm);
        glassFx.resize(bw, bh);
        await glassFx.setBackground(stormBg);
        applyGlassOpts(glassFx, quality, storm);
      } catch (err) {
        console.warn("[kaya] glass resize failed", err);
      }
    };

    const scheduleResizeGlass = () => {
      window.clearTimeout(resizeGlassTimer);
      resizeGlassTimer = window.setTimeout(() => { void resizeGlassNow(); }, 180);
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      quality = detectQuality();
      const q = qualityFor(quality, storm);
      wantRaindropFx = !useGpuStreaks && q.glass != null;
      fitSplash();
      gpu?.resize(w, h);
      const n = Math.round(q.streak * clamp((w * h) / (1280 * 720), 0.7, 1.35));
      gpu?.setCount(n);
      gpu?.setFrameBudget(q.frameMs);
      gpu?.setWind?.(q.wind);
      gpu?.setSpeedMul?.(q.speedMul);
      gpu?.setSizeMul?.(storm ? (q.sizeMul || STORM_MUL.sizeMul) : 1);
      glassDrops?.setCounts(q.glassMain || 34, q.glassMicro || 160);
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
      const cap = storm ? 520 : 90;
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
        /* 柔边 bloom 中心 */
        pushSplash({
          x: hit.x, y: hit.y,
          vx: windBias * 0.15, vy: rand(-20, -8),
          life: rand(0.16, 0.28), r: rand(2.4, 4.2),
          soft: true, kind: "soft", a: 0.7,
        });
        /* 扇形细溅：6～12 颗大小错落 */
        const n = 6 + ((Math.random() * 7) | 0);
        for (let i = 0; i < n; i += 1) {
          const ang = -Math.PI * 0.02 - Math.random() * Math.PI * 0.92;
          const spd = rand(40, 175);
          const fine = Math.random() < 0.55;
          pushSplash({
            x: hit.x + rand(-4, 4),
            y: hit.y + rand(-1, 1.5),
            vx: Math.cos(ang) * spd + windBias,
            vy: Math.sin(ang) * spd,
            life: fine ? rand(0.1, 0.2) : rand(0.14, 0.32),
            r: fine ? rand(0.55, 1.4) : rand(1.4, 3.2),
            soft: Math.random() < 0.4,
            kind: fine ? "hard" : (Math.random() < 0.5 ? "soft" : "hard"),
            a: fine ? 0.95 : 0.85,
          });
        }
        /* 沿卡片面下淌的次级水珠 */
        if (Math.random() < 0.55) {
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
        const n = 1 + ((Math.random() * 2.2) | 0);
        for (let i = 0; i < n; i += 1) {
          const ang = -Math.PI * 0.08 - Math.random() * Math.PI * 0.75;
          const spd = rand(48, 110);
          pushSplash({
            x: hit.x + rand(-2, 2),
            y: hit.y + rand(-0.4, 0.4),
            vx: Math.cos(ang) * spd + windBias,
            vy: Math.sin(ang) * spd,
            life: rand(0.12, 0.2),
            r: rand(0.5, 1.35),
            soft: false, kind: "hard",
          });
        }
      }
    };

    /** 顶缘持续湿珠项链（参考片一直有细密白点） */
    const ensureRimBeads = (rectLedges, dt, aMul) => {
      if (!storm || !rectLedges.length) return;
      for (let i = 0; i < rectLedges.length; i += 1) {
        const L = rectLedges[i];
        const dens = Math.max(5, Math.round(L.w / 18));
        for (let k = 0; k < dens; k += 1) {
          if (Math.random() > 0.55 * aMul * dt * 22) continue;
          const x = L.x + L.w * (0.06 + Math.random() * 0.88);
          pushSplash({
            x, y: L.y + rand(-0.4, 1.2),
            vx: windLive * 8 + rand(-18, 18),
            vy: rand(-35, -8),
            life: rand(0.08, 0.18),
            r: rand(0.45, 1.6),
            soft: Math.random() < 0.5,
            kind: Math.random() < 0.6 ? "hard" : "soft",
            a: rand(0.55, 0.95),
          });
        }
      }
    };

    const hardStop = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(stopTimer);
      window.clearTimeout(resizeGlassTimer);
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
      const frameMs = qualityFor(quality, storm).frameMs;
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
      const qNow = qualityFor(quality, storm);
      const splashMul = qNow.splashRate || 1;

      if (scrolling) {
        splashes.length = 0;
        rims.length = 0;
        splashAcc = 0;
      }

      /* 仅矩形卡片顶缘：短湿划 + 持续细珠 */
      const wetChance = (storm ? 0.55 : 0.2) * aMul;
      for (let i = 0; i < ledges.length; i += 1) {
        const L = ledges[i];
        if (L.shape === "circle") continue;
        const pulse = 0.55 + 0.45 * Math.sin(time * 5.6 + i * 1.25);
        const wetA = scrolling ? 0.4 : 1;
        if (!scrolling && Math.random() < wetChance) {
          const dashN = storm ? (2 + ((Math.random() * 4) | 0)) : (1 + ((Math.random() * 1.5) | 0));
          for (let d = 0; d < dashN; d += 1) {
            const dx = L.x + L.w * (0.05 + Math.random() * 0.9);
            const dw = storm ? rand(3, 16) : rand(4, 12);
            sctx.fillStyle = `rgba(235,245,255,${rand(0.16, storm ? 0.45 : 0.26) * pulse * aMul * wetA})`;
            sctx.fillRect(dx, L.y - 0.6, dw, storm ? 2.2 : 1.5);
          }
        }
      }

      if (!scrolling) {
        const rectLedges = ledges.filter((L) => L.shape !== "circle");
        splashAcc += dt;
        const ledgeBase = (storm ? 22 : 5.5) + rectLedges.length * (storm ? 3.2 : 1.15);
        const rateCap = storm ? 72 : 13;
        const rate = Math.min(rateCap, ledgeBase * splashMul) * aMul;
        const burstCap = storm ? 22 : 4;
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
