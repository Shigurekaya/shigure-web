/**
 * 时雨榧 · 小雨特效
 *
 * 远/中/近景深 + 风速倾角 + 触底溅花/湿痕。
 * 观感目标：细密、透气、带紫丁香品牌冷色，像窗外细雨而非直线雨。
 */
(() => {
  const FRAME_MS = 1000 / 30;
  const WEAK_FRAME_MS = 1000 / 24;
  /** 雨量 -40%、下落速度 +20% */
  const RAIN_AMOUNT = 0.6;
  const RAIN_SPEED = 1.2;

  /** 按色相批量描边；单趟分桶 + 复用索引数组，避免三趟全量扫描 */
  function createLayerPainter() {
    const mistIdx = [];
    const silverIdx = [];
    const lilacIdx = [];
    return function paintLayerBatch(ctx, arr, wind, HUE_STROKE, heads = false) {
      mistIdx.length = 0;
      silverIdx.length = 0;
      lilacIdx.length = 0;
      ctx.lineCap = "round";
      for (let i = 0; i < arr.length; i += 1) {
        const d = arr[i];
        d.wobble += 0.015;
        const sway = Math.sin(d.wobble + d.phase * 6) * (d.drift * 0.04);
        d._tilt = wind * d.drift * 0.12 + d.drift * 0.03 + sway;
        const hue = d.hue || "mist";
        if (hue === "lilac") lilacIdx.push(i);
        else if (hue === "silver") silverIdx.push(i);
        else mistIdx.push(i);
      }
      const batches = mistIdx.length || silverIdx.length || lilacIdx.length
        ? [["mist", mistIdx], ["silver", silverIdx], ["lilac", lilacIdx]]
        : null;
      if (!batches) return;
      for (let b = 0; b < 3; b += 1) {
        const hue = batches[b][0];
        const idx = batches[b][1];
        if (!idx.length) continue;
        let sumW = 0;
        let sumA = 0;
        ctx.beginPath();
        for (let j = 0; j < idx.length; j += 1) {
          const d = arr[idx[j]];
          sumW += d.width;
          sumA += d.alpha;
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + d._tilt, d.y + d.len);
        }
        ctx.lineWidth = sumW / idx.length;
        ctx.strokeStyle = HUE_STROKE[hue](sumA / idx.length);
        ctx.stroke();
        if (!heads) continue;
        for (let j = 0; j < idx.length; j += 1) {
          const d = arr[idx[j]];
          if (d.alpha <= 0.22) continue;
          const headA = d.alpha * (d.width > 1.3 ? 0.55 : 0.38);
          ctx.fillStyle = `rgba(245,250,255,${headA})`;
          ctx.beginPath();
          ctx.arc(d.x + d._tilt * 0.1, d.y + d.len * 0.05, d.width * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function detectQuality() {
    const Gov = window.KayaPerfGovernor;
    if (Gov?.detectRainTier) return Gov.detectRainTier();
    try {
      if (navigator.connection?.saveData) return "low";
    } catch { /* ignore */ }
    const phone = Gov?.isPhoneLike?.() ?? (() => {
      const ua = navigator.userAgent || "";
      if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)) return true;
      try {
        return window.matchMedia("(max-width: 720px)").matches
          && window.matchMedia("(pointer: coarse)").matches;
      } catch { /* ignore */ }
      return window.matchMedia("(max-width: 720px)").matches;
    })();
    const cores = navigator.hardwareConcurrency || 8;
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (phone || narrow || cores <= 4) return "low";
    if (cores <= 8) return "mid";
    return "high";
  }

  /* 速度仍偏快；雨量在 ×1.35 基础上再 -20% */
  const QUALITY = {
    low: { far: 120, mid: 160, near: 95, splashCap: 140, dprCap: 1.2, mist: 1 },
    mid: { far: 185, mid: 250, near: 150, splashCap: 205, dprCap: 1.4, mist: 1 },
    high: { far: 250, mid: 345, near: 205, splashCap: 280, dprCap: 1.55, mist: 1 },
  };
  /** 核显 / 软件 GL：更少像素 + 略减滴数，观感仍接近 low */
  const WEAK_QUALITY = {
    far: 105, mid: 140, near: 82, splashCap: 80, dprCap: 1, mist: 1,
  };

  /** 雨丝色相：避免每滴 createLinearGradient（数百次/帧） */
  const HUE_STROKE = {
    lilac: (a) => `rgba(174,160,230,${a * 0.92})`,
    silver: (a) => `rgba(215,225,245,${a})`,
    mist: (a) => `rgba(188,204,232,${a * 0.88})`,
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

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ mistHost?: HTMLElement | null }} [opts]
   */
  function attach(canvas, opts) {
    /* mistHost 显式传 null/false 时不挂雾层（开场自带 mist） */
    const mistHost = opts && Object.prototype.hasOwnProperty.call(opts, "mistHost")
      ? opts.mistHost
      : canvas.parentElement;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) {
      return { start() {}, stop() {}, resize() {}, destroy() {} };
    }

    const spr = bakeSplashSprites();
    const paintLayerBatch = createLayerPainter();
    const weakGpu = window.KayaPerfGovernor?.isWeakGpu?.() ?? false;
    let quality = weakGpu ? "low" : detectQuality();
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

    let mist = null;
    if (mistHost) {
      mist = document.createElement("div");
      mist.className = "site-bg__light-mist";
      mist.setAttribute("aria-hidden", "true");
      mistHost.appendChild(mist);
    }

    const makeDrop = (layer) => {
      /* 按屏高比例定长度：小雨也要像「雨」，不是针尖毛毛雨 */
      const H = Math.max(h, 640);
      const spec = layer === "far"
        ? {
          len: [H * 0.018, H * 0.038],
          speed: [245, 380],
          alpha: [0.18, 0.34],
          width: [1.1, 1.6],
          drift: [10, 20],
        }
        : layer === "mid"
          ? {
            len: [H * 0.028, H * 0.055],
            speed: [325, 515],
            alpha: [0.28, 0.5],
            width: [1.35, 2.05],
            drift: [14, 26],
          }
          : {
            len: [H * 0.04, H * 0.078],
            speed: [430, 650],
            alpha: [0.42, 0.72],
            width: [1.7, 2.6],
            drift: [16, 30],
          };
      const roll = Math.random();
      return {
        x: Math.random() * Math.max(1, w),
        y: Math.random() * Math.max(1, h),
        len: rand(spec.len[0], spec.len[1]),
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
      const q = weakGpu ? WEAK_QUALITY : QUALITY[quality];
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

      fill(far, q.far, "far");
      fill(mid, q.mid, "mid");
      fill(near, q.near, "near");
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
      quality = weakGpu ? "low" : detectQuality();
      const qCap = weakGpu ? WEAK_QUALITY : QUALITY[quality];
      dpr = Math.min(window.devicePixelRatio || 1, qCap.dprCap);
      if (weakGpu) dpr = qCap.dprCap;
      else if (window.KayaPerfGovernor?.isWeakGpu?.()) {
        dpr = Math.min(dpr, quality === "low" ? 1 : 1.25);
      }
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
      const cap = weakGpu ? WEAK_QUALITY.splashCap : QUALITY[quality].splashCap;
      if (splashes.length >= cap) return;
      const lite = weakGpu || (runtimeGov?.scale ?? 1) < 0.86;
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

    const strokeDrop = (d) => {
      /* 保留供 intro 等单滴场景；主循环用 paintLayerBatch */
      d.wobble += 0.015;
      const sway = Math.sin(d.wobble + d.phase * 6) * (d.drift * 0.04);
      const tilt = wind * d.drift * 0.12 + d.drift * 0.03 + sway;
      const x2 = d.x + tilt;
      const y2 = d.y + d.len;
      const hueFn = HUE_STROKE[d.hue] || HUE_STROKE.mist;
      ctx.strokeStyle = hueFn(d.alpha);
      ctx.lineWidth = d.width;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (d.alpha > 0.22) {
        const headA = d.alpha * (d.width > 1.3 ? 0.55 : 0.38);
        ctx.fillStyle = `rgba(245,250,255,${headA})`;
        ctx.beginPath();
        ctx.arc(d.x + tilt * 0.1, d.y + d.len * 0.05, d.width * 0.65, 0, Math.PI * 2);
        ctx.fill();
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
      min: weakGpu ? 0.65 : 0.72,
      max: 1,
      initial: weakGpu ? 0.88 : (quality === "low" ? 0.9 : 1),
      weakGpu,
    }) ?? null;
    let frameBudget = weakGpu ? WEAK_FRAME_MS : FRAME_MS;
    let dropMul = weakGpu ? 0.88 : (quality === "low" ? 0.92 : 1);
    let lastFrameMs = 0;
    let paused = false;
    let scrollUntil = 0;

    const onScroll = () => {
      scrollUntil = performance.now() + 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });

    const applyDropBudget = () => {
      const q = weakGpu ? WEAK_QUALITY : QUALITY[quality];
      const areaScale = clamp((w * h) / (1280 * 720), 0.65, 1.4);
      const mul = dropMul * areaScale;
      const trim = (arr, n, layer) => {
        const count = Math.max(8, Math.round(n * mul * RAIN_AMOUNT));
        while (arr.length < count) arr.push(makeDrop(layer));
        if (arr.length > count) arr.length = count;
      };
      trim(far, q.far, "far");
      trim(mid, q.mid, "mid");
      trim(near, q.near, "near");
    };

    const onVisibility = () => {
      if (document.hidden) {
        paused = true;
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (paused && running) {
        paused = false;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const tick = (now) => {
      if (!running || paused) return;
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
      paintLayerBatch(ctx, far, wind, HUE_STROKE, false);
      paintLayerBatch(ctx, mid, wind, HUE_STROKE, false);
      paintLayerBatch(ctx, near, wind, HUE_STROKE, !skipExtras && !weakGpu);

      /* 偶发地面涟漪 */
      groundRippleAcc += dt;
      if (!weakGpu && !skipExtras && groundRippleAcc > 0.35 && ripples.length < 20) {
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
          ? Math.max(1000 / 24, (weakGpu ? WEAK_FRAME_MS : FRAME_MS) / stress)
          : (weakGpu ? WEAK_FRAME_MS : FRAME_MS);
      } else if (scrolling) {
        frameBudget = Math.max(1000 / 24, (weakGpu ? WEAK_FRAME_MS : FRAME_MS) * 1.12);
      }
    };

    window.__KayaLightRainStats = () => ({
      frameMs: Math.round(lastFrameMs * 10) / 10,
      dropMul: Math.round(dropMul * 100) / 100,
      quality,
      weakGpu,
      dpr,
      drops: far.length + mid.length + near.length,
      splashes: splashes.length,
    });

    return {
      start() {
        if (running) return;
        running = true;
        fit();
        if (dropMul < 1) applyDropBudget();
        last = performance.now();
        raf = requestAnimationFrame(tick);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        ctx.clearRect(0, 0, w, h);
        splashes.length = 0;
        ripples.length = 0;
      },
      resize: fit,
      destroy() {
        window.removeEventListener("scroll", onScroll, true);
        document.removeEventListener("visibilitychange", onVisibility);
        this.stop();
        mist?.remove();
      },
    };
  }

  window.KayaLightRain = { attach };
})();
