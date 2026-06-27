/**
 * 不规则拼贴画廊 — 固定槽位坐标（非瀑布流）
 * 桌面：komowata 槽位拼贴；手机：双行横向紧密排列（完整显示、少留空）
 */
const CollageGallery = (() => {
  const BLOCK_COMPACT = 0.68;
  const MOBILE_MAX = 768;
  const SLOT_GAP = 5;
  const MOBILE_GAP = 3;
  const MOBILE_ROWS = 2;

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

  function viewportWidth(container) {
    const wrap = container.closest(".km-gallery-wrap");
    return wrap?.getBoundingClientRect().width
      || container.getBoundingClientRect().width
      || window.innerWidth;
  }

  function setScrollWrap(container, on) {
    container.closest(".km-gallery-wrap")?.classList.toggle("km-gallery-wrap--scroll", on);
  }

  function imageAspect(el) {
    const img = el.querySelector("img");
    if (!img?.naturalWidth || !img?.naturalHeight) return null;
    return img.naturalWidth / img.naturalHeight;
  }

  function styleItemImg(el) {
    const img = el.querySelector("img");
    if (!img) return;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.objectPosition = "center";
    img.style.background = "transparent";
  }

  function placeFrame(el, left, top, w, h) {
    el.style.position = "absolute";
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    styleItemImg(el);
  }

  function layoutMobileRows(container, items) {
    const layout = layoutDef();
    const slots = layout?.slots ?? [];
    const slotCount = Math.max(1, slots.length);
    const vSpan = slots.length
      ? Math.max(1, ...slots.map((s) => s.top + s.height))
      : 1;

    const vw = viewportWidth(container);
    if (vw <= 0) return;

    const gap = MOBILE_GAP;
    const baseH = vw * 0.4;
    const rowX = Array(MOBILE_ROWS).fill(0);

    const planned = items.map((el, i) => {
      const row = i % MOBILE_ROWS;
      const slot = slots[i % slotCount];
      const slotFactor = slot ? slot.height / (vSpan / MOBILE_ROWS) : 1;
      const h = baseH * Math.min(1.35, Math.max(0.82, slotFactor * 1.05));
      const aspect = imageAspect(el) || 1;
      const w = h * aspect;
      return { el, row, h, w };
    });

    const row0Max = planned.reduce(
      (max, p) => (p.row === 0 ? Math.max(max, p.h) : max),
      0,
    );
    const row1Top = row0Max + gap;

    planned.forEach(({ el, row, h, w }) => {
      const y = row === 0 ? 0 : row1Top;
      placeFrame(el, rowX[row], y, w, h);
      rowX[row] += w + gap;
    });

    const row1Max = planned.reduce(
      (max, p) => (p.row === 1 ? Math.max(max, p.h) : max),
      0,
    );
    const totalW = Math.max(...rowX);
    const totalH = row1Max > 0 ? row1Top + row1Max : row0Max;

    container.style.position = "relative";
    container.style.width = `${totalW}px`;
    container.style.minWidth = `${totalW}px`;
    container.style.height = `${totalH}px`;
  }

  function layoutCollage(container, items) {
    const layout = layoutDef();
    if (!layout?.slots?.length || !items.length) {
      container.style.height = "0";
      container.style.width = "";
      container.style.minWidth = "";
      return;
    }

    const width = viewportWidth(container);
    if (width <= 0) return;

    const slots = layout.slots;
    const slotCount = slots.length;
    const hSpan = Math.max(1, ...slots.map((s) => s.left + s.width));
    const vSpan = Math.max(1, ...slots.map((s) => s.top + s.height));
    const blockAspect = (layout.canvasHeight / layout.canvasWidth) * (vSpan / hSpan) * BLOCK_COMPACT;
    const blockH = width * blockAspect;

    let maxBottom = 0;

    items.forEach((el, globalIdx) => {
      const block = Math.floor(globalIdx / slotCount);
      const slot = slots[globalIdx % slotCount];

      const left = (slot.left / hSpan) * width + SLOT_GAP / 2;
      const top = (slot.top / vSpan) * blockH + block * blockH + SLOT_GAP / 2;
      const slotW = Math.max(1, (slot.width / hSpan) * width - SLOT_GAP);
      const slotH = Math.max(1, (slot.height / vSpan) * blockH - SLOT_GAP);

      placeFrame(el, left, top, slotW, slotH);
      maxBottom = Math.max(maxBottom, top + slotH);
    });

    container.style.position = "relative";
    container.style.height = `${maxBottom}px`;
    container.style.width = "";
    container.style.minWidth = "";
  }

  function layout(container) {
    const items = collectItems(container);
    if (!items.length) {
      container.style.height = "0";
      container.style.width = "";
      container.style.minWidth = "";
      setScrollWrap(container, false);
      return;
    }

    const width = viewportWidth(container);
    if (width <= MOBILE_MAX) {
      container.classList.add("km-gallery--mobile-scroll");
      container.classList.remove("km-gallery--mobile-grid");
      setScrollWrap(container, true);
      layoutMobileRows(container, items);
    } else {
      container.classList.remove("km-gallery--mobile-scroll");
      container.classList.remove("km-gallery--mobile-grid");
      setScrollWrap(container, false);
      layoutCollage(container, items);
    }

    container.dispatchEvent(new CustomEvent("collage-layout", { bubbles: true }));
  }

  function bindImages(container) {
    container.querySelectorAll("img").forEach((img) => {
      const relayout = () => schedule(container);
      if (img.complete && img.naturalWidth > 0) return;
      img.addEventListener("load", relayout, { once: true });
      img.addEventListener("error", relayout, { once: true });
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
