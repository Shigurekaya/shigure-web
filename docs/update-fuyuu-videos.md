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

本地预览（需从仓库根起服务，因页面使用 `/fuyuu/` 路径）：

```powershell
py -3 -m http.server 3000
# 打开 http://localhost:3000/fuyuu/work/
```

## 提交并部署

Vercel Hobby 要求 **commit 作者邮箱能对应到 GitHub 账号**。请使用已绑定的 noreply 邮箱，例如：

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

若作者写成未绑定的 QQ 邮箱等，部署会变成 **Blocked**。

## 线上仍显示旧列表时

`www.shigurekaya.com` 经 **Cloudflare**；`*.vercel.app` 直连 Vercel。若预览域名已更新、www 仍是旧的：

1. Cloudflare → 选中 `shigurekaya.com`（站点，不是账号设置）
2. **Caching** → **Configuration** → **Purge Cache**
3. Custom Purge 至少清：

```text
https://www.shigurekaya.com/fuyuu/js/site-data.js
https://www.shigurekaya.com/fuyuu/work/
```

或使用 **Purge Everything**。

## 说明

- 本地 `scrapers/` 目录（若存在）在 `.gitignore` 中，仅作本机 uv 环境，**不要依赖它入库**；以 `scripts/scrape-fuyuu-bilibili.py` 为准。
- 首页插画（`gallery-images.js`）与 WORK 视频是两套数据，本流程只更新视频。
