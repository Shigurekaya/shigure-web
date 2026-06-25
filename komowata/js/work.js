/** 作品履历 WORK */
(() => {
  function renderStats() {
    const el = document.getElementById("work-stats");
    if (!el) return;
    const videos = Site.data().videos;
    const years = new Set(videos.map((v) => (v.date || "").split(".")[0]).filter(Boolean));
    el.innerHTML = `
      <div class="stat-card"><span class="stat-num" data-count="${videos.length}">0</span><span class="stat-label">投稿作品</span></div>
      <div class="stat-card"><span class="stat-num" data-count="${years.size}">0</span><span class="stat-label">活跃年份</span></div>
    `;
  }

  function renderTimeline() {
    const root = document.getElementById("work-timeline");
    if (!root) return;

    const videos = Site.data().videos;
    const byYear = {};
    videos.forEach((v, i) => {
      const year = (v.date || "").split(".")[0] || "—";
      (byYear[year] ||= []).push({ ...v, _i: i });
    });

    const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));
    root.innerHTML = years.map((year) => {
      const items = byYear[year]
        .map((v) => {
          const src = Site.thumb(v, v._i);
          const meta = [v.date, v.length].filter(Boolean).join(" · ");
          return `
            <li class="work-entry">
              <a class="work-entry-link" href="${Site.bili(v.bvid)}" target="_blank" rel="noopener">
                <img class="work-entry-thumb" src="${Site.esc(src)}" alt="" loading="lazy" onerror="this.src='assets/images/avatar.jpg'" />
                <span class="work-entry-body">
                  <span class="work-entry-title">${Site.esc(v.title)}</span>
                  <span class="work-entry-meta">${Site.esc(meta)}</span>
                </span>
                <span class="work-entry-arrow" aria-hidden="true">→</span>
              </a>
            </li>
          `;
        })
        .join("");
      return `
        <section class="work-year reveal">
          <h3 class="work-year-title">${Site.esc(year)}<span class="work-year-count">${byYear[year].length}</span></h3>
          <ul class="work-year-list">${items}</ul>
        </section>
      `;
    }).join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    Site.initCommon();
    renderStats();
    renderTimeline();
    Site.renderLinkBand(document.getElementById("link-band"));
    Motion.refresh();
  });
})();
