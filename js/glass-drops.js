/**
 * 玻璃水珠（Canvas 2D）
 * 借鉴 Codrops RainEffect / Radiant rain-on-glass / raindrop-fx：
 * - 冷凝微珠：离屏层批量戳点；大滴滑动 destination-out 擦出干净轨迹
 * - 表面张力≈尺寸概率 kick；合并吸水；泪滴形 + 落地 spread 回弹
 * - 预烘焙精灵 + 微珠精灵，避免每帧造径向渐变
 * 不抢 WebGL（与 GPU 雨丝并存）。
 */
(() => {
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function bakeDropBitmap(size) {
    const pad = Math.ceil(size * 0.18);
    const w = size + pad * 2;
    const h = Math.ceil(size * 1.35) + pad * 2;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = w * 0.5;
    const oy = h * 0.42;
    const rx = size * 0.38;
    const ry = size * 0.44;

    /* 紧贴底影，避免大软斑像羽毛 */
    cx.fillStyle = "rgba(6, 12, 22, 0.32)";
    cx.beginPath();
    cx.ellipse(ox, oy + ry * 0.78, rx * 0.55, ry * 0.16, 0, 0, Math.PI * 2);
    cx.fill();

    const body = cx.createRadialGradient(ox - rx * 0.2, oy - ry * 0.3, rx * 0.05, ox, oy, rx);
    body.addColorStop(0, "rgba(200, 220, 240, 0.42)");
    body.addColorStop(0.4, "rgba(90, 120, 155, 0.36)");
    body.addColorStop(0.78, "rgba(28, 42, 64, 0.38)");
    body.addColorStop(1, "rgba(16, 24, 40, 0)");
    cx.fillStyle = body;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();

    cx.strokeStyle = "rgba(220, 235, 255, 0.5)";
    cx.lineWidth = Math.max(0.7, size * 0.028);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
    cx.stroke();

    const spec = cx.createRadialGradient(
      ox - rx * 0.28, oy - ry * 0.36, 0,
      ox - rx * 0.28, oy - ry * 0.36, rx * 0.28,
    );
    spec.addColorStop(0, "rgba(255,255,255,0.98)");
    spec.addColorStop(0.3, "rgba(230,245,255,0.58)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.ellipse(ox - rx * 0.28, oy - ry * 0.36, rx * 0.16, ry * 0.1, -0.5, 0, Math.PI * 2);
    cx.fill();

    return c;
  }

  function bakeBeadSprite() {
    const c = document.createElement("canvas");
    c.width = 6;
    c.height = 6;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const g = cx.createRadialGradient(2.4, 2.2, 0, 3, 3, 2.6);
    g.addColorStop(0, "rgba(255,255,255,0.92)");
    g.addColorStop(0.4, "rgba(200, 225, 245, 0.45)");
    g.addColorStop(1, "rgba(180,210,240,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.arc(3, 3, 2.5, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  function bakeSprites() {
    /* 参考片主珠约 7–9px，用较小烘焙尺寸避免软边羽毛感 */
    return [16, 22, 28, 36, 46].map(bakeDropBitmap);
  }

  /** 贴屏大块模糊水（参考片镜头水珠/泪痕） */
  function bakeLensBlob(size) {
    const pad = Math.ceil(size * 0.45);
    const w = size + pad * 2;
    const h = Math.ceil(size * 1.8) + pad * 2;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = w * 0.5;
    const oy = h * 0.4;
    const rx = size * 0.42;
    const ry = size * 0.55;
    const g = cx.createRadialGradient(ox - rx * 0.15, oy - ry * 0.2, 0, ox, oy, rx * 1.15);
    g.addColorStop(0, "rgba(230, 240, 255, 0.38)");
    g.addColorStop(0.35, "rgba(160, 190, 220, 0.22)");
    g.addColorStop(0.7, "rgba(70, 100, 140, 0.14)");
    g.addColorStop(1, "rgba(20, 35, 55, 0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();
    /* 纵向泪痕 */
    const trail = cx.createLinearGradient(ox, oy, ox, h - pad);
    trail.addColorStop(0, "rgba(200, 220, 245, 0.18)");
    trail.addColorStop(0.55, "rgba(140, 175, 210, 0.1)");
    trail.addColorStop(1, "rgba(80, 110, 150, 0)");
    cx.fillStyle = trail;
    cx.beginPath();
    cx.ellipse(ox, oy + ry * 0.85, rx * 0.28, ry * 1.1, 0, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  function pickSprite(sprites, r) {
    if (!sprites.length) return null;
    const px = r * 2.5;
    let best = 0;
    let diff = Infinity;
    for (let i = 0; i < sprites.length; i += 1) {
      const d = Math.abs(sprites[i].width - px);
      if (d < diff) { diff = d; best = i; }
    }
    return sprites[best];
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ main?: number, micro?: number, dprCap?: number, storm?: boolean, slideRatio?: number }} [opts]
   */
  function attach(canvas, opts = {}) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;

    const storm = !!opts.storm;
    const sprites = bakeSprites();
    const lensSprites = storm
      ? [48, 72, 96, 128].map(bakeLensBlob)
      : [];
    const beadSpr = bakeBeadSprite();
    const spray = document.createElement("canvas");
    const sctx = spray.getContext("2d", { alpha: true });
    if (!sctx) return null;

    let mainN = opts.main ?? 40;
    let microN = opts.micro ?? 280;
    let dprCap = opts.dprCap ?? 1.35;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let intensity = 0;
    let enabled = true;
    let sprayDirty = true;
    let mergeAcc = 0;
    let topSpawnAcc = 0;
    let lensAcc = 0;
    let flowAcc = 0;
    let mistAcc = 0;
    /** @type {Array<{x:number,y:number,w:number,h?:number,radius?:number}>} */
    let ledges = [];

    /** @type {Array<any>} */
    const drops = [];
    /** @type {Array<any>} */
    const lenses = [];
    /** 持续流动的模糊泪痕（参考片贴屏水流） */
    /** @type {Array<any>} */
    const flows = [];

    const pickInLedge = (depthFrac = 0.55) => {
      if (!ledges.length) return null;
      const L = ledges[(Math.random() * ledges.length) | 0];
      if (L.shape === "circle") {
        const cx = L.x + L.w * 0.5;
        const cy = L.y + (L.h || L.w) * 0.5;
        const R = Math.min(L.w, L.h || L.w) * 0.5 * 0.92;
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * R * (0.15 + 0.85 * depthFrac);
        return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
      }
      const pad = Math.min(L.radius || 12, L.w * 0.08);
      const lh = Math.max(28, L.h || Math.min(h * 0.22, 180));
      return {
        x: L.x + pad + Math.random() * Math.max(4, L.w - pad * 2),
        y: L.y + Math.random() * lh * depthFrac,
      };
    };

    const clearSpray = () => {
      if (!spray.width) return;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.clearRect(0, 0, spray.width, spray.height);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const stampBead = (x, y, scale, alpha) => {
      const s = (storm ? 2.9 : 2.4) * scale;
      sctx.globalAlpha = alpha;
      sctx.drawImage(beadSpr, x - s, y - s, s * 2, s * 2);
    };

    /**
     * 参考片：卡片表面水珠密度明显高于天空。
     * ~55% 微珠落在 UI 卡片矩形内，其余全屏偏中下。
     */
    const seedSpray = () => {
      clearSpray();
      const dens = storm ? 3.2 : 1;
      const n = Math.round(microN * dens * clamp((w * h) / (1280 * 720), 0.65, 1.55));
      const onUi = ledges.length ? Math.round(n * (storm ? 0.72 : 0.55)) : 0;
      for (let i = 0; i < onUi; i += 1) {
        const p = pickInLedge(0.95);
        if (!p) break;
        stampBead(p.x, p.y, rand(0.4, storm ? 1.45 : 0.9), rand(0.25, storm ? 0.7 : 0.48));
      }
      for (let i = onUi; i < n; i += 1) {
        const yBias = Math.pow(Math.random(), 0.68);
        stampBead(
          Math.random() * w,
          yBias * h,
          rand(0.35, storm ? 1.35 : 0.85),
          rand(0.16, storm ? 0.55 : 0.38),
        );
      }
      sctx.globalAlpha = 1;
      sprayDirty = false;
    };

    const eraseSpray = (x, y, rad, trailLen) => {
      sctx.save();
      sctx.globalCompositeOperation = "destination-out";
      sctx.fillStyle = "#000";
      sctx.beginPath();
      sctx.arc(x, y, rad, 0, Math.PI * 2);
      sctx.fill();
      if (trailLen > 0) {
        sctx.beginPath();
        sctx.ellipse(x, y - trailLen * 0.5, rad * 0.32, trailLen * 0.55, 0, 0, Math.PI * 2);
        sctx.fill();
      }
      sctx.restore();
    };

    const spawnDrop = (opts2 = {}) => {
      const fromTop = !!opts2.fromTop;
      const preferUi = opts2.preferUi !== false && !fromTop && ledges.length && Math.random() < (storm ? 0.75 : 0.62);
      const ui = preferUi ? pickInLedge(0.85) : null;
      const r = opts2.r ?? rand(storm ? 4.5 : 2.8, storm ? 12.5 : 7.2);
      /* 暴雨：多数珠子带动量，形成持续下滑 */
      const momentum = opts2.momentum ?? (
        storm
          ? (Math.random() < 0.72 ? rand(0.8, 3.2) : rand(0.05, 0.4))
          : (Math.random() < 0.18 ? rand(0.6, 1.8) : 0)
      );
      drops.push({
        x: opts2.x ?? ui?.x ?? Math.random() * w,
        y: fromTop ? rand(-40, -8) : (opts2.y ?? ui?.y ?? Math.random() * h),
        r,
        momentum,
        vx: rand(storm ? -18 : -8, storm ? 18 : 8),
        a: rand(0.58, storm ? 0.98 : 0.88),
        spreadX: rand(0.04, storm ? 0.28 : 0.14),
        spreadY: rand(0.03, storm ? 0.22 : 0.1),
        lastSpawn: 40,
        sprite: pickSprite(sprites, r),
        killed: false,
      });
    };

    const spawnLens = () => {
      if (!storm || !lensSprites.length) return;
      const spr = lensSprites[(Math.random() * lensSprites.length) | 0];
      lenses.push({
        x: rand(w * 0.04, w * 0.96),
        y: rand(-h * 0.08, h * 0.4),
        vx: rand(-10, 10),
        vy: rand(36, 95),
        life: rand(2.2, 5.5),
        age: 0,
        a: rand(0.28, 0.62),
        scale: rand(0.85, 1.7),
        sprite: spr,
      });
    };

    const spawnFlow = () => {
      if (!storm) return;
      flows.push({
        x: rand(0, w),
        y: rand(-40, h * 0.35),
        vx: rand(-8, 8),
        vy: rand(55, 140),
        w: rand(6, 22),
        h: rand(40, 160),
        a: rand(0.12, 0.32),
        life: rand(1.8, 4.5),
        age: 0,
        wobble: rand(0, Math.PI * 2),
      });
    };

    const rebuild = () => {
      drops.length = 0;
      lenses.length = 0;
      flows.length = 0;
      const area = clamp((w * h) / (1280 * 720), 0.65, 1.35);
      const n = Math.round(mainN * area);
      for (let i = 0; i < n; i += 1) spawnDrop();
      if (storm) {
        for (let i = 0; i < 12; i += 1) spawnLens();
        for (let i = 0; i < 22; i += 1) spawnFlow();
      }
      sprayDirty = true;
    };

    const resize = (cssW, cssH) => {
      w = Math.max(1, cssW | 0);
      h = Math.max(1, cssH | 0);
      dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const bw = Math.max(1, Math.floor(w * dpr));
      const bh = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      if (spray.width !== bw || spray.height !== bh) {
        spray.width = bw;
        spray.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuild();
    };

    const mergeDrops = () => {
      if (drops.length < 2) return;
      drops.sort((a, b) => a.y - b.y);
      for (let i = 0; i < drops.length; i += 1) {
        const d1 = drops[i];
        if (d1.killed) continue;
        const lim = Math.min(i + 22, drops.length);
        for (let j = i + 1; j < lim; j += 1) {
          const d2 = drops[j];
          if (d2.killed || d1.r <= d2.r) continue;
          const dx = d2.x - d1.x;
          const dy = d2.y - d1.y;
          const limR = (d1.r + d2.r) * 0.4;
          if (dx * dx + dy * dy >= limR * limR) continue;
          const a1 = Math.PI * d1.r * d1.r;
          const a2 = Math.PI * d2.r * d2.r;
          d1.r = Math.min(storm ? 14 : 10, Math.sqrt((a1 + a2 * 0.82) / Math.PI));
          d1.momentum += 1.15;
          d1.spreadX = Math.max(d1.spreadX, 0.24);
          d1.spreadY = Math.max(d1.spreadY, 0.15);
          d1.sprite = pickSprite(sprites, d1.r);
          d2.killed = true;
        }
      }
      for (let i = drops.length - 1; i >= 0; i -= 1) {
        if (drops[i].killed) drops.splice(i, 1);
      }
    };

    const drawDrop = (d, aMul) => {
      const TEAR = 1.28;
      const dw = d.r * 2 * (1 + d.spreadX);
      const dh = d.r * 2 * TEAR * (1 + d.spreadY);
      const alpha = d.a * aMul;
      const spr = d.sprite;
      if (spr) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(spr, d.x - dw * 0.5, d.y - dh * 0.42, dw, dh);
      }
    };

    const draw = (dt, aMul) => {
      if (!enabled || !ctx) return;
      ctx.clearRect(0, 0, w, h);
      if (aMul < 0.02 || w < 2) return;

      if (sprayDirty) seedSpray();

      const area = clamp((w * h) / (1280 * 720), 0.65, 1.35);
      const target = Math.round(mainN * area * Math.max(0.55, aMul));

      /* 持续补雾点（Codrops spray 层） */
      mistAcc += dt * aMul;
      const mistEvery = storm ? 0.028 : 0.12;
      while (mistAcc > mistEvery) {
        mistAcc -= mistEvery;
        const k = storm ? (5 + ((Math.random() * 12) | 0)) : (1 + ((Math.random() * 3) | 0));
        for (let i = 0; i < k; i += 1) {
          const ui = ledges.length && Math.random() < 0.72 ? pickInLedge(0.92) : null;
          const x = ui?.x ?? Math.random() * w;
          const y = ui?.y ?? Math.pow(Math.random(), 0.65) * h;
          stampBead(x, y, rand(0.3, storm ? 1.2 : 0.75), rand(0.18, storm ? 0.55 : 0.36) * aMul);
        }
        sctx.globalAlpha = 1;
      }

      mergeAcc += dt;
      if (mergeAcc > (storm ? 0.06 : 0.1)) {
        mergeAcc = 0;
        mergeDrops();
      }

      const topEvery = storm ? 0.045 : 0.28;
      topSpawnAcc += dt * aMul;
      while (topSpawnAcc > topEvery && drops.length < target + 40) {
        topSpawnAcc -= topEvery;
        if (Math.random() < (storm ? 0.95 : 0.48)) {
          spawnDrop({
            fromTop: true,
            momentum: rand(0.5, storm ? 3.4 : 1.0),
            r: rand(storm ? 4.5 : 2.6, storm ? 13 : 5.8),
          });
        }
      }

      if (storm) {
        lensAcc += dt * aMul;
        while (lensAcc > 0.22 && lenses.length < 24) {
          lensAcc -= 0.22;
          spawnLens();
        }
        flowAcc += dt * aMul;
        while (flowAcc > 0.1 && flows.length < 42) {
          flowAcc -= 0.1;
          spawnFlow();
        }
      }

      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        const tension = storm ? 0.72 : 1.15;
        if (Math.random() < (d.r / (100 * tension)) * dt * (storm ? 1.15 : 0.55)) {
          d.momentum += rand(0.4, storm ? 2.6 : 1.6);
        }

        if (d.momentum > 0.08) {
          const step = d.momentum * (storm ? 72 : 48) * dt;
          d.y += step;
          d.x += d.vx * dt * 0.32 + Math.sin(d.y * 0.028 + d.r) * (storm ? 7 : 4.2) * dt;
          d.momentum *= Math.pow(storm ? 0.965 : 0.94, dt * 60);
          eraseSpray(d.x, d.y, d.r * 1.15, Math.min(storm ? 52 : 22, 8 + step * 2.4));
          d.lastSpawn += dt * 60;
          if (d.momentum > 0.35 && d.lastSpawn > (storm ? 7 : 14)) {
            d.lastSpawn = 0;
            d.r *= 0.988;
            stampBead(d.x + rand(-2, 2), d.y - d.r * rand(0.3, 1.1), rand(0.3, 0.7), 0.32 * aMul);
            sctx.globalAlpha = 1;
            d.sprite = pickSprite(sprites, d.r);
          }
        }

        d.spreadX *= Math.pow(0.45, dt * 60);
        d.spreadY *= Math.pow(0.72, dt * 60);

        if (d.y > h + 40 || d.x < -40 || d.x > w + 40 || d.r < 1.8) {
          drops.splice(i, 1);
          continue;
        }
      }

      while (drops.length < target) spawnDrop();
      if (drops.length > target + 20) drops.length = target + 16;

      /* 持续流动模糊泪痕 */
      for (let i = flows.length - 1; i >= 0; i -= 1) {
        const f = flows[i];
        f.age += dt;
        const p = 1 - f.age / f.life;
        if (p <= 0 || f.y > h + 80) {
          flows.splice(i, 1);
          continue;
        }
        f.wobble += dt * 2.4;
        f.y += f.vy * dt;
        f.x += f.vx * dt + Math.sin(f.wobble) * 10 * dt;
        f.vy += 18 * dt;
        f.h = Math.min(220, f.h + dt * 28);
        ctx.save();
        ctx.globalAlpha = f.a * aMul * clamp(p * 1.15, 0, 1);
        try { ctx.filter = "blur(3.5px)"; } catch { /* ignore */ }
        const g = ctx.createLinearGradient(f.x, f.y, f.x, f.y + f.h);
        g.addColorStop(0, "rgba(230,242,255,0.55)");
        g.addColorStop(0.35, "rgba(170,200,230,0.28)");
        g.addColorStop(1, "rgba(90,120,160,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(f.x, f.y + f.h * 0.35, f.w * 0.45, f.h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        try { ctx.filter = "none"; } catch { /* ignore */ }
        ctx.restore();
        eraseSpray(f.x, f.y + f.h * 0.2, f.w * 0.35, f.h * 0.35);
      }

      for (let i = lenses.length - 1; i >= 0; i -= 1) {
        const L = lenses[i];
        L.age += dt;
        const p = 1 - L.age / L.life;
        if (p <= 0) {
          lenses.splice(i, 1);
          continue;
        }
        L.y += L.vy * dt;
        L.x += L.vx * dt;
        L.vy += 16 * dt;
        const spr = L.sprite;
        if (spr) {
          const dw = spr.width * 0.58 * L.scale;
          const dh = spr.height * 0.58 * L.scale;
          ctx.save();
          ctx.globalAlpha = L.a * aMul * clamp(p * 1.25, 0, 1);
          try { ctx.filter = "blur(3px)"; } catch { /* ignore */ }
          ctx.drawImage(spr, L.x - dw * 0.5, L.y - dh * 0.35, dw, dh);
          try { ctx.filter = "none"; } catch { /* ignore */ }
          ctx.restore();
          eraseSpray(L.x, L.y, dw * 0.22, dh * 0.25);
        }
      }

      ctx.globalAlpha = aMul * (storm ? 1 : 0.88);
      ctx.drawImage(spray, 0, 0, w, h);
      ctx.globalAlpha = 1;
      for (let i = 0; i < drops.length; i += 1) drawDrop(drops[i], aMul * (storm ? 1.05 : 1));
      ctx.globalAlpha = 1;
    };

    return {
      resize,
      setIntensity(v) {
        const next = clamp(v, 0, 1);
        if ((intensity < 0.08 && next >= 0.08) || Math.abs(next - intensity) > 0.25) {
          sprayDirty = true;
        }
        intensity = next;
      },
      setCounts(main, micro) {
        mainN = main;
        microN = micro;
        if (w > 1) rebuild();
      },
      /** @param {Array<{x:number,y:number,w:number,h?:number,radius?:number}>} next */
      setLedges(next) {
        const arr = Array.isArray(next) ? next : [];
        const wasEmpty = !ledges.length;
        ledges = arr;
        if (wasEmpty && arr.length) sprayDirty = true;
      },
      setEnabled(on) { enabled = !!on; },
      draw(dt) { draw(dt, intensity); },
      clear() {
        drops.length = 0;
        lenses.length = 0;
        flows.length = 0;
        clearSpray();
        ctx.clearRect(0, 0, w, h);
      },
      destroy() {
        this.clear();
      },
    };
  }

  window.KayaGlassDrops = { attach };
})();
