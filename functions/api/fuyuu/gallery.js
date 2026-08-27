import { verifyAdmin } from "../../../lib/fuyuu-gallery/auth.js";
import { listGallery, deleteWork, reorderWork } from "../../../lib/fuyuu-gallery/store.js";
import { bindEnv, json, optionsResponse } from "../../_shared.js";

const DELETE_MSG = "已删除，Cloudflare Pages 将自动重新部署";

/** @param {{ request: Request, env: Record<string, string | undefined> }} context */
export async function onRequest(context) {
  const { request, env } = context;
  bindEnv(env);

  if (request.method === "OPTIONS") {
    return optionsResponse(request);
  }

  let body = null;
  if (request.method === "DELETE" || request.method === "PATCH") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const auth = verifyAdmin(request, body);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  try {
    if (request.method === "GET") {
      const items = await listGallery();
      return json({ ok: true, items, total: items.length });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const path = body?.path || url.searchParams.get("path");
      if (!path) return json({ ok: false, error: "缺少 path 参数" }, 400);
      const result = await deleteWork(String(path));
      return json({
        ok: true,
        message: DELETE_MSG,
        ...result,
      });
    }

    if (request.method === "PATCH") {
      const path = body?.path;
      const index = body?.index ?? 0;
      if (!path) return json({ ok: false, error: "缺少 path 参数" }, 400);
      const result = await reorderWork(String(path), Number(index));
      return json({
        ok: true,
        message: "顺序已更新",
        ...result,
      });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("[fuyuu/gallery]", err);
    return json({ ok: false, error: err.message || "服务器错误" }, 500);
  }
}
