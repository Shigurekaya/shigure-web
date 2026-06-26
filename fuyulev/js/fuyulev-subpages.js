/** 子页：顶栏配套、页脚头像、B站列表与内容精简 */
(() => {
  const BILI = "https://space.bilibili.com/353604313";

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function placeKayaInFooter() {
    const kaya = document.querySelector(".fuyulev-kaya-corner");
    const footer = document.getElementById("SITE_FOOTER");
    if (!kaya || !footer || footer.contains(kaya)) return;
    footer.appendChild(kaya);
  }

  function renderWorkList() {
    if (!document.body.classList.contains("fuyulev-page-work")) return;
    const ul = document.querySelector("#fuyulev-work-inject .fuyulev-work-list");
    const videos = window.SITE_DATA?.videos;
    if (!ul || !videos?.length) return;

    ul.innerHTML = videos
      .slice(0, 30)
      .map((v, i) => {
        const thumb = v.thumb || `assets/images/video_${i}.jpg`;
        const meta = [v.date, v.length].filter(Boolean).join(" · ");
        return `<li class="fuyulev-work-item"><a href="https://www.bilibili.com/video/${esc(v.bvid)}" target="_blank" rel="noopener">`
          + `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" />`
          + `<span class="fuyulev-work-meta"><strong>${esc(v.title)}</strong>`
          + (meta ? `<small>${esc(meta)}</small>` : "")
          + `</span></a></li>`;
      })
      .join("");

    if (videos.length > 30 && !ul.nextElementSibling?.classList?.contains("fuyulev-more-link")) {
      const p = document.createElement("p");
      p.className = "fuyulev-more-link";
      p.innerHTML = `共 ${videos.length} 条投稿，<a href="${BILI}" target="_blank" rel="noopener">在哔哩哔哩查看全部</a>。`;
      ul.after(p);
    }
  }

  function limitGrid(selector, max) {
    const grid = document.querySelector(selector);
    if (!grid) return;
    [...grid.children].slice(max).forEach((el) => el.remove());
    if (grid.children.length >= max && !grid.nextElementSibling?.classList?.contains("fuyulev-more-link")) {
      const p = document.createElement("p");
      p.className = "fuyulev-more-link";
      p.innerHTML = `更多插画见 <a href="index.html">首页画廊</a>。`;
      grid.after(p);
    }
  }

  function simplifyCopy() {
    const kakuu = document.getElementById("fuyulev-kakuu-inject");
    if (kakuu) {
      const h1 = kakuu.querySelector(".fuyulev-page-title");
      const lead = kakuu.querySelector(".fuyulev-page-lead");
      if (h1) h1.textContent = "Q版·同人插画";
      if (lead) {
        lead.innerHTML =
          "Galgame 同人 Q 版精选（与哔哩哔哩投稿同题材）。完整画廊见 <a href=\"index.html\">首页</a>。";
      }
      limitGrid(".fuyulev-kakuu-grid", 20);
    }

    const portfolio = document.getElementById("fuyulev-portfolio-inject");
    if (portfolio) {
      const h1 = portfolio.querySelector(".fuyulev-page-title");
      const lead = portfolio.querySelector(".fuyulev-page-lead");
      if (h1) h1.textContent = "插画精选";
      if (lead) {
        lead.innerHTML =
          "与首页相同的 Q 版作品缩略展示。全部作品请见 <a href=\"index.html\">首页</a>，绘画过程见 <a href=\"work.html\">WORK</a> 或 <a href=\"" + BILI + "\" target=\"_blank\" rel=\"noopener\">哔哩哔哩</a>。";
      }
      limitGrid(".fuyulev-portfolio-grid", 24);
    }

    const work = document.getElementById("fuyulev-work-inject");
    if (work) {
      const h1 = work.querySelector(".fuyulev-page-title");
      const lead = work.querySelector(".fuyulev-page-lead");
      if (h1) h1.textContent = "WORK · 绘画过程";
      if (lead) {
        lead.innerHTML =
          "哔哩哔哩投稿的绘画过程与 Q 版插画视频。完整列表同步自 <a href=\"" + BILI + "\" target=\"_blank\" rel=\"noopener\">哔哩哔哩空间</a>。";
      }
    }

    const about = document.getElementById("fuyulev-about-inject");
    if (about) {
      const stats = about.querySelector(".fuyulev-about-stats");
      const s = window.SITE_DATA?.stats;
      if (stats && s) {
        stats.textContent = `${s.follower} 粉丝 · ${s.likes} 获赞 · ${s.videos} 投稿`;
      }
      const picks = about.querySelector(".fuyulev-about-picks");
      if (picks && window.SITE_DATA?.videos) {
        picks.innerHTML = window.SITE_DATA.videos
          .slice(0, 6)
          .map(
            (v) =>
              `<li><a href="https://www.bilibili.com/video/${esc(v.bvid)}" target="_blank" rel="noopener">${esc(v.title)}</a></li>`
          )
          .join("");
      }
      const kw = about.querySelector(".fuyulev-keywords");
      if (kw) kw.remove();
    }
  }

  function placeInjectInPage() {
    document.querySelectorAll(".fuyulev-page-inject[id]").forEach((inject) => {
      if (inject.dataset.fuyulevPlaced) return;
      const pageRoot = document.querySelector(
        '#SITE_PAGES [id^="Container"] [data-testid="mesh-container-content"]'
      );
      if (!pageRoot || pageRoot.contains(inject)) {
        inject.dataset.fuyulevPlaced = "1";
        return;
      }
      pageRoot.insertBefore(inject, pageRoot.firstChild);
      inject.dataset.fuyulevPlaced = "1";
    });
  }

  function init() {
    if (!document.body.classList.contains("km-site")) return;
    placeInjectInPage();
    placeKayaInFooter();
    renderWorkList();
    simplifyCopy();
  }

  init();
  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
})();
