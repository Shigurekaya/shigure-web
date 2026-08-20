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
   * @param {{ main?: number, micro?: number, dprCap?: number }} [opts]
   */
  function attach(canvas, opts = {}) {
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return null;

    const sprites = bakeSprites();
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
    /** @type {Array<{x:number,y:number,w:number,h?:number,radius?:number}>} */
    let ledges = [];

    /** @type {Array<any>} */
    const drops = [];

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
      const s = 2.4 * scale;
      sctx.globalAlpha = alpha;
      sctx.drawImage(beadSpr, x - s, y - s, s * 2, s * 2);
    };

    /**
     * 参考片：卡片表面水珠密度明显高于天空。
     * ~55% 微珠落在 UI 卡片矩形内，其余全屏偏中下。
     */
    const seedSpray = () => {
      clearSpray();
      const n = Math.round(microN * clamp((w * h) / (1280 * 720), 0.65, 1.35));
      const onUi = ledges.length ? Math.round(n * 0.55) : 0;
      for (let i = 0; i < onUi; i += 1) {
        const p = pickInLedge(0.92);
        if (!p) break;
        stampBead(p.x, p.y, rand(0.28, 0.9), rand(0.2, 0.48));
      }
      for (let i = onUi; i < n; i += 1) {
        const yBias = Math.pow(Math.random(), 0.72);
        stampBead(
          Math.random() * w,
          yBias * h,
          rand(0.28, 0.85),
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
      const preferUi = opts2.preferUi !== false && !fromTop && ledges.length && Math.random() < 0.62;
      const ui = preferUi ? pickInLedge(0.85) : null;
      const r = opts2.r ?? rand(2.8, 7.2);
      const momentum = opts2.momentum ?? (Math.random() < 0.18 ? rand(0.6, 1.8) : 0);
      drops.push({
        x: opts2.x ?? ui?.x ?? Math.random() * w,
        y: fromTop ? rand(-40, -8) : (opts2.y ?? ui?.y ?? Math.random() * h),
        r,
        momentum,
        vx: rand(-8, 8),
        a: rand(0.55, 0.88),
        spreadX: rand(0.03, 0.14),
        spreadY: rand(0.02, 0.1),
        lastSpawn: 40,
        sprite: pickSprite(sprites, r),
        killed: false,
      });
    };

    const rebuild = () => {
      drops.length = 0;
      const area = clamp((w * h) / (1280 * 720), 0.65, 1.25);
      const n = Math.round(mainN * area);
      for (let i = 0; i < n; i += 1) spawnDrop();
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
          d1.r = Math.min(10, Math.sqrt((a1 + a2 * 0.82) / Math.PI));
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

      /* 修复：仅 dirty 时重建，勿每帧 seed */
      if (sprayDirty) seedSpray();

      const area = clamp((w * h) / (1280 * 720), 0.65, 1.25);
      const target = Math.round(mainN * area * Math.max(0.45, aMul));

      /* 稀疏补雾点：优先补到 UI 卡片上 */
      if (Math.random() < 0.14 * aMul) {
        const k = 1 + ((Math.random() * 4) | 0);
        for (let i = 0; i < k; i += 1) {
          const ui = ledges.length && Math.random() < 0.7 ? pickInLedge(0.9) : null;
          const x = ui?.x ?? Math.random() * w;
          const y = ui?.y ?? Math.pow(Math.random(), 0.7) * h;
          stampBead(x, y, rand(0.25, 0.75), rand(0.16, 0.36) * aMul);
        }
        sctx.globalAlpha = 1;
      }

      mergeAcc += dt;
      if (mergeAcc > 0.1) {
        mergeAcc = 0;
        mergeDrops();
      }

      /* 顶部新滴（模拟新落到玻璃上） */
      topSpawnAcc += dt * aMul;
      while (topSpawnAcc > 0.28 && drops.length < target + 6) {
        topSpawnAcc -= 0.28;
        if (Math.random() < 0.48) {
          spawnDrop({ fromTop: true, momentum: rand(0.15, 1.0), r: rand(2.6, 5.8) });
        }
      }

      for (let i = drops.length - 1; i >= 0; i -= 1) {
        const d = drops[i];
        const tension = 1.15;
        if (Math.random() < (d.r / (110 * tension)) * dt * 0.55) {
          d.momentum += rand(0.35, 1.6);
        }

        if (d.momentum > 0.1) {
          const step = d.momentum * 48 * dt;
          d.y += step;
          d.x += d.vx * dt * 0.28 + Math.sin(d.y * 0.032 + d.r) * 4.2 * dt;
          d.momentum *= Math.pow(0.94, dt * 60);
          eraseSpray(d.x, d.y, d.r * 1.05, Math.min(22, 6 + step * 2));
          d.lastSpawn += dt * 60;
          if (d.momentum > 0.4 && d.lastSpawn > 14) {
            d.lastSpawn = 0;
            d.r *= 0.986;
            stampBead(d.x + rand(-1.5, 1.5), d.y - d.r * rand(0.4, 1.0), rand(0.25, 0.55), 0.28 * aMul);
            sctx.globalAlpha = 1;
            d.sprite = pickSprite(sprites, d.r);
          }
        }

        d.spreadX *= Math.pow(0.45, dt * 60);
        d.spreadY *= Math.pow(0.72, dt * 60);

        if (d.y > h + 36 || d.x < -36 || d.x > w + 36 || d.r < 1.9) {
          drops.splice(i, 1);
          continue;
        }
      }

      while (drops.length < target) spawnDrop();
      if (drops.length > target + 12) drops.length = target + 8;

      ctx.globalAlpha = aMul * 0.88;
      ctx.drawImage(spray, 0, 0, w, h);
      ctx.globalAlpha = 1;
      for (let i = 0; i < drops.length; i += 1) drawDrop(drops[i], aMul);
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
        /* 勿每帧 dirty：滚动时只更新偏置目标，微珠层在 resize/强度切换时重建 */
        if (wasEmpty && arr.length) sprayDirty = true;
      },
      setEnabled(on) { enabled = !!on; },
      draw(dt) { draw(dt, intensity); },
      clear() {
        drops.length = 0;
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
