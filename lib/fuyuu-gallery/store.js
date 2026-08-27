import {
  GALLERY_JS_PATH,
  GALLERY_HTML_PATHS,
  parseGalleryJs,
  serializeGalleryJs,
  galleryImagePath,
  galleryThumbPath,
  repoPathForImage,
  repoPathForThumb,
  prependItem,
  removeItem,
  sanitizeFilename,
  galleryVersionTag,
  bumpGalleryScriptRefs,
} from "./gallery.js";
import { getFile, commitFiles, commitDelete, fileExists } from "./github-client.js";
import { createThumbnail, normalizeToJpeg } from "./thumbnail-api.js";

async function galleryHtmlUpdates(version = galleryVersionTag()) {
  const updates = [];
  for (const htmlPath of GALLERY_HTML_PATHS) {
    const { content } = await getFile(htmlPath);
    updates.push({
      path: htmlPath,
      content: Buffer.from(bumpGalleryScriptRefs(content, version), "utf8"),
    });
  }
  return updates;
}

async function commitGalleryChange(message, galleryJs, extraFiles = []) {
  const version = galleryVersionTag();
  const htmlFiles = await galleryHtmlUpdates(version);
  return commitFiles(message, [
    { path: GALLERY_JS_PATH, content: Buffer.from(galleryJs, "utf8") },
    ...extraFiles,
    ...htmlFiles,
  ]);
}

export async function listGallery() {
  const { content } = await getFile(GALLERY_JS_PATH);
  const items = parseGalleryJs(content);
  return items.map((path) => ({
    path,
    image: `/fuyuu/${path}`,
    thumb: `/fuyuu/${galleryThumbPath(path)}`,
  }));
}

export async function addWork({ filename, imageBuffer }) {
  const safeName = sanitizeFilename(filename);
  const imagePath = galleryImagePath(safeName);
  const thumbPath = galleryThumbPath(imagePath);

  const { content } = await getFile(GALLERY_JS_PATH);
  const items = parseGalleryJs(content);
  if (items.includes(imagePath)) {
    throw new Error(`作品已存在: ${imagePath}`);
  }

  const jpeg = await normalizeToJpeg(imageBuffer);
  const thumb = await createThumbnail(jpeg);
  const updatedItems = prependItem(items, imagePath);
  const galleryJs = serializeGalleryJs(updatedItems);

  const result = await commitGalleryChange(`fuyuu: 添加作品 ${safeName}`, galleryJs, [
    { path: repoPathForImage(imagePath), content: jpeg },
    { path: repoPathForThumb(thumbPath), content: thumb },
  ]);

  return {
    path: imagePath,
    image: `/fuyuu/${imagePath}`,
    thumb: `/fuyuu/${thumbPath}`,
    commitSha: result.commitSha,
    position: 0,
    total: updatedItems.length,
  };
}

export async function deleteWork(imagePath) {
  const normalized = imagePath.startsWith("image/") ? imagePath : `image/${imagePath}`;
  const thumbPath = galleryThumbPath(normalized);

  const { content } = await getFile(GALLERY_JS_PATH);
  const items = parseGalleryJs(content);
  if (!items.includes(normalized)) {
    throw new Error(`作品不存在: ${normalized}`);
  }

  const updatedItems = removeItem(items, normalized);
  const galleryJs = serializeGalleryJs(updatedItems);
  const name = normalized.replace(/^image\//, "").replace(/\.jpg$/i, "");

  const pathsToRemove = [];
  for (const p of [repoPathForImage(normalized), repoPathForThumb(thumbPath)]) {
    if (await fileExists(p)) pathsToRemove.push(p);
  }

  const version = galleryVersionTag();
  const htmlFiles = await galleryHtmlUpdates(version);

  const result = await commitDelete(
    `fuyuu: 删除作品 ${name}`,
    pathsToRemove,
    [
      { path: GALLERY_JS_PATH, content: Buffer.from(galleryJs, "utf8") },
      ...htmlFiles,
    ],
  );

  return {
    path: normalized,
    commitSha: result.commitSha,
    total: updatedItems.length,
  };
}

export async function reorderWork(imagePath, targetIndex = 0) {
  const normalized = imagePath.startsWith("image/") ? imagePath : `image/${imagePath}`;

  const { content } = await getFile(GALLERY_JS_PATH);
  const items = parseGalleryJs(content);
  const idx = items.indexOf(normalized);
  if (idx === -1) throw new Error(`作品不存在: ${normalized}`);

  const next = items.filter((p) => p !== normalized);
  const clamped = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(clamped, 0, normalized);

  const galleryJs = serializeGalleryJs(next);
  const result = await commitGalleryChange(`fuyuu: 调整顺序 ${normalized}`, galleryJs);

  return { path: normalized, position: clamped, commitSha: result.commitSha, total: next.length };
}
