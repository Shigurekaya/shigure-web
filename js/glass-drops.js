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

  /** 主珠：仅亮边+高光，无暗芯/暗影（source-over 暗色在白底上会变墨点） */
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

    /* 极淡亮体——可被 screen 加亮，永不压黑 */
    const body = cx.createRadialGradient(ox, oy, rx * 0.05, ox, oy, rx);
    body.addColorStop(0, "rgba(255,255,255,0.14)");
    body.addColorStop(0.4, "rgba(230,245,255,0.1)");
    body.addColorStop(0.75, "rgba(200,230,255,0.18)");
    body.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = body;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();

    cx.strokeStyle = "rgba(255,255,255,0.85)";
    cx.lineWidth = Math.max(0.9, size * 0.04);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.9, ry * 0.9, 0, 0, Math.PI * 2);
    cx.stroke();

    const rim = cx.createLinearGradient(ox - rx, oy - ry, ox + rx, oy + ry);
    rim.addColorStop(0, "rgba(255,255,255,0)");
    rim.addColorStop(0.3, "rgba(255,255,255,0.65)");
    rim.addColorStop(0.55, "rgba(255,255,255,0)");
    rim.addColorStop(0.8, "rgba(230,245,255,0.35)");
    rim.addColorStop(1, "rgba(255,255,255,0)");
    cx.strokeStyle = rim;
    cx.lineWidth = Math.max(0.55, size * 0.025);
    cx.beginPath();
    cx.ellipse(ox, oy, rx * 0.76, ry * 0.76, 0, -0.9, 2.35);
    cx.stroke();

    const spec = cx.createRadialGradient(
      ox - rx * 0.32, oy - ry * 0.4, 0,
      ox - rx * 0.32, oy - ry * 0.4, rx * 0.34,
    );
    spec.addColorStop(0, "rgba(255,255,255,1)");
    spec.addColorStop(0.35, "rgba(245,250,255,0.8)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = spec;
    cx.beginPath();
    cx.ellipse(ox - rx * 0.32, oy - ry * 0.4, rx * 0.17, ry * 0.1, -0.55, 0, Math.PI * 2);
    cx.fill();

    cx.fillStyle = "rgba(255,255,255,0.5)";
    cx.beginPath();
    cx.ellipse(ox + rx * 0.24, oy + ry * 0.18, rx * 0.055, ry * 0.035, 0.45, 0, Math.PI * 2);
    cx.fill();
    return c;
  }

  /** 冷凝微珠：~2–4px 透亮高光点（参考片相对局部 +40 luma） */
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
    const g = cx.createRadialGradient(ox, oy, 0, ox, oy, rx);
    g.addColorStop(0, "rgba(255,255,255,0.12)");
    g.addColorStop(0.5, "rgba(220,240,255,0.14)");
    g.addColorStop(0.85, "rgba(200,230,255,0.22)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = g;
    cx.beginPath();
    cx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    cx.fill();
    cx.strokeStyle = "rgba(255, 255, 255, 0.7)";
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

  /** 泪痕：极细长亮纹（参考 tear_w≈1–3px） */
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
    const noSpray = !!opts.noSpray;
    const sprites = bakeSprites();
    const lensSprites = storm && !lite ? [36, 48, 64].map(bakeLensBlob) : [];
    const rivuletSprites = storm
      ? (lite
        ? [bakeRivulet(5, 48), bakeRivulet(6, 72), bakeRivulet(7, 96), bakeRivulet(5, 64), bakeRivulet(8, 110)]
        : [
          bakeRivulet(5, 56), bakeRivulet(6, 88), bakeRivulet(8, 120),
          bakeRivulet(5, 72), bakeRivulet(7, 100), bakeRivulet(9, 140), bakeRivulet(6, 80),
        ])
      : [];
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
      const px = 2.5 + scale * 5;
      let best = 0;
      let diff = Infinity;
      for (let i = 0; i < beadSprites.length; i += 1) {
        const d = Math.abs(beadSprites[i].width - px);
        if (d < diff) { diff = d; best = i; }
      }
      return beadSprites[best];
    };

    const beadHalf = (scale, sprW) => (0.42 + scale * 0.95) * (sprW / 4);

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

    /** 下滑时在 trail 上留极淡亮痕（随后被擦干净） */
    const stampWetMark = (x, y, scale, alpha) => {
      const spr = pickBead(scale);
      if (!spr) return;
      const half = beadHalf(scale * 0.7, spr.width);
      tctx.globalAlpha = alpha;
      tctx.drawImage(spr, x - half, y - half, half * 2, half * 2);
      tctx.globalAlpha = 1;
    };

    /**
     * 冷凝珠粒子：粘附 cling 秒后必释放下滑。
     * cling 错开 → 任一帧多数仍粘着（对齐参考片 median 静态珠），但最终都会流。
     */
    const spawnBead = (opts2 = {}) => {
      if (noSpray || microN <= 0) return;
      const preferUi = opts2.preferUi !== false && ledges.length && Math.random() < (storm ? 0.52 : 0.42);
      const ui = preferUi ? pickInLedge(0.95) : null;
      const scale = opts2.scale ?? rand(0.18, storm ? 0.55 : 0.48);
      const clingMax = storm ? (lite ? 3.8 : 5.2) : 6.5;
      const clingMin = storm ? 0.35 : 0.7;
      beads.push({
        x: opts2.x ?? ui?.x ?? Math.random() * w,
        y: opts2.y ?? ui?.y ?? Math.pow(Math.random(), storm ? 0.52 : 0.6) * h,
        scale,
        a: opts2.a ?? rand(0.26, storm ? 0.58 : 0.45),
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
      /* 参考 glass_cover≈1.4%、mid≈334/MP：细点密但不糊罩 */
      const dens = storm ? (lite ? 1.05 : 1.22) : 0.95;
      return Math.round(microN * dens * area);
    };

    const seedBeads = () => {
      beads.length = 0;
      clearTrail();
      const n = targetBeadN();
      const span = storm ? 5.2 : 6.8;
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
      const r = opts2.r ?? rand(storm ? 2.6 : 2.4, storm ? 7.2 : 6.2);
      const momentum = opts2.momentum ?? (
        storm
          ? (Math.random() < 0.14 ? rand(0.7, 1.9) : 0)
          : (Math.random() < 0.16 ? rand(0.5, 1.5) : 0)
      );
      drops.push({
        x: opts2.x ?? ui?.x ?? Math.random() * w,
        y: fromTop ? rand(-40, -8) : (opts2.y ?? ui?.y ?? Math.random() * h),
        r,
        momentum,
        /* 主珠也保证最终下滑：drip 倒计时 */
        drip: opts2.drip ?? (fromTop ? 0 : rand(storm ? 1.2 : 2.0, storm ? 7 : 10)),
        vx: rand(storm ? -8 : -6, storm ? 8 : 6),
        a: rand(0.72, storm ? 0.98 : 0.92),
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
        stuck: true,
        cling: rand(0.8, 4.5),
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
          d1.r = Math.min(storm ? 11 : 10, Math.sqrt((a1 + a2 * 0.82) / Math.PI));
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
      const TEAR = 1.28;
      const dw = d.r * 2 * (1 + d.spreadX);
      const dh = d.r * 2 * TEAR * (1 + d.spreadY) * (d.momentum > 0.2 ? 1.08 : 1);
      const spr = d.sprite;
      if (spr) {
        ctx.globalAlpha = d.a * aMul;
        ctx.drawImage(spr, d.x - dw * 0.5, d.y - dh * 0.42, dw, dh);
      }
    };

    const drawBead = (b, aMul) => {
      const spr = b.spr;
      if (!spr) return;
      const half = beadHalf(b.scale, spr.width);
      const dw = half * 2;
      const dh = half * 2 * b.stretch;
      ctx.globalAlpha = b.a * aMul * (b.flowing ? 0.92 : 1);
      ctx.drawImage(spr, b.x - dw * 0.5, b.y - dh * 0.45, dw, dh);
    };

    const updateBeads = (dt, aMul) => {
      const cap = targetBeadN();
      mistAcc += dt * aMul;
      const mistEvery = noSpray ? 999 : (storm ? (lite ? 0.055 : 0.036) : 0.1);
      while (!noSpray && mistAcc > mistEvery && beads.length < cap + 40) {
        mistAcc -= mistEvery;
        const k = storm
          ? (lite ? (2 + ((Math.random() * 3) | 0)) : (3 + ((Math.random() * 5) | 0)))
          : (1 + ((Math.random() * 3) | 0));
        for (let i = 0; i < k; i += 1) {
          spawnBead({
            y: Math.random() < 0.35 ? rand(-8, h * 0.15) : undefined,
            cling: rand(storm ? 0.5 : 1.0, storm ? 4.5 : 6),
          });
        }
      }

      for (let i = beads.length - 1; i >= 0; i -= 1) {
        const b = beads[i];
        if (!b.flowing) {
          b.cling -= dt;
          /* 尺寸越大越早滑；到期必释放 */
          if (b.cling <= 0 || Math.random() < b.scale * 0.08 * dt) {
            releaseBead(b);
          }
        }
        if (b.flowing) {
          b.vy += (storm ? 55 : 42) * dt;
          b.vy = Math.min(b.vy, storm ? 160 : 120);
          const step = b.vy * dt;
          b.y += step;
          b.x += b.vx * dt * 0.22 + Math.sin(b.y * 0.04 + b.scale * 8) * 2.8 * dt;
          b.stretch = Math.min(2.1, b.stretch + step * 0.012);
          b.scale *= Math.pow(0.998, dt * 60);
          eraseTrail(b.x, b.y, beadHalf(b.scale, 5) * 0.9, Math.min(18, 4 + step));
          /* 碰到大珠则被吸走 */
          for (let j = 0; j < drops.length; j += 1) {
            const d = drops[j];
            const dx = b.x - d.x;
            const dy = b.y - d.y;
            const lim = d.r + 3;
            if (dx * dx + dy * dy < lim * lim) {
              d.r = Math.min(storm ? 11 : 10, d.r + 0.04);
              d.momentum = Math.max(d.momentum, 0.15) + 0.08;
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
        spawnBead({ cling: rand(0.4, storm ? 4 : 5.5) });
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

      const topEvery = storm ? 0.09 : 0.32;
      topSpawnAcc += dt * aMul;
      while (topSpawnAcc > topEvery && drops.length < target + (storm ? 36 : 22)) {
        topSpawnAcc -= topEvery;
        if (Math.random() < (storm ? 0.72 : 0.42)) {
          spawnDrop({
            fromTop: true,
            momentum: rand(0.35, storm ? 1.8 : 0.9),
            r: rand(storm ? 3.2 : 2.4, storm ? 8.5 : 5.2),
            drip: 0,
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
        if (d.momentum <= 0.08) {
          d.drip -= dt;
          if (d.drip <= 0) {
            d.momentum = rand(0.55, storm ? 1.8 : 1.4);
          } else if (Math.random() < (d.r / 160) * dt * (storm ? 0.5 : 0.35)) {
            d.momentum += rand(0.4, storm ? 1.5 : 1.2);
          }
        }

        if (d.momentum > 0.08) {
          const step = d.momentum * (storm ? 48 : 42) * dt;
          d.y += step;
          d.x += d.vx * dt * 0.2 + Math.sin(d.y * 0.028 + d.r) * (storm ? 3.2 : 3.5) * dt;
          d.momentum *= Math.pow(storm ? 0.965 : 0.93, dt * 60);
          eraseTrail(d.x, d.y, d.r * 0.95, Math.min(storm ? 28 : 18, 6 + step * 2));
          d.lastSpawn += dt * 60;
          if (d.momentum > 0.35 && d.lastSpawn > (storm ? 12 : 16)) {
            d.lastSpawn = 0;
            d.r *= 0.992;
            spawnBead({
              x: d.x + rand(-1.2, 1.2),
              y: d.y - d.r * rand(0.3, 1.0),
              scale: rand(0.18, 0.4),
              a: 0.22 * aMul,
              cling: rand(0.3, 2.2),
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
       * 透明底 + 仅亮色精灵 + source-over。
       * （黑底+CSS screen 在手机上常失效 → 整页黑布；已弃用）
       */
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      /* 冷凝：lighter 只加亮 */
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < beads.length; i += 1) drawBead(beads[i], aMul * 0.85);

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
        f.vy += 10 * dt;
        const spr = f.sprite;
        if (spr) {
          const dw = spr.width * f.scale;
          const dh = spr.height * f.scale;
          ctx.globalAlpha = f.a * aMul * clamp(p * 1.15, 0, 1) * 0.85;
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
          ctx.globalAlpha = L.a * aMul * clamp(p * 1.15, 0, 1) * 0.9;
          ctx.drawImage(spr, L.x - dw * 0.5, L.y - dh * 0.4, dw, dh);
        }
      }

      ctx.globalAlpha = 1;
      for (let i = 0; i < drops.length; i += 1) drawDrop(drops[i], aMul * (storm ? 0.95 : 0.88));
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
