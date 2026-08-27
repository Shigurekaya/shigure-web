# 部署到 Cloudflare Pages

站点从 Vercel 迁到 **Cloudflare Pages**（域名仍在 Cloudflare）。

## 控制台一次性配置

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 选仓库 `Shigurekaya/shigure-web`，分支 `main`
3. 构建设置：
   - **Framework preset**: None
   - **Build command**: 留空（或 `exit 0`）
   - **Build output directory**: `/`（仓库根目录）
4. **Environment variables**（Production + Preview 都加）：

| 变量 | 说明 |
|------|------|
| `FUYUU_ADMIN_TOKEN` | 浮游 admin 上传密钥 |
| `GITHUB_TOKEN` | 有 `repo` 权限的 PAT，用于写回画廊 |
| `GITHUB_REPO` | 可选，默认 `Shigurekaya/shigure-web` |
| `GITHUB_BRANCH` | 可选，默认 `main` |

5. 部署成功后打开 `https://<project>.pages.dev` 验收
6. **Custom domains** → 添加 `www.shigurekaya.com`（及需要的 apex）
7. DNS：把原先指向 Vercel 的 CNAME 改为 Pages 提供的 `*.pages.dev` 目标
8. 确认无误后，在 Vercel 删除或断开该项目

## 仓库内已添加的文件

| 文件 | 作用 |
|------|------|
| `_redirects` | 跳转 / clean URL |
| `_headers` | 缓存与安全头 |
| `.cfignore` | 部署排除（开发目录 + 服务端源码） |
| `wrangler.toml` | Pages 配置（`nodejs_compat` 供 API 使用 Buffer） |
| `functions/api/fuyuu/*` | 浮游管理 API（Pages Functions） |
| `gal-quotes/` | Gal 名言多人审阅页 + `quotes.json` |
| `functions/api/gal-quotes/*` | 名言勾选共享 API（写到 `gal-quotes-data` 分支） |

## 本地预览 Pages Functions（可选）

需安装 [Wrangler](https://developers.cloudflare.com/workers/wrangler/)：

```powershell
cd E:\网站\测试框架\shigure-web
npx wrangler pages dev . --compatibility-flags=nodejs_compat
```

静态页仍推荐 `py -3 .\serve-local.py`（见 [local-dev.md](local-dev.md)）。

## 切域名后注意

- 不再有两层缓存（CF 代理 + Vercel）；一般无需像旧文档那样 Purge 才能看到 `site-data.js` 更新
- Git 推送后 Pages 自动部署；**不再**受 Vercel Hobby「commit 作者邮箱」限制
- 浮游 admin 成功提示已改为「Cloudflare Pages 将自动重新部署」

## 回滚

DNS 指回 Vercel CNAME，或在 Pages 暂时移除自定义域名即可。
