/** 首页 — 用 CollageGallery 替换失效的 Wix Pro Gallery（对齐 komowata.com） */
(() => {
  const PAGE_SIZE = 20;
  let shown = PAGE_SIZE;
  let loadBound = false;

  function gallery() {
    return window.HOME_GALLERY || [];
  }

  function ensureInject() {
    if (document.getElementById("fuyulev-home-inject")) return;

    const host = document.getElementById("comp-j3v9refx")
      || document.getElementById("comp-j3v9refi")
      || document.getElementById("comp-j3v9reg1");
    if (!host) return;

    const wrap = document.createElement("div");
    wrap.id = "fuyulev-home-inject";
    wrap.className = "fuyulev-home-inject";
    wrap.innerHTML = `
      <div class="km-gallery-wrap">
        <div id="work-grid" class="km-gallery" data-layout="komowata" aria-label="插画画廊"></div>
      </div>
      <div class="km-load-wrap">
        <button type="button" id="load-more" class="km-load-btn">Load More</button>
      </div>
    `;
    host.appendChild(wrap);
  }

  function bindLoadMore() {
    if (loadBound) return;
    const wrap = document.getElementById("fuyulev-home-inject");
    if (!wrap) return;
    wrap.addEventListener("click", (e) => {
      const btn = e.target.closest("#load-more");
      if (!btn || btn.classList.contains("hidden")) return;
      e.preventDefault();
      e.stopPropagation();
      shown = Math.min(shown + PAGE_SIZE, gallery().length);
      renderGrid();
    });
    loadBound = true;
  }

  function hideWixGallery() {
    ["comp-j3v9reg1", "gallery-wrapper-comp-j3v9reg1"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = "none";
        el.style.height = "0";
        el.style.minHeight = "0";
        el.style.margin = "0";
      }
    });
    document.querySelectorAll("#pro-gallery-comp-j3v9reg1, .layout-fixer-style").forEach((el) => {
      el.style.display = "none";
    });
    ["comp-j3v9refx", "comp-j3v9refi", "comp-l6z9resp"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.height = "auto";
        el.style.minHeight = "0";
      }
    });
  }

  function updateLoadMore(btn, total) {
    if (!btn) return;
    btn.classList.toggle("hidden", shown >= total);
    btn.textContent = "Load More";
  }

  function placeKayaInFooter() {
    const kaya = document.querySelector(".fuyulev-kaya-corner");
    const footer = document.getElementById("SITE_FOOTER");
    if (!kaya || !footer || footer.contains(kaya)) return;
    footer.appendChild(kaya);
  }

  function renderGrid() {
    const grid = document.getElementById("work-grid");
    const loadBtn = document.getElementById("load-more");
    if (!grid || typeof Site === "undefined") return;

    const items = gallery()
      .slice(0, shown)
      .map((src) => Site.createGalleryItem(src));

    if (typeof CollageGallery !== "undefined") {
      CollageGallery.fill(grid, items);
    } else {
      grid.innerHTML = "";
      items.forEach((el) => grid.appendChild(el));
    }

    updateLoadMore(loadBtn, gallery().length);
  }

  function ensureLightbox() {
    if (document.getElementById("lightbox")) return;
    const lb = document.createElement("div");
    lb.id = "lightbox";
    lb.className = "lightbox";
    lb.hidden = true;
    lb.innerHTML = `
      <button type="button" id="lightbox-close" class="lightbox-close" aria-label="关闭">×</button>
      <img id="lightbox-img" src="" alt="" />
      <p id="lightbox-title" class="lightbox-title" hidden></p>
      <a id="lightbox-link" class="lightbox-link" hidden target="_blank" rel="noopener">在哔哩哔哩打开</a>
    `;
    document.body.appendChild(lb);
  }

  function init() {
    if (!document.body.classList.contains("fuyulev-page-index")) return;
    ensureLightbox();
    ensureInject();
    hideWixGallery();
    bindLoadMore();
    placeKayaInFooter();
    if (typeof Site !== "undefined") Site.initCommon?.();
    renderGrid();

    window.addEventListener("resize", () => {
      const grid = document.getElementById("work-grid");
      if (grid && typeof CollageGallery !== "undefined") CollageGallery.refresh(grid);
    });

    window.addEventListener("load", placeKayaInFooter);
    setTimeout(placeKayaInFooter, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
