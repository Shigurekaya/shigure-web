# 更新浮游 WORK 页（B 站投稿）

WORK 页（`/fuyuu/work/`）的视频列表来自 B 站空间 [浮游Lev](https://space.bilibili.com/353604313)，由本地脚本抓取后写入静态文件，再提交部署。

## 会更新哪些文件

| 文件 | 作用 |
|------|------|
| `fuyuu/js/site-data.js` | 页面实际读取的数据（标题、日期、封面路径等） |
| `fuyuu/data/profile.json` | 更完整的源数据备份（播放量、原始封面 URL 等） |
| `fuyuu/assets/images/covers/*.jpg` | WORK 列表用的封面 |
| `fuyuu/data/images/covers/*.jpg` | 数据侧封面副本 |
| `fuyuu/assets/images/avatar.jpg` 等 | 头像 / 挂件（一并刷新） |

抓取脚本：`scripts/scrape-fuyuu-bilibili.py`（带浏览器 UA / Referer / WBI 签名伪装）。

## 前置

- 已安装 [uv](https://github.com/astral-sh/uv)
- **抓 B 站请直连**，不要开 Clash 等代理（代理可能导致接口返回乱码）
- 推 GitHub / Vercel 仍可按仓库惯例走代理

## 抓取

在仓库根目录执行：

```powershell
cd E:\网站\测试框架\shigure-web

# 确认未设置代理（PowerShell）
Remove-Item Env:HTTP_PROXY, Env:HTTPS_PROXY, Env:http_proxy, Env:https_proxy -ErrorAction SilentlyContinue

uv run --with httpx python scripts/scrape-fuyuu-bilibili.py
```

成功时日志大致为：`[done] videos=N data_updated=YYYY.MM.DD`。

本地预览（需从仓库根起服务，因页面使用 `/fuyuu/` 路径；推荐 `serve-local.py`，支持 clean URL 且 HTML 不缓存）：

```powershell
py -3 .\serve-local.py
# 打开 http://127.0.0.1:3000/fuyuu/work/
```

## 提交并部署

推送到 `main` 后 **Cloudflare Pages** 自动部署（见 [deploy-cloudflare.md](deploy-cloudflare.md)）。

仍建议使用 Shigurekaya 的 noreply 邮箱提交（与仓库惯例一致；Pages 不会像 Vercel Hobby 那样因作者邮箱 Block）：

```powershell
# 仅本次提交生效，不改全局 git config
$env:GIT_AUTHOR_NAME = "榧"
$env:GIT_AUTHOR_EMAIL = "163858348+Shigurekaya@users.noreply.github.com"
$env:GIT_COMMITTER_NAME = "榧"
$env:GIT_COMMITTER_EMAIL = "163858348+Shigurekaya@users.noreply.github.com"

git add fuyuu/js/site-data.js fuyuu/data/profile.json `
  fuyuu/assets/images/covers/ fuyuu/data/images/covers/ `
  fuyuu/assets/images/avatar.jpg fuyuu/assets/images/pendant.jpg `
  fuyuu/data/images/

git commit -m "Sync fuyuu WORK videos from Bilibili"
git push origin main
```

若作者写成未绑定的 QQ 邮箱等，Git 历史会不一致；**Cloudflare Pages 仍会部署**。

## 线上仍显示旧列表时

先硬刷新或清浏览器缓存。若 `*.pages.dev` 已更新而 `www.shigurekaya.com` 仍旧，可在 Cloudflare → **Caching** → **Purge Cache** 清理：

```text
https://www.shigurekaya.com/fuyuu/js/site-data.js
https://www.shigurekaya.com/fuyuu/work/
```

（仅一层 CDN，一般比旧「CF + Vercel」双缓存省事。）

## 说明

- 本地 `scrapers/` 目录（若存在）在 `.gitignore` 中，仅作本机 uv 环境，**不要依赖它入库**；以 `scripts/scrape-fuyuu-bilibili.py` 为准。
- 首页插画（`gallery-images.js`）与 WORK 视频是两套数据，本流程只更新视频。
