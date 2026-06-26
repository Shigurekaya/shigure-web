/** 全站动效 — 入场、滚动显现、交错延迟 */
const Motion = (() => {
  let observer;

  function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initPageEnter() {
    requestAnimationFrame(() => {
      document.body.classList.add("page-ready");
    });
  }

  function observe(root = document) {
    if (reducedMotion()) {
      root.querySelectorAll(".reveal, .reveal-stagger > *").forEach((el) => {
        el.classList.add("is-visible");
      });
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          });
        },
        { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
    }

    root.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => observer.observe(el));
    root.querySelectorAll(".reveal-stagger:not(.is-visible)").forEach((group) => {
      group.classList.add("is-visible");
      group.querySelectorAll(":scope > *").forEach((child, i) => {
        child.style.setProperty("--reveal-i", i);
      });
      observer.observe(group);
    });
  }

  function animateValue(el, end, suffix = "") {
    if (reducedMotion() || !el) {
      if (el) el.textContent = end + suffix;
      return;
    }
    const start = 0;
    const duration = 900;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      el.textContent = Math.round(start + (end - start) * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function initCounters(root = document) {
    root.querySelectorAll("[data-count]").forEach((el) => {
      const n = parseInt(el.dataset.count, 10);
      if (!Number.isNaN(n)) animateValue(el, n, el.dataset.suffix || "");
    });
  }

  function refresh(root = document) {
    observe(root);
    initCounters(root);
  }

  function init() {
    initPageEnter();
  }

  return { init, refresh, observe, initCounters, animateValue };
})();
