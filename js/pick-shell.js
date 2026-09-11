/**
 * Gal缘结独立页 — 最小 boot（不加载 main.js）+ 轻量飘雪
 */
(() => {
  function markPageReady() {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.body.classList.remove("page-ready");
    if (reduced) {
      document.body.classList.add("page-ready");
      return;
    }
    void document.body.offsetWidth;
    window.requestAnimationFrame(() => {
      document.body.classList.add("page-ready");
    });
  }

  function initPickSnow() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const host = document.getElementById("pick-snow");
    if (!host || host.childElementCount) return;

    const narrow = window.matchMedia("(max-width: 640px)").matches;
    const count = narrow ? 26 : 44;
    const glyphs = ["❄", "❅", "❆", "·", "✧"];
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i += 1) {
      const flake = document.createElement("span");
      const layer = i % 3; /* 0 far · 1 mid · 2 near */
      flake.className = `pick-snow__flake pick-snow__flake--${["far", "mid", "near"][layer]}`;
      flake.textContent = glyphs[i % glyphs.length];
      flake.style.setProperty("--sx", String(Math.random()));
      flake.style.setProperty("--sd", `${9 + Math.random() * 16}s`);
      flake.style.setProperty("--sdelay", `${-Math.random() * 18}s`);
      flake.style.setProperty("--ssize", `${0.4 + Math.random() * (layer === 2 ? 1.15 : 0.75)}rem`);
      flake.style.setProperty("--sop", String(0.22 + Math.random() * 0.5 + layer * 0.06));
      flake.style.setProperty("--ssway", `${(Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 42)}px`);
      flake.style.setProperty("--srot", `${180 + Math.random() * 360}deg`);
      frag.appendChild(flake);
    }

    host.appendChild(frag);

    document.addEventListener("visibilitychange", () => {
      host.classList.toggle("is-paused", document.hidden);
    });
  }

  window.Kaya = {
    initPick: () => {
      initPickSnow();
      markPageReady();
    },
  };
})();
