/** @typedef {Record<string, string | undefined>} RuntimeEnv */

/** @type {RuntimeEnv | null} */
let bound = null;

/** @param {RuntimeEnv} env */
export function bindRuntimeEnv(env) {
  bound = env;
}

/** @returns {RuntimeEnv} */
export function getRuntimeEnv() {
  return bound || (typeof process !== "undefined" ? process.env : {});
}
