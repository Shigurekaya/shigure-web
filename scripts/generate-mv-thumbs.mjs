/**
 * 从 assets/images/mv-materials 原图生成 WebP 缩略图 → assets/images/mv-materials/thumbs/
 * 尺寸为原图 80%，格式 WebP（与浮游画廊思路一致，路径结构保留子目录）
 * 用法: npm run mv-thumbs
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MV_DIR = path.join(__dirname, "../assets/images/mv-materials");
const THUMB_DIR = path.join(MV_DIR, "thumbs");
const SCALE = 0.8;
const QUALITY = 82;

async function walkImages(dir, base = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const images = [];
  for (const entry of entries) {
    if (entry.name === "thumbs") continue;
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      images.push(...await walkImages(abs, rel));
    } else if (/\.(png|jpe?g)$/i.test(entry.name)) {
      images.push(rel);
    }
  }
  return images;
}

async function main() {
  const images = await walkImages(MV_DIR);
  if (!images.length) {
    console.log("No images found in assets/images/mv-materials/");
    return;
  }

  let saved = 0;
  for (const rel of images) {
    const src = path.join(MV_DIR, rel);
    const dest = path.join(THUMB_DIR, rel.replace(/\.(png|jpe?g)$/i, ".webp"));
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const meta = await sharp(src).metadata();
    const width = Math.max(1, Math.round((meta.width || 1) * SCALE));
    const height = Math.max(1, Math.round((meta.height || 1) * SCALE));

    await sharp(src)
      .rotate()
      .resize({ width, height, fit: "fill" })
      .webp({ quality: QUALITY })
      .toFile(dest);

    const srcStat = await fs.stat(src);
    const destStat = await fs.stat(dest);
    console.log(
      `${rel}: ${meta.width}x${meta.height} → ${width}x${height}, `
      + `${Math.round(srcStat.size / 1024)}KB → ${Math.round(destStat.size / 1024)}KB`
    );
    saved += srcStat.size - destStat.size;
  }

  console.log(`\nDone: ${images.length} thumbs, saved ~${Math.round(saved / 1024 / 1024 * 10) / 10}MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
