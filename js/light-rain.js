/**
 * 时雨榧 · 小雨特效
 *
 * 远/中/近景深 + 风速倾角 + 触底溅花/湿痕。
 * 观感目标：细密、透气、带紫丁香品牌冷色，像窗外细雨而非直线雨。
 */
(() => {
  const FRAME_MS = 1000 / 30;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function detectQuality() {
    try {
      if (navigator.connection?.saveData) return "low";
    } catch { /* ignore */ }
    const ua = navigator.userAgent || "";
    const phone = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)
      || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) <= 920);
    const cores = navigator.hardwareConcurrency || 8;
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (phone || narrow || cores <= 4) return "low";
    if (cores <= 6) return "mid";
    return "high";
  }

  const QUALITY = {
    low: { far: 40, mid: 52, near: 30, splashCap: 64, dprCap: 1.2, mist: 0.85 },
    mid: { far: 64, mid: 88, near: 52, splashCap: 110, dprCap: 1.4, mist: 1 },
    high: { far: 92, mid: 128, near: 72, splashCap: 150, dprCap: 1.6, mist: 1 },
  };

  function bakeSplashSprites() {
    const soft = document.createElement("canvas");
    soft.width = 28;
    soft.height = 28;
    const sx = soft.getContext("2d");
    if (sx) {
      const g = sx.createRadialGradient(14, 14, 0, 14, 14, 13);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.35, "rgba(200, 215, 245, 0.4)");
      g.addColorStop(1, "rgba(170,190,230,0)");
      sx.fillStyle = g;
      sx.beginPath();
      sx.arc(14, 14, 12, 0, Math.PI * 2);
      sx.fill();
    }
    const hard = document.createElement("canvas");
    hard.width = 10;
    hard.height = 10;
    const hx = hard.getContext("2d");
    if (hx) {
      const g = hx.createRadialGradient(4.2, 3.8, 0, 5, 5, 4.5);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.45, "rgba(190,210,240,0.55)");
      g.addColorStop(1, "rgba(170,190,230,0)");
      hx.fillStyle = g;
      hx.beginPath();
      hx.arc(5, 5, 4.2, 0, Math.PI * 2);
      hx.fill();
    }
    return { soft, hard };
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ mistHost?: HTMLElement | null }} [opts]
   */
  function attach(canvas, opts) {
    const mistHost = opts?.mistHost || canvas.parentElement;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      return { start() {}, stop() {}, resize() {}, destroy() {} };
    }

    const spr = bakeSplashSprites();
    let quality = detectQuality();
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let last = performance.now();
    let wind = 0.28;
    let windTarget = 0.28;
    let windTimer = 0;
    let wetPulse = 0;
    let groundRippleAcc = 0;

    /** @type {Array<any>} */
    const far = [];
    /** @type {Array<any>} */
    const mid = [];
    /** @type {Array<any>} */
    const near = [];
    /** @type {Array<any>} */
    const splashes = [];
    /** @type {Array<any>} */
    const ripples = [];

    let mist = null;
    if (mistHost) {
      mist = document.createElement("div");
      mist.className = "site-bg__light-mist";
      mist.setAttribute("aria-hidden", "true");
      mistHost.appendChild(mist);
    }

    const makeDrop = (layer) => {
      const spec = layer === "far"
        ? {
          len: [7, 15],
          speed: [88, 145],
          alpha: [0.05, 0.13],
          width: [0.55, 0.9],
          drift: [8, 16],
        }
        : layer === "mid"
          ? {
            len: [11, 22],
            speed: [125, 205],
            alpha: [0.1, 0.24],
            width: [0.75, 1.15],
            drift: [12, 22],
          }
          : {
            len: [15, 30],
            speed: [165, 275],
            alpha: [0.18, 0.38],
            width: [0.95, 1.55],
            drift: [14, 26],
          };
      const roll = Math.random();
      return {
        x: Math.random() * Math.max(1, w),
        y: Math.random() * Math.max(1, h),
        len: rand(spec.len[0], spec.len[1]),
        speed: rand(spec.speed[0], spec.speed[1]),
        alpha: rand(spec.alpha[0], spec.alpha[1]),
        width: rand(spec.width[0], spec.width[1]),
        drift: rand(spec.drift[0], spec.drift[1]),
        /* lilac / cool / silver — 细雨色相层次 */
        hue: roll < 0.38 ? "lilac" : (roll < 0.72 ? "mist" : "silver"),
        wobble: rand(0, Math.PI * 2),
        phase: Math.random(),
      };
    };

    const rebuild = () => {
      if (w < 2 || h < 2) return;
      const q = QUALITY[quality];
      const areaScale = clamp((w * h) / (1280 * 720), 0.65, 1.4);

      const fill = (arr, n, layer) => {
        const count = Math.max(8, Math.round(n * areaScale));
        while (arr.length < count) arr.push(makeDrop(layer));
        if (arr.length > count) arr.length = count;
        for (let i = 0; i < arr.length; i += 1) {
          if (arr[i].x > w) arr[i].x = Math.random() * w;
          if (arr[i].y > h) arr[i].y = Math.random() * h;
        }
      };

      fill(far, q.far, "far");
      fill(mid, q.mid, "mid");
      fill(near, q.near, "near");
      splashes.length = 0;
      ripples.length = 0;
    };

    const fit = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      quality = detectQuality();
      dpr = Math.min(window.devicePixelRatio || 1, QUALITY[quality].dprCap);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      rebuild();
    };

    const spawnSplash = (x, y) => {
      const cap = QUALITY[quality].splashCap;
      if (splashes.length >= cap) return;
      /* 中心柔晕 */
      if (splashes.length < cap) {
        splashes.push({
          x, y,
          vx: rand(-6, 6),
          vy: rand(-18, -6),
          life: rand(0.16, 0.28),
          age: 0,
          r: rand(2.2, 3.8),
          a: rand(0.22, 0.38),
          soft: true,
        });
      }
      const n = 3 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i += 1) {
        if (splashes.length >= cap) break;
        const ang = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
        const spd = rand(28, 95);
        splashes.push({
          x: x + rand(-2, 2),
          y: y + rand(-1, 1),
          vx: Math.cos(ang) * spd + wind * 8,
          vy: Math.sin(ang) * spd,
          life: rand(0.2, 0.42),
          age: 0,
          r: rand(0.55, 1.45),
          a: rand(0.32, 0.58),
          soft: false,
        });
      }
      if (ripples.length < 28 && Math.random() < 0.55) {
        ripples.push({
          x: clamp(x, 8, w - 8),
          y: h - rand(1, 6),
          life: rand(0.35, 0.7),
          age: 0,
          r0: rand(2, 5),
          a: rand(0.12, 0.26),
        });
      }
    };

    const strokeDrop = (d) => {
      d.wobble += 0.015;
      const sway = Math.sin(d.wobble + d.phase * 6) * (d.drift * 0.04);
      const tilt = wind * d.drift * 0.12 + d.drift * 0.03 + sway;
      const x2 = d.x + tilt;
      const y2 = d.y + d.len;
      const g = ctx.createLinearGradient(d.x, d.y, x2, y2);
      if (d.hue === "lilac") {
        g.addColorStop(0, "rgba(139,111,212,0)");
        g.addColorStop(0.22, `rgba(139,111,212,${d.alpha * 0.35})`);
        g.addColorStop(0.55, `rgba(174,160,230,${d.alpha * 0.95})`);
        g.addColorStop(0.82, `rgba(200,210,240,${d.alpha})`);
        g.addColorStop(1, "rgba(220,230,250,0)");
      } else if (d.hue === "silver") {
        g.addColorStop(0, "rgba(230,238,255,0)");
        g.addColorStop(0.25, `rgba(220,230,250,${d.alpha * 0.45})`);
        g.addColorStop(0.6, `rgba(210,222,245,${d.alpha})`);
        g.addColorStop(1, "rgba(190,205,230,0)");
      } else {
        g.addColorStop(0, "rgba(174,194,224,0)");
        g.addColorStop(0.3, `rgba(174,194,224,${d.alpha * 0.55})`);
        g.addColorStop(0.7, `rgba(200,214,240,${d.alpha})`);
        g.addColorStop(1, "rgba(174,194,224,0)");
      }
      ctx.strokeStyle = g;
      ctx.lineWidth = d.width;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      /* 近景雨丝头部微光点，增加真实感 */
      if (d.alpha > 0.22 && d.width > 1.05) {
        ctx.fillStyle = `rgba(235,245,255,${d.alpha * 0.55})`;
        ctx.beginPath();
        ctx.arc(d.x + tilt * 0.12, d.y + d.len * 0.08, d.width * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const stepDrop = (d, dt, splashChance) => {
      d.y += d.speed * dt;
      d.x += (wind * 24 + d.drift * 0.4) * dt;
      if (d.y > h + d.len) {
        if (Math.random() < splashChance) {
          spawnSplash(clamp(d.x + wind * d.drift * 0.05, 0, w), h - rand(0, 5));
        }
        d.y = -d.len - Math.random() * 50;
        d.x = Math.random() * w;
        d.phase = Math.random();
      } else if (d.x > w + 28) {
        d.x = -14;
      } else if (d.x < -28) {
        d.x = w + 14;
      }
    };

    const drawGroundWet = () => {
      wetPulse += 0.02;
      const pulse = 0.55 + 0.45 * Math.sin(wetPulse);
      const band = Math.min(48, h * 0.07);
      const g = ctx.createLinearGradient(0, h - band, 0, h);
      g.addColorStop(0, "rgba(160,185,220,0)");
      g.addColorStop(0.55, `rgba(170,195,230,${0.045 * pulse})`);
      g.addColorStop(1, `rgba(139,111,212,${0.06 * pulse})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, h - band, w, band);
    };

    const tick = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < FRAME_MS) return;
      const dt = Math.min(0.05, elapsed / 1000);
      last = now;

      windTimer -= dt;
      if (windTimer <= 0) {
        windTimer = rand(2.4, 5.2);
        const mag = rand(0.1, 0.78);
        windTarget = (Math.random() < 0.28 ? -1 : 1) * mag;
      }
      wind += (windTarget - wind) * Math.min(1, dt * 0.6);

      ctx.clearRect(0, 0, w, h);
      drawGroundWet();

      for (let i = 0; i < far.length; i += 1) {
        strokeDrop(far[i]);
        stepDrop(far[i], dt, 0.22);
      }
      for (let i = 0; i < mid.length; i += 1) {
        strokeDrop(mid[i]);
        stepDrop(mid[i], dt, 0.4);
      }
      for (let i = 0; i < near.length; i += 1) {
        strokeDrop(near[i]);
        stepDrop(near[i], dt, 0.62);
      }

      /* 偶发地面涟漪 */
      groundRippleAcc += dt;
      if (groundRippleAcc > 0.35 && ripples.length < 20) {
        groundRippleAcc = 0;
        if (Math.random() < 0.55) {
          ripples.push({
            x: rand(10, w - 10),
            y: h - rand(2, 8),
            life: rand(0.4, 0.75),
            age: 0,
            r0: rand(3, 7),
            a: rand(0.1, 0.2),
          });
        }
      }

      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const r = ripples[i];
        r.age += dt;
        const p = 1 - r.age / r.life;
        if (p <= 0) {
          ripples.splice(i, 1);
          continue;
        }
        const rad = r.r0 + (1 - p) * 14;
        ctx.strokeStyle = `rgba(190,210,240,${r.a * p})`;
        ctx.lineWidth = 0.8 + p * 0.6;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rad, rad * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        const s = splashes[i];
        s.age += dt;
        const p = 1 - s.age / s.life;
        if (p <= 0) {
          splashes.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 460 * dt;
        const rad = s.r * (0.65 + p * 0.5);
        const alpha = s.a * p;
        if (s.soft && spr.soft) {
          const dw = rad * 3.2;
          ctx.globalAlpha = alpha;
          ctx.drawImage(spr.soft, s.x - dw * 0.5, s.y - dw * 0.5, dw, dw);
          ctx.globalAlpha = 1;
        } else if (spr.hard) {
          const dw = rad * 2.4;
          ctx.globalAlpha = alpha;
          ctx.drawImage(spr.hard, s.x - dw * 0.5, s.y - dw * 0.5, dw, dw);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(190,210,240,${alpha})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    return {
      start() {
        if (running) return;
        running = true;
        fit();
        last = performance.now();
        raf = requestAnimationFrame(tick);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        ctx.clearRect(0, 0, w, h);
        splashes.length = 0;
        ripples.length = 0;
      },
      resize: fit,
      destroy() {
        this.stop();
        mist?.remove();
      },
    };
  }

  window.KayaLightRain = { attach };
})();
