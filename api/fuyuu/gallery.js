import { verifyAdmin } from "../../lib/fuyuu-gallery/auth.js";
import { listGallery, deleteWork, reorderWork } from "../../lib/fuyuu-gallery/store.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (req.method === "GET") {
      const items = await listGallery();
      return res.status(200).json({ ok: true, items, total: items.length });
    }

    const auth = verifyAdmin(req);
    if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

    if (req.method === "DELETE") {
      const path = req.body?.path || req.query?.path;
      if (!path) return res.status(400).json({ ok: false, error: "缺少 path 参数" });
      const result = await deleteWork(String(path));
      return res.status(200).json({
        ok: true,
        message: "已删除，Vercel 将自动重新部署",
        ...result,
      });
    }

    if (req.method === "PATCH") {
      const path = req.body?.path;
      const index = req.body?.index ?? 0;
      if (!path) return res.status(400).json({ ok: false, error: "缺少 path 参数" });
      const result = await reorderWork(String(path), Number(index));
      return res.status(200).json({
        ok: true,
        message: "顺序已更新",
        ...result,
      });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("[fuyuu/gallery]", err);
    return res.status(500).json({ ok: false, error: err.message || "服务器错误" });
  }
}
