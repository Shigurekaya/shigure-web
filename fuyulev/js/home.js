/** 首页 HOME */
(() => {
  const PAGE_SIZE = 12;
  let shown = PAGE_SIZE;

  function renderGrid(appendFrom = 0) {
    const grid = document.getElementById("work-grid");
    const loadBtn = document.getElementById("load-more");
    if (!grid) return;

    const videos = Site.data().videos;
    if (appendFrom === 0) grid.innerHTML = "";

    videos.slice(appendFrom, shown).forEach((v, j) => {
      grid.appendChild(Site.createMasonryItem(v, appendFrom + j));
    });

    loadBtn?.classList.toggle("hidden", shown >= videos.length);
    Motion.refresh(grid);
  }

  document.addEventListener("DOMContentLoaded", () => {
    Site.initCommon();
    Site.fillUserHero();
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
