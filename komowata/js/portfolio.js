/** 作品集 PORTFOLIO */
(() => {
  const PAGE_SIZE = 15;
  let shown = PAGE_SIZE;

  function renderStats() {
    const el = document.getElementById("portfolio-stats");
    if (!el) return;
    el.innerHTML = `
      <div class="stat-card stat-card--text"><span class="stat-num stat-num--text">Painting</span><span class="stat-label">Process Videos</span></div>
      <div class="stat-card stat-card--text"><span class="stat-num stat-num--text">Galgame</span><span class="stat-label">& Doujin Art</span></div>
      <div class="stat-card stat-card--text"><span class="stat-num stat-num--text">Bilibili</span><span class="stat-label">@浮游Lev</span></div>
    `;
  }

  function renderGrid(appendFrom = 0) {
    const grid = document.getElementById("portfolio-grid");
    const loadBtn = document.getElementById("load-more");
    if (!grid) return;

    const videos = Site.data().videos;
    const slice = videos.slice(appendFrom, shown);

    if (appendFrom === 0) grid.innerHTML = "";

    slice.forEach((v, j) => {
      const i = appendFrom + j;
      grid.appendChild(Site.createMasonryItem(v, i));
    });

    loadBtn?.classList.toggle("hidden", shown >= videos.length);
    Motion.refresh(grid);
  }

  document.addEventListener("DOMContentLoaded", () => {
    Site.initCommon();
    renderStats();
    renderGrid(0);
    Site.renderLinkBand(document.getElementById("link-band"));
    Motion.refresh();

    document.getElementById("load-more")?.addEventListener("click", () => {
      const prev = shown;
      shown += PAGE_SIZE;
      renderGrid(prev);
    });
  });
})();
