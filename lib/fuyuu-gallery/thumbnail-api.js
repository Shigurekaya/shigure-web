const MAX_WIDTH = 640;
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.9;

/** @param {Uint8Array | ArrayBuffer} input */
function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

/** @param {Uint8Array | ArrayBuffer} input */
async function decodeBitmap(input) {
  const bytes = toBytes(input);
  const blob = new Blob([bytes]);
  return createImageBitmap(blob);
}

/**
 * @param {OffscreenCanvas} canvas
 * @param {string} type
 * @param {number} quality
 */
async function canvasToBuffer(canvas, type, quality) {
  const blob = await canvas.convertToBlob({ type, quality });
  return Buffer.from(await blob.arrayBuffer());
}

/**
 * @param {import("sharp").Sharp | Uint8Array | Buffer} input
 * @param {number} maxWidth
 */
async function renderScaled(input, maxWidth) {
  const bytes = Buffer.isBuffer(input) ? new Uint8Array(input) : toBytes(input);
  const bitmap = await decodeBitmap(bytes);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建 2D 画布");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas;
}

/** @param {Uint8Array | Buffer} input */
export async function createThumbnail(input) {
  const canvas = await renderScaled(input, MAX_WIDTH);
  return canvasToBuffer(canvas, "image/webp", WEBP_QUALITY);
}

/** @param {Uint8Array | Buffer} input */
export async function normalizeToJpeg(input) {
  const canvas = await renderScaled(input, 4096);
  return canvasToBuffer(canvas, "image/jpeg", JPEG_QUALITY);
}
