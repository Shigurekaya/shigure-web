/**
 * 小雨（light rain）性能分级 + 运行时帧预算
 */
(() => {
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  let weakGpuCache = null;

  function isPhoneLike() {
    try {
      if (navigator.connection?.saveData) return true;
    } catch { /* ignore */ }
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)) return true;
    try {
      if (window.matchMedia("(max-width: 720px)").matches
        && window.matchMedia("(pointer: coarse)").matches) return true;
    } catch { /* ignore */ }
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function viewportPixelLoad() {
    let w = window.innerWidth || 1280;
    let h = window.innerHeight || 720;
    if (window.visualViewport) {
      w = window.visualViewport.width || w;
      h = window.visualViewport.height || h;
    }
    return w * h * (window.devicePixelRatio || 1);
  }

  function isHeavyViewport() {
    return viewportPixelLoad() > 1_650_000;
  }

  function isWeakGpu() {
    if (weakGpuCache != null) return weakGpuCache;
    weakGpuCache = false;
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
      if (!gl) {
        weakGpuCache = true;
        return weakGpuCache;
      }
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        const r = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || "").toLowerCase();
        if (/intel|hd graphics|uhd|basic render|microsoft|llvmpipe|swiftshader|mesa/.test(r)) {
          if (!/arc a|rtx|gtx|rx [5-9]|radeon rx|geforce/.test(r)) {
            weakGpuCache = true;
          }
        }
      }
    } catch {
      weakGpuCache = true;
    }
    return weakGpuCache;
  }

  /** @returns {"mid"} */
  function detectRainTier() {
    return "mid";
  }

  function createRuntimeGovernor(opts = {}) {
    const min = opts.min ?? 0.72;
    const max = opts.max ?? 1;
    const weak = !!opts.weakGpu;
    let scale = opts.initial ?? max;
    let slowStreak = 0;
    let fastStreak = 0;
    let tick = 0;

    return {
      get scale() { return scale; },
      get tick() { return tick; },
      noteFrame(frameMsBudget, frameCostMs) {
        tick += 1;
        const slowMs = opts.slowMs ?? frameMsBudget * 1.22;
        const recoverMs = opts.recoverMs ?? frameMsBudget * 0.92;
        if (frameCostMs > slowMs) {
          slowStreak += 1;
          fastStreak = 0;
          if (slowStreak >= 3) {
            scale = Math.max(min, scale * 0.92);
            slowStreak = 0;
          }
        } else if (frameCostMs < recoverMs) {
          fastStreak += 1;
          slowStreak = Math.max(0, slowStreak - 1);
          if (fastStreak >= 18 && scale < max) {
            scale = Math.min(max, scale * 1.025);
            fastStreak = 0;
          }
        }
        return scale;
      },
      /** 隔帧跳过涟漪、近景雨丝头等次要效果 */
      shouldSkipExtras() {
        if (weak && scale < 0.98 && (tick & 1) === 1) return true;
        return scale < 0.9 && (tick & 1) === 1;
      },
      /** 压力更大时隔帧跳过溅花绘制（物理仍更新） */
      shouldSkipSplashes() {
        if (weak && scale < 0.94 && (tick & 1) === 1) return true;
        return scale < 0.84 && (tick & 1) === 1;
      },
    };
  }

  function ambientDprCap(_phone = false) {
    return 1.4;
  }

  /** @returns {"mid"} */
  function detectAmbientTier() {
    return "mid";
  }

  function initPerfOverlay() {
    try {
      if (!/[?&]perf=1(?:&|$)/.test(location.search)) return;
    } catch { return; }
    const box = document.createElement("div");
    box.id = "kaya-perf-overlay";
    Object.assign(box.style, {
      position: "fixed",
      left: "8px",
      bottom: "8px",
      zIndex: "99999",
      padding: "8px 10px",
      font: "11px/1.45 ui-monospace,Consolas,monospace",
      color: "#e8f0ff",
      background: "rgba(8,12,22,0.82)",
      border: "1px solid rgba(140,170,220,0.35)",
      borderRadius: "8px",
      pointerEvents: "none",
      whiteSpace: "pre",
      maxWidth: "min(92vw, 420px)",
    });
    document.body.appendChild(box);
    const tick = () => {
      const c = document.querySelector(".site-bg__rain, .site-bg__sunny, .site-bg__sunny--dyn");
      const px = c ? c.width * c.height : 0;
      const light = window.__KayaLightRainStats?.();
      const sunny = window.__KayaSunnyStats?.();
      const lines = [
        `dpr=${window.devicePixelRatio}  canvas=${c ? `${c.width}×${c.height}` : "—"}  (${(px / 1e6).toFixed(2)} Mpx)`,
        `tier=${detectAmbientTier()} weakGpu=${isWeakGpu()}`,
      ];
      if (light) {
        lines.push(`light: mode=${light.mode ?? "canvas"} layers=${light.layers ?? "—"} frame=${light.frameMs}ms`);
      }
      if (sunny) {
        lines.push(`sunny: mode=${sunny.mode ?? "canvas"} rainbowPx=${sunny.rainbowPx ?? "—"} static=${sunny.static ?? "—"}`);
      }
      box.textContent = lines.join("\n");
    };
    tick();
    setInterval(tick, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPerfOverlay, { once: true });
  } else {
    initPerfOverlay();
  }

  window.KayaPerfGovernor = {
    clamp,
    isPhoneLike,
    isWeakGpu,
    isHeavyViewport,
    detectRainTier,
    detectAmbientTier,
    ambientDprCap,
    createRuntimeGovernor,
  };
})();
