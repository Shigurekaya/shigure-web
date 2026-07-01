const API = "https://api.github.com";

function config() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || "Shigurekaya/shigure-web";
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token) throw new Error("GITHUB_TOKEN 未配置");
  return { token, repo, branch };
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function ghFetch(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(token), ...init.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json();
}

function isRetryableGitError(err) {
  return /GitHub API (409|422):/.test(err?.message || "");
}

async function withRetry(fn, retries = 3) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1 && isRetryableGitError(err)) continue;
      throw err;
    }
  }
  throw lastErr;
}

export async function getFile(path) {
  const { token, repo, branch } = config();
  const data = await ghFetch(
    `/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${branch}`,
    token
  );
  return {
    content: Buffer.from(data.content, "base64").toString("utf8"),
    sha: data.sha,
  };
}

export async function fileExists(path) {
  const { token, repo, branch } = config();
  const res = await fetch(
    `${API}/repos/${repo}/contents/${path}?ref=${branch}`,
    { headers: headers(token) }
  );
  if (res.status === 404) return false;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 400)}`);
  }
  return true;
}

/**
 * 单次 commit 更新多个文件
 * @param {{ path: string, content: Buffer | string, encoding?: 'utf-8' | 'base64' }[]} files
 */
export async function commitFiles(message, files) {
  return withRetry(() => commitFilesOnce(message, files));
}

async function commitFilesOnce(message, files) {
  const { token, repo, branch } = config();

  const refData = await ghFetch(`/repos/${repo}/git/ref/heads/${branch}`, token);
  const baseCommitSha = refData.object.sha;

  const commitData = await ghFetch(`/repos/${repo}/git/commits/${baseCommitSha}`, token);
  const baseTreeSha = commitData.tree.sha;

  const treeEntries = [];
  for (const file of files) {
    const isBuffer = Buffer.isBuffer(file.content);
    const blob = await ghFetch(`/repos/${repo}/git/blobs`, token, {
      method: "POST",
      body: JSON.stringify({
        content: isBuffer ? file.content.toString("base64") : file.content,
        encoding: "base64",
      }),
    });
    treeEntries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const tree = await ghFetch(`/repos/${repo}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  const commit = await ghFetch(`/repos/${repo}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseCommitSha],
    }),
  });

  await ghFetch(`/repos/${repo}/git/refs/heads/${branch}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  return { commitSha: commit.sha, branch };
}

/**
 * 删除文件（内容置空在 Git 中需用 delete API，这里用 tree 省略 sha 表示删除）
 */
export async function commitDelete(message, pathsToDelete, filesToUpdate = []) {
  return withRetry(() => commitDeleteOnce(message, pathsToDelete, filesToUpdate));
}

async function commitDeleteOnce(message, pathsToDelete, filesToUpdate = []) {
  const { token, repo, branch } = config();

  const refData = await ghFetch(`/repos/${repo}/git/ref/heads/${branch}`, token);
  const baseCommitSha = refData.object.sha;
  const commitData = await ghFetch(`/repos/${repo}/git/commits/${baseCommitSha}`, token);
  const baseTreeSha = commitData.tree.sha;

  const treeEntries = [];

  for (const p of pathsToDelete) {
    treeEntries.push({ path: p, mode: "100644", type: "blob", sha: null });
  }

  for (const file of filesToUpdate) {
    const isBuffer = Buffer.isBuffer(file.content);
    const blob = await ghFetch(`/repos/${repo}/git/blobs`, token, {
      method: "POST",
      body: JSON.stringify({
        content: isBuffer ? file.content.toString("base64") : file.content,
        encoding: "base64",
      }),
    });
    treeEntries.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  const tree = await ghFetch(`/repos/${repo}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
  });

  const commit = await ghFetch(`/repos/${repo}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseCommitSha],
    }),
  });

  await ghFetch(`/repos/${repo}/git/refs/heads/${branch}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha }),
  });

  return { commitSha: commit.sha, branch };
}
