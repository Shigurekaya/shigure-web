/**
 * 时雨榧 · 大雨特效（对齐小米天气暴雨观感）
 *
 * 修复点：
 * - 原 WebGL 片元过重易卡死；整屏半透明风暴雾挡住 UI
 * - UV 未翻转可能导致雨丝方向错误
 * - WebGL2 失败时无降级
 *
 * 分层（V2EX/MIUI：雨效夹住 UI）：
 * 0 CSS 冷蓝氛围
 * 1 site-bg 远/中景短密竖直雨丝
 * 2 页面 UI
 * 3 前景近景雨丝 + 玻璃水珠/拖尾
 * 4 卡片顶边溅花
 */
(() => {
  const FADE_SEC = 0.85;
  const FRAME_MS = 1000 / 30;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /**
   * @param {HTMLElement} fxRoot
   * @param {{
   *   getLedges: () => Array<{x:number,y:number,w:number,radius:number}>,
   *   bgHost?: HTMLElement | null,
   * }} opts
   */
  function attach(fxRoot, opts) {
    const bgHost = opts.bgHost || null;

    const bgCanvas = document.createElement("canvas");
    bgCanvas.className = "site-bg__heavy";
    bgCanvas.setAttribute("aria-hidden", "true");
    if (bgHost) bgHost.appendChild(bgCanvas);

    const mist = document.createElement("div");
    mist.className = "site-fx__mist";
    const fgCanvas = document.createElement("canvas");
    fgCanvas.className = "site-fx__gl";
    fgCanvas.setAttribute("aria-hidden", "true");
    const splashCanvas = document.createElement("canvas");
    splashCanvas.className = "site-fx__splash";
    splashCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(mist);
    fxRoot.appendChild(fgCanvas);
    fxRoot.appendChild(splashCanvas);

    const bgCtx = bgCanvas.getContext("2d", { alpha: true });
    const fgCtx = fgCanvas.getContext("2d", { alpha: true });
    const sctx = splashCanvas.getContext("2d", { alpha: true });

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

    /** @type {Array<any>} */
    const far = [];
    /** @type {Array<any>} */
    const mid = [];
    /** @type {Array<any>} */
    const near = [];
    /** @type {Array<any>} */
    const beads = [];
    /** @type {Array<any>} */
    const trails = [];
    /** @type {Array<any>} */
    const splashes = [];
    /** @type {Array<any>} */
    const rims = [];

    const fitCanvas = (c, ctx) => {
      if (!ctx) return;
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (c.width !== cw || c.height !== ch) {
        c.width = cw;
        c.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
    };

    const makeStreak = (layer) => {
      /* 参考片：倾角≈0，长度≈0.6%–2.8% 屏高，短密冷白 */
      const spec = layer === "far"
        ? { lenH: [0.004, 0.01], speed: [520, 780], alpha: [0.1, 0.22], width: [0.7, 1.05] }
        : layer === "mid"
          ? { lenH: [0.008, 0.018], speed: [360, 560], alpha: [0.16, 0.34], width: [0.9, 1.3] }
          : { lenH: [0.014, 0.03], speed: [240, 400], alpha: [0.28, 0.55], width: [1.15, 1.85] };
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        len: h * rand(spec.lenH[0], spec.lenH[1]),
        speed: rand(spec.speed[0], spec.speed[1]),
        alpha: rand(spec.alpha[0], spec.alpha[1]),
        width: rand(spec.width[0], spec.width[1]),
        wind: rand(-8, 8) * 0.12,
      };
    };

    const makeBead = (sliding) => {
      const roll = Math.random();
      const r = roll < 0.55 ? rand(1.8, 3.6) : roll < 0.82 ? rand(3.6, 6.8) : rand(6.8, 11.5);
      const isSlide = !!sliding;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r,
        alpha: rand(0.32, 0.62),
        sliding: isSlide,
        vy: isSlide ? rand(40, 100) : 0,
        vx: isSlide ? rand(-5, 5) : 0,
        stretch: isSlide ? rand(1.5, 2.5) : rand(0.92, 1.12),
        life: isSlide ? rand(3.2, 8.5) : Infinity,
        age: 0,
        wobble: rand(0, Math.PI * 2),
        highlight: rand(0.55, 1),
        _trail: 0,
      };
    };

    const rebuild = () => {
      if (w < 2 || h < 2) return;
      const mpx = (w * h) / 1e6;
      /* 参考约 223/MPx，桌面略降 */
      const total = clamp(Math.round(mpx * 190), 160, 460);
      const nFar = Math.round(total * 0.5);
      const nMid = Math.round(total * 0.32);
      const nNear = Math.max(12, total - nFar - nMid);

      far.length = 0;
      mid.length = 0;
      near.length = 0;
      for (let i = 0; i < nFar; i += 1) far.push(makeStreak("far"));
      for (let i = 0; i < nMid; i += 1) mid.push(makeStreak("mid"));
      for (let i = 0; i < nNear; i += 1) near.push(makeStreak("near"));

      const beadN = clamp(Math.round(mpx * 24), 30, 70);
      const slideN = Math.max(5, Math.round(beadN * 0.22));
      beads.length = 0;
      for (let i = 0; i < beadN - slideN; i += 1) beads.push(makeBead(false));
      for (let i = 0; i < slideN; i += 1) beads.push(makeBead(true));
      trails.length = 0;
      splashes.length = 0;
      rims.length = 0;
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, w > 1200 ? 1.25 : 1.5);
      fitCanvas(bgCanvas, bgCtx);
      fitCanvas(fgCanvas, fgCtx);
      fitCanvas(splashCanvas, sctx);
      rebuild();
    };

    const stepStreak = (d, dt) => {
      d.y += d.speed * dt;
      d.x += d.wind * dt;
      if (d.y > h + d.len) {
        d.y = -d.len - Math.random() * 30;
        d.x = Math.random() * w;
      } else if (d.x > w + 10) d.x = -6;
      else if (d.x < -10) d.x = w + 6;
    };

    const drawStreak = (ctx, d, aMul) => {
      const a = d.alpha * aMul;
      if (a < 0.01) return;
      const x1 = d.x + d.wind * 0.8;
      const y1 = d.y + d.len;
      const g = ctx.createLinearGradient(d.x, d.y, x1, y1);
      g.addColorStop(0, `rgba(210,230,255,0)`);
      g.addColorStop(0.2, `rgba(235,245,255,${a * 0.55})`);
      g.addColorStop(0.55, `rgba(255,255,255,${a})`);
      g.addColorStop(1, `rgba(170,200,235,0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = d.width;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };

    const drawBead = (b, aMul) => {
      const a = b.alpha * aMul;
      if (a < 0.02 || !fgCtx) return;
      const rx = b.r;
      const ry = b.r * b.stretch;
      fgCtx.beginPath();
      fgCtx.ellipse(b.x, b.y + 0.7, rx * 1.06, ry * 1.06, 0, 0, Math.PI * 2);
      fgCtx.fillStyle = `rgba(30,55,90,${0.16 * a})`;
      fgCtx.fill();

      const g = fgCtx.createRadialGradient(
        b.x - rx * 0.32,
        b.y - ry * 0.42,
        rx * 0.08,
        b.x,
        b.y + ry * 0.12,
        rx * 1.2
      );
      g.addColorStop(0, `rgba(255,255,255,${Math.min(0.98, 0.5 + b.highlight * 0.45)})`);
      g.addColorStop(0.25, `rgba(230,240,255,${a * 0.9})`);
      g.addColorStop(0.55, `rgba(170,200,235,${a * 0.4})`);
      g.addColorStop(0.85, `rgba(110,150,200,${a * 0.14})`);
      g.addColorStop(1, "rgba(90,130,180,0)");
      fgCtx.fillStyle = g;
      fgCtx.beginPath();
      fgCtx.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI * 2);
      fgCtx.fill();

      fgCtx.fillStyle = `rgba(255,255,255,${0.55 * b.highlight * a})`;
      fgCtx.beginPath();
      fgCtx.ellipse(b.x - rx * 0.3, b.y - ry * 0.36, rx * 0.26, ry * 0.18, -0.4, 0, Math.PI * 2);
      fgCtx.fill();
    };

    const spawnSplash = (ledge) => {
      if (intensity < 0.2) return;
      const inset = Math.min(ledge.radius * 0.7, ledge.w * 0.08);
      const x = ledge.x + inset + Math.random() * Math.max(4, ledge.w - inset * 2);
      const y = ledge.y + Math.random() * 1.2;
      const n = 4 + ((Math.random() * 5) | 0);
      for (let i = 0; i < n; i += 1) {
        const ang = -Math.PI * 0.05 - Math.random() * Math.PI * 0.9;
        const spd = rand(70, 140);
        splashes.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: rand(0.16, 0.32),
          age: 0,
          r: rand(0.8, 2.1),
          kind: "spark",
        });
      }
      if (Math.random() < 0.6) {
        splashes.push({
          x, y: y + 1, vx: 0, vy: 0,
          life: rand(0.18, 0.28), age: 0,
          r: rand(4, 7), kind: "ring",
        });
      }
      rims.push({
        x, y: y + 0.6,
        life: rand(0.45, 0.85), age: 0,
        w: rand(7, 16), a: rand(0.35, 0.7),
      });
    };

    const hardStop = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(stopTimer);
      intensity = 0;
      targetIntensity = 0;
      trails.length = 0;
      splashes.length = 0;
      rims.length = 0;
      if (bgCtx) bgCtx.clearRect(0, 0, w, h);
      if (fgCtx) fgCtx.clearRect(0, 0, w, h);
      if (sctx) sctx.clearRect(0, 0, w, h);
    };

    const tick = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < FRAME_MS) return;
      const dt = Math.min(0.05, elapsed / 1000);
      last = now;
      const time = (now - t0) / 1000;

      const dir = Math.sign(targetIntensity - intensity);
      if (dir !== 0) {
        intensity += dir * (dt / FADE_SEC);
        if ((dir > 0 && intensity >= targetIntensity) || (dir < 0 && intensity <= targetIntensity)) {
          intensity = targetIntensity;
        }
      }
      const aMul = intensity;
      if (aMul <= 0.001) {
        if (bgCtx) bgCtx.clearRect(0, 0, w, h);
        if (fgCtx) fgCtx.clearRect(0, 0, w, h);
        if (sctx) sctx.clearRect(0, 0, w, h);
        return;
      }

      /* —— 背景雨丝（UI 下方） —— */
      if (bgCtx) {
        bgCtx.clearRect(0, 0, w, h);
        for (let i = 0; i < far.length; i += 1) {
          const d = far[i];
          drawStreak(bgCtx, d, aMul);
          stepStreak(d, dt);
        }
        for (let i = 0; i < mid.length; i += 1) {
          const d = mid[i];
          drawStreak(bgCtx, d, aMul);
          stepStreak(d, dt);
        }
      }

      /* —— 前景雨丝 + 玻璃水珠 —— */
      if (fgCtx) {
        fgCtx.clearRect(0, 0, w, h);
        for (let i = 0; i < near.length; i += 1) {
          const d = near[i];
          drawStreak(fgCtx, d, aMul);
          stepStreak(d, dt);
        }

        for (let i = trails.length - 1; i >= 0; i -= 1) {
          const t = trails[i];
          t.age += dt;
          const p = 1 - t.age / t.life;
          if (p <= 0) { trails.splice(i, 1); continue; }
          const tg = fgCtx.createLinearGradient(t.x, t.y, t.x + t.dx, t.y + t.dy);
          tg.addColorStop(0, `rgba(200,220,245,${0.22 * p * aMul})`);
          tg.addColorStop(1, "rgba(200,220,245,0)");
          fgCtx.strokeStyle = tg;
          fgCtx.lineWidth = t.w;
          fgCtx.beginPath();
          fgCtx.moveTo(t.x, t.y);
          fgCtx.lineTo(t.x + t.dx, t.y + t.dy);
          fgCtx.stroke();
        }

        for (let i = beads.length - 1; i >= 0; i -= 1) {
          const b = beads[i];
          b.wobble += dt * 1.35;
          if (b.sliding) {
            b.age += dt;
            b.vy += 16 * dt;
            b.vx += Math.sin(b.wobble) * 3.5 * dt;
            b._trail -= dt;
            if (b._trail <= 0) {
              b._trail = 0.04;
              if (trails.length < 120) {
                trails.push({
                  x: b.x,
                  y: b.y - b.r * b.stretch * 0.2,
                  dx: b.vx * 0.05,
                  dy: -b.r * b.stretch * 2.1,
                  w: Math.max(1.2, b.r * 0.45),
                  life: rand(0.35, 0.65),
                  age: 0,
                });
              }
            }
            b.y += b.vy * dt;
            b.x += b.vx * dt;
            if (b.age > b.life || b.y > h + 24) {
              beads[i] = makeBead(Math.random() < 0.4);
              continue;
            }
          } else {
            b.x += Math.sin(b.wobble) * 0.3 * dt;
            b.y += (0.7 + Math.cos(b.wobble * 0.7)) * dt;
            if (b.y > h + 10) b.y = -8;
            if (Math.random() < 0.0008) {
              b.sliding = true;
              b.vy = rand(42, 85);
              b.stretch = rand(1.55, 2.4);
              b.life = rand(3, 7);
              b.age = 0;
            }
          }
          drawBead(b, aMul);
        }
      }

      /* —— 溅花 —— */
      if (sctx) {
        sctx.clearRect(0, 0, w, h);
        const ledges = opts.getLedges() || [];
        for (let i = 0; i < ledges.length; i += 1) {
          const L = ledges[i];
          const pulse = 0.5 + 0.5 * Math.sin(time * 5.5 + i * 1.3);
          const g = sctx.createLinearGradient(L.x, L.y, L.x + L.w, L.y);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(0.12, `rgba(210,230,255,${0.1 * pulse * aMul})`);
          g.addColorStop(0.5, `rgba(255,255,255,${0.26 * pulse * aMul})`);
          g.addColorStop(0.88, `rgba(210,230,255,${0.1 * pulse * aMul})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          sctx.fillStyle = g;
          sctx.fillRect(L.x, L.y - 0.5, L.w, 2.3);
        }

        splashAcc += dt;
        const rate = Math.min(22, 4 + ledges.length * 0.9) * aMul;
        let spawned = 0;
        while (rate > 0.2 && splashAcc > 1 / rate && ledges.length && spawned < 8) {
          splashAcc -= 1 / rate;
          spawnSplash(ledges[(Math.random() * ledges.length) | 0]);
          spawned += 1;
        }
        if (splashAcc > 1) splashAcc = 1;

        for (let i = rims.length - 1; i >= 0; i -= 1) {
          const r = rims[i];
          r.age += dt;
          const p = 1 - r.age / r.life;
          if (p <= 0) { rims.splice(i, 1); continue; }
          sctx.fillStyle = `rgba(255,255,255,${r.a * p * aMul})`;
          sctx.beginPath();
          sctx.ellipse(r.x, r.y, r.w * 0.5, 1.15 + (1 - p), 0, 0, Math.PI * 2);
          sctx.fill();
        }

        for (let i = splashes.length - 1; i >= 0; i -= 1) {
          const s = splashes[i];
          s.age += dt;
          const p = 1 - s.age / s.life;
          if (p <= 0) { splashes.splice(i, 1); continue; }
          if (s.kind === "ring") {
            sctx.strokeStyle = `rgba(230,245,255,${0.55 * p * aMul})`;
            sctx.lineWidth = 1.15;
            sctx.beginPath();
            sctx.arc(s.x, s.y, s.r * (0.3 + (1 - p) * 1.45), Math.PI * 1.02, Math.PI * 1.98);
            sctx.stroke();
          } else {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.vy += 280 * dt;
            sctx.fillStyle = `rgba(255,255,255,${0.78 * p * aMul})`;
            sctx.beginPath();
            sctx.arc(s.x, s.y, s.r * (0.65 + p * 0.4), 0, Math.PI * 2);
            sctx.fill();
          }
        }
      }
    };

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
      },
      stop() {
        targetIntensity = 0;
        window.clearTimeout(stopTimer);
        stopTimer = window.setTimeout(hardStop, FADE_SEC * 1000 + 80);
      },
      resize,
      destroy() {
        hardStop();
        bgCanvas.remove();
        fgCanvas.remove();
        splashCanvas.remove();
        mist.remove();
      },
    };
  }

  window.KayaHeavyRain = { attach };
})();
