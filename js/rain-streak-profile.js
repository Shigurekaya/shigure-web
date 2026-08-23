/**
 * 雨丝纵向 alpha 剖面（尾上→头下）
 * 对齐参考视频：尾淡可见、中段低谷、头部最亮。
 */
(() => {
  /** @type {{ t: number, mul: number }[]} */
  const STOPS = [
    { t: 0, mul: 0 },
    { t: 0.15, mul: 0.25 },
    { t: 0.42, mul: 0.46 },
    { t: 0.72, mul: 0.84 },
    { t: 1, mul: 1 },
  ];

  /**
   * @param {number} edge 0=尾(上) … 1=头(下)
   * @returns {number}
   */
  function mulAt(edge) {
    const t = Math.max(0, Math.min(1, edge));
    for (let i = 0; i < STOPS.length - 1; i += 1) {
      const a = STOPS[i];
      const b = STOPS[i + 1];
      if (t <= b.t) {
        if (b.t === a.t) return b.mul;
        return a.mul + (b.mul - a.mul) * ((t - a.t) / (b.t - a.t));
      }
    }
    return STOPS[STOPS.length - 1].mul;
  }

  /**
   * @param {CanvasGradient} grad
   * @param {string} rgb 如 "168,184,214"
   * @param {number} alpha
   */
  function applyCanvasGradient(grad, rgb, alpha) {
    const a = Math.max(0, alpha);
    const cap = Math.min(1, a * 1.02);
    for (let i = 0; i < STOPS.length; i += 1) {
      const s = STOPS[i];
      grad.addColorStop(s.t, `rgba(${rgb},${Math.min(cap, a * s.mul)})`);
    }
  }

  window.KayaRainStreakProfile = {
    STOPS,
    mulAt,
    applyCanvasGradient,
  };
})();
