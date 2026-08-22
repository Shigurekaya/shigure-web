/**
 * 时雨榧 · 雨后彩虹（兼容入口）
 *
 * 已与 `sunny-sky.js` 融合为同一 Canvas 视觉；保留 `KayaAfterRain` 供旧链接调用。
 */
(() => {
  function attach(host) {
    if (!window.KayaSunnySky?.attach) {
      console.warn("[kaya] KayaSunnySky missing");
      return null;
    }
    return window.KayaSunnySky.attach(host);
  }

  window.KayaAfterRain = { attach };
})();
