/**
 * 时雨榧 · 雷声驱动整页低频震动
 * 读取 window.__kayaStormRumble（由 storm-lightning 音频分析 + 合成包络写入）。
 */
(() => {
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function attach() {
    let enabled = true;
    let intensity = 0;
    let shakeX = 0;
    let shakeY = 0;
    let phase = 0;
    let raf = 0;
    let last = performance.now();

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = clamp((now - last) / 1000, 0.004, 0.05);
      last = now;

      const rumble = typeof window.__kayaStormRumble === "number"
        ? window.__kayaStormRumble
        : 0;

      if (!enabled || intensity < 0.04 || rumble < 0.002) {
        shakeX *= Math.exp(-dt * 12);
        shakeY *= Math.exp(-dt * 12);
        if (Math.abs(shakeX) < 0.02 && Math.abs(shakeY) < 0.02) {
          document.documentElement.classList.remove("storm-thunder-rumble");
          document.documentElement.style.setProperty("--thunder-shake-x", "0px");
          document.documentElement.style.setProperty("--thunder-shake-y", "0px");
          return;
        }
      } else {
        document.documentElement.classList.add("storm-thunder-rumble");
        phase += dt * (2.8 + rumble * 6);
        const amp = rumble * intensity * 5.2;
        const low = Math.sin(phase * 0.7) * 0.55 + Math.sin(phase * 1.9) * 0.35;
        const targetX = low * amp;
        const targetY = Math.cos(phase * 0.55) * amp * 0.62;
        shakeX += (targetX - shakeX) * Math.min(1, dt * 18);
        shakeY += (targetY - shakeY) * Math.min(1, dt * 18);
      }

      document.documentElement.style.setProperty("--thunder-shake-x", `${shakeX.toFixed(3)}px`);
      document.documentElement.style.setProperty("--thunder-shake-y", `${shakeY.toFixed(3)}px`);
    };

    raf = requestAnimationFrame(tick);

    return {
      setIntensity(v) {
        intensity = clamp(v, 0, 1);
      },
      setEnabled(on) {
        enabled = !!on;
        if (!enabled) {
          document.documentElement.classList.remove("storm-thunder-rumble");
          shakeX = 0;
          shakeY = 0;
        }
      },
      destroy() {
        cancelAnimationFrame(raf);
        document.documentElement.classList.remove("storm-thunder-rumble");
        document.documentElement.style.removeProperty("--thunder-shake-x");
        document.documentElement.style.removeProperty("--thunder-shake-y");
      },
    };
  }

  window.KayaStormThunderRumble = { attach };
})();
