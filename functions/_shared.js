import { bindRuntimeEnv } from "../lib/fuyuu-gallery/runtime-env.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

/** @param {Record<string, string>} [extra] */
export function corsHeaders(extra = {}) {
  return { ...CORS, ...extra };
}

/** @param {unknown} data @param {number} [status] */
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json", ...extra }),
  });
}

/** @param {Record<string, string | undefined>} env */
export function bindEnv(env) {
  bindRuntimeEnv(env);
}

/** @param {Request} request */
export function optionsResponse(request) {
  const allow = request.headers.get("Access-Control-Request-Method") || "GET, POST, DELETE, PATCH, OPTIONS";
  return new Response(null, {
    status: 204,
    headers: corsHeaders({ "Access-Control-Allow-Methods": allow }),
  });
}
