/**
 * 时雨榧 · 暴雨叠层扩展（效果优先，继续堆叠）
 *
 * 参考：电影颗粒 / 游戏风卷杂物 / 景深 bokeh / 多层视差雨帘 /
 *       雾卷 wisps / 卡片湿面高光 / 地面积水反光 / 交互擦玻璃。
 */
(() => {
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  /**
   * @param {HTMLElement} fxRoot
   * @param {{ bgHost?: HTMLElement | null }} [opts]
   */
  function attach(fxRoot, opts = {}) {
    if (!fxRoot) return null;
    const bgHost = opts.bgHost || null;

    const skyGlow = document.createElement("div");
    skyGlow.className = "site-bg__storm-sky-glow";
    skyGlow.setAttribute("aria-hidden", "true");
    if (bgHost) bgHost.appendChild(skyGlow);
    else fxRoot.appendChild(skyGlow);

    const depthFar = document.createElement("canvas");
    depthFar.className = "site-fx__storm-depth-far";
    depthFar.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(depthFar);

    const depthNear = document.createElement("canvas");
    depthNear.className = "site-fx__storm-depth-near";
    depthNear.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(depthNear);

    const wispCanvas = document.createElement("canvas");
    wispCanvas.className = "site-fx__storm-wisps";
    wispCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(wispCanvas);

    const bokehCanvas = document.createElement("canvas");
    bokehCanvas.className = "site-fx__storm-bokeh";
    bokehCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(bokehCanvas);

    const debrisCanvas = document.createElement("canvas");
    debrisCanvas.className = "site-fx__storm-debris";
    debrisCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(debrisCanvas);

    const glintCanvas = document.createElement("canvas");
    glintCanvas.className = "site-fx__storm-glints";
    glintCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(glintCanvas);

    const groundFlash = document.createElement("canvas");
    groundFlash.className = "site-fx__storm-ground-flash";
    groundFlash.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(groundFlash);

    const grainCanvas = document.createElement("canvas");
    grainCanvas.className = "site-fx__storm-grain";
    grainCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(grainCanvas);

    const scanDiv = document.createElement("div");
    scanDiv.className = "site-fx__storm-scan";
    scanDiv.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(scanDiv);

    const fctx = depthFar.getContext("2d", { alpha: true, desynchronized: true });
    const nctx = depthNear.getContext("2d", { alpha: true, desynchronized: true });
    const wctx = wispCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const bctx = bokehCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const dctx = debrisCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const gctx = glintCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const gfctx = groundFlash.getContext("2d", { alpha: true, desynchronized: true });
    const grctx = grainCanvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!fctx || !nctx || !wctx || !bctx || !dctx || !gctx || !gfctx || !grctx) {
      [skyGlow, depthFar, depthNear, wispCanvas, bokehCanvas, debrisCanvas,
        glintCanvas, groundFlash, grainCanvas, scanDiv].forEach((el) => el.remove());
      return null;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let intensity = 0;
    let enabled = true;
    let wind = 0.4;
    let gust = 0;
    let flashBoost = 0;
    let time = 0;
    let grainFrame = 0;
  /** @type {Array<{x:number,y:number,len:number,spd:number,a:number,w:number}>} */
    const farStreaks = [];
  /** @type {Array<{x:number,y:number,len:number,spd:number,a:number,w:number}>} */
    const nearStreaks = [];
  /** @type {Array<{x:number,y:number,vx:number,vy:number,r:number,a:number,phase:number}>} */
    const bokehs = [];
  /** @type {Array<{x:number,y:number,vx:number,vy:number,rot:number,vr:number,w:number,h:number,a:number}>} */
    const debris = [];
  /** @type {Array<{x:number,y:number,scale:number,spd:number,a:number,phase:number,curve:number}>} */
    const wisps = [];
  /** @type {Array<{x:number,y:number,r:number,life:number,maxLife:number}>} */
    const wipes = [];
  /** @type {Array<{x:number,y:number,w:number,phase:number}>} */
    let ledges = [];

    const rebuildStreaks = () => {
      const fn = Math.max(120, Math.round((w * h) / 2200));
      const nn = Math.max(180, Math.round((w * h) / 1400));
      while (farStreaks.length < fn) {
        farStreaks.push({
          x: Math.random() * w,
          y: Math.random() * h,
          len: rand(h * 0.012, h * 0.028),
          spd: rand(280, 520),
          a: rand(0.04, 0.12),
          w: rand(0.5, 1.1),
        });
      }
      if (farStreaks.length > fn) farStreaks.length = fn;
      while (nearStreaks.length < nn) {
        nearStreaks.push({
          x: Math.random() * w,
          y: Math.random() * h,
          len: rand(h * 0.022, h * 0.055),
          spd: rand(680, 1180),
          a: rand(0.1, 0.28),
          w: rand(0.9, 2.0),
        });
      }
      if (nearStreaks.length > nn) nearStreaks.length = nn;
    };

    const rebuildBokeh = () => {
      /* 远景柔光斑，勿做成贴屏冷凝大圆 */
      const n = Math.max(6, Math.round(8 + w / 140));
      while (bokehs.length < n) {
        bokehs.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: rand(-6, 6),
          vy: rand(-3, 4),
          r: rand(10, 32),
          a: rand(0.02, 0.07),
          phase: Math.random() * Math.PI * 2,
        });
      }
      if (bokehs.length > n) bokehs.length = n;
    };

    const rebuildDebris = () => {
      const n = Math.max(24, Math.round(36 + w / 60));
      while (debris.length < n) {
        debris.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: rand(-20, 20),
          vy: rand(40, 140),
          rot: Math.random() * Math.PI,
          vr: rand(-2, 2),
          w: rand(3, 9),
          h: rand(2, 6),
          a: rand(0.15, 0.42),
        });
      }
      if (debris.length > n) debris.length = n;
    };

    const rebuildWisps = () => {
      const n = Math.max(8, Math.round(12 + w / 160));
      while (wisps.length < n) {
        wisps.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.85,
          scale: rand(0.6, 1.4),
          spd: rand(12, 38),
          a: rand(0.06, 0.16),
          phase: Math.random() * Math.PI * 2,
          curve: rand(0.4, 1.2),
        });
      }
      if (wisps.length > n) wisps.length = n;
    };

    const fit = (cssW, cssH) => {
      w = Math.max(1, cssW | 0);
      h = Math.max(1, cssH | 0);
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      for (const c of [depthFar, depthNear, wispCanvas, bokehCanvas, debrisCanvas,
        glintCanvas, groundFlash, grainCanvas]) {
        if (c.width !== cw || c.height !== ch) {
          c.width = cw;
          c.height = ch;
        }
      }
      for (const cx of [fctx, nctx, wctx, bctx, dctx, gctx, gfctx, grctx]) {
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      rebuildStreaks();
      rebuildBokeh();
      rebuildDebris();
      rebuildWisps();
    };

    const paintDepth = (ctx, streaks, mul, aMul, dt) => {
      ctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;
      ctx.lineCap = "round";
      const tilt = wind * 18 + gust * wind * 12;
      const flash = flashBoost;
      for (let i = 0; i < streaks.length; i += 1) {
        const s = streaks[i];
        s.y += s.spd * mul * (1 + gust * 0.5) * dt;
        s.x += (wind * 70 * mul + gust * wind * 30) * dt;
        if (s.y > h + s.len) {
          s.y = -s.len - Math.random() * 30;
          s.x = Math.random() * w;
        }
        const a = s.a * aMul * (0.7 + flash * 0.9) * (1 + gust * 0.25);
        ctx.strokeStyle = `rgba(${flash > 0.2 ? "215,235,255" : "170,195,225"},${a})`;
        ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + tilt, s.y + s.len);
        ctx.stroke();
      }
    };

    const paintWisps = (dt, aMul) => {
      wctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;
      for (let i = 0; i < wisps.length; i += 1) {
        const p = wisps[i];
        p.phase += dt * 0.7;
        p.x += (wind * 28 + p.spd) * dt;
        p.y += Math.sin(p.phase) * 8 * dt;
        if (p.x > w + 120) {
          p.x = -120;
          p.y = Math.random() * h * 0.8;
        }
        const alpha = p.a * aMul * (0.55 + gust * 0.35);
        const sc = p.scale * (1 + Math.sin(p.phase * 1.3) * 0.12);
        wctx.save();
        wctx.translate(p.x, p.y);
        wctx.scale(sc, sc * 0.55);
        wctx.beginPath();
        wctx.moveTo(-40, 0);
        wctx.bezierCurveTo(-20, -18 * p.curve, 20, 14 * p.curve, 50, 0);
        wctx.bezierCurveTo(20, 10 * p.curve, -10, 16 * p.curve, -40, 0);
        const g = wctx.createRadialGradient(0, 0, 0, 0, 0, 55);
        g.addColorStop(0, `rgba(150,175,210,${alpha})`);
        g.addColorStop(0.55, `rgba(120,150,190,${alpha * 0.35})`);
        g.addColorStop(1, "rgba(100,130,170,0)");
        wctx.fillStyle = g;
        wctx.fill();
        wctx.restore();
      }
    };

    const paintBokeh = (dt, aMul) => {
      bctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;
      for (let i = 0; i < bokehs.length; i += 1) {
        const b = bokehs[i];
        b.phase += dt * 0.5;
        b.x += (b.vx + wind * 6) * dt;
        b.y += (b.vy + gust * 4) * dt;
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;
        const pulse = 0.75 + Math.sin(b.phase) * 0.25;
        const alpha = b.a * aMul * pulse * (1 + flashBoost * 0.8);
        const g = bctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(200,225,255,${alpha * 0.55})`);
        g.addColorStop(0.35, `rgba(160,195,235,${alpha * 0.28})`);
        g.addColorStop(0.7, `rgba(100,140,190,${alpha * 0.08})`);
        g.addColorStop(1, "rgba(80,120,170,0)");
        bctx.fillStyle = g;
        bctx.beginPath();
        bctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        bctx.fill();
      }
    };

    const paintDebris = (dt, aMul) => {
      dctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;
      const gustMul = 1 + gust * 1.2;
      for (let i = 0; i < debris.length; i += 1) {
        const p = debris[i];
        p.x += (p.vx + wind * 120 * gustMul) * dt;
        p.y += p.vy * gustMul * dt;
        p.rot += p.vr * dt;
        if (p.y > h + 20 || p.x < -30 || p.x > w + 30) {
          p.x = wind > 0 ? -20 : w + 20;
          p.y = rand(0, h * 0.75);
          p.vy = rand(60, 200) * gustMul;
        }
        dctx.save();
        dctx.translate(p.x, p.y);
        dctx.rotate(p.rot);
        dctx.fillStyle = `rgba(140,155,175,${p.a * aMul})`;
        dctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
        dctx.fillStyle = `rgba(180,195,215,${p.a * aMul * 0.45})`;
        dctx.fillRect(-p.w * 0.35, -p.h * 0.35, p.w * 0.5, p.h * 0.5);
        dctx.restore();
      }
    };

    const paintGlints = (dt, aMul) => {
      gctx.clearRect(0, 0, w, h);
      if (aMul < 0.02 || !ledges.length) return;
      time += dt;
      gctx.lineCap = "round";
      for (let i = 0; i < ledges.length; i += 1) {
        const L = ledges[i];
        if (L.shape === "circle") continue;
        const sweep = (time * 0.85 + i * 0.7) % 1;
        const gx = L.x + L.w * sweep;
        const gy = L.y - 1;
        const gw = 14 * (0.6 + gust * 0.4);
        const alpha = 0.35 * aMul * (0.5 + flashBoost * 0.8);
        const g = gctx.createLinearGradient(gx - gw, gy, gx + gw, gy);
        g.addColorStop(0, "rgba(220,240,255,0)");
        g.addColorStop(0.45, `rgba(240,248,255,${alpha})`);
        g.addColorStop(0.55, `rgba(240,248,255,${alpha * 0.85})`);
        g.addColorStop(1, "rgba(220,240,255,0)");
        gctx.strokeStyle = g;
        gctx.lineWidth = 2.2;
        gctx.beginPath();
        gctx.moveTo(gx - gw, gy);
        gctx.lineTo(gx + gw, gy);
        gctx.stroke();
      }
    };

    const paintGroundFlash = (dt, aMul) => {
      gfctx.clearRect(0, 0, w, h);
      if (aMul < 0.02 || flashBoost < 0.05) return;
      const bandH = Math.min(h * 0.18, 160);
      const g = gfctx.createLinearGradient(0, h - bandH, 0, h);
      const fa = flashBoost * aMul * 0.42;
      g.addColorStop(0, "rgba(180,210,250,0)");
      g.addColorStop(0.35, `rgba(200,225,255,${fa * 0.35})`);
      g.addColorStop(0.72, `rgba(230,242,255,${fa})`);
      g.addColorStop(1, `rgba(190,220,250,${fa * 0.55})`);
      gfctx.fillStyle = g;
      gfctx.fillRect(0, h - bandH, w, bandH);
    };

    const paintGrain = (dt, aMul) => {
      grctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;
      grainFrame += 1;
      if (grainFrame % 2 !== 0) return;
      const gw = Math.max(1, Math.floor(w * dpr / 2));
      const gh = Math.max(1, Math.floor(h * dpr / 2));
      const img = grctx.createImageData(gw, gh);
      const data = img.data;
      const base = 18 + flashBoost * 22;
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() * base) | 0;
        data[i] = 200 + n;
        data[i + 1] = 210 + n;
        data[i + 2] = 230 + n;
        data[i + 3] = (Math.random() * 28 + 8) * aMul;
      }
      grctx.save();
      grctx.setTransform(1, 0, 0, 1, 0, 0);
      grctx.putImageData(img, 0, 0);
      grctx.restore();
      grctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      grctx.globalCompositeOperation = "destination-out";
      for (let i = wipes.length - 1; i >= 0; i -= 1) {
        const wp = wipes[i];
        wp.life -= dt;
        if (wp.life <= 0) {
          wipes.splice(i, 1);
          continue;
        }
        const p = wp.life / wp.maxLife;
        const rg = grctx.createRadialGradient(wp.x, wp.y, 0, wp.x, wp.y, wp.r * (1.1 - p * 0.2));
        rg.addColorStop(0, `rgba(0,0,0,${0.85 * p})`);
        rg.addColorStop(0.6, `rgba(0,0,0,${0.35 * p})`);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        grctx.fillStyle = rg;
        grctx.beginPath();
        grctx.arc(wp.x, wp.y, wp.r, 0, Math.PI * 2);
        grctx.fill();
      }
      grctx.globalCompositeOperation = "source-over";
    };

    const stepFlash = (dt) => {
      const flash = typeof window.__kayaStormFlash === "number"
        ? window.__kayaStormFlash
        : 0;
      flashBoost += (clamp(flash, 0, 1) - flashBoost) * Math.min(1, dt * 14);
      flashBoost *= Math.exp(-dt * 3.2);
      skyGlow.style.opacity = enabled && intensity > 0.04
        ? String(clamp(flashBoost * 0.55 * intensity, 0, 0.65))
        : "0";
      scanDiv.style.opacity = enabled && intensity > 0.04
        ? String(clamp(0.06 + flashBoost * 0.12 + gust * 0.04, 0, 0.22))
        : "0";
    };

    const wipeAt = (x, y, r = 42) => {
      if (!enabled || intensity < 0.06) return;
      wipes.push({ x, y, r, life: 1, maxLife: 1 });
      if (wipes.length > 48) wipes.shift();
      window.__kayaStormWipePulse = performance.now();
    };

    const onPointer = (e) => {
      if (!enabled || intensity < 0.08) return;
      const rect = fxRoot.getBoundingClientRect();
      wipeAt(e.clientX - rect.left, e.clientY - rect.top, 36 + gust * 12);
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });

    const setOn = (on) => {
      for (const el of [depthFar, depthNear, wispCanvas, bokehCanvas, debrisCanvas,
        glintCanvas, groundFlash, grainCanvas, scanDiv]) {
        el.classList.toggle("is-on", on);
      }
      skyGlow.classList.toggle("is-on", on);
      document.body.classList.toggle("storm-fx-stack", on);
    };

    return {
      resize: fit,
      setIntensity(v) {
        intensity = clamp(v, 0, 1);
        setOn(enabled && intensity > 0.04);
      },
      setWind(v) { wind = v; },
      setGust(v) { gust = clamp(v, 0, 2); },
      setLedges(list) { ledges = list || []; },
      setEnabled(on) {
        enabled = !!on;
        this.setIntensity(intensity);
      },
      draw(dt) {
        if (!enabled || intensity < 0.01 || w < 2) {
          fctx.clearRect(0, 0, w, h);
          nctx.clearRect(0, 0, w, h);
          wctx.clearRect(0, 0, w, h);
          bctx.clearRect(0, 0, w, h);
          dctx.clearRect(0, 0, w, h);
          gctx.clearRect(0, 0, w, h);
          gfctx.clearRect(0, 0, w, h);
          grctx.clearRect(0, 0, w, h);
          return;
        }
        const t = clamp(dt || 0.016, 0.004, 0.05);
        stepFlash(t);
        paintDepth(fctx, farStreaks, 0.55, intensity * 0.75, t);
        paintDepth(nctx, nearStreaks, 1, intensity, t);
        paintWisps(t, intensity);
        paintBokeh(t, intensity);
        paintDebris(t, intensity);
        paintGlints(t, intensity);
        paintGroundFlash(t, intensity);
        paintGrain(t, intensity);
      },
      clear() {
        wipes.length = 0;
        fctx.clearRect(0, 0, w, h);
        nctx.clearRect(0, 0, w, h);
        wctx.clearRect(0, 0, w, h);
        bctx.clearRect(0, 0, w, h);
        dctx.clearRect(0, 0, w, h);
        gctx.clearRect(0, 0, w, h);
        gfctx.clearRect(0, 0, w, h);
        grctx.clearRect(0, 0, w, h);
      },
      destroy() {
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("pointerdown", onPointer);
        document.body.classList.remove("storm-fx-stack");
        skyGlow.remove();
        depthFar.remove();
        depthNear.remove();
        wispCanvas.remove();
        bokehCanvas.remove();
        debrisCanvas.remove();
        glintCanvas.remove();
        groundFlash.remove();
        grainCanvas.remove();
        scanDiv.remove();
      },
    };
  }

  window.KayaStormOverlay = { attach };
})();
