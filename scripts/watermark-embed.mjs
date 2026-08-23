/**
 * MV 素材隐形水印（LSB 扩散嵌入，肉眼不可见）
 * 载荷：時雨榧（UTF-8）+ 路径 FNV 哈希 + 校验和
 */
export const BRAND_LABEL = "時雨榧";
const BRAND_MARK = new TextEncoder().encode(BRAND_LABEL);

export function fnv1a(str) {
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

export function buildPayload(assetKey) {
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

/**
 * @param {Uint8Array | Uint8ClampedArray} data RGBA
 */
export function embedRgba(data, width, height, assetKey) {
  if (!width || !height || data.length < width * height * 4) return false;
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

/**
 * @param {Uint8Array | Uint8ClampedArray} data RGBA
 */
export function extractRgba(data, width, height, assetKey) {
  if (!width || !height || data.length < width * height * 4) return null;
  const payload = buildPayload(assetKey);
  const bitCount = payload.length * 8;
  const rand = mulberry32(fnv1a(assetKey) ^ 0x7f4a7c15);
  const pixels = width * height;
  const used = new Set();
  const out = new Uint8Array(payload.length);
  let bitIdx = 0;
  let guard = 0;

  while (bitIdx < bitCount && guard < pixels * 4) {
    guard += 1;
    const px = Math.floor(rand() * pixels);
    if (used.has(px)) continue;
    used.add(px);

    const i = px * 4;
    const bit = data[i] & 1;
    const byteIdx = bitIdx >> 3;
    const bitInByte = 7 - (bitIdx & 7);
    out[byteIdx] |= bit << bitInByte;
    bitIdx += 1;
  }

  if (bitIdx !== bitCount) return null;
  for (let i = 0; i < payload.length; i += 1) {
    if (out[i] !== payload[i]) return null;
  }
  return { ok: true, brand: BRAND_LABEL, assetKey, hash: fnv1a(assetKey) };
}
