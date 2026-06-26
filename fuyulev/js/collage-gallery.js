/**
 * Collage 拼贴画廊 — komowata galleryLayout:0
 * 首页使用 komowata-ref 导出的真实 slot 坐标；其他页用简化三列拼贴
 */
const CollageGallery = (() => {
  const GAP = 23;
  const COLS = 3;
  const tracked = new Set();
  let resizeTimer;
  let inited = false;

  const SELECTOR = ".km-gallery-item";

  function usesKomowataLayout(container) {
    const layout = window.KOMOWATA_COLLAGE_LAYOUT;
    if (!layout?.slots?.length) return false;
    return container.dataset.layout === "komowata"
      || container.classList.contains("km-gallery--komowata");
  }

  function collectItems(container) {
    return [...container.querySelectorAll(SELECTOR)];
  }

  function aspect(img) {
    if (!img) return 4 / 3;
    const w = img.naturalWidth || img.width || 3;
    const h = img.naturalHeight || img.height || 4;
    return h / w;
  }

  function rowPattern(count, aspects) {
    if (count === 1) return [3];
    if (count === 2) {
      if (aspects[0] <= aspects[1]) return [2, 1];
      return [1, 2];
    }
    return [1, 1, 1];
  }

  function layoutKomowata(container, items) {
    const layout = window.KOMOWATA_COLLAGE_LAYOUT;
    if (!layout?.slots?.length) {
      layoutMasonry(container, items);
      return;
    }

    const width = container.getBoundingClientRect().width;
    if (width <= 0) return;

    const slots = layout.slots;
    const hSpan = Math.max(1, ...slots.map((s) => s.left + s.width));
    const vSpan = Math.max(1, ...slots.map((s) => s.top + s.height));
    const aspect = (layout.canvasHeight / layout.canvasWidth) * (vSpan / hSpan);
    const blockH = width * aspect;
    let maxBottom = 0;

    items.forEach((el, i) => {
      const block = Math.floor(i / slots.length);
      const slot = slots[i % slots.length];
      const left = (slot.left / hSpan) * width;
      const top = (slot.top / vSpan) * blockH + block * blockH;
      const w = (slot.width / hSpan) * width;
      const h = (slot.height / vSpan) * blockH;

      el.style.position = "absolute";
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;

      const img = el.querySelector("img");
      if (img) {
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
      }

      maxBottom = Math.max(maxBottom, top + h);
    });

    container.style.height = `${maxBottom}px`;
  }

  /** 三列瀑布流 — komowata 坐标不可用时的后备 */
  function layoutMasonry(container, items) {
    const width = container.getBoundingClientRect().width;
    if (width <= 0) return;

    const cols = width < 560 ? 1 : width < 900 ? 2 : 3;
    const colWidth = (width - GAP * (cols - 1)) / cols;
    const colHeights = Array(cols).fill(0);

    items.forEach((el) => {
      const img = el.querySelector("img");
      const ar = aspect(img);
      const itemH = colWidth * ar;
      const col = colHeights.indexOf(Math.min(...colHeights));
      const left = col * (colWidth + GAP);
      const top = colHeights[col];

      el.style.position = "absolute";
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${colWidth}px`;
      el.style.height = `${itemH}px`;

      if (img) {
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
      }

      colHeights[col] += itemH + GAP;
    });

    container.style.height = `${Math.max(...colHeights, 0) - GAP}px`;
  }

  function layoutSimple(container, items) {
    const width = container.getBoundingClientRect().width;

    if (width < 500) {
      let y = 0;
      items.forEach((el) => {
        const img = el.querySelector("img");
        const ar = aspect(img);
        const itemH = width * ar;
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = `${y}px`;
        el.style.width = `${width}px`;
        el.style.height = `${itemH}px`;
        y += itemH + GAP;
      });
      container.style.height = `${Math.max(0, y - GAP)}px`;
      return;
    }

    const cols = width < 768 ? 2 : COLS;
    const colWidth = (width - GAP * (cols - 1)) / cols;
    let y = 0;
    let i = 0;

    while (i < items.length) {
      const rowSize = Math.min(cols, items.length - i);
      const rowItems = items.slice(i, i + rowSize);
      const aspects = rowItems.map((el) => aspect(el.querySelector("img")));
      const pattern = rowPattern(rowSize, aspects);

      let x = 0;
      let rowHeight = 0;

      pattern.forEach((span, j) => {
        const itemW = colWidth * span + GAP * (span - 1);
        rowHeight = Math.max(rowHeight, itemW * aspects[j]);
        x += itemW + GAP;
      });

      pattern.forEach((span, j) => {
        const el = rowItems[j];
        const itemW = colWidth * span + GAP * (span - 1);
        el.style.position = "absolute";
        el.style.left = `${pattern.slice(0, j).reduce((sum, s, k) => sum + colWidth * s + GAP, 0)}px`;
        el.style.top = `${y}px`;
        el.style.width = `${itemW}px`;
        el.style.height = `${rowHeight}px`;
        const img = el.querySelector("img");
        if (img) {
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
        }
      });

      y += rowHeight + GAP;
      i += rowSize;
    }

    container.style.height = `${Math.max(0, y - GAP)}px`;
  }

  function layout(container) {
    const items = collectItems(container);
    if (!items.length) {
      container.style.height = "0";
      return;
    }

    if (usesKomowataLayout(container)) {
      layoutKomowata(container, items);
    } else if (container.classList.contains("km-gallery")) {
      layoutMasonry(container, items);
    } else {
      layoutSimple(container, items);
    }
  }

  function bindImages(container) {
    container.querySelectorAll("img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", () => schedule(container), { once: true });
      img.addEventListener("error", () => schedule(container), { once: true });
    });
  }

  const pending = new Map();

  function schedule(container) {
    clearTimeout(pending.get(container));
    pending.set(container, setTimeout(() => layout(container), 60));
  }

  function refresh(container) {
    if (!container) return;
    tracked.add(container);
    container.style.position = "relative";
    layout(container);
    bindImages(container);
    requestAnimationFrame(() => layout(container));
  }

  function fill(container, elements) {
    if (!container) return;
    container.innerHTML = "";
    container.style.position = "relative";
    elements.forEach((el) => container.appendChild(el));
    tracked.add(container);
    refresh(container);
  }

  function init() {
    if (inited) return;
    inited = true;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        tracked.forEach((c) => refresh(c));
      }, 150);
    });
  }

  return { fill, refresh, init, layout: refresh };
})();
