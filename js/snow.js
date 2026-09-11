/**
 * 时雨榧 · 雪天特效
 *
 * 远/中/近景深 + 惯性飘移 + 阵风打散 + 六角近景雪花。
 */
(() => {
  const FRAME_MS = 1000 / 30;

  const FLAKE_SPEC = {
    far: {
      r: [0.6, 1.4],
      speed: [16, 30],
      alpha: [0.32, 0.54],
      swing: [0.35, 0.85],
      swingAmp: [5, 12],
      spin: [0, 0.25],
      windMul: 1.15,
    },
    mid: {
      r: [1.1, 2.4],
      speed: [24, 44],
      alpha: [0.4, 0.64],
      swing: [0.5, 1.05],
      swingAmp: [10, 22],
      spin: [0.15, 0.65],
      windMul: 0.82,
    },
    near: {
      r: [2.2, 4.8],
      speed: [36, 62],
      alpha: [0.48, 0.78],
      swing: [0.62, 1.25],
      swingAmp: [14, 32],
      spin: [0.35, 1.1],
      windMul: 0.55,
    },
  };

  /** @type {Map<number, HTMLCanvasElement>} */
  const spriteCache = new Map();

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function bakeFlakeSprite(radius, branches) {
    const key = Math.round(radius * 10) + branches * 100;
    const cached = spriteCache.get(key);
    if (cached) return cached;

    const pad = branches ? radius * 2.4 : radius * 2.2;
    const size = Math.ceil(pad * 2);
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const cx = c.getContext("2d");
    if (!cx) return c;

    const ox = size * 0.5;
    const oy = size * 0.5;

    if (branches) {
      cx.strokeStyle = "rgba(255,255,255,0.95)";
      cx.lineCap = "round";
      for (let i = 0; i < 6; i += 1) {
        const ang = (Math.PI / 3) * i;
        const len = radius * 1.05;
        cx.lineWidth = Math.max(0.6, radius * 0.22);
        cx.beginPath();
        cx.moveTo(ox, oy);
        cx.lineTo(ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
        cx.stroke();
        const stub = len * 0.38;
        for (const s of [-1, 1]) {
          const a2 = ang + s * 0.52;
          cx.lineWidth = Math.max(0.45, radius * 0.14);
          cx.beginPath();
          cx.moveTo(ox + Math.cos(ang) * len * 0.55, oy + Math.sin(ang) * len * 0.55);
          cx.lineTo(
            ox + Math.cos(ang) * len * 0.55 + Math.cos(a2) * stub,
            oy + Math.sin(ang) * len * 0.55 + Math.sin(a2) * stub,
          );
          cx.stroke();
        }
      }
      const g = cx.createRadialGradient(ox, oy, 0, ox, oy, radius * 0.55);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(ox, oy, radius * 0.45, 0, Math.PI * 2);
      cx.fill();
    } else {
      const g = cx.createRadialGradient(ox, oy, 0, ox, oy, radius);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.35, "rgba(240,246,255,0.55)");
      g.addColorStop(1, "rgba(220,232,248,0)");
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(ox, oy, radius, 0, Math.PI * 2);
      cx.fill();
    }

    spriteCache.set(key, c);
    return c;
  }

  function mountSnowStaticScene(host, canvas) {
    const scene = document.createElement("div");
    scene.className = "site-bg__snow-scene";
    scene.setAttribute("aria-hidden", "true");

    const orbs = document.createElement("div");
    orbs.className = "site-bg__snow-scene-orbs";

    const grain = document.createElement("div");
    grain.className = "site-bg__snow-scene-grain";

    const mist = document.createElement("div");
    mist.className = "site-bg__snow-scene-mist";

    scene.append(orbs, grain, mist);
    host.insertBefore(scene, canvas);
    return scene;
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ mistHost?: HTMLElement | null }} [opts]
   */
  function attach(canvas, opts) {
    const mistHost = opts && Object.prototype.hasOwnProperty.call(opts, "mistHost")
      ? opts.mistHost
      : canvas.parentElement;
    const useStaticBg = !!mistHost;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) {
      return { start() {}, stop() {}, resize() {}, destroy() {} };
    }
    canvas.classList.remove("site-bg__rain--css-idle");

    const weakGpu = window.KayaPerfGovernor?.isWeakGpu?.() ?? false;
    const phoneLike = window.KayaPerfGovernor?.isPhoneLike?.()
      ?? window.matchMedia("(max-width: 720px)").matches;

    const quality = {
      far: weakGpu ? 72 : (phoneLike ? 88 : 102),
      mid: weakGpu ? 58 : (phoneLike ? 68 : 78),
      near: weakGpu ? 28 : (phoneLike ? 36 : 42),
      dprCap: weakGpu ? 1 : (phoneLike ? 1.15 : 1.28),
    };

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let paused = false;
    let last = performance.now();
    let wind = 0.06;
    let windTarget = 0.06;
    let windTimer = 0;
    let gust = 0;
    let gustTarget = 0;
    let gustTimer = rand(2.2, 5.5);
    let scrollUntil = 0;

    /** @type {Array<any>} */
    const far = [];
    /** @type {Array<any>} */
    const mid = [];
    /** @type {Array<any>} */
    const near = [];

    /** @type {HTMLElement | null} */
    let sceneEl = null;

    if (useStaticBg && mistHost) {
      document.body.classList.add("kaya-ambient-eco");
      sceneEl = mountSnowStaticScene(mistHost, canvas);
    }

    const bindSprite = (f) => {
      const branches = f.layer === "near" && f.r >= 2.6 && !weakGpu && Math.random() < 0.62;
      f.branches = branches;
      f._spr = bakeFlakeSprite(f.r, branches ? 1 : 0);
      f._hw = f._spr.width * 0.5;
      f._hh = f._spr.height * 0.5;
    };

    /** 飘散：按风向从上方/侧缘入场，并赋予初始侧向动量 */
    const scatterRespawn = (f, initial = false) => {
      const edge = Math.random();
      const pad = f.r * 4;

      if (initial) {
        f.y = Math.random() * Math.max(1, h);
        f.x = rand(-pad, w + pad);
      } else if (edge < 0.12) {
        f.y = rand(pad, Math.max(pad, h - pad));
        f.x = wind >= 0 ? -pad - rand(0, 48) : w + pad + rand(0, 48);
      } else if (edge < 0.18) {
        f.y = rand(pad, Math.max(pad, h * 0.35));
        f.x = w + pad + rand(0, 64);
      } else {
        f.y = -pad - Math.random() * h * 0.22;
        f.x = rand(-pad, w + pad);
      }

      const gustBias = gust * 34;
      f.vx = wind * rand(14, 38) * f.windMul + gustBias * f.scatter + rand(-16, 16);
      f.vy = f.speed * rand(0.72, 1.08);
      f.phase = rand(0, Math.PI * 2);
      f.phase2 = rand(0, Math.PI * 2);
      f.lift = Math.random() < 0.08 ? rand(0.25, 0.75) : 0;
    };

    const makeFlake = (layer) => {
      const spec = FLAKE_SPEC[layer];
      const r = rand(spec.r[0], spec.r[1]);
      const f = {
        x: Math.random() * Math.max(1, w),
        y: Math.random() * Math.max(1, h),
        r,
        speed: rand(spec.speed[0], spec.speed[1]),
        alpha: rand(spec.alpha[0], spec.alpha[1]),
        swing: rand(spec.swing[0], spec.swing[1]),
        swingAmp: rand(spec.swingAmp[0], spec.swingAmp[1]),
        spin: rand(spec.spin[0], spec.spin[1]) * (Math.random() < 0.5 ? -1 : 1),
        angle: rand(0, Math.PI * 2),
        phase: rand(0, Math.PI * 2),
        phase2: rand(0, Math.PI * 2),
        scatter: rand(0.55, 1.25),
        windMul: spec.windMul,
        vx: 0,
        vy: 0,
        lift: 0,
        layer,
        branches: false,
        _spr: null,
        _hw: 0,
        _hh: 0,
      };
      bindSprite(f);
      scatterRespawn(f, true);
      return f;
    };

    const rebuild = () => {
      if (w < 2 || h < 2) return;
      const areaScale = clamp((w * h) / (1280 * 720), 0.62, 1.28);

      const fill = (arr, n, layer) => {
        const count = Math.max(5, Math.round(n * areaScale * dropMul));
        while (arr.length < count) arr.push(makeFlake(layer));
        if (arr.length > count) arr.length = count;
        for (let i = 0; i < arr.length; i += 1) {
          if (arr[i].x > w) arr[i].x = Math.random() * w;
          if (arr[i].y > h) arr[i].y = Math.random() * h;
        }
      };

      fill(far, quality.far, "far");
      fill(mid, quality.mid, "mid");
      fill(near, quality.near, "near");
    };

    const fit = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuild();
    };

    const stepFlake = (f, dt, windNow, gustNow) => {
      f.phase += f.swing * dt;
      f.phase2 += f.swing * 0.41 * dt;

      const sway = Math.sin(f.phase) * f.swingAmp * 0.13
        + Math.sin(f.phase2 * 0.68) * f.swingAmp * 0.055;
      const targetVx = (windNow * 22 + gustNow * 30 * f.scatter) * f.windMul + sway;
      f.vx += (targetVx - f.vx) * Math.min(1, dt * (1.6 + f.scatter * 0.5));

      const floatY = Math.sin(f.phase * 1.22 + f.phase2 * 0.35) * 5.5;
      let targetVy = f.speed + floatY;
      if (f.lift > 0) {
        f.lift -= dt;
        targetVy -= 16 * f.scatter;
      } else if (Math.random() < 0.0018 * dt * 60) {
        f.lift = rand(0.22, 0.62);
      }
      f.vy += (targetVy - f.vy) * Math.min(1, dt * 2.4);

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.branches) f.angle += f.spin * dt;

      const pad = f.r * 4;
      if (f.y > h + pad) {
        scatterRespawn(f);
      } else if (f.x > w + pad * 2) {
        f.x = -pad - rand(0, 56);
        f.vx = windNow * rand(10, 28) + gustNow * 18 - rand(0, 10);
      } else if (f.x < -pad * 2) {
        f.x = w + pad + rand(0, 56);
        f.vx = windNow * rand(10, 28) + gustNow * 18 + rand(0, 10);
      }
    };

    const paintLayer = (arr, withRotate) => {
      for (let i = 0; i < arr.length; i += 1) {
        const f = arr[i];
        const spr = f._spr;
        if (!spr) continue;
        ctx.globalAlpha = f.alpha;
        if (withRotate && f.branches) {
          const cos = Math.cos(f.angle);
          const sin = Math.sin(f.angle);
          ctx.setTransform(
            cos * dpr, sin * dpr,
            -sin * dpr, cos * dpr,
            f.x * dpr, f.y * dpr,
          );
          ctx.drawImage(spr, -f._hw, -f._hh, spr.width, spr.height);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        } else {
          ctx.drawImage(spr, f.x - f._hw, f.y - f._hh, spr.width, spr.height);
        }
      }
    };

    const runtimeGov = window.KayaPerfGovernor?.createRuntimeGovernor?.({
      min: 0.65,
      max: 1,
      initial: 1,
      weakGpu,
    }) ?? null;
    let frameBudget = FRAME_MS;
    let dropMul = 1;
    let lastFrameMs = 0;

    const applyDropBudget = () => {
      rebuild();
    };

    const onScroll = () => {
      scrollUntil = performance.now() + 180;
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });

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
        windTimer = rand(2.6, 6.8);
        windTarget = rand(-0.28, 0.34);
      }
      wind += (windTarget - wind) * Math.min(1, dt * 0.55);

      gustTimer -= dt;
      if (gustTimer <= 0) {
        gustTimer = rand(2.4, 6.2);
        gustTarget = Math.random() < 0.38
          ? rand(0.45, 1.35) * (Math.random() < 0.55 ? -1 : 1)
          : 0;
      }
      gust += (gustTarget - gust) * Math.min(1, dt * 1.35);

      ctx.clearRect(0, 0, w, h);

      const scrolling = now < scrollUntil;
      const skipNear = scrolling || (runtimeGov?.shouldSkipExtras?.() ?? false);

      for (let i = 0; i < far.length; i += 1) stepFlake(far[i], dt, wind, gust);
      for (let i = 0; i < mid.length; i += 1) stepFlake(mid[i], dt, wind, gust);
      if (!skipNear) {
        for (let i = 0; i < near.length; i += 1) stepFlake(near[i], dt, wind, gust);
      }

      paintLayer(far, false);
      paintLayer(mid, false);
      if (!skipNear) paintLayer(near, true);

      ctx.globalAlpha = 1;

      lastFrameMs = performance.now() - frameStart;

      if (runtimeGov) {
        const gs = runtimeGov.noteFrame(frameBudget, lastFrameMs);
        if (gs < 0.9 && Math.abs(dropMul - gs) > 0.06) {
          dropMul = gs;
          applyDropBudget();
        }
        frameBudget = gs < 0.88
          ? Math.max(1000 / 24, FRAME_MS / gs)
          : FRAME_MS;
      } else if (scrolling) {
        frameBudget = Math.max(1000 / 24, FRAME_MS * 1.08);
      } else {
        frameBudget = FRAME_MS;
      }
    };

    window.__KayaSnowStats = () => ({
      mode: useStaticBg ? "canvas-snow+static-dom" : "canvas-snow",
      frameMs: Math.round(lastFrameMs * 10) / 10,
      dropMul: Math.round(dropMul * 100) / 100,
      weakGpu,
      phoneLike,
      dpr,
      wind: Math.round(wind * 100) / 100,
      gust: Math.round(gust * 100) / 100,
      flakes: far.length + mid.length + near.length,
    });

    return {
      start() {
        paused = false;
        if (running) {
          last = performance.now();
          if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
          return;
        }
        running = true;
        fit();
        if (dropMul < 1) applyDropBudget();
        sceneEl?.classList.add("is-on");
        last = performance.now();
        if (!document.hidden) raf = requestAnimationFrame(tick);
      },
      stop() {
        running = false;
        paused = true;
        cancelAnimationFrame(raf);
        raf = 0;
        sceneEl?.classList.remove("is-on");
        ctx.clearRect(0, 0, w, h);
      },
      resize: fit,
      destroy() {
        window.removeEventListener("scroll", onScroll, true);
        document.removeEventListener("visibilitychange", onVisibility);
        this.stop();
        sceneEl?.remove();
        sceneEl = null;
        if (useStaticBg
          && !document.body.classList.contains("sunny-sky")
          && !document.body.classList.contains("light-rain")
          && !document.body.classList.contains("snow-sky")) {
          document.body.classList.remove("kaya-ambient-eco");
        }
        delete window.__KayaSnowStats;
      },
    };
  }

  window.KayaSnow = { attach };
})();
