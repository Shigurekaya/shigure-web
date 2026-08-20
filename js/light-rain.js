/**
 * 时雨榧 · 小雨特效
 *
 * 技术来源（组合，非整库嵌入）：
 * - @vgerbot/weather-canvas RainElement（MIT）：风速连动倾角、触底溅花粒子池
 * - Codrops RainEffect 思路：远/中/近分层深度
 * - 本站：透明叠加 + 紫丁香品牌色，不覆盖 site-bg
 *
 * 暴雨仍由 raindrop-fx 负责；本模块只服务轻量 ambient。
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
    const cores = navigator.hardwareConcurrency || 8;
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    if (narrow || cores <= 4) return "low";
    if (cores <= 6) return "mid";
    return "high";
  }

  const QUALITY = {
    low: { far: 28, mid: 36, near: 22, splashCap: 40, dprCap: 1.15 },
    mid: { far: 42, mid: 55, near: 34, splashCap: 64, dprCap: 1.35 },
    high: { far: 56, mid: 72, near: 44, splashCap: 90, dprCap: 1.5 },
  };

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

    let quality = detectQuality();
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let last = performance.now();
    let wind = 0.35;
    let windTarget = 0.35;
    let windTimer = 0;

    /** @type {Array<any>} */
    const far = [];
    /** @type {Array<any>} */
    const mid = [];
    /** @type {Array<any>} */
    const near = [];
    /** @type {Array<any>} */
    const splashes = [];

    let mist = null;
    if (mistHost) {
      mist = document.createElement("div");
      mist.className = "site-bg__light-mist";
      mist.setAttribute("aria-hidden", "true");
      mistHost.appendChild(mist);
    }

    const makeDrop = (layer) => {
      /* weather-canvas：length / speed 区间；分层加深近景 */
      const spec = layer === "far"
        ? {
          len: [8, 16],
          speed: [95, 150],
          alpha: [0.06, 0.14],
          width: [0.7, 1],
          drift: [10, 18],
        }
        : layer === "mid"
          ? {
            len: [12, 24],
            speed: [130, 210],
            alpha: [0.1, 0.22],
            width: [0.85, 1.2],
            drift: [14, 24],
          }
          : {
            len: [16, 32],
            speed: [170, 280],
            alpha: [0.16, 0.32],
            width: [1, 1.45],
            drift: [16, 28],
          };
      return {
        x: Math.random() * Math.max(1, w),
        y: Math.random() * Math.max(1, h),
        len: rand(spec.len[0], spec.len[1]),
        speed: rand(spec.speed[0], spec.speed[1]),
        alpha: rand(spec.alpha[0], spec.alpha[1]),
        width: rand(spec.width[0], spec.width[1]),
        drift: rand(spec.drift[0], spec.drift[1]),
        hue: Math.random() < 0.55 ? "lilac" : "mist",
      };
    };

    const rebuild = () => {
      if (w < 2 || h < 2) return;
      const q = QUALITY[quality];
      const areaScale = clamp((w * h) / (1280 * 720), 0.65, 1.35);

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
      /* weather-canvas createSplash：2–4 颗、上抛再落 */
      const n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i += 1) {
        if (splashes.length >= cap) break;
        splashes.push({
          x,
          y,
          vx: rand(-28, 28),
          vy: rand(-90, -150),
          life: rand(0.22, 0.38),
          age: 0,
          r: rand(0.7, 1.5),
          a: rand(0.28, 0.5),
        });
      }
    };

    const strokeDrop = (d) => {
      /* 风速连动倾角（weather-canvas: x + wind*2） */
      const tilt = wind * d.drift * 0.12 + d.drift * 0.035;
      const x2 = d.x + tilt;
      const y2 = d.y + d.len;
      const g = ctx.createLinearGradient(d.x, d.y, x2, y2);
      if (d.hue === "lilac") {
        g.addColorStop(0, `rgba(139,111,212,0)`);
        g.addColorStop(0.35, `rgba(139,111,212,${d.alpha * 0.55})`);
        g.addColorStop(0.7, `rgba(174,160,230,${d.alpha})`);
        g.addColorStop(1, `rgba(174,194,224,0)`);
      } else {
        g.addColorStop(0, `rgba(174,194,224,0)`);
        g.addColorStop(0.4, `rgba(174,194,224,${d.alpha * 0.7})`);
        g.addColorStop(0.75, `rgba(200,210,235,${d.alpha})`);
        g.addColorStop(1, `rgba(174,194,224,0)`);
      }
      ctx.strokeStyle = g;
      ctx.lineWidth = d.width;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const stepDrop = (d, dt) => {
      d.y += d.speed * dt;
      d.x += (wind * 22 + d.drift * 0.35) * dt;
      if (d.y > h + d.len) {
        /* 触底溅花：贴屏底，轻微横向随机 */
        if (Math.random() < 0.45) {
          spawnSplash(clamp(d.x, 0, w), h - rand(0, 4));
        }
        d.y = -d.len - Math.random() * 40;
        d.x = Math.random() * w;
      } else if (d.x > w + 24) {
        d.x = -12;
      } else if (d.x < -24) {
        d.x = w + 12;
      }
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
        windTimer = rand(2.8, 5.5);
        windTarget = rand(0.12, 0.85);
      }
      wind += (windTarget - wind) * Math.min(1, dt * 0.55);

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < far.length; i += 1) {
        const d = far[i];
        strokeDrop(d);
        stepDrop(d, dt);
      }
      for (let i = 0; i < mid.length; i += 1) {
        const d = mid[i];
        strokeDrop(d);
        stepDrop(d, dt);
      }
      for (let i = 0; i < near.length; i += 1) {
        const d = near[i];
        strokeDrop(d);
        stepDrop(d, dt);
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
        s.vy += 420 * dt;
        ctx.fillStyle = `rgba(174,194,224,${s.a * p})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * (0.7 + p * 0.4), 0, Math.PI * 2);
        ctx.fill();
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
