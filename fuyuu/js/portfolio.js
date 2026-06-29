/** 作品集 PORTFOLIO — 全宽瀑布流 */
(() => {
  const PAGE_SIZE = 12;
  let shown = PAGE_SIZE;

  function updateLoadMore(loadBtn, total) {
    if (!loadBtn) return;
    loadBtn.classList.toggle("hidden", total - shown <= 0);
    loadBtn.textContent = "Load More";
  }

  function renderGrid() {
    const grid = document.getElementById("portfolio-grid");
    const loadBtn = document.getElementById("load-more");
    if (!grid) return;

    const videos = Site.data().videos;
    const items = videos.slice(0, shown).map((v, i) => Site.createMasonryItem(v, i));
    Masonry.fill(grid, items);
    updateLoadMore(loadBtn, videos.length);
    Motion.refresh(grid);
  }

  document.addEventListener("DOMContentLoaded", () => {
    Site.initCommon();
    renderGrid();
    Site.renderLinkBand(document.getElementById("link-band"));
    Motion.refresh();

    document.getElementById("load-more")?.addEventListener("click", () => {
      shown = Math.min(shown + PAGE_SIZE, Site.data().videos.length);
      renderGrid();
    });
  });
})();
