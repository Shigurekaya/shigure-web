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
      glassMain: 28,
      glassMicro: 360,
      splashRate: 1.05,
      glass: null,
    },
    mid: {
      streak: 1420,
      dprCap: 1.35,
      frameMs: 1000 / 30,
      wind: 0.32,
      speedMul: 1.16,
      glassMain: 38,
      glassMicro: 480,
      splashRate: 1.12,
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
      glassMain: 48,
      glassMicro: 580,
      splashRate: 1.2,
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

  /** 雷暴相对大雨的强度倍率（对齐小米天气大雨参考片再加一档） */
  const STORM_MUL = {
    streak: 1.65,
    wind: 1.35,
    speed: 1.28,
    splash: 1.55,
    glassMain: 1.55,
    glassMicro: 1.7,
    sizeMul: 1.38,
  };

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
      count: mobileLite ? Math.min(streakCount, storm ? 1300 : 900) : streakCount,
      dprCap: mobileLite ? Math.min(q0.dprCap, 1.15) : q0.dprCap,
      wind: q0.wind,
      speedMul: q0.speedMul,
      wanderWind: storm,
      tilt: storm ? 0.12 : 0.08,
      sizeMul: storm ? (q0.sizeMul || STORM_MUL.sizeMul) : 1,
    });

    const useGpuStreaks = !!gpu;

    /* 溅花：全端开启。贴屏水珠：桌面全开；暴雨手机也开轻量版（参考片关键） */
    const wantSplash = true;
    const wantGlassDrops = useGpuStreaks && (!mobileLite || storm);
    splashCanvas.style.display = wantSplash ? "" : "none";
    glassDropCanvas.style.display = wantGlassDrops ? "" : "none";
    if (storm) glassDropCanvas.classList.add("is-storm-glass");

    const glassMainN = mobileLite && storm
      ? Math.round((q0.glassMain || 34) * 0.55)
      : (q0.glassMain || 34);
    const glassMicroN = mobileLite && storm
      ? Math.round((q0.glassMicro || 160) * 0.5)
      : (q0.glassMicro || 160);

    const glassDrops = wantGlassDrops && window.KayaGlassDrops?.attach
      ? window.KayaGlassDrops.attach(glassDropCanvas, {
        main: glassMainN,
        micro: glassMicroN,
        dprCap: Math.min(q0.dprCap, mobileLite ? 1.2 : 1.35),
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
      const gMain = mobileLite && storm
        ? Math.round((q.glassMain || 34) * 0.55)
        : (q.glassMain || 34);
      const gMicro = mobileLite && storm
        ? Math.round((q.glassMicro || 160) * 0.5)
        : (q.glassMicro || 160);
      glassDrops?.setCounts(gMain, gMicro);
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

    const spawnSplash = (ledge) => {
      if (intensity < 0.12) return;
      /* 圆形头像不做撞击溅花（易成半圆弧/悬空水花） */
      if (ledge.shape === "circle") return;
      const cap = storm ? (mobileLite ? 96 : 140) : (mobileLite ? 48 : 72);
      if (splashes.length >= cap) return;
      const hit = hitPointOnLedge(ledge);
      /* 参考片顶缘：成簇白点；暴雨每击 2～5 颗、更大 */
      const n = storm
        ? (2 + ((Math.random() * 3.5) | 0))
        : (1 + ((Math.random() * 2.2) | 0));
      const windBias = windLive * (storm ? 20 : 10);
      for (let i = 0; i < n; i += 1) {
        if (splashes.length >= cap) break;
        const ang = -Math.PI * 0.05 - Math.random() * Math.PI * 0.85;
        const spd = storm ? rand(55, 150) : rand(48, 110);
        splashes.push({
          x: hit.x + rand(-3, 3),
          y: hit.y + rand(-0.6, 0.8),
          vx: Math.cos(ang) * spd + windBias,
          vy: Math.sin(ang) * spd,
          life: storm ? rand(0.14, 0.28) : rand(0.12, 0.2),
          age: 0,
          r: storm ? rand(1.1, 2.8) : rand(0.5, 1.35),
          soft: storm && Math.random() < 0.45,
        });
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

      /* 仅矩形卡片顶缘：短湿划，不画整条宽线、不画半圆弧 */
      const wetChance = (storm ? 0.42 : 0.2) * aMul;
      for (let i = 0; i < ledges.length; i += 1) {
        const L = ledges[i];
        if (L.shape === "circle") continue;
        const pulse = 0.55 + 0.45 * Math.sin(time * 5.6 + i * 1.25);
        const wetA = scrolling ? 0.4 : 1;
        if (!scrolling && Math.random() < wetChance) {
          const dashN = storm ? (1 + ((Math.random() * 3) | 0)) : (1 + ((Math.random() * 1.5) | 0));
          for (let d = 0; d < dashN; d += 1) {
            const dx = L.x + L.w * (0.08 + Math.random() * 0.84);
            const dw = storm ? rand(5, 18) : rand(4, 12);
            sctx.fillStyle = `rgba(235,245,255,${rand(0.14, storm ? 0.38 : 0.26) * pulse * aMul * wetA})`;
            sctx.fillRect(dx, L.y - 0.5, dw, storm ? 2 : 1.5);
          }
        }
      }

      if (!scrolling) {
        const rectLedges = ledges.filter((L) => L.shape !== "circle");
        splashAcc += dt;
        /* 参考片顶缘溅点较密；封顶在倍率之后 */
        const ledgeBase = (storm ? 8 : 5.5) + rectLedges.length * (storm ? 1.55 : 1.15);
        const rateCap = storm ? 26 : 13;
        const mobileFactor = mobileLite ? (storm ? 0.85 : 0.72) : 1;
        const rate = Math.min(rateCap, ledgeBase * splashMul) * aMul * mobileFactor;
        const burstCap = storm ? 8 : 4;
        let spawned = 0;
        while (rate > 0.2 && splashAcc > 1 / rate && rectLedges.length && spawned < burstCap) {
          splashAcc -= 1 / rate;
          spawnSplash(rectLedges[(Math.random() * rectLedges.length) | 0]);
          spawned += 1;
        }
        if (splashAcc > 1) splashAcc = 1;
      }

      rims.length = 0;

      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        const s = splashes[i];
        s.age += dt;
        const p = 1 - s.age / s.life;
        if (p <= 0) { splashes.splice(i, 1); continue; }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += (storm ? 340 : 300) * dt;
        const rad = s.r * (0.65 + p * 0.45);
        if (s.soft) {
          sctx.save();
          sctx.shadowColor = "rgba(210, 230, 255, 0.85)";
          sctx.shadowBlur = 6 + rad * 2.2;
          sctx.fillStyle = `rgba(255,255,255,${0.55 * p * aMul})`;
          sctx.beginPath();
          sctx.arc(s.x, s.y, rad * 1.35, 0, Math.PI * 2);
          sctx.fill();
          sctx.restore();
        }
        sctx.fillStyle = `rgba(255,255,255,${(storm ? 0.88 : 0.78) * p * aMul})`;
        sctx.beginPath();
        sctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
        sctx.fill();
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
