/**
 * 校验 MV 素材是否含有隐形水印
 * 用法: node scripts/verify-mv-watermark.mjs <图片路径> <assetKey>
 * 例: node scripts/verify-mv-watermark.mjs assets/images/mv-materials/thumbs/ave/丰川祥子1.webp assets/images/mv-materials/ave/丰川祥子1.jpg
 */
import path from "path";
import sharp from "sharp";
import { BRAND_LABEL, extractRgba } from "./watermark-embed.mjs";

const file = process.argv[2];
const assetKey = process.argv[3];

if (!file || !assetKey) {
  console.error("Usage: node scripts/verify-mv-watermark.mjs <image> <assetKey>");
  process.exit(1);
}

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const result = extractRgba(data, info.width, info.height, assetKey);
if (result?.ok) {
  console.log(JSON.stringify({
    ok: true,
    brand: BRAND_LABEL,
    file: path.normalize(file),
    assetKey,
    hash: result.hash,
  }, null, 2));
} else {
  console.log(JSON.stringify({ ok: false, file: path.normalize(file), assetKey }, null, 2));
  process.exit(2);
}
