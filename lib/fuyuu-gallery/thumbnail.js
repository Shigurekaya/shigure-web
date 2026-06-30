import sharp from "sharp";

const MAX_WIDTH = 640;
const QUALITY = 82;

/** @param {Buffer} input */
export async function createThumbnail(input) {
  return sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
}

/** @param {Buffer} input */
export async function normalizeToJpeg(input) {
  return sharp(input).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
