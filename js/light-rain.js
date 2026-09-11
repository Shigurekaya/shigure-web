/**
 * 时雨榧 · 小雨特效
 *
 * 远/中/近景深 + 风速倾角 + 触底溅花/湿痕。
 * 观感目标：细密、透气、带紫丁香品牌冷色，像窗外细雨而非直线雨。
 */
(() => {
  const FRAME_MS = 1000 / 30;
  /** 雨量在既有基础上再 -30%（累计 ×0.42）、下落速度 +20% */
  const RAIN_AMOUNT = 0.42;
  const RAIN_SPEED = 1.2;

  /** 雨丝色相（渐变尾迹用 RGB 字面量） */
  /** 浅色背景上略加深，保证可见；尾迹仍靠渐变淡出 */
  const HUE_RGB = {
    lilac: "158,142,218",
    silver: "188,200,228",
    mist: "168,184,214",
  };

  /** 每滴独立线性渐变：头在下（较实）、尾在上（高透明） */
  function createLayerPainter() {
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
        const rgb = HUE_RGB[d.hue] || HUE_RGB.mist;
        const a = d.alpha;
        const grad = ctx.createLinearGradient(x1, y1, x2, y2);
        /* y1=尾（上）→ y2=头（下）；剖面见 rain-streak-profile.js */
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

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /* 固定中档：不再按设备分 low/mid/high */
  const QUALITY = {
    far: 185, mid: 250, near: 150, splashCap: 205, dprCap: 1.4, mist: 1,
  };

  /**
   * 雨丝：比原版短（参考短片），但保持可见
   * 720p 约 远 7–14px / 中 11–20px / 近 14–26px（原版最长 ~56px）
   */
  const DROP_SPEC = {
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

  function bakeSplashSprites() {
    const soft = document.createElement("canvas");
    soft.width = 28;
    soft.height = 28;
    const sx = soft.getContext("2d");
    if (sx) {
      const g = sx.createRadialGradient(14, 14, 0, 14, 14, 13);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.35, "rgba(200, 215, 245, 0.4)");
      g.addColorStop(1, "rgba(170,190,230,0)");
      sx.fillStyle = g;
      sx.beginPath();
      sx.arc(14, 14, 12, 0, Math.PI * 2);
      sx.fill();
    }
    const hard = document.createElement("canvas");
    hard.width = 10;
    hard.height = 10;
    const hx = hard.getContext("2d");
    if (hx) {
      const g = hx.createRadialGradient(4.2, 3.8, 0, 5, 5, 4.5);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.45, "rgba(190,210,240,0.55)");
      g.addColorStop(1, "rgba(170,190,230,0)");
      hx.fillStyle = g;
      hx.beginPath();
      hx.arc(5, 5, 4.2, 0, Math.PI * 2);
      hx.fill();
    }
    return { soft, hard };
  }

  function mountLightStaticScene(host, canvas) {
    const scene = document.createElement("div");
    scene.className = "site-bg__light-scene";
    scene.setAttribute("aria-hidden", "true");

    const orbs = document.createElement("div");
    orbs.className = "site-bg__light-scene-orbs";

    const grain = document.createElement("div");
    grain.className = "site-bg__light-scene-grain";

    const mist = document.createElement("div");
    mist.className = "site-bg__light-scene-mist";

    scene.append(orbs, grain, mist);
    host.insertBefore(scene, canvas);
    return scene;
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ mistHost?: HTMLElement | null }} [opts]
   */
  function attach(canvas, opts) {
    /* mistHost 显式传 null/false 时不挂静态底图（开场雨幕等） */
    const mistHost = opts && Object.prototype.hasOwnProperty.call(opts, "mistHost")
      ? opts.mistHost
      : canvas.parentElement;
    const useStaticBg = !!mistHost;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) {
      return { start() {}, stop() {}, resize() {}, destroy() {} };
    }
    /* 清除 CSS 雨层遗留的隐藏类，避免「没雨」 */
    canvas.classList.remove("site-bg__rain--css-idle");

    const spr = bakeSplashSprites();
    const paintLayerBatch = createLayerPainter();
    const weakGpu = window.KayaPerfGovernor?.isWeakGpu?.() ?? false;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let last = performance.now();
    let wind = 0.28;
    let windTarget = 0.28;
    let windTimer = 0;
    let wetPulse = 0;
    let groundRippleAcc = 0;
    /** 地面湿痕离屏：仅 pulse 变化时重绘 */
    let wetBuf = null;
    let wetCtx = null;
    let wetPulseKey = -1;

    /** @type {Array<any>} */
    const far = [];
    /** @type {Array<any>} */
    const mid = [];
    /** @type {Array<any>} */
    const near = [];
    /** @type {Array<any>} */
    const splashes = [];
    /** @type {Array<any>} */
    const ripples = [];

    /** @type {HTMLElement | null} */
    let sceneEl = null;

    if (useStaticBg && mistHost) {
      document.body.classList.add("kaya-ambient-eco");
      sceneEl = mountLightStaticScene(mistHost, canvas);
    }

    const makeDrop = (layer) => {
      const H = Math.max(h, 640);
      const spec = DROP_SPEC[layer];
      const roll = Math.random();
      return {
        x: Math.random() * Math.max(1, w),
        y: Math.random() * Math.max(1, h),
        len: rand(spec.len[0], spec.len[1]) * H,
        speed: rand(spec.speed[0], spec.speed[1]) * RAIN_SPEED,
        alpha: rand(spec.alpha[0], spec.alpha[1]),
        width: rand(spec.width[0], spec.width[1]),
        drift: rand(spec.drift[0], spec.drift[1]),
        hue: roll < 0.28 ? "lilac" : (roll < 0.62 ? "mist" : "silver"),
        wobble: rand(0, Math.PI * 2),
        phase: Math.random(),
      };
    };

    const rebuild = () => {
      if (w < 2 || h < 2) return;
      const areaScale = clamp((w * h) / (1280 * 720), 0.65, 1.4);

      const fill = (arr, n, layer) => {
        const count = Math.max(8, Math.round(n * areaScale * RAIN_AMOUNT));
        while (arr.length < count) arr.push(makeDrop(layer));
        if (arr.length > count) arr.length = count;
        for (let i = 0; i < arr.length; i += 1) {
          if (arr[i].x > w) arr[i].x = Math.random() * w;
          if (arr[i].y > h) arr[i].y = Math.random() * h;
        }
      };

      fill(far, QUALITY.far, "far");
      fill(mid, QUALITY.mid, "mid");
      fill(near, QUALITY.near, "near");
      splashes.length = 0;
      ripples.length = 0;
    };

    const fit = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      dpr = Math.min(window.devicePixelRatio || 1, QUALITY.dprCap);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      rebuild();
    };

    const spawnSplash = (x, y) => {
      const cap = QUALITY.splashCap;
      if (splashes.length >= cap) return;
      const lite = (runtimeGov?.scale ?? 1) < 0.86;
      if (splashes.length < cap) {
        splashes.push({
          x, y,
          vx: rand(-8, 8),
          vy: rand(-28, -10),
          life: rand(0.18, 0.32),
          age: 0,
          r: rand(3.2, 5.5),
          a: rand(0.32, 0.5),
          soft: true,
        });
      }
      const n = lite ? (1 + ((Math.random() * 2) | 0)) : (4 + ((Math.random() * 5) | 0));
      for (let i = 0; i < n; i += 1) {
        if (splashes.length >= cap) break;
        const ang = -Math.PI * 0.12 - Math.random() * Math.PI * 0.76;
        const spd = rand(40, 130);
        splashes.push({
          x: x + rand(-3, 3),
          y: y + rand(-1, 1),
          vx: Math.cos(ang) * spd + wind * 10,
          vy: Math.sin(ang) * spd,
          life: rand(0.22, 0.48),
          age: 0,
          r: rand(0.8, 2.0),
          a: rand(0.4, 0.7),
          soft: false,
        });
      }
      if (ripples.length < 36 && Math.random() < 0.7) {
        ripples.push({
          x: clamp(x, 8, w - 8),
          y: h - rand(1, 8),
          life: rand(0.4, 0.8),
          age: 0,
          r0: rand(4, 9),
          a: rand(0.16, 0.32),
        });
      }
    };

    const stepDrop = (d, dt, splashChance) => {
      d.y += d.speed * dt;
      d.x += (wind * 28 + d.drift * 0.45) * dt;
      if (d.y > h + d.len) {
        if (Math.random() < splashChance) {
          spawnSplash(clamp(d.x + wind * d.drift * 0.05, 0, w), h - rand(0, 5));
        }
        d.y = -d.len - Math.random() * 60;
        d.x = Math.random() * w;
        d.phase = Math.random();
      } else if (d.x > w + 28) {
        d.x = -14;
      } else if (d.x < -28) {
        d.x = w + 14;
      }
    };

    const drawGroundWet = () => {
      wetPulse += 0.02;
      const pulse = 0.55 + 0.45 * Math.sin(wetPulse);
      const band = Math.min(72, h * 0.1);
      const key = Math.round(pulse * 32);
      if (!wetBuf || wetBuf.width !== w || wetBuf.height !== band) {
        if (!wetBuf) {
          wetBuf = document.createElement("canvas");
          wetCtx = wetBuf.getContext("2d");
        }
        wetBuf.width = Math.max(1, w);
        wetBuf.height = Math.max(1, Math.ceil(band));
        wetPulseKey = -1;
      }
      if (wetCtx && key !== wetPulseKey) {
        wetPulseKey = key;
        const p = key / 32;
        const g = wetCtx.createLinearGradient(0, 0, 0, band);
        g.addColorStop(0, "rgba(160,185,220,0)");
        g.addColorStop(0.4, `rgba(170,195,230,${0.14 * p})`);
        g.addColorStop(1, `rgba(139,111,212,${0.16 * p})`);
        wetCtx.clearRect(0, 0, w, band);
        wetCtx.fillStyle = g;
        wetCtx.fillRect(0, 0, w, band);
      }
      if (wetBuf) ctx.drawImage(wetBuf, 0, h - band);
    };

    const runtimeGov = window.KayaPerfGovernor?.createRuntimeGovernor?.({
      min: 0.72,
      max: 1,
      initial: 1,
      weakGpu,
    }) ?? null;
    let frameBudget = FRAME_MS;
    let dropMul = 1;
    let lastFrameMs = 0;
    let paused = false;
    let scrollUntil = 0;

    const onScroll = () => {
      scrollUntil = performance.now() + 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });

    const applyDropBudget = () => {
      const areaScale = clamp((w * h) / (1280 * 720), 0.65, 1.4);
      const mul = dropMul * areaScale;
      const trim = (arr, n, layer) => {
        const count = Math.max(8, Math.round(n * mul * RAIN_AMOUNT));
        while (arr.length < count) arr.push(makeDrop(layer));
        if (arr.length > count) arr.length = count;
      };
      trim(far, QUALITY.far, "far");
      trim(mid, QUALITY.mid, "mid");
      trim(near, QUALITY.near, "near");
    };

    const onVisibility = () => {
      if (document.hidden) {
        paused = true;
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (running) {
        paused = false;
        last = performance.now();
        if (!raf) raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const tick = (now) => {
      if (!running || paused || document.hidden) return;
      raf = requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < frameBudget) return;
      const frameStart = performance.now();
      const dt = Math.min(0.05, elapsed / 1000);
      last = now;

      windTimer -= dt;
      if (windTimer <= 0) {
        windTimer = rand(2.4, 5.2);
        const mag = rand(0.1, 0.78);
        windTarget = (Math.random() < 0.28 ? -1 : 1) * mag;
      }
      wind += (windTarget - wind) * Math.min(1, dt * 0.6);

      ctx.clearRect(0, 0, w, h);
      drawGroundWet();

      const scrolling = performance.now() < scrollUntil;
      const skipExtras = scrolling || (runtimeGov?.shouldSkipExtras?.() ?? false);
      const skipSplashes = scrolling || (runtimeGov?.shouldSkipSplashes?.() ?? false);
      const splashMul = dropMul * (skipExtras ? 0.55 : 1);

      for (let i = 0; i < far.length; i += 1) stepDrop(far[i], dt, 0.55 * splashMul);
      for (let i = 0; i < mid.length; i += 1) stepDrop(mid[i], dt, 0.75 * splashMul);
      for (let i = 0; i < near.length; i += 1) stepDrop(near[i], dt, 0.9 * splashMul);
      paintLayerBatch(ctx, far, wind);
      paintLayerBatch(ctx, mid, wind);
      paintLayerBatch(ctx, near, wind);

      groundRippleAcc += dt;
      if (!skipExtras && groundRippleAcc > 0.35 && ripples.length < 20) {
        groundRippleAcc = 0;
        if (Math.random() < 0.55) {
          ripples.push({
            x: rand(10, w - 10),
            y: h - rand(2, 8),
            life: rand(0.4, 0.75),
            age: 0,
            r0: rand(3, 7),
            a: rand(0.1, 0.2),
          });
        }
      }

      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const r = ripples[i];
        r.age += dt;
        const p = 1 - r.age / r.life;
        if (p <= 0) {
          ripples[i] = ripples[ripples.length - 1];
          ripples.pop();
          continue;
        }
        if (skipExtras) continue;
        const rad = r.r0 + (1 - p) * 14;
        ctx.strokeStyle = `rgba(190,210,240,${r.a * p})`;
        ctx.lineWidth = 0.8 + p * 0.6;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad, rad * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        const s = splashes[i];
        s.age += dt;
        const p = 1 - s.age / s.life;
        if (p <= 0) {
          splashes[i] = splashes[splashes.length - 1];
          splashes.pop();
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 460 * dt;
        s._p = p;
        s._rad = s.r * (0.65 + p * 0.5);
        s._alpha = s.a * p;
      }

      if (!skipSplashes) {
        for (let i = 0; i < splashes.length; i += 1) {
          const s = splashes[i];
          if (!s.soft || !spr.soft) continue;
          const dw = s._rad * 3.2;
          ctx.globalAlpha = s._alpha;
          ctx.drawImage(spr.soft, s.x - dw * 0.5, s.y - dw * 0.5, dw, dw);
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < splashes.length; i += 1) {
          const s = splashes[i];
          if (s.soft) continue;
          if (spr.hard) {
            const dw = s._rad * 2.4;
            ctx.globalAlpha = s._alpha;
            ctx.drawImage(spr.hard, s.x - dw * 0.5, s.y - dw * 0.5, dw, dw);
          } else {
            ctx.fillStyle = `rgba(190,210,240,${s._alpha})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s._rad, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      lastFrameMs = performance.now() - frameStart;

      if (runtimeGov) {
        const gs = runtimeGov.noteFrame(frameBudget, performance.now() - frameStart);
        if (gs < 0.9 && Math.abs(dropMul - gs) > 0.06) {
          dropMul = gs;
          applyDropBudget();
        }
        const stress = scrolling ? Math.min(gs, 0.88) : gs;
        frameBudget = stress < 0.88
          ? Math.max(1000 / 24, FRAME_MS / stress)
          : FRAME_MS;
      } else if (scrolling) {
        frameBudget = Math.max(1000 / 24, FRAME_MS * 1.12);
      }
    };

    window.__KayaLightRainStats = () => ({
      mode: useStaticBg ? "canvas-rain+static-dom" : "canvas-rain",
      frameMs: Math.round(lastFrameMs * 10) / 10,
      dropMul: Math.round(dropMul * 100) / 100,
      tier: "mid",
      staticBg: useStaticBg,
      weakGpu,
      dpr,
      drops: far.length + mid.length + near.length,
      splashes: splashes.length,
    });

    return {
      start() {
        const now = performance.now();
        /* stop() 后 paused 可能仍为 true；不清理会导致 tick 首帧直接 return、雨永久停 */
        paused = false;
        if (running) {
          last = now;
          if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
          return;
        }
        running = true;
        fit();
        if (dropMul < 1) applyDropBudget();
        sceneEl?.classList.add("is-on");
        last = now;
        if (!document.hidden) raf = requestAnimationFrame(tick);
      },
      stop() {
        running = false;
        paused = true;
        cancelAnimationFrame(raf);
        raf = 0;
        sceneEl?.classList.remove("is-on");
        ctx.clearRect(0, 0, w, h);
        splashes.length = 0;
        ripples.length = 0;
      },
      resize: fit,
      destroy() {
        window.removeEventListener("scroll", onScroll, true);
        document.removeEventListener("visibilitychange", onVisibility);
        this.stop();
        sceneEl?.remove();
        sceneEl = null;
        if (useStaticBg && !document.body.classList.contains("sunny-sky")) {
          document.body.classList.remove("kaya-ambient-eco");
        }
        delete window.__KayaLightRainStats;
      },
    };
  }

  window.KayaLightRain = { attach };
})();
