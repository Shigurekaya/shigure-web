/**
 * 天气模式判定（须在 kaya-boot 前加载，供按需脚本分包）
 */
(() => {
  /* 首页随机天气：晴 20% / 雪 20% / 小雨 55% / 大雨 5%（雷暴仅 URL 强制） */
  const HOME_SUNNY_CHANCE = 0.2;
  const HOME_SNOW_CHANCE = 0.2;
  const HOME_LIGHT_CHANCE = 0.55;
  const HOME_HEAVY_CHANCE = 0.05;

  function normalize(mode) {
    if (mode === "rainbow" || mode === "after") return "sunny";
    return mode;
  }

  function normalizePathname(pathname) {
    let p = pathname || "/";
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p || "/";
  }

  function forceFromUrl() {
    try {
      const q = new URLSearchParams(window.location.search);
      const rain = (q.get("rain") || "").toLowerCase();
      const fromRain = normalize(rain);
      if (fromRain === "storm" || fromRain === "heavy" || fromRain === "light" || fromRain === "sunny" || fromRain === "snow") {
        return fromRain;
      }

      if (q.has("storm")) return "storm";
      if (q.has("heavy")) return "heavy";
      if (q.has("light")) return "light";
      if (q.has("snow")) return "snow";
      if (q.has("sunny") || q.has("clear") || q.has("rainbow") || q.has("after")) return "sunny";

      const path = normalizePathname(window.location.pathname);
      if (path === "/storm") return "storm";
      if (path === "/heavy") return "heavy";
      if (path === "/light") return "light";
      if (path === "/snow") return "snow";
      if (path === "/sunny" || path === "/rainbow") return "sunny";
    } catch { /* ignore */ }
    return null;
  }

  function navigationType() {
    try {
      const entry = performance.getEntriesByType?.("navigation")?.[0];
      if (entry?.type) return entry.type;
    } catch { /* ignore */ }
    try {
      const t = performance.navigation?.type;
      if (t === 1) return "reload";
      if (t === 2) return "back_forward";
    } catch { /* ignore */ }
    return "navigate";
  }

  function readStored() {
    try {
      const v = normalize(sessionStorage.getItem(RAIN_MODE_KEY));
      if (v === "storm" || v === "heavy" || v === "light" || v === "sunny" || v === "snow") return v;
      const legacy = sessionStorage.getItem("kaya-rain-heavy");
      if (legacy === "1") return "heavy";
      if (legacy === "0") return "light";
    } catch { /* ignore */ }
    return null;
  }

  function writeStored(mode) {
    const normalized = normalize(mode);
    if (!normalized) return;
    try {
      sessionStorage.setItem(RAIN_MODE_KEY, normalized);
      sessionStorage.setItem("kaya-rain-heavy", (normalized === "heavy" || normalized === "storm") ? "1" : "0");
    } catch { /* ignore */ }
  }

  function rollHomeWeather() {
    const r = Math.random();
    let t = HOME_SUNNY_CHANCE;
    if (r < t) return "sunny";
    t += HOME_SNOW_CHANCE;
    if (r < t) return "snow";
    t += HOME_LIGHT_CHANCE;
    if (r < t) return "light";
    return "heavy";
  }

  function isSameSitePageNav() {
    try {
      const ref = document.referrer;
      if (!ref) return false;
      const refUrl = new URL(ref);
      const here = new URL(window.location.href);
      if (refUrl.origin !== here.origin) return false;
      return normalizePathname(refUrl.pathname) !== normalizePathname(here.pathname);
    } catch {
      return false;
    }
  }

  function isContentSubPage() {
    const p = normalizePathname(window.location.pathname);
    return p === "/works" || p === "/links" || p === "/mv-materials";
  }

  function isHomeEntry() {
    const p = normalizePathname(window.location.pathname);
    return p === "/" || p === "/index.html";
  }

  /** kaya-boot 与 main.js 同页各调一次 pickInitial，内存缓存防二次抽签 */
  let navPick = null;

  function fromBody() {
    const b = document.body;
    if (b.classList.contains("storm-rain")) return "storm";
    if (b.classList.contains("heavy-rain")) return "heavy";
    if (b.classList.contains("sunny-sky")) return "sunny";
    if (b.classList.contains("light-rain")) return "light";
    if (b.classList.contains("snow-sky")) return "snow";
    return null;
  }

  function pickInitial() {
    if (navPick) return navPick;

    const forced = forceFromUrl();
    if (forced) {
      writeStored(forced);
      navPick = forced;
      return forced;
    }

    const saved = readStored();
    const isReload = navigationType() === "reload";
    const sameSiteNav = isSameSitePageNav();

    /* 站内切页（主页↔作品集等）：保持本会话天气，不重抽 */
    if (sameSiteNav) {
      navPick = saved || fromBody() || rollHomeWeather();
      writeStored(navPick);
      return navPick;
    }

    /* 打开主页（新标签、外链、刷新、地址栏回站）：每次随机，不沿用旧 session */
    if (isHomeEntry()) {
      navPick = rollHomeWeather();
      writeStored(navPick);
      return navPick;
    }

    if (saved) {
      if (!isReload) {
        navPick = saved;
        return saved;
      }
      if (saved === "sunny" || saved === "storm" || saved === "snow") {
        navPick = saved;
        return saved;
      }
      if (isContentSubPage()) {
        navPick = saved;
        return saved;
      }
    }

    navPick = rollHomeWeather();
    writeStored(navPick);
    return navPick;
  }

  window.KayaRainMode = {
    normalize,
    forceFromUrl,
    forceHeavyFromUrl() {
      const m = forceFromUrl();
      return m === "heavy" || m === "storm";
    },
    forceStormFromUrl() {
      return forceFromUrl() === "storm";
    },
    forceSpecialFromUrl() {
      const m = forceFromUrl();
      return m === "heavy" || m === "storm" || m === "sunny" || m === "light" || m === "snow";
    },
    isDry(mode) {
      return mode === "sunny";
    },
    readStored,
    writeStored,
    fromBody,
    pickInitial,
  };
})();
