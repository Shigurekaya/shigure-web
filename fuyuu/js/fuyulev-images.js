/** 浮游Lev 图片懒加载与加载体验优化 */
(() => {
  const EAGER_GALLERY = 6;
  const ROOT_MARGIN = "320px 0px";
  const SELECTOR =
    ".pro-gallery img, .fuyulev-kakuu-thumb img, .fuyulev-portfolio-thumb img, " +
    ".km-gallery-item img, .fuyulev-work-item img, .link-banner img, .profile-banner img";

  let observer;
  let parseObserver;
  let galleryIdx = 0;

  function resolveSrc(img) {
    const raw = img.getAttribute("src") || img.getAttribute("data-src") || "";
    if (!raw || !window.FuyulevImageFix) return raw;
    const item = img.closest("[data-idx]");
    const idx = item ? parseInt(item.getAttribute("data-idx"), 10) : undefined;
    return window.FuyulevImageFix.resolveSrc(raw, Number.isNaN(idx) ? undefined : idx);
  }

  function markLoaded(img) {
    img.classList.add("fy-img-loaded");
    img.removeAttribute("data-fy-pending");
  }

  function reveal(img) {
    let src = img.getAttribute("data-src");
    if (!src) src = resolveSrc(img);
    if (!src || img.getAttribute("data-fy-loaded") === "1") return;
    img.setAttribute("data-fy-loaded", "1");
    img.removeAttribute("data-src");
    img.decoding = "async";
    if (img.complete && img.naturalWidth) {
      markLoaded(img);
      return;
    }
    img.addEventListener("load", () => markLoaded(img), { once: true });
    img.addEventListener("error", () => markLoaded(img), { once: true });
    img.src = src;
    const srcset = img.getAttribute("data-srcset");
    if (srcset) {
      img.srcset = srcset;
      img.removeAttribute("data-srcset");
    } else {
      img.srcset = `${src} 1x, ${src} 2x`;
    }
  }

  function shouldEager(img) {
    if (img.closest(".km-header, .fuyulev-about-head, .fuyulev-kaya-corner")) return true;
    if (img.id && /^img_comp-(imyso5rc|imytorpi|mqk7r3rt|lstqan4)/.test(img.id)) return true;
    const item = img.closest("[data-idx]");
    if (item) {
      const idx = parseInt(item.getAttribute("data-idx"), 10);
      if (!Number.isNaN(idx) && idx < EAGER_GALLERY) return true;
    }
    const grid = img.closest(".fuyulev-kakuu-grid, .fuyulev-portfolio-grid");
    if (grid) {
      const thumbs = [...grid.querySelectorAll("img")];
      return thumbs.indexOf(img) < 8;
    }
    return false;
  }

  function defer(img) {
    if (!img || img.getAttribute("data-fy-pending") === "1") return;
    if (img.getAttribute("data-src") && img.getAttribute("data-fy-loaded") !== "1") {
      observer?.observe(img);
      return;
    }

    const current = img.getAttribute("src");
    if (!current || current.startsWith("data:")) return;

    const resolved = resolveSrc(img);
    if (resolved && resolved !== current) {
      img.src = resolved;
      img.srcset = `${resolved} 1x, ${resolved} 2x`;
    }

    img.setAttribute("data-fy-pending", "1");
    img.decoding = "async";

    if (shouldEager(img)) {
      if (galleryIdx === 0 && img.closest("#pro-gallery-comp-j3v9reg1")) {
        img.fetchPriority = "high";
      }
      galleryIdx += 1;
      if (!img.complete) {
        img.addEventListener("load", () => markLoaded(img), { once: true });
        img.addEventListener("error", () => markLoaded(img), { once: true });
      } else {
        markLoaded(img);
      }
      return;
    }

    img.setAttribute("data-src", img.getAttribute("src"));
    img.removeAttribute("src");
    const srcset = img.getAttribute("srcset");
    if (srcset) {
      img.setAttribute("data-srcset", srcset);
      img.removeAttribute("srcset");
    }
    img.classList.add("fy-img-deferred");
    if (observer) observer.observe(img);
    else reveal(img);
  }

  function scan(root) {
    if (!root) return;
    if (root.matches?.("img")) defer(root);
    root.querySelectorAll?.(SELECTOR).forEach(defer);
  }

  function initObserver() {
    if (observer || !("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: ROOT_MARGIN, threshold: 0.01 }
    );
  }

  function initParseHook() {
    if (!("MutationObserver" in window) || parseObserver) return;
    parseObserver = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          scan(node);
        });
      });
    });
    parseObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopParseHook() {
    parseObserver?.disconnect();
    parseObserver = null;
  }

  function init() {
    initObserver();
    if (window.FuyulevImageFix) window.FuyulevImageFix.run();
    scan(document);
    document.querySelectorAll("img[data-src]").forEach((img) => {
      if (observer) observer.observe(img);
      else reveal(img);
    });
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("img[data-src]").forEach(reveal);
    }
  }

  initObserver();
  initParseHook();

  const boot = () => {
    stopParseHook();
    init();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener("load", init, { once: true });
  window.FuyulevImages = { defer, reveal, scan, markLoaded };
})();
