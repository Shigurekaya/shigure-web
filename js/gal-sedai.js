const STORAGE_KEY = "selectedGalgames";
const DISPLAY_COUNT = 20;

let selected = loadSelected();
const totalGames = getAllDisplayTitles().length;

const gridPanel = document.getElementById("grid-panel");
const clearBtn = document.getElementById("btn-clear");
const toastEl = document.getElementById("toast");

function loadSelected() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSelected() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
}

function getAllDisplayTitles() {
  return Object.keys(GAMES).flatMap((year) =>
    GAMES[year].slice(0, DISPLAY_COUNT).map((game) => game.title)
  );
}

function renderGrid() {
  gridPanel.innerHTML = "";

  const header = document.createElement("div");
  header.className = "sedai-grid-header";
  header.innerHTML = `
    <h1>Gal世代<span class="sedai-grid-header__subtitle"> - 点击选择你玩过的galgame</span></h1>
    <span class="sedai-grid-header__counter" id="counter">我玩过 ${selected.length}/${totalGames} 部galgame</span>
  `;
  gridPanel.appendChild(header);

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
        const isSelected = selected.includes(game.title);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `sedai-game-btn${isSelected ? " is-selected" : ""}`;
        btn.title = game.title;
        btn.dataset.title = game.title;
        btn.innerHTML = `<span>${escapeHtml(game.title)}</span>`;
        btn.addEventListener("click", () => toggleGame(game.title));
        gamesRow.appendChild(btn);
      });

      row.appendChild(gamesRow);
      gridPanel.appendChild(row);
    });

  updateCounter();
}

function updateCounter() {
  const el = document.getElementById("counter");
  if (el) {
    el.textContent = `我玩过 ${selected.length}/${totalGames} 部galgame`;
  }
  clearBtn.hidden = selected.length === 0;
}

function toggleGame(title) {
  if (selected.includes(title)) {
    selected = selected.filter((item) => item !== title);
  } else {
    selected = [...selected, title];
  }
  saveSelected();
  renderGrid();
}

function selectAll() {
  selected = getAllDisplayTitles();
  saveSelected();
  renderGrid();
}

function clearAll() {
  selected = [];
  saveSelected();
  renderGrid();
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove("show"), 2000);
}

async function captureImage() {
  const panel = document.getElementById("grid-panel");
  if (!panel || typeof htmlToImage === "undefined") {
    throw new Error("截图组件未加载");
  }

  document.body.classList.add("sedai-capture-mode");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  try {
    return await htmlToImage.toBlob(panel, {
      scale: 2,
      filter: (node) => !(node instanceof HTMLElement && node.classList.contains("remove")),
    });
  } finally {
    document.body.classList.remove("sedai-capture-mode");
  }
}

async function copyImage() {
  showToast("复制中...");
  try {
    const blob = await captureImage();
    if (!blob) throw new Error("生成图片失败");
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    showToast("复制成功");
  } catch (error) {
    showToast(`复制失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

async function downloadImage() {
  showToast("下载中...");
  try {
    const blob = await captureImage();
    if (!blob) throw new Error("生成图片失败");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gal-sedai.png";
    link.click();
    URL.revokeObjectURL(url);
    showToast("下载成功");
  } catch (error) {
    showToast(`下载失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.KayaGalSedai = {
  init() {
    document.getElementById("btn-select-all").addEventListener("click", selectAll);
    clearBtn.addEventListener("click", clearAll);
    document.getElementById("btn-copy").addEventListener("click", copyImage);
    document.getElementById("btn-download").addEventListener("click", downloadImage);
    renderGrid();
  },
};
