/** 子页：顶栏配套、页脚头像、B站列表与内容精简 */
(() => {
  const BILI = "https://space.bilibili.com/353604313";

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function placeKayaInFooter() {
    const kaya = document.querySelector(".fy-kaya-corner");
    const footer = document.getElementById("SITE_FOOTER");
    if (!kaya || !footer || footer.contains(kaya)) return;
    footer.appendChild(kaya);
  }

  function renderWorkList() {
    if (!document.body.classList.contains("fy-page-work")) return;
    const ul = document.querySelector("#fy-work-inject .fy-work-list");
    const videos = window.SITE_DATA?.videos;
    if (!ul || !videos?.length) return;

    ul.innerHTML = videos
      .slice(0, 30)
      .map((v, i) => {
        const thumb = v.thumb ? v.thumb : (v.bvid ? `assets/images/covers/${v.bvid}.jpg` : `assets/images/avatar.jpg`);
        const meta = [v.date, v.length].filter(Boolean).join(" · ");
        return `<li class="fy-work-item"><a href="https://www.bilibili.com/video/${esc(v.bvid)}" target="_blank" rel="noopener">`
          + `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async" />`
          + `<span class="fy-work-meta"><strong>${esc(v.title)}</strong>`
          + (meta ? `<small>${esc(meta)}</small>` : "")
          + `</span></a></li>`;
      })
      .join("");

    if (videos.length > 30 && !ul.nextElementSibling?.classList?.contains("fy-more-link")) {
      const p = document.createElement("p");
      p.className = "fy-more-link";
      p.innerHTML = `更多投稿见 <a href="${BILI}" target="_blank" rel="noopener">哔哩哔哩主页</a>。`;
      ul.after(p);
    }
  }

  function limitGrid(selector, max) {
    const grid = document.querySelector(selector);
    if (!grid) return;
    [...grid.children].slice(max).forEach((el) => el.remove());
    if (grid.children.length >= max && !grid.nextElementSibling?.classList?.contains("fy-more-link")) {
      const p = document.createElement("p");
      p.className = "fy-more-link";
      p.innerHTML = `更多插画见 <a href="index.html">首页画廊</a>。`;
      grid.after(p);
    }
  }

  function simplifyCopy() {
    const kakuu = document.getElementById("fy-kakuu-inject");
    if (kakuu) kakuu.remove();

    const portfolio = document.getElementById("fy-portfolio-inject");
    if (portfolio) {
      const h1 = portfolio.querySelector(".fy-page-title");
      const lead = portfolio.querySelector(".fy-page-lead");
      if (h1) h1.textContent = "插画精选";
      if (lead) {
        lead.innerHTML =
          "与首页相同的 Q 版作品缩略展示。全部作品请见 <a href=\"index.html\">首页</a>，绘画过程见 <a href=\"work.html\">WORK</a> 或 <a href=\"" + BILI + "\" target=\"_blank\" rel=\"noopener\">哔哩哔哩</a>。";
      }
      limitGrid(".fy-portfolio-grid", 24);
    }

    const work = document.getElementById("fy-work-inject");
    if (work) {
      const h1 = work.querySelector(".fy-page-title");
      const lead = work.querySelector(".fy-page-lead");
      if (h1) h1.textContent = "WORK · 绘画过程";
      if (lead) {
        lead.innerHTML =
          "哔哩哔哩投稿的绘画过程与 Q 版插画视频。完整列表同步自 <a href=\"" + BILI + "\" target=\"_blank\" rel=\"noopener\">哔哩哔哩空间</a>。";
      }
    }

    const about = document.getElementById("fy-about-inject");
    if (about) {
      about.querySelector(".fy-about-stats")?.remove();
      const picks = about.querySelector(".fy-about-picks");
      if (picks && window.SITE_DATA?.videos) {
        picks.innerHTML = window.SITE_DATA.videos
          .slice(0, 6)
          .map(
            (v) =>
              `<li><a href="https://www.bilibili.com/video/${esc(v.bvid)}" target="_blank" rel="noopener">${esc(v.title)}</a></li>`
          )
          .join("");
      }
      const kw = about.querySelector(".fy-keywords");
      if (kw) kw.remove();
    }
  }

  function placeInjectInPage() {
    document.querySelectorAll(".fy-page-inject[id]").forEach((inject) => {
      if (inject.dataset.fyPlaced) return;
      const pageRoot = document.querySelector(
        '#SITE_PAGES [id^="Container"] [data-testid="mesh-container-content"]'
      );
      if (!pageRoot || pageRoot.contains(inject)) {
        inject.dataset.fyPlaced = "1";
        return;
      }
      pageRoot.insertBefore(inject, pageRoot.firstChild);
      inject.dataset.fyPlaced = "1";
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
