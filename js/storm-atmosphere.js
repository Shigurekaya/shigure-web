/**
 * 时雨榧 · 暴雨氛围层（效果优先，不限性能）
 *
 * 1 远景雨幕（半透明竖向帘带，随风漂移）
 * 2 地面溅雾 / 低空水汽
 * 3 阵风脉冲（短时提亮雨幕 + 横移加速）
 * 4 闪电曝光联动（读 window.__kayaStormFlash）
 */
(() => {
  const RAIN_DENSITY = 0.6;
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

    const sheetCanvas = document.createElement("canvas");
    sheetCanvas.className = "site-fx__storm-sheets";
    sheetCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(sheetCanvas);

    const sprayCanvas = document.createElement("canvas");
    sprayCanvas.className = "site-fx__storm-spray";
    sprayCanvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(sprayCanvas);

    const haze = document.createElement("div");
    haze.className = "site-fx__storm-haze";
    haze.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(haze);

    const scx = sheetCanvas.getContext("2d", { alpha: true, desynchronized: true });
    const spx = sprayCanvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!scx || !spx) {
      sheetCanvas.remove();
      sprayCanvas.remove();
      haze.remove();
      return null;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let intensity = 0;
    let enabled = true;
    let wind = 0.4;
    /** @type {Array<{x:number,y:number,ww:number,hh:number,spd:number,a:number,drift:number,phase:number}>} */
    const curtains = [];
    /** @type {Array<{x:number,y:number,vx:number,vy:number,r:number,a:number,life:number,age:number}>} */
    const sprays = [];
    /** @type {Array<{x:number,y:number,vx:number,vy:number,len:number,a:number,w:number}>} */
    const needles = [];
    let gust = 0;
    let gustTimer = 0.6;
    let flashBoost = 0;
    let mistPulse = 0;

    const rebuildCurtains = () => {
      const n = Math.max(8, Math.round((18 + (w / 120)) * RAIN_DENSITY));
      while (curtains.length < n) {
        curtains.push({
          x: Math.random() * w,
          y: -h * rand(0.05, 0.25),
          ww: rand(w * 0.04, w * 0.1),
          hh: rand(h * 0.45, h * 0.85),
          spd: rand(28, 72),
          a: rand(0.02, 0.06),
          drift: rand(0.3, 1.1),
          phase: Math.random() * Math.PI * 2,
        });
      }
      if (curtains.length > n) curtains.length = n;
    };

    const rebuildNeedles = () => {
      const n = Math.max(280, Math.round(((w * h) / 1200) * RAIN_DENSITY));
      while (needles.length < n) {
        needles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: rand(-20, 20),
          vy: rand(520, 980),
          len: rand(h * 0.018, h * 0.055),
          a: rand(0.08, 0.28),
          w: rand(0.8, 1.6),
        });
      }
      if (needles.length > n) needles.length = n;
    };

    const fit = (cssW, cssH) => {
      w = Math.max(1, cssW | 0);
      h = Math.max(1, cssH | 0);
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (sheetCanvas.width !== cw || sheetCanvas.height !== ch) {
        sheetCanvas.width = cw;
        sheetCanvas.height = ch;
      }
      if (sprayCanvas.width !== cw || sprayCanvas.height !== ch) {
        sprayCanvas.width = cw;
        sprayCanvas.height = ch;
      }
      scx.setTransform(dpr, 0, 0, dpr, 0, 0);
      spx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildCurtains();
      rebuildNeedles();
    };

    const spawnSprayBurst = (x, y, mul = 1) => {
      const n = Math.round((8 + Math.random() * 14) * mul);
      for (let i = 0; i < n; i += 1) {
        if (sprays.length > 900) break;
        const ang = -Math.PI * 0.5 + rand(-1.1, 1.1);
        const spd = rand(40, 160) * mul;
        sprays.push({
          x: x + rand(-18, 18),
          y: y + rand(-4, 6),
          vx: Math.cos(ang) * spd + wind * 40,
          vy: Math.sin(ang) * spd,
          r: rand(0.8, 2.8) * mul,
          a: rand(0.08, 0.28),
          life: rand(0.28, 0.7),
          age: 0,
        });
      }
    };

    const paintSheets = (dt, aMul) => {
      scx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;

      const flash = flashBoost;
      const gustA = 1 + gust * 0.35;

      /* 远景雨幕：仅保留细针雨丝，取消大光带/椭圆（易呈两侧白团） */

      /* 中景细针雨幕：密而偏暗，闪电时发亮 */
      scx.lineCap = "round";
      for (let i = 0; i < needles.length; i += 1) {
        const d = needles[i];
        d.vy = 520 + (d.len / h) * 600;
        d.y += d.vy * (1 + gust * 0.45) * dt;
        d.x += (wind * 90 + d.vx + gust * wind * 40) * dt;
        if (d.y > h + d.len) {
          d.y = -d.len - Math.random() * 40;
          d.x = Math.random() * w;
        } else if (d.x > w + 20) d.x = -10;
        else if (d.x < -20) d.x = w + 10;
        const tilt = wind * 14 + gust * wind * 8;
        const a = d.a * aMul * (0.75 + flash * 1.4) * gustA;
        scx.strokeStyle = `rgba(${flash > 0.15 ? "230,240,255" : "185,205,230"},${a})`;
        scx.lineWidth = d.w;
        scx.beginPath();
        scx.moveTo(d.x, d.y);
        scx.lineTo(d.x + tilt, d.y + d.len);
        scx.stroke();
      }
    };

    const paintSpray = (dt, aMul) => {
      spx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;

      mistPulse += dt;
      /* 底部水汽带 */
      const bandH = Math.min(h * 0.28, 220);
      const g = spx.createLinearGradient(0, h - bandH, 0, h);
      const ba = (0.1 + 0.08 * Math.sin(mistPulse * 0.9) + gust * 0.06 + flashBoost * 0.12) * aMul;
      g.addColorStop(0, "rgba(150,175,210,0)");
      g.addColorStop(0.45, `rgba(160,185,220,${ba * 0.45})`);
      g.addColorStop(1, `rgba(130,160,200,${ba})`);
      spx.fillStyle = g;
      spx.fillRect(0, h - bandH, w, bandH);

      /* 仅底部溅雾，禁止在中上部生成白圆斑 */
      if (Math.random() < 0.45 * aMul * (1 + gust * 0.5)) {
        spawnSprayBurst(rand(0, w), h - rand(2, 24), 0.55 + gust * 0.35);
      }

      for (let i = sprays.length - 1; i >= 0; i -= 1) {
        const s = sprays[i];
        s.age += dt;
        const p = 1 - s.age / s.life;
        if (p <= 0) {
          sprays.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 180 * dt;
        s.vx *= Math.exp(-dt * 1.2);
        const rad = s.r * (0.6 + p * 0.7);
        const alpha = s.a * p * aMul * (1 + flashBoost * 0.5);
        const rg = spx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
        rg.addColorStop(0, `rgba(235,245,255,${alpha})`);
        rg.addColorStop(0.45, `rgba(190,215,240,${alpha * 0.35})`);
        rg.addColorStop(1, "rgba(160,190,220,0)");
        spx.fillStyle = rg;
        spx.beginPath();
        spx.arc(s.x, s.y, rad, 0, Math.PI * 2);
        spx.fill();
      }
    };

    const stepGust = (dt) => {
      gustTimer -= dt;
      if (gustTimer <= 0) {
        gustTimer = rand(1.2, 3.8);
        gust = rand(0.55, 1.35);
      }
      gust *= Math.exp(-dt * 1.15);
      if (gust < 0.04) gust = 0;

      const flash = typeof window.__kayaStormFlash === "number"
        ? window.__kayaStormFlash
        : 0;
      flashBoost += (clamp(flash, 0, 1) - flashBoost) * Math.min(1, dt * 14);
      flashBoost *= Math.exp(-dt * 3.2);

      haze.style.opacity = String(clamp(
        intensity * (0.12 + gust * 0.08 + flashBoost * 0.18),
        0,
        0.32,
      ));
      haze.style.setProperty("--storm-gust-x", `${wind * 12 + gust * wind * 18}px`);
    };

    return {
      resize: fit,
      setIntensity(v) {
        intensity = clamp(v, 0, 1);
        const on = enabled && intensity > 0.04;
        sheetCanvas.classList.toggle("is-on", on);
        sprayCanvas.classList.toggle("is-on", on);
        haze.classList.toggle("is-on", on);
      },
      setWind(v) { wind = v; },
      setEnabled(on) {
        enabled = !!on;
        this.setIntensity(intensity);
      },
      draw(dt) {
        if (!enabled || intensity < 0.01 || w < 2) {
          scx.clearRect(0, 0, w, h);
          spx.clearRect(0, 0, w, h);
          return;
        }
        const t = clamp(dt || 0.016, 0.004, 0.05);
        stepGust(t);
        paintSheets(t, intensity);
        paintSpray(t, intensity);
      },
      /** 卡片顶缘额外溅雾 */
      hit(x, y, mul = 1) {
        if (!enabled || intensity < 0.08) return;
        spawnSprayBurst(x, y, mul);
      },
      clear() {
        sprays.length = 0;
        scx.clearRect(0, 0, w, h);
        spx.clearRect(0, 0, w, h);
      },
      destroy() {
        sheetCanvas.remove();
        sprayCanvas.remove();
        haze.remove();
      },
      get gust() { return gust; },
      get flashBoost() { return flashBoost; },
    };
  }

  window.KayaStormAtmosphere = { attach };
})();
