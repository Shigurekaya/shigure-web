/**
 * 时雨榧 · 暴雨后处理叠层（效果优先，全开堆叠）
 *
 * 参考：Codrops RainEffect（镜头水珠折射）、Unity RainOnTheLens / RainRipples、
 *       Cyanilux 表面流水、游戏雷暴 screen shake + chromatic flash。
 *
 * 1 镜头边缘水珠（rain on lens）
 * 2 地面积水涟漪（puddle ripples）
 * 3 阵风横掠风丝
 * 4 侧缘流水帘（runoff）
 * 5 闪电色散 / 屏幕微震
 * 6 远景暗雨帘（窄带，避免白团）
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
   */
  function attach(fxRoot) {
    if (!fxRoot) return null;

    const veilCanvas = document.createElement("canvas");
    veilCanvas.className = "site-fx__storm-veils";
    veilCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(veilCanvas);

    const puddleCanvas = document.createElement("canvas");
    puddleCanvas.className = "site-fx__storm-puddles";
    puddleCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(puddleCanvas);

    const windCanvas = document.createElement("canvas");
    windCanvas.className = "site-fx__storm-wind";
    windCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(windCanvas);

    const runoffCanvas = document.createElement("canvas");
    runoffCanvas.className = "site-fx__storm-runoff";
    runoffCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(runoffCanvas);

    const lensCanvas = document.createElement("canvas");
    lensCanvas.className = "site-fx__storm-lens";
    lensCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(lensCanvas);

    const chroma = document.createElement("div");
    chroma.className = "site-fx__storm-chroma";
    chroma.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(chroma);

    const rumble = document.createElement("div");
    rumble.className = "site-fx__storm-rumble";
    rumble.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(rumble);

    const vctx = veilCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const pctx = puddleCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const wctx = windCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const rctx = runoffCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const lctx = lensCanvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!vctx || !pctx || !wctx || !rctx || !lctx) {
      [veilCanvas, puddleCanvas, windCanvas, runoffCanvas, lensCanvas, chroma, rumble]
        .forEach((el) => el.remove());
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
    let shakeX = 0;
    let shakeY = 0;
    let shakeVelX = 0;
    let shakeVelY = 0;
    let chromaOff = 0;
    let rumbleA = 0;

    /** @type {Array<{x:number,y:number,ww:number,hh:number,spd:number,a:number,phase:number}>} */
    const veils = [];
    /** @type {Array<{x:number,y:number,r:number,maxR:number,age:number,life:number,w:number}>} */
    const ripples = [];
    /** @type {Array<{x:number,y:number,vx:number,len:number,a:number,w:number,life:number,age:number}>} */
    const windLines = [];
    /** @type {Array<{x:number,y:number,len:number,spd:number,w:number,a:number,phase:number,side:number}>} */
    const runoffs = [];
    /** @type {Array<{x:number,y:number,r:number,vy:number,a:number,trail:number,phase:number,edge:number}>} */
    const lensDrops = [];
    /** @type {Array<{x:number,y:number,r:number,life:number,maxLife:number}>} */
    const lensWipes = [];

    const rebuildVeils = () => {
      const n = Math.max(14, Math.round(22 + w / 90));
      while (veils.length < n) {
        veils.push({
          x: Math.random() * w,
          y: -h * rand(0.02, 0.2),
          ww: rand(3, 9),
          hh: rand(h * 0.35, h * 0.72),
          spd: rand(36, 88),
          a: rand(0.018, 0.05),
          phase: Math.random() * Math.PI * 2,
        });
      }
      if (veils.length > n) veils.length = n;
    };

    const rebuildRunoffs = () => {
      const n = Math.max(6, Math.round(10 + w / 140));
      while (runoffs.length < n) {
        const side = Math.random() < 0.5 ? -1 : 1;
        runoffs.push({
          x: side < 0 ? rand(0, w * 0.08) : rand(w * 0.92, w),
          y: rand(-h * 0.1, h * 0.35),
          len: rand(h * 0.08, h * 0.28),
          spd: rand(42, 110),
          w: rand(1.2, 3.2),
          a: rand(0.06, 0.16),
          phase: Math.random() * Math.PI * 2,
          side,
        });
      }
      if (runoffs.length > n) runoffs.length = n;
    };

    const rebuildLens = () => {
      const n = Math.max(28, Math.round(48 + w / 28));
      while (lensDrops.length < n) {
        const edge = Math.random();
        let x;
        let y;
        if (edge < 0.28) {
          x = rand(0, w);
          y = rand(0, h * 0.12);
        } else if (edge < 0.56) {
          x = rand(0, w);
          y = rand(h * 0.88, h);
        } else if (edge < 0.78) {
          x = rand(0, w * 0.1);
          y = rand(0, h);
        } else {
          x = rand(w * 0.9, w);
          y = rand(0, h);
        }
        lensDrops.push({
          x,
          y,
          r: rand(2.5, 9),
          vy: rand(8, 28),
          a: rand(0.12, 0.38),
          trail: rand(6, 22),
          phase: Math.random() * Math.PI * 2,
          edge,
        });
      }
      if (lensDrops.length > n) lensDrops.length = n;
    };

    const fit = (cssW, cssH) => {
      w = Math.max(1, cssW | 0);
      h = Math.max(1, cssH | 0);
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      for (const c of [veilCanvas, puddleCanvas, windCanvas, runoffCanvas, lensCanvas]) {
        if (c.width !== cw || c.height !== ch) {
          c.width = cw;
          c.height = ch;
        }
      }
      for (const cx of [vctx, pctx, wctx, rctx, lctx]) {
        cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      rebuildVeils();
      rebuildRunoffs();
      rebuildLens();
    };

    const spawnRipple = (x, y, mul = 1) => {
      if (ripples.length > 220) return;
      ripples.push({
        x,
        y,
        r: rand(2, 6),
        maxR: rand(18, 52) * mul,
        age: 0,
        life: rand(0.55, 1.15),
        w: rand(0.8, 1.8),
      });
    };

    const spawnWindLine = () => {
      if (windLines.length > 120) return;
      const y = rand(h * 0.08, h * 0.92);
      windLines.push({
        x: wind > 0 ? -rand(40, 120) : w + rand(40, 120),
        y,
        vx: (wind > 0 ? 1 : -1) * rand(420, 920) * (1 + gust * 0.8),
        len: rand(w * 0.06, w * 0.22),
        a: rand(0.06, 0.2),
        w: rand(0.6, 2.2),
        life: rand(0.12, 0.38),
        age: 0,
      });
    };

    const paintVeils = (dt, aMul) => {
      vctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;
      const flash = flashBoost;
      for (let i = 0; i < veils.length; i += 1) {
        const v = veils[i];
        v.phase += dt * 0.8;
        v.y += v.spd * (1 + gust * 0.4) * dt;
        v.x += (wind * 48 + Math.sin(v.phase) * 8) * dt;
        if (v.y > h + v.hh * 0.15) {
          v.y = -v.hh * rand(0.15, 0.45);
          v.x = Math.random() * w;
        }
        const sx = v.x - v.ww * 0.5;
        const sy = v.y;
        const g = vctx.createLinearGradient(sx, sy, sx + v.ww, sy);
        const aa = v.a * aMul * (1 + gust * 0.25 + flash * 0.35);
        g.addColorStop(0, "rgba(40,58,82,0)");
        g.addColorStop(0.35, `rgba(55,78,108,${aa * 0.45})`);
        g.addColorStop(0.55, `rgba(70,95,128,${aa * 0.75})`);
        g.addColorStop(0.72, `rgba(55,78,108,${aa * 0.45})`);
        g.addColorStop(1, "rgba(40,58,82,0)");
        vctx.fillStyle = g;
        vctx.fillRect(sx, sy, v.ww, v.hh);
      }
    };

    const paintPuddles = (dt, aMul) => {
      pctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;

      const bandTop = h - Math.min(h * 0.22, 200);
      const pg = pctx.createLinearGradient(0, bandTop, 0, h);
      const pa = 0.22 * aMul * (1 + flashBoost * 0.25);
      pg.addColorStop(0, "rgba(20,32,48,0)");
      pg.addColorStop(0.35, `rgba(28,42,62,${pa * 0.55})`);
      pg.addColorStop(1, `rgba(18,30,48,${pa})`);
      pctx.fillStyle = pg;
      pctx.fillRect(0, bandTop, w, h - bandTop);

      if (Math.random() < 0.55 * aMul * (1 + gust * 0.35)) {
        spawnRipple(rand(0, w), h - rand(4, 28), 0.8 + gust * 0.4);
      }
      if (Math.random() < 0.18 * aMul) {
        spawnRipple(rand(w * 0.1, w * 0.9), h - rand(2, 16), 1.1 + gust * 0.5);
      }

      pctx.lineCap = "round";
      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const r = ripples[i];
        r.age += dt;
        const p = 1 - r.age / r.life;
        if (p <= 0) {
          ripples.splice(i, 1);
          continue;
        }
        r.r += (r.maxR - r.r) * Math.min(1, dt * 4.2);
        const alpha = r.a * p * aMul * (0.35 + flashBoost * 0.45);
        pctx.strokeStyle = `rgba(160,195,230,${alpha})`;
        pctx.lineWidth = r.w * (0.6 + p * 0.5);
        pctx.beginPath();
        pctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        pctx.stroke();
        if (p > 0.35) {
          pctx.strokeStyle = `rgba(130,165,205,${alpha * 0.45})`;
          pctx.lineWidth = r.w * 0.55;
          pctx.beginPath();
          pctx.arc(r.x, r.y, r.r * 0.62, 0, Math.PI * 2);
          pctx.stroke();
        }
      }
    };

    const paintWind = (dt, aMul) => {
      wctx.clearRect(0, 0, w, h);
      if (aMul < 0.02 || gust < 0.12) return;

      const rate = (0.35 + gust * 1.8) * aMul;
      const burst = Math.round(rate * dt * 60);
      for (let i = 0; i < burst; i += 1) spawnWindLine();

      wctx.lineCap = "round";
      for (let i = windLines.length - 1; i >= 0; i -= 1) {
        const L = windLines[i];
        L.age += dt;
        const p = 1 - L.age / L.life;
        if (p <= 0) {
          windLines.splice(i, 1);
          continue;
        }
        const x1 = L.x;
        const x2 = L.x + (L.vx > 0 ? L.len : -L.len);
        L.x += L.vx * dt;
        const alpha = L.a * p * aMul * (0.5 + gust * 0.5);
        const g = wctx.createLinearGradient(x1, L.y, x2, L.y);
        g.addColorStop(0, "rgba(200,220,245,0)");
        g.addColorStop(0.25, `rgba(210,230,250,${alpha})`);
        g.addColorStop(0.75, `rgba(210,230,250,${alpha * 0.85})`);
        g.addColorStop(1, "rgba(200,220,245,0)");
        wctx.strokeStyle = g;
        wctx.lineWidth = L.w;
        wctx.beginPath();
        wctx.moveTo(x1, L.y);
        wctx.lineTo(x2, L.y);
        wctx.stroke();
      }
    };

    const paintRunoff = (dt, aMul) => {
      rctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;
      rctx.lineCap = "round";
      for (let i = 0; i < runoffs.length; i += 1) {
        const s = runoffs[i];
        s.phase += dt * 1.4;
        s.y += s.spd * (1 + gust * 0.35) * dt;
        const wob = Math.sin(s.phase) * 3 + wind * 6;
        if (s.y > h + s.len) {
          s.y = rand(-h * 0.15, h * 0.1);
          s.x = s.side < 0 ? rand(0, w * 0.09) : rand(w * 0.91, w);
        }
        const x = s.x + wob;
        const alpha = s.a * aMul * (0.65 + gust * 0.35 + flashBoost * 0.4);
        const g = rctx.createLinearGradient(x, s.y, x, s.y + s.len);
        g.addColorStop(0, "rgba(180,205,235,0)");
        g.addColorStop(0.15, `rgba(195,220,248,${alpha * 0.55})`);
        g.addColorStop(0.55, `rgba(210,232,255,${alpha})`);
        g.addColorStop(0.9, `rgba(170,200,235,${alpha * 0.35})`);
        g.addColorStop(1, "rgba(160,190,220,0)");
        rctx.strokeStyle = g;
        rctx.lineWidth = s.w;
        rctx.beginPath();
        rctx.moveTo(x, s.y);
        rctx.lineTo(x + wob * 0.4, s.y + s.len);
        rctx.stroke();
      }
    };

    const paintLens = (dt, aMul) => {
      lctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;

      for (let i = 0; i < lensDrops.length; i += 1) {
        const d = lensDrops[i];
        d.phase += dt * 1.1;
        d.y += d.vy * (1 + gust * 0.2) * dt;
        d.x += (wind * 4 + Math.sin(d.phase) * 1.2) * dt;
        if (d.y > h + d.r + d.trail) {
          const edge = Math.random();
          d.edge = edge;
          if (edge < 0.28) {
            d.x = rand(0, w);
            d.y = rand(0, h * 0.1);
          } else if (edge < 0.56) {
            d.x = rand(0, w);
            d.y = rand(h * 0.9, h);
          } else if (edge < 0.78) {
            d.x = rand(0, w * 0.1);
            d.y = rand(0, h);
          } else {
            d.x = rand(w * 0.9, w);
            d.y = rand(0, h);
          }
          d.r = rand(2.5, 9);
          d.vy = rand(8, 28);
        }

        const alpha = d.a * aMul * (0.7 + flashBoost * 0.65);
        const rx = d.r;
        const ry = d.r * 1.08;
        const trailLen = d.trail * (1 + gust * 0.15);

        let wiped = false;
        for (let wi = 0; wi < lensWipes.length; wi += 1) {
          const wp = lensWipes[wi];
          const dx = d.x - wp.x;
          const dy = d.y - wp.y;
          if (dx * dx + dy * dy < wp.r * wp.r * 1.1) {
            wiped = true;
            break;
          }
        }
        if (wiped) continue;

        const body = lctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, rx * 1.2);
        body.addColorStop(0, `rgba(235,245,255,${alpha * 0.55})`);
        body.addColorStop(0.45, `rgba(200,225,250,${alpha * 0.28})`);
        body.addColorStop(1, "rgba(180,210,240,0)");
        lctx.fillStyle = body;
        lctx.beginPath();
        lctx.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2);
        lctx.fill();

        const tg = lctx.createLinearGradient(d.x, d.y - trailLen, d.x, d.y);
        tg.addColorStop(0, "rgba(190,215,245,0)");
        tg.addColorStop(0.6, `rgba(200,225,250,${alpha * 0.22})`);
        tg.addColorStop(1, `rgba(220,238,255,${alpha * 0.35})`);
        lctx.fillStyle = tg;
        lctx.fillRect(d.x - rx * 0.35, d.y - trailLen, rx * 0.7, trailLen);

        lctx.fillStyle = `rgba(255,255,255,${alpha * 0.65})`;
        lctx.beginPath();
        lctx.arc(d.x - rx * 0.28, d.y - ry * 0.32, rx * 0.18, 0, Math.PI * 2);
        lctx.fill();
      }
    };

    const wipeAt = (x, y, r = 40) => {
      if (!enabled || intensity < 0.06) return;
      lensWipes.push({ x, y, r, life: 1.2, maxLife: 1.2 });
      if (lensWipes.length > 40) lensWipes.shift();
    };

    const onPointer = (e) => {
      if (!enabled || intensity < 0.08) return;
      const rect = fxRoot.getBoundingClientRect();
      wipeAt(e.clientX - rect.left, e.clientY - rect.top, 34 + gust * 10);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });

    const stepLensWipes = (dt) => {
      for (let i = lensWipes.length - 1; i >= 0; i -= 1) {
        lensWipes[i].life -= dt;
        if (lensWipes[i].life <= 0) lensWipes.splice(i, 1);
      }
    };

    const stepShake = (dt) => {
      stepLensWipes(dt);
      const flash = typeof window.__kayaStormFlash === "number"
        ? window.__kayaStormFlash
        : 0;
      flashBoost += (clamp(flash, 0, 1) - flashBoost) * Math.min(1, dt * 14);
      flashBoost *= Math.exp(-dt * 3.2);

      const shakeAmp = (gust * 2.8 + flashBoost * 5.5) * intensity;
      if (shakeAmp > 0.08) {
        shakeVelX += (rand(-1, 1) * shakeAmp - shakeX) * dt * 28;
        shakeVelY += (rand(-1, 1) * shakeAmp * 0.65 - shakeY) * dt * 28;
      }
      shakeVelX *= Math.exp(-dt * 9);
      shakeVelY *= Math.exp(-dt * 9);
      shakeX += shakeVelX * dt * 60;
      shakeY += shakeVelY * dt * 60;
      shakeX *= Math.exp(-dt * 7);
      shakeY *= Math.exp(-dt * 7);

      fxRoot.style.setProperty("--storm-shake-x", `${shakeX.toFixed(2)}px`);
      fxRoot.style.setProperty("--storm-shake-y", `${shakeY.toFixed(2)}px`);

      chromaOff += (flashBoost * 6 + gust * 1.5 - chromaOff) * Math.min(1, dt * 12);
      chromaOff *= Math.exp(-dt * 4);
      const chromaA = clamp(intensity * (flashBoost * 0.42 + gust * 0.06), 0, 0.55);
      chroma.style.opacity = enabled && intensity > 0.04 ? String(chromaA) : "0";
      chroma.style.setProperty("--storm-chroma", `${chromaOff.toFixed(2)}px`);

      rumbleA += ((gust * 0.22 + flashBoost * 0.35) * intensity - rumbleA) * Math.min(1, dt * 6);
      rumble.style.opacity = enabled && intensity > 0.04 ? String(clamp(rumbleA, 0, 0.48)) : "0";
    };

    const setOn = (on) => {
      for (const el of [veilCanvas, puddleCanvas, windCanvas, runoffCanvas, lensCanvas, chroma, rumble]) {
        el.classList.toggle("is-on", on);
      }
      if (!on) fxRoot.classList.remove("storm-shake-on");
      else fxRoot.classList.add("storm-shake-on");
    };

    return {
      resize: fit,
      setIntensity(v) {
        intensity = clamp(v, 0, 1);
        setOn(enabled && intensity > 0.04);
      },
      setWind(v) { wind = v; },
      setGust(v) { gust = clamp(v, 0, 2); },
      setEnabled(on) {
        enabled = !!on;
        this.setIntensity(intensity);
      },
      draw(dt) {
        if (!enabled || intensity < 0.01 || w < 2) {
          vctx.clearRect(0, 0, w, h);
          pctx.clearRect(0, 0, w, h);
          wctx.clearRect(0, 0, w, h);
          rctx.clearRect(0, 0, w, h);
          lctx.clearRect(0, 0, w, h);
          return;
        }
        const t = clamp(dt || 0.016, 0.004, 0.05);
        stepShake(t);
        paintVeils(t, intensity);
        paintPuddles(t, intensity);
        paintWind(t, intensity);
        paintRunoff(t, intensity);
        paintLens(t, intensity);
      },
      /** 溅点触发额外涟漪 */
      hit(x, y, mul = 1) {
        if (!enabled || intensity < 0.06) return;
        const n = Math.round(2 + mul * 3);
        for (let i = 0; i < n; i += 1) {
          spawnRipple(x + rand(-12, 12), y + rand(-4, 8), mul);
        }
      },
      clear() {
        ripples.length = 0;
        windLines.length = 0;
        vctx.clearRect(0, 0, w, h);
        pctx.clearRect(0, 0, w, h);
        wctx.clearRect(0, 0, w, h);
        rctx.clearRect(0, 0, w, h);
        lctx.clearRect(0, 0, w, h);
        shakeX = 0;
        shakeY = 0;
        fxRoot.style.setProperty("--storm-shake-x", "0px");
        fxRoot.style.setProperty("--storm-shake-y", "0px");
      },
      destroy() {
        lensWipes.length = 0;
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("pointerdown", onPointer);
        fxRoot.classList.remove("storm-shake-on");
        veilCanvas.remove();
        puddleCanvas.remove();
        windCanvas.remove();
        runoffCanvas.remove();
        lensCanvas.remove();
        chroma.remove();
        rumble.remove();
      },
    };
  }

  window.KayaStormPostFx = { attach };
})();
