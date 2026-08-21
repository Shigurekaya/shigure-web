/**
 * 时雨榧 · 雷暴闪电层
 *
 * 借鉴（MIT / 常见公开算法，非整库嵌入）：
 * - 垂直中点位移分叉：diwsi、shadcn Lightning Background、Cod Chill Thunder Breathing
 * - 环境闪光衰减：@vgerbot/weather-canvas LightningElement
 * - 先闪后雷距离延迟：panmona/stormsimulator
 *
 * 仅 `?rain=storm` / `/storm/` 挂载；默认静音，首次点击后才允许程序化雷声。
 */
(() => {
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function detectLite() {
    try {
      if (navigator.connection?.saveData) return true;
    } catch { /* ignore */ }
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    const cores = navigator.hardwareConcurrency || 8;
    return narrow || cores <= 4;
  }

  /**
   * 垂直中点位移：对线段中点沿法线偏移，递归并减半位移。
   * @returns {Array<{x0:number,y0:number,x1:number,y1:number,w:number}>}
   */
  function displaceBolt(ax, ay, bx, by, generations, maxOff, width, branchChance, out) {
    if (generations <= 0) {
      out.push({ x0: ax, y0: ay, x1: bx, y1: by, w: width });
      return;
    }

    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    /* 法线方向（垂直于主路径） */
    const nx = -dy / len;
    const ny = dx / len;
    const offset = (Math.random() * 2 - 1) * maxOff;
    const cx = mx + nx * offset;
    const cy = my + ny * offset;

    displaceBolt(ax, ay, cx, cy, generations - 1, maxOff * 0.5, width, branchChance * 0.72, out);
    displaceBolt(cx, cy, bx, by, generations - 1, maxOff * 0.5, width, branchChance * 0.72, out);

    if (generations >= 2 && Math.random() < branchChance) {
      const ang = Math.atan2(dy, dx) + rand(-1.05, 1.05);
      const bl = len * rand(0.2, 0.45);
      const ex = cx + Math.cos(ang) * bl;
      const ey = cy + Math.sin(ang) * bl;
      displaceBolt(cx, cy, ex, ey, generations - 2, maxOff * 0.42, width * 0.55, 0, out);
    }
  }

  function buildStrike(w, h, lite) {
    const x0 = rand(w * 0.1, w * 0.9);
    const y0 = rand(-h * 0.02, h * 0.06);
    const x1 = clamp(x0 + rand(-w * 0.18, w * 0.18), w * 0.04, w * 0.96);
    const y1 = rand(h * 0.45, h * (lite ? 0.82 : 0.94));
    const gens = lite ? 5 : 6;
    const maxOff = Math.max(22, Math.min(w, h) * (lite ? 0.07 : 0.1));
    /** @type {Array<{x0:number,y0:number,x1:number,y1:number,w:number}>} */
    const segs = [];
    displaceBolt(x0, y0, x1, y1, gens, maxOff, lite ? 1.55 : 2.15, lite ? 0.26 : 0.34, segs);

    /* 伴生弱枝（Cod Chill companion bolts） */
    if (!lite && Math.random() < 0.55) {
      const sx = x0 + rand(-36, 36);
      const sy = y0 + rand(0, 24);
      const ex = clamp(x1 + rand(-70, 70), 0, w);
      const ey = y1 * rand(0.5, 0.78);
      displaceBolt(sx, sy, ex, ey, gens - 2, maxOff * 0.55, 1.15, 0.18, segs);
    }

    return {
      segs,
      flashX: (x0 + x1) * 0.5,
      flashY: Math.min(y0, y1) + Math.abs(y1 - y0) * 0.28,
    };
  }

  /**
   * @param {HTMLElement} host
   * @param {{ lite?: boolean }} [opts]
   */
  function attach(host, opts = {}) {
    if (!host) return null;
    const lite = opts.lite ?? detectLite();

    const canvas = document.createElement("canvas");
    canvas.className = "site-fx__lightning";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const flash = document.createElement("div");
    flash.className = "site-fx__thunder-flash";
    flash.setAttribute("aria-hidden", "true");
    host.appendChild(flash);

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      canvas.remove();
      flash.remove();
      return null;
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let running = false;
    let raf = 0;
    let strikeTimer = 0;
    let audioOk = false;
    let audioCtx = null;
    /** @type {Array<{segs: ReturnType<typeof buildStrike>["segs"], age: number, life: number, flashX: number, flashY: number}>} */
    const bolts = [];
    let ambient = 0;
    let last = performance.now();

    const fit = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.15 : 1.5);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const unlockAudio = () => {
      audioOk = true;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") void audioCtx.resume();
      } catch { /* ignore */ }
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    const playThunder = (distance) => {
      if (!audioOk || lite) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") void audioCtx.resume();
        const delay = rand(0.22, 0.4) + distance * 0.00115;
        const t0 = audioCtx.currentTime + delay;
        const dur = rand(0.95, 1.85);
        const bufLen = Math.floor(audioCtx.sampleRate * dur);
        const buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        let n = 0;
        for (let i = 0; i < bufLen; i += 1) {
          const env = Math.exp(-i / (audioCtx.sampleRate * 0.38))
            * (0.5 + 0.5 * Math.exp(-i / (audioCtx.sampleRate * 0.07)));
          n = n * 0.97 + (Math.random() * 2 - 1) * 0.32;
          data[i] = n * env * 0.2;
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = rand(160, 380);
        const gain = audioCtx.createGain();
        gain.gain.value = clamp(0.26 - distance * 0.00007, 0.05, 0.26);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        src.start(t0);
        src.stop(t0 + dur + 0.05);
      } catch { /* ignore */ }
    };

    const drawBolt = (b, alpha) => {
      if (!b?.segs?.length || alpha <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.strokeStyle = `rgba(150, 185, 255,${0.2 * alpha})`;
      ctx.shadowColor = "rgba(130, 165, 255, 0.9)";
      ctx.shadowBlur = lite ? 12 : 20;
      for (let i = 0; i < b.segs.length; i += 1) {
        const s = b.segs[i];
        ctx.lineWidth = s.w * 4;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }

      ctx.shadowBlur = lite ? 5 : 9;
      ctx.strokeStyle = `rgba(240, 248, 255,${0.95 * alpha})`;
      for (let i = 0; i < b.segs.length; i += 1) {
        const s = b.segs[i];
        ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }
      ctx.restore();
    };

    const pushBolt = (built, lifeScale) => {
      bolts.push({
        segs: built.segs,
        flashX: built.flashX,
        flashY: built.flashY,
        age: 0,
        life: (lite ? rand(0.16, 0.28) : rand(0.2, 0.42)) * lifeScale,
      });
    };

    const strike = () => {
      if (!running || document.hidden) {
        scheduleNext();
        return;
      }

      const main = buildStrike(w, h, lite);
      pushBolt(main, 1);
      ambient = Math.max(ambient, lite ? rand(0.32, 0.5) : rand(0.5, 0.82));
      flash.style.setProperty("--flash-x", `${(main.flashX / Math.max(w, 1)) * 100}%`);
      flash.style.setProperty("--flash-y", `${(main.flashY / Math.max(h, 1)) * 100}%`);
      flash.classList.add("is-on");
      flash.style.opacity = String(ambient);

      /* 双闪 / 三闪 burst（近距更常见） */
      const bursts = lite ? (Math.random() < 0.25 ? 1 : 0) : (Math.random() < 0.55 ? 1 + ((Math.random() < 0.35) | 0) : 0);
      for (let i = 0; i < bursts; i += 1) {
        window.setTimeout(() => {
          if (!running) return;
          const sub = buildStrike(w, h, lite);
          pushBolt(sub, 0.75);
          ambient = Math.max(ambient, rand(0.35, 0.62));
          flash.style.opacity = String(ambient);
          flash.classList.remove("is-on");
          void flash.offsetWidth;
          flash.classList.add("is-on");
        }, 45 + i * rand(50, 95));
      }

      playThunder(Math.hypot(main.flashX - w * 0.5, main.flashY - h * 0.15));
      scheduleNext();
    };

    const scheduleNext = () => {
      window.clearTimeout(strikeTimer);
      if (!running) return;
      const gap = lite ? rand(4000, 8800) : rand(2000, 5800);
      strikeTimer = window.setTimeout(strike, gap);
    };

    const tick = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      /* 残影拖尾：半透明擦除（shadcn afterglow） */
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = lite ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (let i = bolts.length - 1; i >= 0; i -= 1) {
        const b = bolts[i];
        b.age += dt;
        const p = 1 - b.age / b.life;
        if (p <= 0) {
          bolts.splice(i, 1);
          continue;
        }
        const flicker = 0.72 + 0.28 * Math.sin(b.age * 78 + i);
        drawBolt(b, clamp(p * flicker, 0, 1));
      }

      if (ambient > 0.01) {
        ambient *= Math.exp(-dt * 6.8);
        flash.style.opacity = String(ambient);
      } else if (ambient !== 0) {
        ambient = 0;
        flash.style.opacity = "0";
        flash.classList.remove("is-on");
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        window.clearTimeout(strikeTimer);
        bolts.length = 0;
        ambient = 0;
        flash.style.opacity = "0";
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else if (running) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
        scheduleNext();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return {
      start() {
        if (running) return;
        running = true;
        fit();
        last = performance.now();
        raf = requestAnimationFrame(tick);
        strikeTimer = window.setTimeout(strike, rand(700, 1800));
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        raf = 0;
        window.clearTimeout(strikeTimer);
        bolts.length = 0;
        ambient = 0;
        flash.style.opacity = "0";
        flash.classList.remove("is-on");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
      resize() {
        fit();
      },
      destroy() {
        this.stop();
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pointerdown", unlockAudio);
        window.removeEventListener("keydown", unlockAudio);
        try { audioCtx?.close(); } catch { /* ignore */ }
        canvas.remove();
        flash.remove();
      },
    };
  }

  window.KayaStormLightning = { attach };
})();
