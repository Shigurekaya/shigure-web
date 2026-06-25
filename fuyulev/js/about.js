/** 关于 ABOUT */
(() => {
  const KEYWORDS = ["Q版", "SD", "Galgame", "柚子社", "同人插画", "绘画过程", "约稿", "Key 社", "蔚蓝档案"];

  function renderAbout() {
    const { user, videos } = Site.data();

    const avatar = document.getElementById("about-avatar");
    if (avatar && user.avatar) {
      avatar.src = user.avatar.includes("..") ? "assets/images/avatar.jpg" : user.avatar;
    }

    const nameEl = document.getElementById("about-name");
    const signEl = document.getElementById("about-sign");
    if (nameEl) nameEl.textContent = user.name || "浮游Lev";
    if (signEl) signEl.textContent = user.sign || "梦想成为自由的旮旯给木画师";

    const featured = document.getElementById("about-featured");
    if (featured) {
      featured.innerHTML = videos.slice(0, 3).map((v, i) => {
        const src = Site.thumb(v, i);
        return `
          <a href="${Site.bili(v.bvid)}" target="_blank" rel="noopener" class="featured-card reveal">
            <img src="${Site.esc(src)}" alt="${Site.esc(v.title)}" loading="lazy" onerror="this.src='assets/images/avatar.jpg'" />
            <span class="featured-card-cap">
              <span class="featured-card-title">${Site.esc(v.title)}</span>
              <span class="featured-card-meta">${Site.esc(v.date || "")}</span>
            </span>
          </a>
        `;
      }).join("");
    }

    const picksEl = document.getElementById("about-picks");
    if (picksEl) {
      picksEl.innerHTML = videos.slice(0, 6).map((v) => `
        <li><a href="${Site.bili(v.bvid)}" target="_blank" rel="noopener">${Site.esc(v.title)}</a></li>
      `).join("");
    }

    const kwEl = document.getElementById("about-keywords");
    if (kwEl) {
      kwEl.innerHTML = KEYWORDS.map((k) => `<span class="keyword-tag">${Site.esc(k)}</span>`).join("");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    Site.initCommon();
    renderAbout();
    Site.renderLinkBand(document.getElementById("link-band"));
    Motion.refresh();
  });
})();
