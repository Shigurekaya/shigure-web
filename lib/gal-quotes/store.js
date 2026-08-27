/**
 * 多人共享的 Gal 名言勾选状态（写到专用 Git 分支，不触发 Pages 部署）。
 */
import { getRuntimeEnv } from "../fuyuu-gallery/runtime-env.js";

const API = "https://api.github.com";
const FILE_PATH = "_gal_quotes/data/approved.json";
const DATA_BRANCH = "gal-quotes-data";

function config() {
  const env = getRuntimeEnv();
  const token = env.GITHUB_TOKEN;
  const repo = env.GITHUB_REPO || "Shigurekaya/shigure-web";
  if (!token) throw new Error("GITHUB_TOKEN 未配置");
  return { token, repo, branch: env.GAL_QUOTES_BRANCH || DATA_BRANCH };
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    "User-Agent": "Shigurekaya-shigure-web/gal-quotes",
  };
}

async function gh(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(token), ...init.headers },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function ensureBranch({ token, repo, branch }) {
  try {
    await gh(`/repos/${repo}/git/ref/heads/${branch}`, token);
    return;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const mainRef = await gh(`/repos/${repo}/git/ref/heads/main`, token);
  await gh(`/repos/${repo}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: mainRef.object.sha,
    }),
  });
}

/**
 * @returns {Promise<{ approved: Record<string, any>, sha: string | null }>}
 */
export async function readApproved() {
  const cfg = config();
  await ensureBranch(cfg);
  try {
    const data = await gh(
      `/repos/${cfg.repo}/contents/${FILE_PATH}?ref=${cfg.branch}`,
      cfg.token
    );
    const text = Buffer.from(data.content, "base64").toString("utf8");
    const approved = text.trim() ? JSON.parse(text) : {};
    return { approved: approved && typeof approved === "object" ? approved : {}, sha: data.sha };
  } catch (e) {
    if (e.status === 404) return { approved: {}, sha: null };
    throw e;
  }
}

/**
 * 合并写入单条勾选（带 sha 冲突重试）
 * @param {{ id: string, approved: boolean, quote_zh?: string, by?: string }} patch
 */
export async function patchApproved(patch) {
  const id = String(patch.id || "").trim();
  if (!id) throw new Error("缺少 id");

  const cfg = config();
  await ensureBranch(cfg);

  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { approved, sha } = await readApproved();
    if (patch.approved) {
      approved[id] = {
        approved: true,
        quote_zh: (patch.quote_zh || approved[id]?.quote_zh || "").trim(),
        by: (patch.by || approved[id]?.by || "").trim() || undefined,
        updated_at: new Date().toISOString(),
      };
    } else {
      delete approved[id];
    }

    const body = {
      message: patch.approved
        ? `gal-quotes: keep ${id}`
        : `gal-quotes: drop ${id}`,
      content: Buffer.from(JSON.stringify(approved, null, 2), "utf8").toString("base64"),
      branch: cfg.branch,
    };
    if (sha) body.sha = sha;

    try {
      await gh(`/repos/${cfg.repo}/contents/${FILE_PATH}`, cfg.token, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      return { approved, id, kept: !!patch.approved };
    } catch (e) {
      lastErr = e;
      if (e.status === 409 || e.status === 422) continue;
      throw e;
    }
  }
  throw lastErr || new Error("写入冲突，请重试");
}

export function approvedStats(approved) {
  const ids = Object.keys(approved || {}).filter((k) => approved[k]?.approved);
  return { kept: ids.length, ids };
}
