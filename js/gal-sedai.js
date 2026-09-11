const STORAGE_KEY = "selectedGalgames";
const DISPLAY_COUNT = 20;
const HTML_TO_IMAGE_SRC =
  "https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.min.js";

let selected = new Set(loadSelected());
let allTitles = null;
let htmlToImageReady = null;

const gridPanel = document.getElementById("grid-panel");
const clearBtn = document.getElementById("btn-clear");
const toastEl = document.getElementById("toast");

function loadSelected() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveSelected() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
}

function getAllDisplayTitles() {
  if (allTitles) return allTitles;
  allTitles = Object.keys(GAMES)
    .sort((a, b) => Number(a) - Number(b))
    .flatMap((year) => GAMES[year].slice(0, DISPLAY_COUNT).map((game) => game.title));
  return allTitles;
}

function totalGames() {
  return getAllDisplayTitles().length;
}

function updateCounter() {
  const el = document.getElementById("counter");
  if (el) {
    el.textContent = `我玩过 ${selected.size}/${totalGames()} 部galgame`;
  }
  clearBtn.hidden = selected.size === 0;
}

function setButtonSelected(btn, on) {
  btn.classList.toggle("is-selected", on);
}

function syncAllButtons() {
  gridPanel.querySelectorAll(".sedai-game-btn").forEach((btn) => {
    setButtonSelected(btn, selected.has(btn.dataset.title));
  });
  updateCounter();
}

function renderGrid() {
  const frag = document.createDocumentFragment();

  const header = document.createElement("div");
  header.className = "sedai-grid-header";
  header.innerHTML = `
    <h1>Gal世代<span class="sedai-grid-header__subtitle"> - 点击选择你玩过的galgame</span></h1>
    <span class="sedai-grid-header__counter" id="counter">我玩过 ${selected.size}/${totalGames()} 部galgame</span>
  `;
  frag.appendChild(header);

  Object.keys(GAMES)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((year) => {
      const games = GAMES[year].slice(0, DISPLAY_COUNT);
      const row = document.createElement("div");
      row.className = "sedai-year-row";

      const label = document.createElement("div");
      label.className = "sedai-year-label";
      label.textContent = year;
      row.appendChild(label);

      const gamesRow = document.createElement("div");
      gamesRow.className = "sedai-games-row";

      games.forEach((game) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sedai-game-btn";
        if (selected.has(game.title)) btn.classList.add("is-selected");
        btn.title = game.title;
        btn.dataset.title = game.title;
        const span = document.createElement("span");
        span.textContent = game.title;
        btn.appendChild(span);
        gamesRow.appendChild(btn);
      });

      row.appendChild(gamesRow);
      frag.appendChild(row);
    });

  gridPanel.replaceChildren(frag);
  updateCounter();
}

function toggleGame(title, btn) {
  if (selected.has(title)) {
    selected.delete(title);
    if (btn) setButtonSelected(btn, false);
  } else {
    selected.add(title);
    if (btn) setButtonSelected(btn, true);
  }
  saveSelected();
  updateCounter();
}

function selectAll() {
  selected = new Set(getAllDisplayTitles());
  saveSelected();
  syncAllButtons();
}

function clearAll() {
  selected.clear();
  saveSelected();
  syncAllButtons();
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function canWriteImageClipboard() {
  return !!(navigator.clipboard && typeof navigator.clipboard.write === "function" && typeof ClipboardItem !== "undefined");
}

function loadHtmlToImage() {
  if (typeof htmlToImage !== "undefined") return Promise.resolve();
  if (htmlToImageReady) return htmlToImageReady;
  htmlToImageReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = HTML_TO_IMAGE_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      htmlToImageReady = null;
      reject(new Error("截图组件加载失败"));
    };
    document.head.appendChild(s);
  });
  return htmlToImageReady;
}

function normalizePngBlob(blob) {
  if (!blob) throw new Error("生成图片失败");
  if (!blob.type || blob.type === "image/png") return blob;
  return blob.slice(0, blob.size, "image/png");
}

function restoreScroll(x, y) {
  const apply = () => window.scrollTo(x, y);
  apply();
  requestAnimationFrame(apply);
}

