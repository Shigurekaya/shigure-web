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

  /**
   * 主珠：对齐小米「透镜水珠」——中心近透、Fresnel 亮边 + 高光，
   * 盖在白字上仍像玻璃而非墨团（参考片 temp/mid 带）。
   */
  function bakeDropBitmap(size) {
    const pad = Math.ceil(size * 0.22);
    const w = size + pad * 2;
    const h = Math.ceil(size * 1.48) + pad * 2;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = w * 0.5;
    const oy = h * 0.4;
    const rx = size * 0.36;
    const ry = size * 0.46;

    /* 极轻接触影（勿黑） */
    cx.fillStyle = "rgba(30, 55, 90, 0.08)";
    cx.beginPath();
    cx.ellipse(ox, oy + ry * 0.88, rx * 0.42, ry * 0.1, 0, 0, Math.PI * 2);
    cx.fill();

    /* 中心几乎透明，外缘略亮——像透镜 */
    const body = cx.createRadialGradient(ox, oy, rx * 0.08, ox, oy, rx);
    body.addColorStop(0, "rgba(255,255,255,0.06)");
    body.addColorStop(0.45, "rgba(210,235,255,0.1)");
    body.addColorStop(0.78, "rgba(185,220,250,0.22)");
    body.addColorStop(1, "rgba(200,230,255,0)");
    cx.fillStyle = body;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();

    cx.strokeStyle = "rgba(255,255,255,0.78)";
    cx.lineWidth = Math.max(0.85, size * 0.038);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
    cx.stroke();

    const rim = cx.createLinearGradient(ox - rx, oy - ry, ox + rx, oy + ry);
    rim.addColorStop(0, "rgba(255,255,255,0)");
    rim.addColorStop(0.28, "rgba(255,255,255,0.55)");
    rim.addColorStop(0.55, "rgba(255,255,255,0)");
    rim.addColorStop(0.78, "rgba(220,240,255,0.25)");
    rim.addColorStop(1, "rgba(255,255,255,0)");
    cx.strokeStyle = rim;
    cx.lineWidth = Math.max(0.55, size * 0.024);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.78, ry * 0.78, 0, -0.9, 2.35);
    cx.stroke();

    const spec = cx.createRadialGradient(
      ox - rx * 0.32, oy - ry * 0.4, 0,
      ox - rx * 0.32, oy - ry * 0.4, rx * 0.34,
    );
    spec.addColorStop(0, "rgba(255,255,255,1)");
    spec.addColorStop(0.3, "rgba(245,250,255,0.85)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.ellipse(ox - rx * 0.32, oy - ry * 0.4, rx * 0.16, ry * 0.1, -0.55, 0, Math.PI * 2);
    cx.fill();

    cx.fillStyle = "rgba(255,255,255,0.4)";
    cx.beginPath();
    cx.ellipse(ox + rx * 0.24, oy + ry * 0.18, rx * 0.055, ry * 0.035, 0.45, 0, Math.PI * 2);
    cx.fill();

    return c;
  }

  /**
   * 冷凝微珠：参考片 round_w≈2px 的透亮高光点（非软灰球）。
   */
  function bakeBeadSprite(size = 4) {
    const dim = Math.max(4, size | 0);
    const c = document.createElement("canvas");
    c.width = dim;
    c.height = dim;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const o = dim * 0.5;
    const r = dim * 0.4;
    const body = cx.createRadialGradient(o - r * 0.15, o - r * 0.2, 0, o, o, r);
    body.addColorStop(0, "rgba(255,255,255,1)");
    body.addColorStop(0.35, "rgba(235,248,255,0.55)");
    body.addColorStop(0.7, "rgba(200,230,255,0.12)");
    body.addColorStop(1, "rgba(180,215,245,0)");
    cx.fillStyle = body;
    cx.beginPath();
    cx.arc(o, o, r, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  function bakeBeadSprites() {
    return [3, 4, 5, 7].map(bakeBeadSprite);
  }

  function bakeSprites() {
    return [12, 16, 22, 28, 36, 46].map(bakeDropBitmap);
  }

  /** 中号水团：同样透镜化，忌暗芯 */
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
    cx.fillStyle = "rgba(25, 50, 85, 0.07)";
    cx.beginPath();
    cx.ellipse(ox, oy + ry * 0.72, rx * 0.45, ry * 0.11, 0, 0, Math.PI * 2);
    cx.fill();
    const g = cx.createRadialGradient(ox, oy, 0, ox, oy, rx);
    g.addColorStop(0, "rgba(255,255,255,0.08)");
    g.addColorStop(0.5, "rgba(200,230,255,0.16)");
    g.addColorStop(0.85, "rgba(175,215,245,0.28)");
    g.addColorStop(1, "rgba(190,220,245,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "rgba(245, 252, 255, 0.62)";
    cx.lineWidth = Math.max(0.9, size * 0.028);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
    cx.stroke();
    const spec = cx.createRadialGradient(
      ox - rx * 0.3, oy - ry * 0.34, 0,
      ox - rx * 0.3, oy - ry * 0.34, rx * 0.32,
    );
    spec.addColorStop(0, "rgba(255,255,255,1)");
    spec.addColorStop(0.35, "rgba(235,248,255,0.55)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.ellipse(ox - rx * 0.3, oy - ry * 0.34, rx * 0.15, ry * 0.09, -0.45, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  /** 参考片泪痕：极细长亮纹（w≈1–3px 量级），非宽糊条 */
  function bakeRivulet(w0, h0) {
    const c = document.createElement("canvas");
    c.width = Math.max(4, Math.ceil(w0));
    c.height = Math.ceil(h0);
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = c.width * 0.5;
    const top = 1;
    const bot = c.height - 1;
    const half = Math.max(0.7, c.width * 0.22);
    const g = cx.createLinearGradient(ox, top, ox, bot);
    g.addColorStop(0, "rgba(255,255,255,0.05)");
    g.addColorStop(0.08, "rgba(245,250,255,0.55)");
    g.addColorStop(0.45, "rgba(210,235,255,0.28)");
    g.addColorStop(0.85, "rgba(180,215,245,0.1)");
    g.addColorStop(1, "rgba(160,200,235,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.moveTo(ox, top);
    cx.bezierCurveTo(ox + half * 0.55, top + 6, ox + half * 0.85, bot * 0.4, ox + half * 0.25, bot);
    cx.quadraticCurveTo(ox, bot + 0.5, ox - half * 0.25, bot);
    cx.bezierCurveTo(ox - half * 0.85, bot * 0.4, ox - half * 0.55, top + 6, ox, top);
    cx.closePath();
    cx.fill();
    cx.strokeStyle = "rgba(255,255,255,0.55)";
    cx.lineWidth = 0.55;
    cx.beginPath();
    cx.moveTo(ox - half * 0.08, top + 3);
    cx.quadraticCurveTo(ox - half * 0.28, bot * 0.42, ox - half * 0.06, bot - 3);
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
    /* noSpray 仅显式关闭；micro===0 时也不铺冷凝层 */
    const noSpray = !!opts.noSpray;
    const sprites = bakeSprites();
    /* 中号水团桌面开；泪痕手机也开（参考片关键细亮纹） */
    const lensSprites = storm && !lite
      ? [36, 48, 64].map(bakeLensBlob)
      : [];
    const rivuletSprites = storm
      ? (lite
        ? [
          bakeRivulet(5, 48),
          bakeRivulet(6, 72),
          bakeRivulet(7, 96),
          bakeRivulet(5, 64),
          bakeRivulet(8, 110),
        ]
        : [
          bakeRivulet(5, 56),
          bakeRivulet(6, 88),
          bakeRivulet(8, 120),
          bakeRivulet(5, 72),
          bakeRivulet(7, 100),
          bakeRivulet(9, 140),
          bakeRivulet(6, 80),
        ])
      : [];
    const beadSprites = bakeBeadSprites();
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

    const pickBead = (scale) => {
      if (!beadSprites.length) return null;
      const px = 2.5 + scale * 5;
      let best = 0;
      let diff = Infinity;
      for (let i = 0; i < beadSprites.length; i += 1) {
        const d = Math.abs(beadSprites[i].width - px);
        if (d < diff) { diff = d; best = i; }
      }
      return beadSprites[best];
    };

    /** 参考片微珠 ~2px：scale 0.2–0.65 → 约 1.2–3.5 CSS px */
    const stampBead = (x, y, scale, alpha) => {
      const spr = pickBead(scale);
      if (!spr) return;
      const half = (0.42 + scale * 0.95) * (spr.width / 4);
      sctx.globalAlpha = alpha;
      sctx.drawImage(spr, x - half, y - half, half * 2, half * 2);
    };

    /**
     * 参考片 mid 带 ~650 圆珠/MP；用细亮点铺满，忌大软球叠雾。
     */
    const seedSpray = () => {
      clearSpray();
      if (noSpray || microN <= 0) {
        sprayDirty = false;
        return;
      }
      const area = clamp((w * h) / (1280 * 720), 0.65, 1.55);
      const dens = storm ? (lite ? 1.15 : 1.35) : 1.05;
      const n = Math.round(microN * dens * area);
      const onUi = ledges.length ? Math.round(n * (storm ? 0.52 : 0.45)) : 0;
      for (let i = 0; i < onUi; i += 1) {
        const p = pickInLedge(0.98);
        if (!p) break;
        stampBead(p.x, p.y, rand(0.22, 0.62), rand(0.28, 0.58));
      }
      for (let i = onUi; i < n; i += 1) {
        /* 下半屏更湿（参考 lower 带 bright% 更高） */
        const yBias = Math.pow(Math.random(), storm ? 0.55 : 0.62);
        stampBead(
          Math.random() * w,
          yBias * h,
          rand(0.18, 0.55),
          rand(0.14, storm ? 0.42 : 0.34),
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
      const preferUi = opts2.preferUi !== false && !fromTop && ledges.length && Math.random() < (storm ? 0.7 : 0.62);
      const ui = preferUi ? pickInLedge(0.85) : null;
      /* 参考片主珠偏小；多数粘附静止（帧间几乎不动） */
      const r = opts2.r ?? rand(storm ? 2.6 : 2.4, storm ? 7.2 : 6.2);
      const momentum = opts2.momentum ?? (
        storm
          ? (Math.random() < 0.16 ? rand(0.7, 1.9) : rand(0, 0.06))
          : (Math.random() < 0.18 ? rand(0.5, 1.5) : rand(0, 0.06))
      );
      drops.push({
        x: opts2.x ?? ui?.x ?? Math.random() * w,
        y: fromTop ? rand(-40, -8) : (opts2.y ?? ui?.y ?? Math.random() * h),
        r,
        momentum,
        vx: rand(storm ? -8 : -6, storm ? 8 : 6),
        a: rand(0.7, storm ? 0.98 : 0.92),
        spreadX: rand(0.03, storm ? 0.12 : 0.1),
        spreadY: rand(0.02, storm ? 0.12 : 0.08),
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
        vx: rand(-5, 5),
        vy: rand(0, 10),
        life: rand(4, 9),
        age: 0,
        a: rand(0.38, 0.68),
        scale: rand(0.65, 1.05),
        sprite: spr,
        stuck: Math.random() < 0.82,
      });
    };

    const spawnFlow = () => {
      if (!storm || !rivuletSprites.length) return;
      const spr = rivuletSprites[(Math.random() * rivuletSprites.length) | 0];
      const preferUi = ledges.length && Math.random() < 0.55;
      const ui = preferUi ? pickInLedge(0.45) : null;
      flows.push({
        x: ui?.x ?? rand(w * 0.04, w * 0.96),
        y: ui?.y ?? rand(-30, h * 0.3),
        vx: rand(-3, 3),
        vy: rand(28, lite ? 70 : 88),
        scale: rand(0.9, lite ? 1.2 : 1.35),
        a: rand(0.32, 0.62),
        life: rand(2.4, 5.2),
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
          for (let i = 0; i < 4; i += 1) spawnLens();
        }
        const flowN = lite ? 6 : 10;
        for (let i = 0; i < flowN; i += 1) spawnFlow();
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

      /* 持续补冷凝——小亮点，参考片几乎静态湿膜 */
      mistAcc += dt * aMul;
      const mistEvery = noSpray ? 999 : (storm ? (lite ? 0.05 : 0.032) : 0.09);
      while (!noSpray && mistAcc > mistEvery) {
        mistAcc -= mistEvery;
        const k = storm
          ? (lite ? (3 + ((Math.random() * 4) | 0)) : (5 + ((Math.random() * 7) | 0)))
          : (2 + ((Math.random() * 3) | 0));
        for (let i = 0; i < k; i += 1) {
          const ui = ledges.length && Math.random() < (storm ? 0.68 : 0.58) ? pickInLedge(0.95) : null;
          const x = ui?.x ?? Math.random() * w;
          const y = ui?.y ?? Math.pow(Math.random(), storm ? 0.5 : 0.6) * h;
          stampBead(
            x,
            y,
            rand(0.2, storm ? 0.58 : 0.5),
            rand(0.16, storm ? 0.45 : 0.34) * aMul,
          );
        }
        sctx.globalAlpha = 1;
      }

      mergeAcc += dt;
      if (mergeAcc > (storm ? 0.1 : 0.12)) {
        mergeAcc = 0;
        mergeDrops();
      }

      const topEvery = storm ? 0.09 : 0.32;
      topSpawnAcc += dt * aMul;
      while (topSpawnAcc > topEvery && drops.length < target + (storm ? 36 : 22)) {
        topSpawnAcc -= topEvery;
        if (Math.random() < (storm ? 0.72 : 0.42)) {
          spawnDrop({
            fromTop: true,
            momentum: rand(0.35, storm ? 1.8 : 0.9),
            r: rand(storm ? 3.2 : 2.4, storm ? 8.5 : 5.2),
          });
        }
      }

      if (storm && !lite) {
        lensAcc += dt * aMul;
        while (lensAcc > 0.4 && lenses.length < 12) {
          lensAcc -= 0.4;
          spawnLens();
        }
      }
      if (storm) {
        flowAcc += dt * aMul;
        const flowCap = lite ? 16 : 28;
        const flowEvery = lite ? 0.14 : 0.1;
        while (flowAcc > flowEvery && flows.length < flowCap) {
          flowAcc -= flowEvery;
          spawnFlow();
        }
      }

      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        const tension = storm ? 1.35 : 1.2;
        /* 参考片：多数粘附，偶发 kick */
        if (Math.random() < (d.r / (140 * tension)) * dt * (storm ? 0.55 : 0.4)) {
          d.momentum += rand(0.45, storm ? 1.7 : 1.35);
        }

        if (d.momentum > 0.08) {
          const step = d.momentum * (storm ? 48 : 42) * dt;
          d.y += step;
          d.x += d.vx * dt * 0.2 + Math.sin(d.y * 0.028 + d.r) * (storm ? 3.2 : 3.5) * dt;
          d.momentum *= Math.pow(storm ? 0.965 : 0.93, dt * 60);
          eraseSpray(d.x, d.y, d.r * 0.95, Math.min(storm ? 28 : 18, 6 + step * 2));
          d.lastSpawn += dt * 60;
          if (d.momentum > 0.35 && d.lastSpawn > (storm ? 12 : 16)) {
            d.lastSpawn = 0;
            d.r *= 0.992;
            stampBead(d.x + rand(-1.2, 1.2), d.y - d.r * rand(0.25, 0.9), rand(0.18, 0.4), 0.2 * aMul);
            sctx.globalAlpha = 1;
            d.sprite = pickSprite(sprites, d.r);
          }
        }

        d.spreadX *= Math.pow(0.45, dt * 60);
        d.spreadY *= Math.pow(0.72, dt * 60);

        if (d.y > h + 40 || d.x < -40 || d.x > w + 40 || d.r < 1.6) {
          drops.splice(i, 1);
          continue;
        }
      }

      while (drops.length < target) spawnDrop();
      if (drops.length > target + 20) drops.length = target + 16;

      /* 下半屏极淡湿膜（参考 lower 更湿），screen 不加灰罩 */
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const film = ctx.createLinearGradient(0, 0, 0, h);
      film.addColorStop(0, "rgba(200,225,245,0)");
      film.addColorStop(0.45, "rgba(210,230,250,0.015)");
      film.addColorStop(1, "rgba(230,242,255,0.07)");
      ctx.globalAlpha = aMul * (storm ? 0.85 : 0.65);
      ctx.fillStyle = film;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      /* 冷凝层 */
      if (!noSpray) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = aMul * (storm ? 0.82 : 0.7);
        ctx.drawImage(spray, 0, 0, w, h);
        ctx.restore();
      }

      /* 细长泪痕 */
      for (let i = flows.length - 1; i >= 0; i -= 1) {
        const f = flows[i];
        f.age += dt;
        const p = 1 - f.age / f.life;
        if (p <= 0 || f.y > h + 80) {
          flows.splice(i, 1);
          continue;
        }
        f.wobble += dt * 1.4;
        f.y += f.vy * dt;
        f.x += f.vx * dt + Math.sin(f.wobble) * 4 * dt;
        f.vy += 10 * dt;
        const spr = f.sprite;
        if (spr) {
          const dw = spr.width * f.scale;
          const dh = spr.height * f.scale;
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = f.a * aMul * clamp(p * 1.15, 0, 1);
          ctx.drawImage(spr, f.x - dw * 0.5, f.y, dw, dh);
          ctx.restore();
          eraseSpray(f.x, f.y + dh * 0.35, dw * 0.35, dh * 0.42);
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
          if (Math.random() < 0.22 * dt) {
            L.stuck = false;
            L.vy = rand(22, 58);
          }
        } else {
          L.y += L.vy * dt;
          L.x += L.vx * dt;
          L.vy += 18 * dt;
        }
        const spr = L.sprite;
        if (spr) {
          const dw = spr.width * 0.5 * L.scale;
          const dh = spr.height * 0.5 * L.scale;
          ctx.globalAlpha = L.a * aMul * clamp(p * 1.15, 0, 1);
          ctx.drawImage(spr, L.x - dw * 0.5, L.y - dh * 0.4, dw, dh);
          if (!L.stuck) eraseSpray(L.x, L.y, dw * 0.2, dh * 0.22);
        }
      }

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
        microN = noSpray ? 0 : Math.max(0, micro | 0);
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
