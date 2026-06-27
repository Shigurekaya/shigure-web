/**
 * 不规则拼贴画廊 — 固定槽位坐标（非瀑布流）
 * 每张图按 HOME_GALLERY 顺序固定对应槽位，Load More 时不重排已有图片
 */
const CollageGallery = (() => {
  /** 整体压缩高度，一屏可展示更多作品 */
  const BLOCK_COMPACT = 0.68;
  const MOBILE_COMPACT = 0.58;
  const MOBILE_MAX = 640;
  const SLOT_GAP = 5;

  const tracked = new Set();
  let resizeTimer;
  let inited = false;

  const SELECTOR = ".km-gallery-item";

  function layoutDef() {
    return window.KOMOWATA_COLLAGE_LAYOUT;
  }

  function collectItems(container) {
    return [...container.querySelectorAll(SELECTOR)];
  }

  function layoutCollage(container, items) {
    const layout = layoutDef();
    if (!layout?.slots?.length || !items.length) {
      container.style.height = "0";
      return;
    }

    const width = container.getBoundingClientRect().width;
    if (width <= 0) return;

    const slots = layout.slots;
    const slotCount = slots.length;
    const hSpan = Math.max(1, ...slots.map((s) => s.left + s.width));
    const vSpan = Math.max(1, ...slots.map((s) => s.top + s.height));
    const compact = width <= MOBILE_MAX ? MOBILE_COMPACT : BLOCK_COMPACT;
    const blockAspect = (layout.canvasHeight / layout.canvasWidth) * (vSpan / hSpan) * compact;
    const blockH = width * blockAspect;

    let maxBottom = 0;

    items.forEach((el, globalIdx) => {
      const block = Math.floor(globalIdx / slotCount);
      const slotIdx = globalIdx % slotCount;
      const slot = slots[slotIdx];

      const left = (slot.left / hSpan) * width + SLOT_GAP / 2;
      const top = (slot.top / vSpan) * blockH + block * blockH + SLOT_GAP / 2;
      const w = Math.max(1, (slot.width / hSpan) * width - SLOT_GAP);
      const h = Math.max(1, (slot.height / vSpan) * blockH - SLOT_GAP);

      el.style.position = "absolute";
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;

      const img = el.querySelector("img");
      if (img) {
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        img.style.objectPosition = "center";
        img.style.background = "#fafafa";
      }

      maxBottom = Math.max(maxBottom, top + h);
    });

    container.style.position = "relative";
    container.style.height = `${maxBottom}px`;
  }

  function layout(container) {
    const items = collectItems(container);
    if (!items.length) {
      container.style.height = "0";
      return;
    }
    layoutCollage(container, items);
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
    container.classList.remove("km-gallery--rows");
    layout(container);
    bindImages(container);
    requestAnimationFrame(() => layout(container));
  }

  function fill(container, elements) {
    if (!container) return;
    container.innerHTML = "";
    elements.forEach((el) => container.appendChild(el));
    tracked.add(container);
    refresh(container);
  }

  /** 追加新项，保留已有 DOM 与布局位置 */
  function append(container, elements) {
    if (!container || !elements.length) return;
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

  return { fill, append, refresh, init, layout: refresh };
})();
