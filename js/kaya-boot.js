/**
 * 鎸夐〉闈?+ 澶╂皵妯″紡鎸夐渶鍔犺浇鑴氭湰锛坉efer 鍏ュ彛锛?
 */
(() => {
  const V = "202608281955";

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      /* 鍔ㄦ€佹彃鍏ラ粯璁?async锛涜 false 鎵嶈兘骞惰涓嬭浇 + 鎸夋枃妗ｉ『搴忔墽琛?*/
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`script failed: ${src}`));
      document.head.appendChild(s);
    });
  }

  /** 骞惰涓嬭浇锛屾寜 urls 椤哄簭 await锛岄伩鍏嶇€戝竷寮忎覆琛屾嫋鎱㈤灞?*/
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

    /* 宸ュ叿椤电函闈欐€佸簳锛屼笉鎷夊ぉ姘?CSS锛堝惈澶ч潰绉?blur锛?*/
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
      pick: [`js/gal-pick.js?v=${V}`],
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
      snow: [`js/snow.js?v=${V}`],
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
    if (page === "pick") {
      urls.push(`js/pick-shell.js?v=${V}`);
    } else {
      urls.push(`js/footer-gal-motto.js?v=${V}`, `js/main.js?v=${V}`);
    }

    /* pick 棰樺簱涓庨€昏緫骞惰涓嬭浇锛岄灞忓厛鍑?UI 鍐嶈В鏋?900KB+ 鏁版嵁 */
    const pickDataJob = page === "pick"
      ? loadScript(`js/gal-pick-data.js?v=${V}`)
      : null;

    await loadOrdered(urls);

    const api = window.Kaya;
    if (!api) {
      throw new Error("window.Kaya missing after boot scripts");
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

    if (pickDataJob) {
      pickDataJob
        .then(() => window.KayaGalPick?.onDataLoaded?.())
        .catch((err) => {
          console.error("[kaya-boot] gal-pick-data", err);
          window.KayaGalPick?.onDataLoadFailed?.(err);
        });
    }
  }

  boot().catch((err) => {
    console.error("[kaya-boot]", err);
  });
})();
