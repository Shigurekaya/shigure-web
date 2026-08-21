/**
 * 时雨榧 · 雷暴闪电层（效果优先，全开）
 *
 * 借鉴：垂直中点位移分叉、环境闪光、先闪后雷距离延迟。
 * 仅 `?rain=storm` / `/storm/` 挂载。
 */
(() => {
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

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
    const nx = -dy / len;
    const ny = dx / len;
    const offset = (Math.random() * 2 - 1) * maxOff;
    const cx = mx + nx * offset;
    const cy = my + ny * offset;

    displaceBolt(ax, ay, cx, cy, generations - 1, maxOff * 0.5, width, branchChance * 0.78, out);
    displaceBolt(cx, cy, bx, by, generations - 1, maxOff * 0.5, width, branchChance * 0.78, out);

    if (generations >= 2 && Math.random() < branchChance) {
      const ang = Math.atan2(dy, dx) + rand(-1.2, 1.2);
      const bl = len * rand(0.22, 0.55);
      const ex = cx + Math.cos(ang) * bl;
      const ey = cy + Math.sin(ang) * bl;
      displaceBolt(cx, cy, ex, ey, generations - 2, maxOff * 0.45, width * 0.55, branchChance * 0.35, out);
    }
  }

  function buildStrike(w, h) {
    const x0 = rand(w * 0.06, w * 0.94);
    const y0 = rand(-h * 0.06, h * 0.1);
    const x1 = clamp(x0 + rand(-w * 0.28, w * 0.28), w * 0.02, w * 0.98);
    const y1 = rand(h * 0.38, h * 0.98);
    const gens = 8;
    const maxOff = Math.max(36, Math.min(w, h) * 0.14);
    /** @type {Array<{x0:number,y0:number,x1:number,y1:number,w:number}>} */
    const segs = [];
    displaceBolt(x0, y0, x1, y1, gens, maxOff, 2.8, 0.48, segs);

    const companions = 1 + ((Math.random() * 3) | 0);
    for (let c = 0; c < companions; c += 1) {
      const sx = x0 + rand(-70, 70);
      const sy = y0 + rand(0, 40);
      const ex = clamp(x1 + rand(-120, 120), 0, w);
      const ey = y1 * rand(0.4, 0.9);
      displaceBolt(sx, sy, ex, ey, gens - 2, maxOff * 0.65, 1.5, 0.28, segs);
    }

    return {
      segs,
      flashX: (x0 + x1) * 0.5,
      flashY: Math.min(y0, y1) + Math.abs(y1 - y0) * 0.22,
    };
  }

  /**
   * @param {HTMLElement} host
   * @param {{ maxQuality?: boolean }} [opts]
   */
  function attach(host, opts = {}) {
    if (!host) return null;
    void opts;

    const canvas = document.createElement("canvas");
    canvas.className = "site-fx__lightning";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const flash = document.createElement("div");
    flash.className = "site-fx__thunder-flash";
    flash.setAttribute("aria-hidden", "true");
    host.appendChild(flash);

    const sheet = document.createElement("div");
    sheet.className = "site-fx__thunder-sheet";
    sheet.setAttribute("aria-hidden", "true");
    host.appendChild(sheet);

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      canvas.remove();
      flash.remove();
      sheet.remove();
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
    /** @type {Array<{segs: any[], age: number, life: number, flashX: number, flashY: number, bright: number}>} */
    const bolts = [];
    let ambient = 0;
    let sheetA = 0;
    let last = performance.now();
    let strikeCount = 0;

    const fit = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      window.removeEventListener("touchstart", unlockAudio);
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio, { passive: true });

    const playThunder = (distance, big) => {
      if (!audioOk) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") void audioCtx.resume();
        const delay = rand(0.12, 0.35) + distance * 0.0009;
        const t0 = audioCtx.currentTime + delay;
        const dur = big ? rand(1.4, 2.6) : rand(0.9, 1.7);
        const bufLen = Math.floor(audioCtx.sampleRate * dur);
        const buffer = audioCtx.createBuffer(1, bufLen, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        let n = 0;
        for (let i = 0; i < bufLen; i += 1) {
          const env = Math.exp(-i / (audioCtx.sampleRate * (big ? 0.55 : 0.35)))
            * (0.45 + 0.55 * Math.exp(-i / (audioCtx.sampleRate * 0.06)));
          n = n * 0.96 + (Math.random() * 2 - 1) * 0.4;
          const crack = i < audioCtx.sampleRate * 0.04 ? (Math.random() * 2 - 1) * 0.55 : 0;
          data[i] = (n * 0.75 + crack) * env * (big ? 0.32 : 0.22);
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = big ? rand(280, 520) : rand(160, 380);
        const gain = audioCtx.createGain();
        gain.gain.value = clamp((big ? 0.38 : 0.26) - distance * 0.00005, 0.08, 0.4);
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

      ctx.strokeStyle = `rgba(140, 175, 255,${0.28 * alpha * b.bright})`;
      ctx.shadowColor = "rgba(160, 195, 255, 1)";
      ctx.shadowBlur = 28;
      for (let i = 0; i < b.segs.length; i += 1) {
        const s = b.segs[i];
        ctx.lineWidth = s.w * 5.2;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }

      ctx.shadowBlur = 12;
      ctx.strokeStyle = `rgba(210, 230, 255,${0.75 * alpha})`;
      for (let i = 0; i < b.segs.length; i += 1) {
        const s = b.segs[i];
        ctx.lineWidth = s.w * 2.1;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }

      ctx.shadowBlur = 4;
      ctx.strokeStyle = `rgba(255, 255, 255,${0.98 * alpha})`;
      for (let i = 0; i < b.segs.length; i += 1) {
        const s = b.segs[i];
        ctx.lineWidth = s.w * 0.85;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }
      ctx.restore();
    };

    const pushBolt = (built, lifeScale, bright) => {
      bolts.push({
        segs: built.segs,
        flashX: built.flashX,
        flashY: built.flashY,
        age: 0,
        life: rand(0.22, 0.55) * lifeScale,
        bright: bright ?? 1,
      });
    };

    const pulseBody = (ms) => {
      document.body.classList.add("storm-flash");
      window.setTimeout(() => document.body.classList.remove("storm-flash"), ms);
    };

    const strike = (forceBig) => {
      if (!running || document.hidden) {
        scheduleNext();
        return;
      }

      strikeCount += 1;
      const big = forceBig || Math.random() < 0.38;
      const main = buildStrike(w, h);
      pushBolt(main, big ? 1.25 : 1, big ? 1.35 : 1);
      ambient = Math.max(ambient, big ? rand(0.72, 1) : rand(0.48, 0.78));
      sheetA = Math.max(sheetA, big ? rand(0.35, 0.55) : rand(0.12, 0.28));
      flash.style.setProperty("--flash-x", `${(main.flashX / Math.max(w, 1)) * 100}%`);
      flash.style.setProperty("--flash-y", `${(main.flashY / Math.max(h, 1)) * 100}%`);
      flash.classList.add("is-on");
      flash.style.opacity = String(ambient);
      sheet.style.opacity = String(sheetA);
      pulseBody(big ? 180 : 90);

      const bursts = big ? (2 + ((Math.random() * 3) | 0)) : (1 + ((Math.random() < 0.55) | 0));
      for (let i = 0; i < bursts; i += 1) {
        window.setTimeout(() => {
          if (!running) return;
          const sub = buildStrike(w, h);
          pushBolt(sub, 0.85, 1.1);
          ambient = Math.max(ambient, rand(0.4, 0.75));
          sheetA = Math.max(sheetA, rand(0.15, 0.35));
          flash.style.opacity = String(ambient);
          sheet.style.opacity = String(sheetA);
          flash.classList.remove("is-on");
          void flash.offsetWidth;
          flash.classList.add("is-on");
          pulseBody(70);
        }, 35 + i * rand(45, 110));
      }

      playThunder(Math.hypot(main.flashX - w * 0.5, main.flashY - h * 0.12), big);
      scheduleNext();
    };

    const scheduleNext = () => {
      window.clearTimeout(strikeTimer);
      if (!running) return;
      /* 高频雷击：约 0.9～3.2s */
      const gap = rand(900, 3200);
      strikeTimer = window.setTimeout(() => strike(false), gap);
    };

    const tick = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.22)";
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
        const flicker = 0.65 + 0.35 * Math.sin(b.age * 95 + i * 2.1);
        drawBolt(b, clamp(p * flicker, 0, 1));
      }

      if (ambient > 0.01) {
        ambient *= Math.exp(-dt * 5.2);
        flash.style.opacity = String(ambient);
      } else if (ambient !== 0) {
        ambient = 0;
        flash.style.opacity = "0";
        flash.classList.remove("is-on");
      }

      if (sheetA > 0.01) {
        sheetA *= Math.exp(-dt * 4.4);
        sheet.style.opacity = String(sheetA);
      } else if (sheetA !== 0) {
        sheetA = 0;
        sheet.style.opacity = "0";
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        window.clearTimeout(strikeTimer);
        bolts.length = 0;
        ambient = 0;
        sheetA = 0;
        flash.style.opacity = "0";
        sheet.style.opacity = "0";
        document.body.classList.remove("storm-flash");
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
        /* 很快首击，营造进入即雷暴 */
        strikeTimer = window.setTimeout(() => strike(true), rand(280, 700));
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        raf = 0;
        window.clearTimeout(strikeTimer);
        bolts.length = 0;
        ambient = 0;
        sheetA = 0;
        flash.style.opacity = "0";
        sheet.style.opacity = "0";
        flash.classList.remove("is-on");
        document.body.classList.remove("storm-flash");
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
        window.removeEventListener("touchstart", unlockAudio);
        try { audioCtx?.close(); } catch { /* ignore */ }
        canvas.remove();
        flash.remove();
        sheet.remove();
      },
    };
  }

  window.KayaStormLightning = { attach };
})();
