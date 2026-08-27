import { bindEnv, json, optionsResponse } from "../../_shared.js";
import { readApproved, patchApproved, approvedStats } from "../../../lib/gal-quotes/store.js";

/** @param {{ request: Request, env: Record<string, string | undefined> }} context */
export async function onRequest(context) {
  const { request, env } = context;
  bindEnv(env);

  if (request.method === "OPTIONS") {
    return optionsResponse(request);
  }

  try {
    if (request.method === "GET") {
      const { approved } = await readApproved();
      const stats = approvedStats(approved);
      return json({
        ok: true,
        approved,
        kept: stats.kept,
        storage: "github:gal-quotes-data",
      });
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "invalid json" }, 400);
      }
      const id = String(body?.id || "").trim();
      if (!id) return json({ ok: false, error: "缺少 id" }, 400);
      const result = await patchApproved({
        id,
        approved: !!body.approved,
        quote_zh: body.quote_zh || "",
        by: body.by || "",
      });
      const stats = approvedStats(result.approved);
      return json({
        ok: true,
        id: result.id,
        kept: result.kept,
        total_kept: stats.kept,
        approved: result.approved,
      });
    }

    return json({ ok: false, error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("[gal-quotes/approved]", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
}
