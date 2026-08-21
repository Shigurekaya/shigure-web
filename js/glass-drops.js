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
    const pad = Math.ceil(size * 0.2);
    const w = size + pad * 2;
    const h = Math.ceil(size * 1.42) + pad * 2;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = w * 0.5;
    const oy = h * 0.4;
    const rx = size * 0.36;
    const ry = size * 0.44;

    cx.fillStyle = "rgba(8, 16, 28, 0.12)";
    cx.beginPath();
    cx.ellipse(ox, oy + ry * 0.82, rx * 0.48, ry * 0.12, 0, 0, Math.PI * 2);
    cx.fill();

    const body = cx.createRadialGradient(ox - rx * 0.22, oy - ry * 0.32, rx * 0.04, ox, oy, rx);
    body.addColorStop(0, "rgba(245, 250, 255, 0.55)");
    body.addColorStop(0.28, "rgba(190, 220, 245, 0.28)");
    body.addColorStop(0.62, "rgba(140, 180, 220, 0.16)");
    body.addColorStop(1, "rgba(255, 255, 255, 0)");
    cx.fillStyle = body;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();

    /* 玻璃折射边缘 */
    cx.strokeStyle = "rgba(245, 250, 255, 0.65)";
    cx.lineWidth = Math.max(0.7, size * 0.03);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
    cx.stroke();

    const rim = cx.createLinearGradient(ox - rx, oy, ox + rx, oy);
    rim.addColorStop(0, "rgba(255,255,255,0)");
    rim.addColorStop(0.35, "rgba(255,255,255,0.35)");
    rim.addColorStop(0.65, "rgba(255,255,255,0)");
    cx.strokeStyle = rim;
    cx.lineWidth = Math.max(0.5, size * 0.02);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.78, ry * 0.78, 0, -0.8, 2.2);
    cx.stroke();

    const spec = cx.createRadialGradient(
      ox - rx * 0.3, oy - ry * 0.38, 0,
      ox - rx * 0.3, oy - ry * 0.38, rx * 0.3,
    );
    spec.addColorStop(0, "rgba(255,255,255,1)");
    spec.addColorStop(0.28, "rgba(235,245,255,0.75)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.ellipse(ox - rx * 0.3, oy - ry * 0.38, rx * 0.15, ry * 0.09, -0.5, 0, Math.PI * 2);
    cx.fill();

    /* 次高光 */
    cx.fillStyle = "rgba(255,255,255,0.45)";
    cx.beginPath();
    cx.ellipse(ox + rx * 0.22, oy + ry * 0.15, rx * 0.06, ry * 0.04, 0.4, 0, Math.PI * 2);
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
    /* 多档尺寸，主珠高光更清晰 */
    return [14, 18, 24, 30, 38, 48].map(bakeDropBitmap);
  }

  /** 贴屏中号水团：清晰边缘 + 高光，避免软糊斑 */
  function bakeLensBlob(size) {
    const pad = Math.ceil(size * 0.28);
    const w = size + pad * 2;
    const h = Math.ceil(size * 1.45) + pad * 2;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = w * 0.5;
    const oy = h * 0.4;
    const rx = size * 0.36;
    const ry = size * 0.42;
    cx.fillStyle = "rgba(8, 14, 24, 0.22)";
    cx.beginPath();
    cx.ellipse(ox, oy + ry * 0.7, rx * 0.5, ry * 0.14, 0, 0, Math.PI * 2);
    cx.fill();
    const g = cx.createRadialGradient(ox - rx * 0.22, oy - ry * 0.28, 0, ox, oy, rx);
    g.addColorStop(0, "rgba(225, 238, 255, 0.5)");
    g.addColorStop(0.4, "rgba(120, 155, 190, 0.32)");
    g.addColorStop(0.82, "rgba(36, 52, 78, 0.34)");
    g.addColorStop(1, "rgba(16, 24, 40, 0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "rgba(230, 245, 255, 0.42)";
    cx.lineWidth = Math.max(0.8, size * 0.022);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
    cx.stroke();
    const spec = cx.createRadialGradient(
      ox - rx * 0.3, oy - ry * 0.34, 0,
      ox - rx * 0.3, oy - ry * 0.34, rx * 0.32,
    );
    spec.addColorStop(0, "rgba(255,255,255,0.95)");
    spec.addColorStop(0.35, "rgba(230,245,255,0.45)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.ellipse(ox - rx * 0.3, oy - ry * 0.34, rx * 0.14, ry * 0.09, -0.45, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  /** 细长泪痕精灵（无 canvas filter，边缘干净） */
  function bakeRivulet(w0, h0) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w0);
    c.height = Math.ceil(h0);
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = c.width * 0.5;
    const top = 2;
    const bot = c.height - 2;
    const half = Math.max(1.2, c.width * 0.28);
    const g = cx.createLinearGradient(ox, top, ox, bot);
    g.addColorStop(0, "rgba(235,245,255,0.08)");
    g.addColorStop(0.12, "rgba(210,230,250,0.38)");
    g.addColorStop(0.55, "rgba(150,185,220,0.22)");
    g.addColorStop(1, "rgba(90,120,160,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.moveTo(ox, top);
    cx.bezierCurveTo(ox + half * 0.7, top + 8, ox + half, bot * 0.45, ox + half * 0.35, bot);
    cx.quadraticCurveTo(ox, bot + 1, ox - half * 0.35, bot);
    cx.bezierCurveTo(ox - half, bot * 0.45, ox - half * 0.7, top + 8, ox, top);
    cx.closePath();
    cx.fill();
    cx.strokeStyle = "rgba(245,250,255,0.35)";
    cx.lineWidth = 0.7;
    cx.beginPath();
    cx.moveTo(ox - half * 0.15, top + 4);
    cx.quadraticCurveTo(ox - half * 0.4, bot * 0.4, ox - half * 0.12, bot - 4);
    cx.stroke();
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
   * @param {{ main?: number, micro?: number, dprCap?: number, storm?: boolean, slideRatio?: number, lite?: boolean, noSpray?: boolean }} [opts]
   */
  function attach(canvas, opts = {}) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;

    const storm = !!opts.storm;
    const lite = !!opts.lite;
    /* 暴雨关掉糊散冷凝喷雾球，只留清晰滑动玻璃珠 + 泪痕 */
    const noSpray = !!opts.noSpray || (storm && (opts.micro === 0));
    const sprites = bakeSprites();
    const lensSprites = storm && !lite && !noSpray
      ? [40, 56, 72].map(bakeLensBlob)
      : [];
    const rivuletSprites = storm && !lite
      ? [
        bakeRivulet(10, 56),
        bakeRivulet(14, 88),
        bakeRivulet(18, 120),
        bakeRivulet(12, 72),
        bakeRivulet(16, 100),
        bakeRivulet(20, 140),
      ]
      : [];
    const beadSpr = bakeBeadSprite();
    const spray = document.createElement("canvas");
    const sctx = spray.getContext("2d", { alpha: true });
    if (!sctx) return null;

    let mainN = opts.main ?? 40;
    let microN = noSpray ? 0 : (opts.micro ?? 280);
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
      const s = (storm ? 2.15 : 2.4) * scale;
      sctx.globalAlpha = alpha;
      sctx.drawImage(beadSpr, x - s, y - s, s * 2, s * 2);
    };

    /**
     * 参考片：卡片表面水珠密度高于天空，但忌糊成灰雾。
     * 暴雨：中等密度、偏亮小珠；大雨沿用原比例。
     */
    const seedSpray = () => {
      clearSpray();
      if (noSpray || microN <= 0) {
        sprayDirty = false;
        return;
      }
      /* 大雨才铺冷凝微珠；暴雨禁用（避免糊散圆球） */
      const dens = 1;
      const n = Math.round(microN * dens * clamp((w * h) / (1280 * 720), 0.65, 1.55));
      const onUi = ledges.length ? Math.round(n * 0.55) : 0;
      for (let i = 0; i < onUi; i += 1) {
        const p = pickInLedge(0.95);
        if (!p) break;
        stampBead(p.x, p.y, rand(0.45, 0.9), rand(0.28, 0.48));
      }
      for (let i = onUi; i < n; i += 1) {
        const yBias = Math.pow(Math.random(), 0.72);
        stampBead(
          Math.random() * w,
          yBias * h,
          rand(0.35, 0.85),
          rand(0.14, 0.38),
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
      const preferUi = opts2.preferUi !== false && !fromTop && ledges.length && Math.random() < (storm ? 0.68 : 0.62);
      const ui = preferUi ? pickInLedge(0.85) : null;
      const r = opts2.r ?? rand(storm ? 3.8 : 2.8, storm ? 9.5 : 7.2);
      /* 暴雨：多数先粘附，再突然下滑（更像玻璃表面张力） */
      const momentum = opts2.momentum ?? (
        storm
          ? (Math.random() < 0.28 ? rand(0.9, 2.4) : rand(0, 0.12))
          : (Math.random() < 0.22 ? rand(0.55, 1.7) : rand(0, 0.08))
      );
      drops.push({
        x: opts2.x ?? ui?.x ?? Math.random() * w,
        y: fromTop ? rand(-40, -8) : (opts2.y ?? ui?.y ?? Math.random() * h),
        r,
        momentum,
        vx: rand(storm ? -12 : -8, storm ? 12 : 8),
        a: rand(0.62, storm ? 0.96 : 0.88),
        spreadX: rand(0.04, storm ? 0.16 : 0.14),
        spreadY: rand(0.03, storm ? 0.14 : 0.1),
        lastSpawn: 40,
        sprite: pickSprite(sprites, r),
        killed: false,
      });
    };

    const spawnLens = () => {
      if (!storm || !lensSprites.length) return;
      const spr = lensSprites[(Math.random() * lensSprites.length) | 0];
      const preferUi = ledges.length && Math.random() < 0.55;
      const ui = preferUi ? pickInLedge(0.7) : null;
      lenses.push({
        x: ui?.x ?? rand(w * 0.06, w * 0.94),
        y: ui?.y ?? rand(h * 0.05, h * 0.55),
        vx: rand(-6, 6),
        vy: rand(0, 12),
        life: rand(3.5, 7.5),
        age: 0,
        a: rand(0.42, 0.72),
        scale: rand(0.7, 1.15),
        sprite: spr,
        stuck: Math.random() < 0.65,
      });
    };

    const spawnFlow = () => {
      if (!storm || !rivuletSprites.length) return;
      const spr = rivuletSprites[(Math.random() * rivuletSprites.length) | 0];
      const preferUi = ledges.length && Math.random() < 0.5;
      const ui = preferUi ? pickInLedge(0.4) : null;
      flows.push({
        x: ui?.x ?? rand(w * 0.04, w * 0.96),
        y: ui?.y ?? rand(-30, h * 0.25),
        vx: rand(-5, 5),
        vy: rand(42, 95),
        scale: rand(0.85, 1.35),
        a: rand(0.28, 0.52),
        life: rand(2.2, 4.8),
        age: 0,
        wobble: rand(0, Math.PI * 2),
        sprite: spr,
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
        if (!lite) {
          for (let i = 0; i < 5; i += 1) spawnLens();
          for (let i = 0; i < 8; i += 1) spawnFlow();
        }
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
          d1.r = Math.min(storm ? 11 : 10, Math.sqrt((a1 + a2 * 0.82) / Math.PI));
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

      /* 持续补雾点——暴雨 noSpray 时完全跳过 */
      mistAcc += dt * aMul;
      const mistEvery = noSpray ? 999 : (storm ? (lite ? 0.08 : 0.045) : 0.12);
      while (!noSpray && mistAcc > mistEvery) {
        mistAcc -= mistEvery;
        const k = storm
          ? (lite ? (2 + ((Math.random() * 3) | 0)) : (4 + ((Math.random() * 6) | 0)))
          : (1 + ((Math.random() * 3) | 0));
        for (let i = 0; i < k; i += 1) {
          const ui = ledges.length && Math.random() < (storm ? 0.72 : 0.65) ? pickInLedge(0.92) : null;
          const x = ui?.x ?? Math.random() * w;
          const y = ui?.y ?? Math.pow(Math.random(), storm ? 0.55 : 0.65) * h;
          stampBead(x, y, rand(0.4, storm ? 1.15 : 0.75), rand(0.18, storm ? 0.48 : 0.36) * aMul);
        }
        sctx.globalAlpha = 1;
      }

      mergeAcc += dt;
      if (mergeAcc > (storm ? 0.08 : 0.1)) {
        mergeAcc = 0;
        mergeDrops();
      }

      const topEvery = storm ? 0.06 : 0.28;
      topSpawnAcc += dt * aMul;
      while (topSpawnAcc > topEvery && drops.length < target + (storm ? 48 : 28)) {
        topSpawnAcc -= topEvery;
        if (Math.random() < (storm ? 0.85 : 0.48)) {
          spawnDrop({
            fromTop: true,
            momentum: rand(0.45, storm ? 2.4 : 1.0),
            r: rand(storm ? 4.2 : 2.6, storm ? 11 : 5.8),
          });
        }
      }

      if (storm && !lite && !noSpray) {
        lensAcc += dt * aMul;
        while (lensAcc > 0.32 && lenses.length < 14) {
          lensAcc -= 0.32;
          spawnLens();
        }
      }
      if (storm && !lite) {
        flowAcc += dt * aMul;
        while (flowAcc > 0.12 && flows.length < (noSpray ? 28 : 22)) {
          flowAcc -= 0.12;
          spawnFlow();
        }
      }

      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        const tension = storm ? 0.95 : 1.15;
        /* 粘附珠周期性 kick 下滑 */
        if (Math.random() < (d.r / (100 * tension)) * dt * (storm ? 0.85 : 0.55)) {
          d.momentum += rand(0.55, storm ? 2.1 : 1.6);
        }

        if (d.momentum > 0.08) {
          const step = d.momentum * (storm ? 58 : 48) * dt;
          d.y += step;
          d.x += d.vx * dt * 0.28 + Math.sin(d.y * 0.028 + d.r) * (storm ? 4.5 : 4.2) * dt;
          d.momentum *= Math.pow(storm ? 0.972 : 0.94, dt * 60);
          eraseSpray(d.x, d.y, d.r * 1.05, Math.min(storm ? 36 : 22, 8 + step * 2.2));
          d.lastSpawn += dt * 60;
          if (d.momentum > 0.35 && d.lastSpawn > (storm ? 10 : 14)) {
            d.lastSpawn = 0;
            d.r *= 0.99;
            stampBead(d.x + rand(-1.5, 1.5), d.y - d.r * rand(0.3, 1.0), rand(0.28, 0.55), 0.26 * aMul);
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

      /* 细长泪痕：精灵绘制，擦出干净湿痕 */
      for (let i = flows.length - 1; i >= 0; i -= 1) {
        const f = flows[i];
        f.age += dt;
        const p = 1 - f.age / f.life;
        if (p <= 0 || f.y > h + 80) {
          flows.splice(i, 1);
          continue;
        }
        f.wobble += dt * 1.8;
        f.y += f.vy * dt;
        f.x += f.vx * dt + Math.sin(f.wobble) * 6 * dt;
        f.vy += 12 * dt;
        const spr = f.sprite;
        if (spr) {
          const dw = spr.width * f.scale;
          const dh = spr.height * f.scale;
          ctx.globalAlpha = f.a * aMul * clamp(p * 1.1, 0, 1);
          ctx.drawImage(spr, f.x - dw * 0.5, f.y, dw, dh);
          eraseSpray(f.x, f.y + dh * 0.35, dw * 0.28, dh * 0.4);
        }
      }

      for (let i = lenses.length - 1; i >= 0; i -= 1) {
        const L = lenses[i];
        L.age += dt;
        const p = 1 - L.age / L.life;
        if (p <= 0 || L.y > h + 60) {
          lenses.splice(i, 1);
          continue;
        }
        if (L.stuck) {
          if (Math.random() < 0.35 * dt) {
            L.stuck = false;
            L.vy = rand(28, 70);
          }
        } else {
          L.y += L.vy * dt;
          L.x += L.vx * dt;
          L.vy += 22 * dt;
        }
        const spr = L.sprite;
        if (spr) {
          const dw = spr.width * 0.52 * L.scale;
          const dh = spr.height * 0.52 * L.scale;
          ctx.globalAlpha = L.a * aMul * clamp(p * 1.15, 0, 1);
          ctx.drawImage(spr, L.x - dw * 0.5, L.y - dh * 0.4, dw, dh);
          if (!L.stuck) eraseSpray(L.x, L.y, dw * 0.2, dh * 0.22);
        }
      }

      ctx.globalAlpha = aMul * (storm ? 0.92 : 0.88);
      if (!noSpray) ctx.drawImage(spray, 0, 0, w, h);
      ctx.globalAlpha = 1;
      for (let i = 0; i < drops.length; i += 1) drawDrop(drops[i], aMul * (storm ? 1.12 : 1));
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
        microN = noSpray ? 0 : micro;
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
