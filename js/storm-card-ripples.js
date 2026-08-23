/**
 * 时雨榧 · 卡片表面实时涟漪
 * 在卡片矩形内裁剪绘制同心涟漪，雨点溅落时触发。
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

    const canvas = document.createElement("canvas");
    canvas.className = "site-fx__storm-card-ripples";
    canvas.setAttribute("aria-hidden", "true");
    fxRoot.appendChild(canvas);

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) {
      canvas.remove();
      return null;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let intensity = 0;
    let enabled = true;
    let wind = 0;
    let flashBoost = 0;
    let time = 0;
    /** @type {Array<{x:number,y:number,w:number,h:number,radius:number,shape:string}>} */
    let ledges = [];
    /** @type {Array<{x:number,y:number,r:number,maxR:number,age:number,life:number,w:number,ledge:number}>} */
    const ripples = [];

    const fit = (cssW, cssH) => {
      w = Math.max(1, cssW | 0);
      h = Math.max(1, cssH | 0);
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const roundedRectPath = (cx, x, y, rw, rh, rad) => {
      const r = Math.min(rad, rw * 0.5, rh * 0.5);
      cx.beginPath();
      cx.moveTo(x + r, y);
      cx.lineTo(x + rw - r, y);
      cx.quadraticCurveTo(x + rw, y, x + rw, y + r);
      cx.lineTo(x + rw, y + rh - r);
      cx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
      cx.lineTo(x + r, y + rh);
      cx.quadraticCurveTo(x, y + rh, x, y + rh - r);
      cx.lineTo(x, y + r);
      cx.quadraticCurveTo(x, y, x + r, y);
      cx.closePath();
    };

    const findLedge = (x, y) => {
      for (let i = 0; i < ledges.length; i += 1) {
        const L = ledges[i];
        if (L.shape === "circle") continue;
        if (x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + L.h) return i;
      }
      return -1;
    };

    const spawnOnLedge = (li, x, y, mul = 1) => {
      if (li < 0 || li >= ledges.length) return;
      const L = ledges[li];
      if (L.shape === "circle") return;
      if (ripples.length > 480) return;
      const px = clamp(x, L.x + 4, L.x + L.w - 4);
      const py = clamp(y, L.y + 4, L.y + L.h - 4);
      ripples.push({
        x: px,
        y: py,
        r: rand(1.5, 4),
        maxR: rand(14, 38) * mul,
        age: 0,
        life: rand(0.45, 1.05),
        w: rand(0.7, 1.6),
        ledge: li,
      });
    };

    const spawnRandom = () => {
      const rects = ledges.filter((L) => L.shape !== "circle");
      if (!rects.length) return;
      const L = rects[(Math.random() * rects.length) | 0];
      const li = ledges.indexOf(L);
      spawnOnLedge(li, L.x + rand(L.w * 0.08, L.w * 0.92), L.y + rand(L.h * 0.12, L.h * 0.88), 0.85);
    };

    const paint = (dt, aMul) => {
      ctx.clearRect(0, 0, w, h);
      if (aMul < 0.02) return;

      const flash = flashBoost;
      ctx.lineCap = "round";

      for (let li = 0; li < ledges.length; li += 1) {
        const L = ledges[li];
        if (L.shape === "circle") continue;

        ctx.save();
        roundedRectPath(ctx, L.x, L.y, L.w, L.h, L.radius || 14);
        ctx.clip();

        for (let i = ripples.length - 1; i >= 0; i -= 1) {
          const r = ripples[i];
          if (r.ledge !== li) continue;
          r.age += dt;
          const p = 1 - r.age / r.life;
          if (p <= 0) {
            ripples.splice(i, 1);
            continue;
          }
          r.r += (r.maxR - r.r) * Math.min(1, dt * 3.8);
          const alpha = 0.42 * p * aMul * (0.55 + flash * 0.65);
          ctx.strokeStyle = `rgba(175,210,245,${alpha})`;
          ctx.lineWidth = r.w * (0.55 + p * 0.45);
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
          ctx.stroke();
          if (p > 0.3) {
            ctx.strokeStyle = `rgba(140,175,215,${alpha * 0.4})`;
            ctx.lineWidth = r.w * 0.5;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.r * 0.58, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        const wet = 0.06 + Math.sin(time * 2.2 + li) * 0.02;
        const wg = ctx.createLinearGradient(L.x, L.y, L.x, L.y + L.h);
        wg.addColorStop(0, `rgba(190,215,245,${wet * aMul})`);
        wg.addColorStop(0.35, `rgba(160,190,225,${wet * 0.35 * aMul})`);
        wg.addColorStop(1, "rgba(140,170,210,0)");
        ctx.fillStyle = wg;
        ctx.fillRect(L.x, L.y, L.w, L.h);

        ctx.restore();
      }
    };

    return {
      resize: fit,
      setIntensity(v) {
        intensity = clamp(v, 0, 1);
        canvas.classList.toggle("is-on", enabled && intensity > 0.04);
      },
      setWind(v) { wind = v; },
      setLedges(list) { ledges = list || []; },
      setEnabled(on) {
        enabled = !!on;
        canvas.classList.toggle("is-on", enabled && intensity > 0.04);
      },
      draw(dt) {
        if (!enabled || intensity < 0.01 || w < 2) {
          ctx.clearRect(0, 0, w, h);
          return;
        }
        const t = clamp(dt || 0.016, 0.004, 0.05);
        time += t;
        const flash = typeof window.__kayaStormFlash === "number"
          ? window.__kayaStormFlash
          : 0;
        flashBoost += (clamp(flash, 0, 1) - flashBoost) * Math.min(1, t * 14);
        flashBoost *= Math.exp(-t * 3.2);

        if (Math.random() < 0.38 * intensity) spawnRandom();
        if (Math.random() < 0.12 * intensity * (1 + Math.abs(wind) * 0.3)) spawnRandom();

        paint(t, intensity);
      },
      hit(x, y, mul = 1) {
        if (!enabled || intensity < 0.06) return;
        const li = findLedge(x, y);
        if (li >= 0) {
          const n = Math.round(2 + mul * 4);
          for (let i = 0; i < n; i += 1) {
            spawnOnLedge(li, x + rand(-10, 10), y + rand(-8, 8), mul);
          }
          return;
        }
        for (let i = 0; i < ledges.length; i += 1) {
          const L = ledges[i];
          if (L.shape === "circle") continue;
          if (Math.abs(x - (L.x + L.w * 0.5)) < L.w * 0.55 && Math.abs(y - L.y) < 28) {
            spawnOnLedge(i, x, L.y + rand(4, L.h * 0.4), mul);
          }
        }
      },
      clear() {
        ripples.length = 0;
        ctx.clearRect(0, 0, w, h);
      },
      destroy() {
        canvas.remove();
      },
    };
  }

  window.KayaStormCardRipples = { attach };
})();
