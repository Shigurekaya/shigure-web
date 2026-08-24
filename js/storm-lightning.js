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

  function buildStrike(w, h, lite) {
    const x0 = rand(w * 0.06, w * 0.94);
    const y0 = rand(-h * 0.06, h * 0.1);
    const x1 = clamp(x0 + rand(-w * 0.28, w * 0.28), w * 0.02, w * 0.98);
    const y1 = rand(h * 0.38, h * 0.98);
    const gens = lite ? 5 : 10;
    const maxOff = Math.max(lite ? 24 : 48, Math.min(w, h) * (lite ? 0.1 : 0.16));
    /** @type {Array<{x0:number,y0:number,x1:number,y1:number,w:number}>} */
    const segs = [];
    displaceBolt(x0, y0, x1, y1, gens, maxOff, lite ? 2.2 : 3.4, lite ? 0.28 : 0.58, segs);

    const companions = lite ? (Math.random() < 0.35 ? 1 : 0) : (2 + ((Math.random() * 3) | 0));
    for (let c = 0; c < companions; c += 1) {
      const sx = x0 + rand(-90, 90);
      const sy = y0 + rand(0, 50);
      const ex = clamp(x1 + rand(-140, 140), 0, w);
      const ey = y1 * rand(0.35, 0.95);
      displaceBolt(sx, sy, ex, ey, Math.max(2, gens - 2), maxOff * 0.7, lite ? 1.2 : 1.7, lite ? 0.15 : 0.35, segs);
    }

    return {
      segs,
      flashX: (x0 + x1) * 0.5,
      flashY: Math.min(y0, y1) + Math.abs(y1 - y0) * 0.22,
    };
  }

  /**
   * @param {HTMLElement} host
   * @param {{ lite?: boolean, maxQuality?: boolean }} [opts]
   */
  function attach(host, opts = {}) {
    if (!host) return null;
    const maxQuality = !!opts.maxQuality;
    const lite = maxQuality ? false : !!opts.lite;

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
    /** @type {Array<{ analyser: AnalyserNode, until: number }>} */
    const rumbleTracks = [];
    let synthRumble = 0;
    const rumbleBuf = new Uint8Array(256);

    const fit = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.15 : (maxQuality ? 2.5 : 2));
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
      synthRumble = Math.max(synthRumble, big ? 1 : 0.72);
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
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.72;
        gain.connect(analyser);
        analyser.connect(audioCtx.destination);
        rumbleTracks.push({ analyser, until: t0 + dur + delay + 0.15 });
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

      /* shadowBlur 在手机 Canvas2D 上极贵，lite 关掉 */
      if (!lite) {
        ctx.strokeStyle = `rgba(140, 175, 255,${0.35 * alpha * b.bright})`;
        ctx.shadowColor = "rgba(180, 210, 255, 1)";
        ctx.shadowBlur = maxQuality ? 42 : 28;
        for (let i = 0; i < b.segs.length; i += 1) {
          const s = b.segs[i];
          ctx.lineWidth = s.w * (maxQuality ? 6.5 : 5.2);
          ctx.beginPath();
          ctx.moveTo(s.x0, s.y0);
          ctx.lineTo(s.x1, s.y1);
          ctx.stroke();
        }
        ctx.shadowBlur = maxQuality ? 18 : 12;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.strokeStyle = `rgba(210, 230, 255,${(lite ? 0.85 : 0.82) * alpha})`;
      for (let i = 0; i < b.segs.length; i += 1) {
        const s = b.segs[i];
        ctx.lineWidth = s.w * (lite ? 2.4 : 2.35);
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(s.x1, s.y1);
        ctx.stroke();
      }

      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255, 255, 255,${0.98 * alpha})`;
      for (let i = 0; i < b.segs.length; i += 1) {
        const s = b.segs[i];
        ctx.lineWidth = s.w * (maxQuality ? 1.05 : 0.85);
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
      const big = forceBig || Math.random() < (maxQuality ? 0.42 : 0.32);
      const main = buildStrike(w, h, lite);
      pushBolt(main, big ? 1.35 : 1, big ? 1.4 : 1.1);
      ambient = Math.max(ambient, big ? rand(0.7, 0.95) : rand(0.4, 0.65));
      sheetA = Math.max(sheetA, big ? rand(0.2, 0.38) : rand(0.08, 0.18));
      flash.style.setProperty("--flash-x", `${(main.flashX / Math.max(w, 1)) * 100}%`);
      flash.style.setProperty("--flash-y", `${(main.flashY / Math.max(h, 1)) * 100}%`);
      flash.classList.add("is-on");
      flash.style.opacity = String(ambient);
      sheet.style.opacity = String(sheetA);
      pulseBody(big ? 180 : 90);

      const bursts = big ? (Math.random() < 0.7 ? 1 + ((Math.random() * 2) | 0) : 1) : (Math.random() < 0.25 ? 1 : 0);
      for (let i = 0; i < bursts; i += 1) {
        window.setTimeout(() => {
          if (!running) return;
          const sub = buildStrike(w, h, lite);
          pushBolt(sub, 0.85, 1.15);
          ambient = Math.max(ambient, rand(0.35, 0.6));
          sheetA = Math.max(sheetA, rand(0.08, 0.18));
          flash.style.opacity = String(ambient);
          sheet.style.opacity = String(sheetA);
          flash.classList.remove("is-on");
          void flash.offsetWidth;
          flash.classList.add("is-on");
          pulseBody(70);
        }, rand(40, 110) * (i + 1));
      }

      playThunder(Math.hypot(main.flashX - w * 0.5, main.flashY - h * 0.12), big);
      synthRumble = Math.max(synthRumble, big ? 0.95 : 0.65);
      scheduleNext();
    };

    const scheduleNext = () => {
      window.clearTimeout(strikeTimer);
      if (!running) return;
      /* 高画质更密的闪电节奏 */
      const gap = maxQuality ? rand(1800, 4800) : rand(4500, 11000);
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
        window.__kayaStormFlash = clamp(ambient + sheetA * 0.65, 0, 1);
      } else if (ambient !== 0) {
        ambient = 0;
        flash.style.opacity = "0";
        flash.classList.remove("is-on");
        window.__kayaStormFlash = clamp(sheetA * 0.65, 0, 1);
      } else {
        window.__kayaStormFlash = clamp(sheetA * 0.65, 0, 1);
      }

      if (sheetA > 0.01) {
        sheetA *= Math.exp(-dt * 4.4);
        sheet.style.opacity = String(sheetA);
      } else if (sheetA !== 0) {
        sheetA = 0;
        sheet.style.opacity = "0";
      }

      synthRumble *= Math.exp(-dt * 1.65);
      let rumble = synthRumble;
      const nowSec = audioCtx ? audioCtx.currentTime : 0;
      for (let ri = rumbleTracks.length - 1; ri >= 0; ri -= 1) {
        const tr = rumbleTracks[ri];
        if (nowSec > tr.until) {
          rumbleTracks.splice(ri, 1);
          continue;
        }
        try {
          tr.analyser.getByteFrequencyData(rumbleBuf);
          let bass = 0;
          for (let bi = 0; bi < 24; bi += 1) bass += rumbleBuf[bi];
          rumble += (bass / (24 * 255)) * 0.92;
        } catch { /* ignore */ }
      }
      window.__kayaStormRumble = clamp(rumble, 0, 1);
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
        window.__kayaStormFlash = 0;
        window.__kayaStormRumble = 0;
        synthRumble = 0;
        rumbleTracks.length = 0;
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
        if (running) {
          last = performance.now();
          if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
          if (!strikeTimer && !document.hidden) scheduleNext();
          return;
        }
        running = true;
        fit();
        last = performance.now();
        raf = requestAnimationFrame(tick);
        /* 很快首击，营造进入即雷暴 */
        strikeTimer = window.setTimeout(() => strike(true), rand(1400, 2800));
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
        window.__kayaStormFlash = 0;
        window.__kayaStormRumble = 0;
        synthRumble = 0;
        rumbleTracks.length = 0;
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
