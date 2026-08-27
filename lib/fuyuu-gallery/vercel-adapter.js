/** Build a Request for shared auth helpers (Vercel legacy handlers). */
export function requestFromVercel(req) {
  const host = req.headers.host || "localhost";
  const path = req.url || "/";
  const url = path.startsWith("http") ? path : `https://${host}${path}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (typeof value === "string") headers.set(key, value);
  }
  return new Request(url, { method: req.method, headers });
}
