/** 瀑布流 — komowata 三列，980px 内容区内 */
const Masonry = (() => {
  const GAP = 23;
  const tracked = new Set();
  let resizeTimer;

  function columnCount(width) {
    if (width < 500) return 1;
    if (width < 768) return 2;
    return 3;
  }

  function collectItems(container) {
    return [...container.querySelectorAll(".masonry-item")];
  }

  function buildColumns(container, cols) {
    container.querySelector(".pro-masonry__cols")?.remove();
    const wrap = document.createElement("div");
    wrap.className = "pro-masonry__cols";
    const colEls = Array.from({ length: cols }, () => {
      const col = document.createElement("div");
      col.className = "pro-masonry__col";
      wrap.appendChild(col);
      return col;
    });
    container.appendChild(wrap);
    return colEls;
  }

  function distribute(colEls, items) {
    items.forEach((el) => el.remove());
    if (!colEls.length || !items.length) return;

    const heights = new Array(colEls.length).fill(0);
    items.forEach((item) => {
      let min = 0;
      for (let i = 1; i < heights.length; i++) {
        if (heights[i] < heights[min]) min = i;
      }
      colEls[min].appendChild(item);
      const h = item.getBoundingClientRect().height;
      heights[min] += (h > 0 ? h : 220) + GAP;
    });
  }

  function layout(container) {
    const items = collectItems(container);
    if (!items.length) {
      container.querySelector(".pro-masonry__cols")?.remove();
      return;
    }

    const width = container.getBoundingClientRect().width || window.innerWidth;
    const cols = columnCount(width);
    const colEls = buildColumns(container, cols);
    distribute(colEls, items);
  }

  function layoutAfterImages(container) {
    layout(container);
    requestAnimationFrame(() => {
      const colEls = [...container.querySelectorAll(".pro-masonry__col")];
      distribute(colEls, collectItems(container));
    });

    container.querySelectorAll("img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", () => schedule(container), { once: true });
      img.addEventListener("error", () => schedule(container), { once: true });
    });
  }

  const pending = new Map();

  function schedule(container) {
    clearTimeout(pending.get(container));
    pending.set(container, setTimeout(() => {
      const colEls = [...container.querySelectorAll(".pro-masonry__col")];
      if (colEls.length) distribute(colEls, collectItems(container));
    }, 80));
  }

  function fill(container, elements) {
    if (!container) return;
    container.innerHTML = "";
    elements.forEach((el) => container.appendChild(el));
    tracked.add(container);
    layoutAfterImages(container);
  }

  function refresh(container) {
    if (!container) return;
    tracked.add(container);
    layoutAfterImages(container);
  }

  let inited = false;

  function init() {
    if (inited) return;
    inited = true;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        tracked.forEach((c) => layoutAfterImages(c));
      }, 160);
    });
  }

  return { fill, refresh, init, layout: layoutAfterImages };
})();