/**
 * 离屏克隆截图，不改动可见页面尺寸，避免滚动跳到中间。
 * 克隆宿主挂 sedai-capture-mode，强制一行 20 格（与桌面导出一致）。
 */
let captureBusy = false;

async function captureImage() {
  const panel = document.getElementById("grid-panel");
  if (!panel) throw new Error("截图区域不存在");

  await loadHtmlToImage();
  if (typeof htmlToImage === "undefined") {
    throw new Error("截图组件未加载");
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const host = document.createElement("div");
  host.className = "sedai-capture-host sedai-capture-mode";
  host.setAttribute("aria-hidden", "true");

  const clone = panel.cloneNode(true);
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  host.appendChild(clone);
  document.body.appendChild(host);

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const scale = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  try {
    const blob = await htmlToImage.toBlob(clone, {
      scale,
      pixelRatio: scale,
      cacheBust: false,
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains("remove")),
    });
    return normalizePngBlob(blob);
  } finally {
    host.remove();
    restoreScroll(scrollX, scrollY);
  }
}

function triggerDownload(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "gal-sedai.png";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyImage() {
  if (captureBusy) return;
  captureBusy = true;
  const copyBtn = document.getElementById("btn-copy");
  const dlBtn = document.getElementById("btn-download");
  copyBtn?.setAttribute("aria-busy", "true");
  if (copyBtn) copyBtn.disabled = true;
  if (dlBtn) dlBtn.disabled = true;
  showToast("复制中...");

  try {
    if (!canWriteImageClipboard()) {
      try {
        triggerDownload(await captureImage());
        showToast("当前浏览器不支持复制图片，已改为下载");
      } catch (error) {
        showToast(`操作失败: ${error instanceof Error ? error.message : "未知错误"}`);
      }
      return;
    }

    let resolvedBlob = null;
    const blobPromise = captureImage().then((blob) => {
      resolvedBlob = blob;
      return blob;
    });

    try {
      /* 同步构造 ClipboardItem(Promise)，保留点击手势；手机端尤其依赖这点 */
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blobPromise }),
      ]);
      showToast("复制成功");
    } catch (error) {
      try {
        const blob = resolvedBlob || (await blobPromise.catch(() => null)) || (await captureImage());
        triggerDownload(blob);
        showToast("浏览器不支持复制图片，已改为下载");
      } catch {
        showToast(`复制失败: ${error instanceof Error ? error.message : "未知错误"}`);
      }
    }
  } finally {
    captureBusy = false;
    copyBtn?.removeAttribute("aria-busy");
    if (copyBtn) copyBtn.disabled = false;
    if (dlBtn) dlBtn.disabled = false;
  }
}

async function downloadImage() {
  if (captureBusy) return;
  captureBusy = true;
  const copyBtn = document.getElementById("btn-copy");
  const dlBtn = document.getElementById("btn-download");
  dlBtn?.setAttribute("aria-busy", "true");
  if (copyBtn) copyBtn.disabled = true;
  if (dlBtn) dlBtn.disabled = true;
  showToast("下载中...");
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  try {
    const blob = await captureImage();
    triggerDownload(blob);
    restoreScroll(scrollX, scrollY);
    showToast("下载成功");
  } catch (error) {
    restoreScroll(scrollX, scrollY);
    showToast(`下载失败: ${error instanceof Error ? error.message : "未知错误"}`);
  } finally {
    captureBusy = false;
    dlBtn?.removeAttribute("aria-busy");
    if (copyBtn) copyBtn.disabled = false;
    if (dlBtn) dlBtn.disabled = false;
  }
}

window.KayaGalSedai = {
  init() {
    gridPanel.addEventListener("click", (event) => {
      const btn = event.target.closest(".sedai-game-btn");
      if (!btn || !gridPanel.contains(btn)) return;
      toggleGame(btn.dataset.title, btn);
    });
    document.getElementById("btn-select-all").addEventListener("click", selectAll);
    clearBtn.addEventListener("click", clearAll);
    document.getElementById("btn-copy").addEventListener("click", copyImage);
    document.getElementById("btn-download").addEventListener("click", downloadImage);
    renderGrid();

    const warm = () => {
      loadHtmlToImage().catch(() => {});
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(warm, { timeout: 2500 });
    } else {
      setTimeout(warm, 1200);
    }
  },
};
