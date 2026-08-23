/**
 * 时雨榧 · 雨后彩虹（兼容入口）
 *
 * 已合并为晴天；旧链接仍指向 `KayaSunnySky`。
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
