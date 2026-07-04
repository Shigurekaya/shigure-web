const GALLERY_JS_PATH = "fuyuu/js/gallery-images.js";
export const GALLERY_HTML_PATHS = ["fuyuu/index.html", "fuyuu/portfolio.html"];

export function galleryVersionTag(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `${p(date.getHours())}${p(date.getMinutes())}`
  );
}

/** 更新 HTML 中 gallery-images.js 的版本参数，避免 CDN/浏览器缓存旧列表 */
export function bumpGalleryScriptRefs(html, version) {
  return html.replace(
    /js\/gallery-images\.js(\?v=\d+)?/g,
    `js/gallery-images.js?v=${version}`,
  );
}

export function parseGalleryJs(content) {
  const match = content.match(/window\.HOME_GALLERY\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error("无法解析 gallery-images.js");
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

export function serializeGalleryJs(items) {
  const lines = items.map((item) => `  "${item}",`).join("\n");
  return `/** 首页插画 · fuyuu/image */\nwindow.HOME_GALLERY = [\n${lines}\n];\n`;
}

export function galleryImagePath(filename) {
  const base = sanitizeFilename(filename);
  return `image/${base}.jpg`;
}

export function galleryThumbPath(imagePath) {
  const name = imagePath.replace(/^image\//, "").replace(/\.(jpe?g|png|webp)$/i, "");
  return `image/thumbs/${name}.webp`;
}

export function repoPathForImage(imagePath) {
  return `fuyuu/${imagePath}`;
}

export function repoPathForThumb(thumbPath) {
  return `fuyuu/${thumbPath}`;
}

/** 保留中文、字母数字及常见符号，统一为 .jpg 文件名 */
export function sanitizeFilename(name) {
  const raw = String(name || "untitled")
    .replace(/\.(jpe?g|png|webp|gif)$/i, "")
    .replace(/[/\\:*?"<>|]/g, "")
    .trim();
  const cleaned = raw.replace(/\s+/g, " ").slice(0, 80);
  return cleaned || "untitled";
}

export function prependItem(items, imagePath) {
  const filtered = items.filter((p) => p !== imagePath);
  return [imagePath, ...filtered];
}

export function removeItem(items, imagePath) {
  const normalized = imagePath.startsWith("image/") ? imagePath : `image/${imagePath}`;
  return items.filter((p) => p !== normalized);
}

export { GALLERY_JS_PATH };
