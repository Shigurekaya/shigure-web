/** @param {import('@vercel/node').VercelRequest} req */
export function verifyAdmin(req) {
  const expected = process.env.FUYUU_ADMIN_TOKEN;
  if (!expected) {
    return { ok: false, status: 503, error: "FUYUU_ADMIN_TOKEN 未配置" };
  }

  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const bodyToken = typeof req.body?.token === "string" ? req.body.token : null;
  const queryToken = typeof req.query?.token === "string" ? req.query.token : null;
  const token = bearer || bodyToken || queryToken;

  if (!token || token !== expected) {
    return { ok: false, status: 401, error: "未授权" };
  }

  return { ok: true };
}
