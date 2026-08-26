/**
 * 按页面 + 天气模式按需加载脚本（defer 入口）
 */
(() => {
  const V = "202608262110";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      /* 动态插入默认 async；设 false 才能并行下载 + 按文档顺序执行 */
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`script failed: ${src}`));
      document.head.appendChild(s);
    });
  }

  /** 并行下载，按 urls 顺序 await，避免瀑布式串行拖慢首屏 */
  async function loadOrdered(urls) {
    const jobs = urls.map((url) => loadScript(url));
    for (const job of jobs) await job;
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
    const noWeather = page === "quiz" || page === "sedai" || page === "pick";
    const mode = noWeather ? null : (window.KayaRainMode?.pickInitial?.() ?? "light");

    /* 工具页纯静态底，不拉天气 CSS（含大面积 blur） */
    if (!reduced && !noWeather) loadWeatherCss();

    const dataByPage = {
      home: [
        `js/site-data.js?v=${V}`,
        `js/mv-materials-data.js?v=${V}`,
      ],
      works: [`js/site-data.js?v=${V}`],
      links: [`js/links-data.js?v=${V}`],
      mv: [`js/mv-materials-data.js?v=${V}`],
      quiz: [
        `js/gal-quiz-data.js?v=${V}`,
        `js/gal-quiz.js?v=${V}`,
        `js/gal-quiz-float.js?v=${V}`,
      ],
      pick: [
        `js/gal-pick-data.js?v=${V}`,
        `js/gal-pick.js?v=${V}`,
      ],
      sedai: [
        `js/gal-sedai-data.js?v=${V}`,
        `js/gal-sedai.js?v=${V}`,
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

    const urls = [...(dataByPage[page] || []), ...(noWeather ? [] : shared)];
    if (!reduced && !noWeather) {
      urls.push(...(weatherByMode[mode] || weatherByMode.light));
    }
    if (page === "home" && !reduced) {
      urls.push("js/vendor/anime.umd.min.js", `js/profile-reveal.js?v=${V}`);
    }
    urls.push(`js/main.js?v=${V}`);

    await loadOrdered(urls);

    const api = window.Kaya;
    if (!api) {
      throw new Error("window.Kaya missing after main.js load");
    }

    const init = {
      home: () => api.initHome(),
      works: () => api.initWorks(),
      links: () => api.initLinks(),
      mv: () => api.initMvMaterials(),
      quiz: () => {
        window.KayaQuiz?.init();
        window.KayaQuizFloat?.init();
        api.initQuiz();
      },
      pick: () => {
        window.KayaGalPick?.init();
        api.initPick();
      },
      sedai: () => {
        window.KayaGalSedai?.init();
        api.initSedai();
      },
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
