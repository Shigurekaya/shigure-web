import { getRuntimeEnv } from "./runtime-env.js";

/**
 * @param {Request} request
 * @param {Record<string, unknown> | null} [body]
 */
export function verifyAdmin(request, body = null) {
  const expected = getRuntimeEnv().FUYUU_ADMIN_TOKEN;
  if (!expected) {
    return { ok: false, status: 503, error: "FUYUU_ADMIN_TOKEN 未配置" };
  }

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const bodyToken = typeof body?.token === "string" ? body.token : null;
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");
  const token = bearer || bodyToken || queryToken;

  if (!token || token !== expected) {
    return { ok: false, status: 401, error: "未授权" };
  }

  return { ok: true };
}
