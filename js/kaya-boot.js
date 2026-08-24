/**
 * 按页面 + 天气模式按需加载脚本（defer 入口）
 */
(() => {
  const V = "202608241400";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`script failed: ${src}`));
      document.head.appendChild(s);
    });
  }

  async function loadSequential(urls) {
    for (const url of urls) {
      await loadScript(url);
    }
  }

  function loadWeatherCss() {
    if (document.querySelector('link[href*="style-weather.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `css/style-weather.css?v=${V}`;
    document.head.appendChild(link);
  }

  async function boot() {
    const page = document.body.dataset.kayaPage || "home";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mode = window.KayaRainMode.pickInitial();

    if (!reduced) loadWeatherCss();

    const dataByPage = {
      home: [
        `js/site-data.js?v=${V}`,
        `js/mv-materials-data.js?v=${V}`,
      ],
      works: [`js/site-data.js?v=${V}`],
      links: [`js/links-data.js?v=${V}`],
      mv: [
        `js/mv-materials-data.js?v=${V}`,
        `js/mv-watermark.js?v=${V}`,
      ],
    };

    const shared = [
      `js/perf-governor.js?v=${V}`,
      `js/rain-streak-profile.js?v=${V}`,
    ];

    const heavyBundle = [
      "js/vendor/html2canvas.min.js",
      "js/vendor/raindrop-fx.js",
      `js/gpu-streak-rain.js?v=${V}`,
      `js/glass-drops.js?v=${V}`,
      `js/storm-refract.js?v=${V}`,
      `js/storm-thunder-rumble.js?v=${V}`,
      `js/storm-overlay.js?v=${V}`,
      `js/storm-postfx.js?v=${V}`,
      `js/storm-atmosphere.js?v=${V}`,
      `js/heavy-rain.js?v=${V}`,
    ];

    const weatherByMode = {
      light: [`js/light-rain.js?v=${V}`],
      sunny: [`js/sunny-sky.js?v=${V}`],
      heavy: heavyBundle,
      storm: [...heavyBundle, `js/storm-lightning.js?v=${V}`],
    };

    const urls = [...(dataByPage[page] || []), ...shared];
    if (!reduced) {
      urls.push(...(weatherByMode[mode] || weatherByMode.light));
    }
    urls.push(`js/main.js?v=${V}`);

    await loadSequential(urls);

    const init = {
      home: () => window.Kaya.initHome(),
      works: () => window.Kaya.initWorks(),
      links: () => window.Kaya.initLinks(),
      mv: () => window.Kaya.initMvMaterials(),
    }[page];

    if (!init) {
      console.warn("[kaya-boot] unknown page:", page);
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }

  boot().catch((err) => {
    console.error("[kaya-boot]", err);
  });
})();
