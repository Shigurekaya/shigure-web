import { verifyAdmin } from "../../lib/fuyuu-gallery/auth.js";
import { addWork } from "../../lib/fuyuu-gallery/store.js";

const MAX_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const auth = verifyAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, error: auth.error });

  try {
    const { filename, imageBase64 } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ ok: false, error: "缺少 imageBase64" });
    }

    const imageBuffer = Buffer.from(imageBase64, "base64");
    if (imageBuffer.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: "图片过大（上限 8MB）" });
    }
    if (imageBuffer.length < 100) {
      return res.status(400).json({ ok: false, error: "无效的图片数据" });
    }

    const name = filename || req.body?.name || "untitled";
    const result = await addWork({ filename: name, imageBuffer });

    return res.status(200).json({
      ok: true,
      message: "已上传并置于最前，Vercel 将自动重新部署（约 1–2 分钟）",
      ...result,
    });
  } catch (err) {
    console.error("[fuyuu/upload]", err);
    return res.status(500).json({ ok: false, error: err.message || "上传失败" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
