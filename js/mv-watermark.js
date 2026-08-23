/**
 * MV 素材隐形水印（与 scripts/watermark-embed.mjs 算法一致）
 */
(() => {
  const BRAND_LABEL = "時雨榧";
  const BRAND_MARK = new TextEncoder().encode(BRAND_LABEL);

  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function pathChecksum(str) {
    let sum = 0;
    for (let i = 0; i < str.length; i += 1) {
      sum = (sum + str.charCodeAt(i)) & 0xffff;
    }
    return sum;
  }

  function buildPayload(assetKey) {
    const hash = fnv1a(assetKey);
    const sum = pathChecksum(assetKey);
    return Uint8Array.from([
      ...BRAND_MARK,
      (hash >>> 24) & 255,
      (hash >>> 16) & 255,
      (hash >>> 8) & 255,
      hash & 255,
      (sum >>> 8) & 255,
      sum & 255,
    ]);
  }

  function mulberry32(seed) {
    let s = seed | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function embedImageData(imageData, assetKey) {
    const { data, width, height } = imageData;
    const payload = buildPayload(assetKey);
    const bitCount = payload.length * 8;
    const rand = mulberry32(fnv1a(assetKey) ^ 0x7f4a7c15);
    const pixels = width * height;
    const used = new Set();
    let bitIdx = 0;
    let guard = 0;

    while (bitIdx < bitCount && guard < pixels * 4) {
      guard += 1;
      const px = Math.floor(rand() * pixels);
      if (used.has(px)) continue;
      used.add(px);

      const byteIdx = bitIdx >> 3;
      const bitInByte = 7 - (bitIdx & 7);
      const bit = (payload[byteIdx] >>> bitInByte) & 1;
      const i = px * 4;
      data[i] = (data[i] & 0xfe) | bit;
      data[i + 1] = (data[i + 1] & 0xfe) | bit;
      data[i + 2] = (data[i + 2] & 0xfe) | bit;
      bitIdx += 1;
    }
    return bitIdx === bitCount;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`load failed: ${url}`));
      img.src = url;
    });
  }

  function mimeForSrc(src) {
    if (/\.png$/i.test(src)) return "image/png";
    if (/\.webp$/i.test(src)) return "image/webp";
    return "image/jpeg";
  }

  function stampCanvas(canvas, assetKey) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const ok = embedImageData(imageData, assetKey);
    if (ok) ctx.putImageData(imageData, 0, 0);
    return ok;
  }

  async function toObjectUrl(url, assetKey, opts = {}) {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return url;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    embedImageData(imageData, assetKey);
    ctx.putImageData(imageData, 0, 0);

    const mime = opts.mime || mimeForSrc(url);
    const quality = opts.quality ?? (mime === "image/png" ? undefined : 0.94);
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), mime, quality);
    });
    if (!blob) return url;
    return URL.createObjectURL(blob);
  }

  window.KayaMvWatermark = {
    brand: BRAND_LABEL,
    stampCanvas,
    toObjectUrl,
    fnv1a,
  };
})();
