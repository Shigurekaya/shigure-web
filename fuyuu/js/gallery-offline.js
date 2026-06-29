/** 离线 Pro Gallery：保留 SSR 拼贴布局，阻止 layout-fixer 与 hydration 隐藏图片 */
(() => {
  if (document.body.classList.contains("fy-page-index")) return;

  let patchTimer;
  let stableTimer;
  let observer;
  let patchCount = 0;

  const patch = () => {
    document.querySelectorAll('[id^="layout-fixer-style-"]').forEach((link) => {
      link.removeAttribute("href");
    });

    document.querySelectorAll('[data-key="items-styles"]').forEach((el) => {
      el.style.display = "none";
    });

    document.querySelectorAll('.pro-gallery [data-hook="item-container"]').forEach((el) => {
      el.style.setProperty("opacity", "1", "important");
      el.style.setProperty("display", "block", "important");
      el.style.setProperty("visibility", "visible", "important");
      el.removeAttribute("aria-hidden");
    });

    document.querySelectorAll(".pro-gallery-margin-container").forEach((container) => {
      let maxBottom = 0;
      container.querySelectorAll('[data-hook="item-container"]').forEach((el) => {
        const top = parseInt(el.style.top, 10) || 0;
        const height = parseInt(el.style.height, 10) || el.offsetHeight || 0;
        maxBottom = Math.max(maxBottom, top + height);
      });
      if (maxBottom <= 0) return;
      const margin = parseInt(container.style.margin, 10) || 0;
      const total = maxBottom + margin * 2;
      container.style.height = `${maxBottom}px`;
      const gallery = container.closest('[id^="pro-gallery-container-"]');
      if (gallery) gallery.style.height = `${total}px`;
      const proGallery = container.closest(".pro-gallery[id^='pro-gallery-comp-']");
      if (proGallery && proGallery.id.startsWith("pro-gallery-comp-")) {
        const compId = proGallery.id.replace("pro-gallery-", "");
        const comp = document.getElementById(compId);
        if (comp) comp.style.height = `${total + 64}px`;
      }
    });

    patchCount += 1;
    if (patchCount >= 3) stopObserver();
  };

  const schedulePatch = () => {
    clearTimeout(patchTimer);
    patchTimer = setTimeout(patch, 32);
  };

  const stopObserver = () => {
    observer?.disconnect();
    observer = null;
    clearTimeout(stableTimer);
  };

  patch();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedulePatch, { once: true });
  }

  window.addEventListener("load", schedulePatch, { once: true });

  const galleries = document.querySelectorAll(".pro-gallery");
  if (galleries.length && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver((mutations) => {
      if (!mutations.some((m) => m.type === "attributes" || m.addedNodes.length)) return;
      schedulePatch();
    });
    galleries.forEach((el) => {
      observer.observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    });
    stableTimer = setTimeout(stopObserver, 4000);
  }
})();
