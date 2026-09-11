/**
 * 从 fuyuu/image 原图生成 WebP 缩略图 → fuyuu/image/thumbs/
 * 用法: npm run thumbs
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_DIR = path.join(__dirname, "../fuyuu/image");
const THUMB_DIR = path.join(IMAGE_DIR, "thumbs");
const MAX_WIDTH = 640;
const QUALITY = 82;

async function main() {
  await fs.mkdir(THUMB_DIR, { recursive: true });
  const files = await fs.readdir(IMAGE_DIR);
  const images = files.filter((f) => /\.(png|jpe?g)$/i.test(f));

  if (!images.length) {
    console.log("No images found in fuyuu/image/");
    return;
  }

  let saved = 0;
  for (const file of images) {
    const src = path.join(IMAGE_DIR, file);
    const dest = path.join(THUMB_DIR, file.replace(/\.(png|jpe?g)$/i, ".webp"));
    await sharp(src)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(dest);
    const srcStat = await fs.stat(src);
    const destStat = await fs.stat(dest);
    console.log(`${file}: ${Math.round(srcStat.size / 1024)}KB → ${Math.round(destStat.size / 1024)}KB`);
    saved += srcStat.size - destStat.size;
  }

  console.log(`\nDone: ${images.length} thumbs, saved ~${Math.round(saved / 1024 / 1024)}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
