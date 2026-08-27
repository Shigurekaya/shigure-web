import { verifyAdmin } from "../../../lib/fuyuu-gallery/auth.js";
import { addWork } from "../../../lib/fuyuu-gallery/store.js";
import { bindEnv, json, optionsResponse } from "../../_shared.js";

const MAX_BYTES = 8 * 1024 * 1024;
const DEPLOY_MSG = "已上传并置于最前，Cloudflare Pages 将自动重新部署（约 1–2 分钟）";

/** @param {{ request: Request, env: Record<string, string | undefined> }} context */
export async function onRequest(context) {
  const { request, env } = context;
  bindEnv(env);

  if (request.method === "OPTIONS") {
    return optionsResponse(request);
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "无效 JSON" }, 400);
  }

  const auth = verifyAdmin(request, body);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  try {
    const { filename, imageBase64 } = body || {};
    if (!imageBase64) {
      return json({ ok: false, error: "缺少 imageBase64" }, 400);
    }

    const raw = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    if (raw.length > MAX_BYTES) {
      return json({ ok: false, error: "图片过大（上限 8MB）" }, 413);
    }
    if (raw.length < 100) {
      return json({ ok: false, error: "无效的图片数据" }, 400);
    }

    const name = filename || body?.name || "untitled";
    const result = await addWork({ filename: name, imageBuffer: Buffer.from(raw) });

    return json({
      ok: true,
      message: DEPLOY_MSG,
      ...result,
    });
  } catch (err) {
    console.error("[fuyuu/upload]", err);
    return json({ ok: false, error: err.message || "上传失败" }, 500);
  }
}
