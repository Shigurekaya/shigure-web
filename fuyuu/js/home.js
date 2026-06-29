/** 首页 HOME — komowata 式 CSS 三列瀑布流 */
(() => {
  const PAGE_SIZE = 12;
  let shown = PAGE_SIZE;

  function gallery() {
    return window.HOME_GALLERY || [];
  }

  function updateLoadMore(loadBtn, total) {
    if (!loadBtn) return;
    loadBtn.classList.toggle("hidden", total - shown <= 0);
    loadBtn.textContent = "Load More";
  }

  function renderGrid() {
    const grid = document.getElementById("work-grid");
    const loadBtn = document.getElementById("load-more");
    if (!grid) return;

    grid.innerHTML = "";
    gallery().slice(0, shown).forEach((src) => {
      grid.appendChild(Site.createGalleryItem(src));
    });

    updateLoadMore(loadBtn, gallery().length);
  }

  document.addEventListener("DOMContentLoaded", () => {
    Site.initCommon();
    Site.fillUserHero();
    renderGrid();
    Site.renderLinkBand(document.getElementById("link-band"));

    document.getElementById("load-more")?.addEventListener("click", () => {
      shown = Math.min(shown + PAGE_SIZE, gallery().length);
      renderGrid();
    });
  });
})();
