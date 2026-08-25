/**
 * 玻璃水珠（Canvas 2D）——对齐小米天气「雨水打在玻璃屏上」
 *
 * 深度分析参考片结论（见 .cursor/rules/rain-realism.mdc）：
 * - 背景：短密近竖直雨丝（由 GPU 雨丝负责）
 * - 贴屏玻璃：透亮透镜珠 + 细亮冷凝点 + 泪痕，盖在 UI 上
 * - 冷凝珠先粘附，cling 后必然下滑（无一永久钉死）
 * - 高光偏白（相对局部 +40 luma），忌墨点/灰雾罩
 * - 真折射（Radiant/raindrop-fx）需背景纹理；活 UI 截图手机已发黑，故用 2D 透镜模拟
 *
 * 借鉴：Codrops RainEffect / Radiant / raindrop-fx / atmos-fx 物理与观感，不抢 WebGL。
 */
(() => {
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /**
   * 主珠：对齐小米天气贴屏珠——中心近透明、Fresnel 亮边、顶左高光。
   * 忌大片白雾填色（会像糊团而不是水）。
   */
  function bakeDropBitmap(size) {
    const pad = Math.ceil(size * 0.32);
    const w = size + pad * 2;
    const h = Math.ceil(size * 1.55) + pad * 2;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = w * 0.5;
    const oy = h * 0.4;
    const rx = size * 0.36;
    const ry = size * 0.44;

    /* 极淡接触阴影（透明水，忌深蓝灰体积 → 泥水） */
    const shade = cx.createRadialGradient(ox + rx * 0.08, oy + ry * 0.35, rx * 0.15, ox, oy + ry * 0.1, rx * 1.15);
    shade.addColorStop(0, "rgba(180,210,235,0.06)");
    shade.addColorStop(0.55, "rgba(200,225,245,0.02)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = shade;
    cx.beginPath();
    cx.ellipse(ox + rx * 0.06, oy + ry * 0.12, rx * 1.02, ry * 1.05, 0, 0, Math.PI * 2);
    cx.fill();

    /* 透镜体：中心几乎透明，仅边缘 Fresnel */
    const body = cx.createRadialGradient(ox - rx * 0.1, oy - ry * 0.22, 0, ox, oy, rx);
    body.addColorStop(0, "rgba(255,255,255,0.02)");
    body.addColorStop(0.45, "rgba(235,248,255,0.06)");
    body.addColorStop(0.78, "rgba(220,240,255,0.18)");
    body.addColorStop(0.92, "rgba(245,252,255,0.42)");
    body.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = body;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();

    /* Fresnel 亮环 */
    cx.strokeStyle = "rgba(255,255,255,0.92)";
    cx.lineWidth = Math.max(1.1, size * 0.048);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.94, ry * 0.94, 0, 0, Math.PI * 2);
    cx.stroke();

    const rim = cx.createLinearGradient(ox - rx, oy - ry, ox + rx * 0.6, oy + ry);
    rim.addColorStop(0, "rgba(255,255,255,0)");
    rim.addColorStop(0.22, "rgba(255,255,255,0.95)");
    rim.addColorStop(0.48, "rgba(255,255,255,0.12)");
    rim.addColorStop(0.78, "rgba(210,236,255,0.5)");
    rim.addColorStop(1, "rgba(255,255,255,0)");
    cx.strokeStyle = rim;
    cx.lineWidth = Math.max(0.75, size * 0.032);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.78, ry * 0.78, 0, -1.05, 2.35);
    cx.stroke();

    /* 主高光（顶左） */
    const spec = cx.createRadialGradient(
      ox - rx * 0.34, oy - ry * 0.46, 0,
      ox - rx * 0.34, oy - ry * 0.46, rx * 0.4,
    );
    spec.addColorStop(0, "rgba(255,255,255,1)");
    spec.addColorStop(0.28, "rgba(245,250,255,0.85)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.ellipse(ox - rx * 0.34, oy - ry * 0.44, rx * 0.2, ry * 0.11, -0.55, 0, Math.PI * 2);
    cx.fill();

    /* 次高光 */
    cx.fillStyle = "rgba(255,255,255,0.55)";
    cx.beginPath();
    cx.ellipse(ox + rx * 0.28, oy + ry * 0.18, rx * 0.05, ry * 0.035, 0.5, 0, Math.PI * 2);
    cx.fill();

    /* 底缘折射亮带（泪珠下端） */
    const tip = cx.createRadialGradient(ox, oy + ry * 0.78, 0, ox, oy + ry * 0.95, rx * 0.4);
    tip.addColorStop(0, "rgba(230,245,255,0.32)");
    tip.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = tip;
    cx.beginPath();
    cx.ellipse(ox, oy + ry * 0.68, rx * 0.28, ry * 0.22, 0, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  /** 冷凝微珠：主珠缩小版 — 中心透、Fresnel 边（对齐 bakeDropBitmap / raindrop-fx） */
  function bakeBeadSprite(size = 4) {
    const dim = Math.max(6, size | 0);
    const c = document.createElement("canvas");
    c.width = dim;
    c.height = dim;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const o = dim * 0.5;
    const r = dim * 0.38;
    const shade = cx.createRadialGradient(o + r * 0.06, o + r * 0.2, 0, o, o, r * 1.1);
    shade.addColorStop(0, "rgba(200,225,245,0.05)");
    shade.addColorStop(0.6, "rgba(220,238,255,0.02)");
    shade.addColorStop(1, "rgba(0,0,0,0)");
    cx.fillStyle = shade;
    cx.beginPath();
    cx.arc(o, o, r * 1.02, 0, Math.PI * 2);
    cx.fill();
    const body = cx.createRadialGradient(o - r * 0.12, o - r * 0.18, 0, o, o, r);
    body.addColorStop(0, "rgba(255,255,255,0.02)");
    body.addColorStop(0.5, "rgba(235,248,255,0.06)");
    body.addColorStop(0.8, "rgba(225,242,255,0.16)");
    body.addColorStop(0.92, "rgba(245,252,255,0.38)");
    body.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = body;
    cx.beginPath();
    cx.arc(o, o, r, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "rgba(255,255,255,0.88)";
    cx.lineWidth = Math.max(0.4, dim * 0.06);
    cx.beginPath();
    cx.arc(o, o, r * 0.9, 0, Math.PI * 2);
    cx.stroke();
    const spec = cx.createRadialGradient(o - r * 0.28, o - r * 0.3, 0, o - r * 0.28, o - r * 0.3, r * 0.32);
    spec.addColorStop(0, "rgba(255,255,255,0.82)");
    spec.addColorStop(0.35, "rgba(240,248,255,0.28)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.arc(o - r * 0.22, o - r * 0.24, r * 0.14, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  function bakeBeadSprites() {
    /* 大雨对齐参考片：中等冷凝珠（略大于原微点） */
    return [4, 6, 8, 11, 14, 18].map(bakeBeadSprite);
  }

  function bakeSprites() {
    return [20, 28, 38, 50, 68, 90, 118, 150].map(bakeDropBitmap);
  }

  function bakeLensBlob(size) {
    const pad = Math.ceil(size * 0.3);
    const w = size + pad * 2;
    const h = Math.ceil(size * 1.45) + pad * 2;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = w * 0.5;
    const oy = h * 0.42;
    const rx = size * 0.37;
    const ry = size * 0.42;
    const g = cx.createRadialGradient(ox - rx * 0.12, oy - ry * 0.2, 0, ox, oy, rx);
    g.addColorStop(0, "rgba(255,255,255,0.05)");
    g.addColorStop(0.5, "rgba(220,240,255,0.12)");
    g.addColorStop(0.82, "rgba(210,236,255,0.42)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "rgba(255,255,255,0.88)";
    cx.lineWidth = Math.max(1, size * 0.03);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
    cx.stroke();
    const spec = cx.createRadialGradient(
      ox - rx * 0.32, oy - ry * 0.38, 0,
      ox - rx * 0.32, oy - ry * 0.38, rx * 0.3,
    );
    spec.addColorStop(0, "rgba(255,255,255,1)");
    spec.addColorStop(0.35, "rgba(235,248,255,0.65)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.ellipse(ox - rx * 0.32, oy - ry * 0.38, rx * 0.15, ry * 0.09, -0.45, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  /** 泪痕：细长透亮水道 + 亮边（参考片下滑珠） */
  function bakeRivulet(w0, h0) {
    const c = document.createElement("canvas");
    c.width = Math.max(7, Math.ceil(w0));
    c.height = Math.ceil(h0);
    const cx = c.getContext("2d");
    if (!cx) return c;
    const ox = c.width * 0.5;
    const top = 1;
    const bot = c.height - 1;
    const half = Math.max(1.2, c.width * 0.26);
    const g = cx.createLinearGradient(ox, top, ox, bot);
    g.addColorStop(0, "rgba(255,255,255,0.04)");
    g.addColorStop(0.05, "rgba(245,250,255,0.55)");
    g.addColorStop(0.3, "rgba(210,238,255,0.28)");
    g.addColorStop(0.7, "rgba(190,228,255,0.14)");
    g.addColorStop(1, "rgba(160,200,235,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.moveTo(ox, top);
    cx.bezierCurveTo(ox + half * 0.5, top + 6, ox + half * 0.75, bot * 0.4, ox + half * 0.2, bot);
    cx.quadraticCurveTo(ox, bot + 0.5, ox - half * 0.2, bot);
    cx.bezierCurveTo(ox - half * 0.75, bot * 0.4, ox - half * 0.5, top + 6, ox, top);
    cx.closePath();
    cx.fill();
    cx.strokeStyle = "rgba(255,255,255,0.7)";
    cx.lineWidth = 0.8;
    cx.beginPath();
    cx.moveTo(ox - half * 0.1, top + 3);
    cx.quadraticCurveTo(ox - half * 0.3, bot * 0.42, ox - half * 0.05, bot - 3);
    cx.stroke();
    /* 头珠高光 */
    const head = cx.createRadialGradient(ox, top + half * 1.2, 0, ox, top + half * 1.2, half * 1.4);
    head.addColorStop(0, "rgba(255,255,255,0.85)");
    head.addColorStop(0.4, "rgba(235,248,255,0.35)");
    head.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = head;
    cx.beginPath();
    cx.ellipse(ox, top + half * 1.1, half * 0.85, half * 1.05, 0, 0, Math.PI * 2);
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
   * @param {{ main?: number, micro?: number, dprCap?: number, storm?: boolean, slideRatio?: number, lite?: boolean, noSpray?: boolean }} [opts]
   */
  function attach(canvas, opts = {}) {
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return null;

    const storm = !!opts.storm;
    const lite = !!opts.lite;
    const noSpray = !!opts.noSpray;
    const sprites = bakeSprites();
    /* 大雨也要泪痕/大透镜（对齐参考片下滑珠），不再仅限 storm */
    const lensSprites = !lite ? [32, 44, 58, 76].map(bakeLensBlob) : [];
    const rivuletSprites = lite
      ? [bakeRivulet(5, 48), bakeRivulet(6, 72), bakeRivulet(7, 96), bakeRivulet(5, 64)]
      : [
        bakeRivulet(5, 56), bakeRivulet(6, 88), bakeRivulet(8, 120),
        bakeRivulet(5, 72), bakeRivulet(7, 100), bakeRivulet(9, 140), bakeRivulet(6, 80),
      ];
    const beadSprites = bakeBeadSprites();

    /* 湿痕层：大珠/泪痕擦出干净轨迹；冷凝本身是活粒子 */
    const trail = document.createElement("canvas");
    const tctx = trail.getContext("2d", { alpha: true });
    if (!tctx) return null;

    let mainN = opts.main ?? 40;
    let microN = noSpray ? 0 : (opts.micro ?? 280);
    let dprCap = opts.dprCap ?? 1.35;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let intensity = 0;
    let enabled = true;
    let beadsDirty = true;
    let mergeAcc = 0;
    let topSpawnAcc = 0;
    let lensAcc = 0;
    let flowAcc = 0;
    let mistAcc = 0;
    /** @type {Array<any>} */
    let ledges = [];
    /** @type {Array<any>} */
    const drops = [];
    /** @type {Array<any>} */
    const lenses = [];
    /** @type {Array<any>} */
    const flows = [];
    /** @type {Array<any>} */
    const beads = [];
    /** @type {Array<any>} */
    const hits = [];

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

    const clearTrail = () => {
      if (!trail.width) return;
      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, trail.width, trail.height);
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const pickBead = (scale) => {
      if (!beadSprites.length) return null;
      const px = 4 + scale * 8;
      let best = 0;
      let diff = Infinity;
      for (let i = 0; i < beadSprites.length; i += 1) {
        const d = Math.abs(beadSprites[i].width - px);
        if (d < diff) { diff = d; best = i; }
      }
      return beadSprites[best];
    };

    /* 大雨略放大绘制半径，暴雨沿用原尺度 */
    const beadHalf = (scale, sprW) => {
      const mul = storm ? 0.95 : 1.22;
      return (0.42 + scale * 0.95) * (sprW / 4) * mul;
    };

    const eraseTrail = (x, y, rad, trailLen) => {
      tctx.save();
      tctx.globalCompositeOperation = "destination-out";
      tctx.fillStyle = "#000";
      tctx.beginPath();
      tctx.arc(x, y, rad, 0, Math.PI * 2);
      tctx.fill();
      if (trailLen > 0) {
        tctx.beginPath();
        tctx.ellipse(x, y - trailLen * 0.5, rad * 0.28, trailLen * 0.55, 0, 0, Math.PI * 2);
        tctx.fill();
      }
      tctx.restore();
    };

    /** 下滑时在 trail 上留亮湿痕 */
    const stampWetMark = (x, y, scale, alpha) => {
      const spr = pickBead(scale);
      if (!spr) return;
      const half = beadHalf(scale * 0.85, spr.width);
      tctx.globalCompositeOperation = "source-over";
      tctx.globalAlpha = alpha * 0.55;
      tctx.drawImage(spr, x - half, y - half, half * 2, half * 2);
      tctx.globalAlpha = 1;
    };

    /** 撞击瞬间：短命亮环 */
    const spawnHit = (x, y, r) => {
      hits.push({
        x, y,
        r: r * rand(1.1, 1.6),
        age: 0,
        life: rand(0.18, 0.38),
        a: rand(0.55, 0.9),
      });
    };

    /**
     * 冷凝珠粒子：粘附 cling 秒后必释放下滑。
     * cling 错开 → 任一帧多数仍粘着（对齐参考片 median 静态珠），但最终都会流。
     */
    const spawnBead = (opts2 = {}) => {
      if (noSpray || microN <= 0) return;
      const preferUi = opts2.preferUi !== false && ledges.length && Math.random() < (storm ? 0.52 : 0.42);
      const ui = preferUi ? pickInLedge(0.95) : null;
      const scale = opts2.scale ?? rand(storm ? 0.1 : 0.32, storm ? 0.34 : 0.78);
      const clingMax = storm ? (lite ? 1.8 : 2.6) : 0.08;
      const clingMin = storm ? 0.15 : 0;
      beads.push({
        x: opts2.x ?? ui?.x ?? Math.random() * w,
        y: opts2.y ?? ui?.y ?? Math.pow(Math.random(), storm ? 0.62 : 0.6) * h,
        scale,
        a: opts2.a ?? rand(0.28, storm ? 0.62 : 0.56),
        cling: opts2.cling ?? rand(clingMin, clingMax),
        flowing: false,
        vy: 0,
        vx: rand(-5, 5),
        stretch: 1,
        spr: pickBead(scale),
      });
    };

    const targetBeadN = () => {
      if (noSpray || microN <= 0) return 0;
      const area = clamp((w * h) / (1280 * 720), 0.65, 1.5);
      /* 冷凝微珠：稀疏透亮，勿糊成满屏大光斑 */
      const dens = storm ? (lite ? 0.28 : 0.34) : 0.34;
      return Math.round(microN * dens * area);
    };

    const seedBeads = () => {
      beads.length = 0;
      clearTrail();
      const n = targetBeadN();
      const span = storm ? 5.2 : 0.35;
      for (let i = 0; i < n; i += 1) {
        spawnBead({
          preferUi: Math.random() < 0.48,
          cling: (i / Math.max(1, n)) * span + rand(0.15, 1.1),
        });
      }
      beadsDirty = false;
    };

    const releaseBead = (b) => {
      if (b.flowing) return;
      b.flowing = true;
      b.vy = rand(storm ? 22 : 14, storm ? 48 : 36);
      b.vx += rand(-10, 10);
      b.stretch = rand(1.2, 1.7);
    };

    const spawnDrop = (opts2 = {}) => {
      const fromTop = !!opts2.fromTop;
      const preferUi = opts2.preferUi !== false && !fromTop && ledges.length && Math.random() < (storm ? 0.7 : 0.62);
      const ui = preferUi ? pickInLedge(0.85) : null;
      /* 参考片：粘附时偏圆；尺寸跨度更大 */
      const r = opts2.r ?? rand(storm ? 6 : 5.5, storm ? 16 : 14);
      const momentum = opts2.momentum ?? (
        fromTop
          ? rand(0.9, storm ? 2.4 : 1.6)
          : (Math.random() < (storm ? 0.48 : 0.32)
            ? rand(0.45, storm ? 1.8 : 1.15)
            : 0)
      );
      const x = opts2.x ?? ui?.x ?? Math.random() * w;
      const y = fromTop ? rand(-40, -8) : (opts2.y ?? ui?.y ?? Math.random() * h);
      drops.push({
        x,
        y,
        r,
        momentum,
        drip: opts2.drip ?? (fromTop || momentum > 0.08 ? 0 : rand(storm ? 0.8 : 0.35, storm ? 4.2 : 1.8)),
        vx: rand(storm ? -10 : -7, storm ? 10 : 7),
        a: rand(0.78, 1),
        spreadX: rand(0.02, storm ? 0.12 : 0.08),
        spreadY: rand(0.02, storm ? 0.12 : 0.08),
        lastSpawn: 40,
        sprite: pickSprite(sprites, r),
        killed: false,
        hitDone: !!opts2.hitDone,
      });
      if (fromTop && !opts2.hitDone) {
        drops[drops.length - 1].pendingHit = true;
      }
    };

    const spawnLens = () => {
      if (!lensSprites.length) return;
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
        a: rand(0.55, 0.9),
        scale: rand(0.75, 1.15),
        sprite: spr,
        stuck: true,
        cling: rand(0.35, 2.2),
      });
    };

    const spawnFlow = () => {
      if (!rivuletSprites.length) return;
      const spr = rivuletSprites[(Math.random() * rivuletSprites.length) | 0];
      const preferUi = ledges.length && Math.random() < 0.55;
      const ui = preferUi ? pickInLedge(0.45) : null;
      flows.push({
        x: ui?.x ?? rand(w * 0.04, w * 0.96),
        y: ui?.y ?? rand(-30, h * 0.3),
        vx: rand(-4, 4),
        vy: rand(storm ? 36 : 28, lite ? 95 : (storm ? 120 : 88)),
        scale: rand(1.0, lite ? 1.35 : 1.45),
        a: rand(0.45, 0.82),
        life: rand(2.8, 6.2),
        age: 0,
        wobble: rand(0, Math.PI * 2),
        sprite: spr,
      });
    };

    const rebuild = () => {
      drops.length = 0;
      lenses.length = 0;
      flows.length = 0;
      hits.length = 0;
      const area = clamp((w * h) / (1280 * 720), 0.65, 1.35);
      const n = Math.round(mainN * area);
      for (let i = 0; i < n; i += 1) spawnDrop();
      if (!lite) {
        const lensN = storm ? 6 : 4;
        for (let i = 0; i < lensN; i += 1) spawnLens();
      }
      const flowN = lite ? (storm ? 10 : 6) : (storm ? 16 : 10);
      for (let i = 0; i < flowN; i += 1) spawnFlow();
      beadsDirty = true;
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
      if (trail.width !== bw || trail.height !== bh) {
        trail.width = bw;
        trail.height = bh;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
          d1.r = Math.min(storm ? 14 : 12, Math.sqrt((a1 + a2 * 0.82) / Math.PI));
          d1.momentum = Math.max(d1.momentum, 0.2) + 1.05;
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
      /* 粘附近圆；下滑才拉长成泪珠（对齐参考片） */
      const sliding = d.momentum > 0.25;
      const TEAR = sliding ? 1.55 : 1.08;
      const dw = d.r * 2.05 * (1 + d.spreadX);
      const dh = d.r * 2.05 * TEAR * (1 + d.spreadY) * (sliding ? 1.1 : 1);
      const spr = d.sprite;
      if (spr) {
        ctx.globalAlpha = d.a * aMul;
        ctx.drawImage(spr, d.x - dw * 0.5, d.y - dh * (sliding ? 0.38 : 0.5), dw, dh);
      }
    };

    const drawBead = (b, aMul) => {
      const spr = b.spr;
      if (!spr) return;
      const half = beadHalf(b.scale, spr.width);
      const dw = half * 2;
      const dh = half * 2 * b.stretch;
      ctx.globalAlpha = b.a * aMul * (storm ? (b.flowing ? 0.92 : 1) : (b.flowing ? 0.82 : 0.78));
      ctx.drawImage(spr, b.x - dw * 0.5, b.y - dh * 0.45, dw, dh);
    };

    const updateBeads = (dt, aMul) => {
      const cap = targetBeadN();
      mistAcc += dt * aMul;
      const mistEvery = noSpray ? 999 : (storm ? (lite ? 0.028 : 0.018) : 0.1);
      while (!noSpray && mistAcc > mistEvery && beads.length < cap + 40) {
        mistAcc -= mistEvery;
        const k = storm
          ? (lite ? (2 + ((Math.random() * 3) | 0)) : (3 + ((Math.random() * 5) | 0)))
          : (1 + ((Math.random() * 3) | 0));
        for (let i = 0; i < k; i += 1) {
          spawnBead({
            y: Math.random() < 0.35 ? rand(-8, h * 0.15) : undefined,
            cling: rand(storm ? 0.5 : 0.28, storm ? 4.5 : 1.2),
          });
        }
      }

      for (let i = beads.length - 1; i >= 0; i -= 1) {
        const b = beads[i];
        if (!b.flowing) {
          b.cling -= dt;
          /* 尺寸越大越早滑；到期必释放 */
          if (b.cling <= 0 || Math.random() < b.scale * (storm ? 0.08 : 0.22) * dt) {
            releaseBead(b);
          }
        }
        if (b.flowing) {
          b.vy += (storm ? 70 : 52) * dt;
          b.vy = Math.min(b.vy, storm ? 200 : 150);
          const step = b.vy * dt;
          b.y += step;
          b.x += b.vx * dt * 0.22 + Math.sin(b.y * 0.04 + b.scale * 8) * 2.8 * dt;
          b.stretch = Math.min(2.4, b.stretch + step * 0.014);
          b.scale *= Math.pow(0.998, dt * 60);
          stampWetMark(b.x, b.y, b.scale * 0.9, 0.22 * aMul);
          eraseTrail(b.x, b.y, beadHalf(b.scale, 5) * 0.55, Math.min(14, 3 + step));
          /* 碰到大珠则被吸走 */
          for (let j = 0; j < drops.length; j += 1) {
            const d = drops[j];
            const dx = b.x - d.x;
            const dy = b.y - d.y;
            const lim = d.r + 3;
            if (dx * dx + dy * dy < lim * lim) {
              d.r = Math.min(storm ? 14 : 12, d.r + 0.05);
              d.momentum = Math.max(d.momentum, 0.2) + 0.12;
              d.sprite = pickSprite(sprites, d.r);
              beads.splice(i, 1);
              b._gone = true;
              break;
            }
          }
          if (b._gone) continue;
        }
        if (b.y > h + 20 || b.x < -20 || b.x > w + 20 || b.scale < 0.08) {
          beads.splice(i, 1);
        }
      }

      while (beads.length < cap) {
        spawnBead({ cling: rand(0.12, storm ? 4 : 1.0) });
      }
      if (beads.length > cap + 60) beads.length = cap + 40;
    };

    const draw = (dt, aMul) => {
      if (!enabled || !ctx) return;
      ctx.clearRect(0, 0, w, h);
      if (aMul < 0.02 || w < 2) return;

      if (beadsDirty) seedBeads();

      const area = clamp((w * h) / (1280 * 720), 0.65, 1.35);
      const target = Math.round(mainN * area * Math.max(0.55, aMul));

      updateBeads(dt, aMul);

      mergeAcc += dt;
      if (mergeAcc > (storm ? 0.1 : 0.12)) {
        mergeAcc = 0;
        mergeDrops();
      }

      const topEvery = storm ? 0.028 : 0.2;
      topSpawnAcc += dt * aMul;
      while (topSpawnAcc > topEvery && drops.length < target + (storm ? 96 : 28)) {
        topSpawnAcc -= topEvery;
        if (Math.random() < (storm ? 0.95 : 0.55)) {
          spawnDrop({
            fromTop: true,
            momentum: rand(1.0, storm ? 2.6 : 1.5),
            r: rand(storm ? 6 : 6.5, storm ? 15 : 14),
            drip: 0,
          });
        }
      }

      if (!lite) {
        lensAcc += dt * aMul;
        const lensEvery = storm ? 0.16 : 0.42;
        const lensCap = storm ? 28 : 10;
        while (lensAcc > lensEvery && lenses.length < lensCap) {
          lensAcc -= lensEvery;
          spawnLens();
        }
      }
      {
        flowAcc += dt * aMul;
        const flowCap = lite ? (storm ? 36 : 12) : (storm ? 64 : 22);
        const flowEvery = lite ? 0.08 : (storm ? 0.04 : 0.11);
        while (flowAcc > flowEvery && flows.length < flowCap) {
          flowAcc -= flowEvery;
          spawnFlow();
        }
      }

      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        if (d.pendingHit && d.y >= d.r * 0.6) {
          d.pendingHit = false;
          spawnHit(d.x, d.y, d.r);
          d.spreadX = Math.max(d.spreadX, 0.28);
          d.spreadY = Math.max(d.spreadY, 0.18);
        }

        if (d.momentum <= 0.08) {
          d.drip -= dt;
          if (d.drip <= 0) {
            d.momentum = rand(0.7, storm ? 2.2 : 1.6);
          } else if (Math.random() < (d.r / 90) * dt * (storm ? 0.9 : 0.55)) {
            d.momentum += rand(0.55, storm ? 1.8 : 1.3);
          }
        }

        if (d.momentum > 0.08) {
          const step = d.momentum * (storm ? 62 : 50) * dt;
          d.y += step;
          d.x += d.vx * dt * 0.22 + Math.sin(d.y * 0.028 + d.r) * (storm ? 3.6 : 3.2) * dt;
          d.momentum *= Math.pow(storm ? 0.972 : 0.945, dt * 60);
          stampWetMark(d.x, d.y, clamp(d.r / 10, 0.35, 1.1), 0.28 * aMul);
          eraseTrail(d.x, d.y, d.r * 0.55, Math.min(storm ? 22 : 14, 4 + step * 1.5));
          d.lastSpawn += dt * 60;
          if (d.momentum > 0.35 && d.lastSpawn > (storm ? 10 : 14)) {
            d.lastSpawn = 0;
            d.r *= 0.992;
            spawnBead({
              x: d.x + rand(-1.2, 1.2),
              y: d.y - d.r * rand(0.3, 1.0),
              scale: rand(storm ? 0.22 : 0.36, storm ? 0.48 : 0.72),
              a: 0.4 * aMul,
              cling: rand(0.2, 1.6),
              preferUi: false,
            });
            d.sprite = pickSprite(sprites, d.r);
          }
        }

        d.spreadX *= Math.pow(0.45, dt * 60);
        d.spreadY *= Math.pow(0.72, dt * 60);

        if (d.y > h + 40 || d.x < -40 || d.x > w + 40 || d.r < 1.6) {
          drops.splice(i, 1);
        }
      }

      while (drops.length < target) spawnDrop();
      if (drops.length > target + 20) drops.length = target + 16;

      /*
       * 透明底 + 仅亮色精灵。
       * 湿痕层 fade + 撞击环 → 可读的「打屏再流下」
       */
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      /* 湿痕缓慢淡出 */
      tctx.globalCompositeOperation = "destination-out";
      tctx.fillStyle = "rgba(0,0,0,0.045)";
      tctx.fillRect(0, 0, w, h);
      tctx.globalCompositeOperation = "source-over";

      ctx.globalAlpha = 0.55 * aMul;
      ctx.drawImage(trail, 0, 0, w, h);
      ctx.globalAlpha = 1;

      /* 冷凝：source-over 保持透亮边，勿 lighter 糊成白霜 */
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < beads.length; i += 1) drawBead(beads[i], aMul * 0.92);

      ctx.globalCompositeOperation = "source-over";
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
        f.vy += 14 * dt;
        stampWetMark(f.x, f.y + 8, 0.55, 0.18 * aMul * p);
        const spr = f.sprite;
        if (spr) {
          const dw = spr.width * f.scale;
          const dh = spr.height * f.scale;
          ctx.globalAlpha = f.a * aMul * clamp(p * 1.2, 0, 1);
          ctx.drawImage(spr, f.x - dw * 0.5, f.y, dw, dh);
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
          L.cling -= dt;
          if (L.cling <= 0) {
            L.stuck = false;
            L.vy = rand(28, 72);
          }
        } else {
          L.y += L.vy * dt;
          L.x += L.vx * dt;
          L.vy += 22 * dt;
          stampWetMark(L.x, L.y, L.scale * 0.7, 0.2 * aMul * p);
        }
        const spr = L.sprite;
        if (spr) {
          const dw = spr.width * 0.5 * L.scale;
          const dh = spr.height * 0.5 * L.scale;
          ctx.globalAlpha = L.a * aMul * clamp(p * 1.2, 0, 1);
          ctx.drawImage(spr, L.x - dw * 0.5, L.y - dh * 0.4, dw, dh);
        }
      }

      /* 撞击亮环 */
      for (let i = hits.length - 1; i >= 0; i -= 1) {
        const ht = hits[i];
        ht.age += dt;
        const p = 1 - ht.age / ht.life;
        if (p <= 0) {
          hits.splice(i, 1);
          continue;
        }
        const rr = ht.r * (1 + (1 - p) * 1.8);
        ctx.globalAlpha = ht.a * aMul * p;
        ctx.strokeStyle = "rgba(245,250,255,0.95)";
        ctx.lineWidth = Math.max(1.2, ht.r * 0.12 * p);
        ctx.beginPath();
        ctx.ellipse(ht.x, ht.y, rr, rr * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = ht.a * aMul * p * 0.45;
        ctx.beginPath();
        ctx.ellipse(ht.x, ht.y, rr * 0.55, rr * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      for (let i = 0; i < drops.length; i += 1) drawDrop(drops[i], aMul);
      ctx.globalAlpha = 1;
    };

    return {
      resize,
      setIntensity(v) {
        const next = clamp(v, 0, 1);
        if ((intensity < 0.08 && next >= 0.08) || Math.abs(next - intensity) > 0.25) {
          beadsDirty = true;
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
        if (wasEmpty && arr.length) beadsDirty = true;
      },
      setEnabled(on) { enabled = !!on; },
      draw(dt) { draw(dt, intensity); },
      clear() {
        drops.length = 0;
        lenses.length = 0;
        flows.length = 0;
        beads.length = 0;
        hits.length = 0;
        clearTrail();
        ctx.clearRect(0, 0, w, h);
      },
      destroy() {
        this.clear();
      },
    };
  }

  window.KayaGlassDrops = { attach };
})();
