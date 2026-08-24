# shigure-web

个人网站静态页面，部署于 [Vercel](https://shigure-web.vercel.app)。

当前线上仅开放：

- `/` — 时雨榧（站点主页，无 `/kaya` 后缀）
- `/fuyuu/` — 浮游Lev 作品集

本地仍保留、但 **不部署到 Vercel**（见 `.vercelignore`）：

- `/koharu` — 小春日向（暂缓）
- `/shiotsuki` — 汐月空_poi（暂缓）
- `/tianhu` — 天狐页（暂缓）

恢复上线：从 `.vercelignore` 去掉对应目录，并去掉 `vercel.json` 里相关 redirects。

旧路径 `/kaya/` 会永久重定向到 `/`（兼容旧书签）。

## 本地启动

页面使用绝对路径（如 `/fuyuu/`、`/css/`），**必须从本仓库根目录**起静态服务，不要直接双击 HTML。

本地开发地址见 **[docs/local-dev.md](docs/local-dev.md)**（固定 `127.0.0.1:3000`，不用 `localhost`）。

```powershell
cd E:\网站\测试框架\shigure-web
py -3 .\serve-local.py
# 或 .\start-local.ps1
```

（也可用 `py -3 -m http.server 3000`，但无 clean URL，且 HTML 可能被浏览器缓存旧跳转页；`serve-local.py` 会对 HTML 发 `Cache-Control: no-store`，并支持 `/works/` 等 clean 路径。）

浏览器打开：

| 路径 | 页面 |
|------|------|
| http://127.0.0.1:3000/ | 时雨榧（主站） |
| http://127.0.0.1:3000/works/ | 作品 |
| http://127.0.0.1:3000/links/ | 链接 |
| http://127.0.0.1:3000/mv-materials/ | MV 素材 |
| http://127.0.0.1:3000/fuyuu/ | 浮游Lev |

图片资源目录与分辨率见 **[docs/kaya-assets.md](docs/kaya-assets.md)**。

无需 `npm install`；`package.json` 仅用于缩略图脚本（`npm run thumbs`）。线上部署由 Vercel 在推送 `main` 后自动完成。

## Git 提交身份（必读）

本仓库（`shigure-web`）的 **所有 commit / push** 必须使用 GitHub 账号 **Shigurekaya** 的身份。Vercel Hobby 要求作者邮箱能对应到该账号，否则部署会变成 **Blocked**、线上不更新。

| | 值 |
|--|--|
| Name | `榧` |
| Email | `163858348+Shigurekaya@users.noreply.github.com` |

推荐仅对本仓库写本地配置（**不要**改全局 `user.name` / `user.email`）：

```powershell
cd E:\网站\测试框架\shigure-web
git config --local user.name "榧"
git config --local user.email "163858348+Shigurekaya@users.noreply.github.com"
```

若不想改本地 config，也可在单次提交前注入环境变量（见 [docs/update-fuyuu-videos.md](docs/update-fuyuu-videos.md)）。

**禁止**使用其它身份（例如未绑定的 QQ 邮箱）向本仓库提交。

### 一键推送

仓库根目录脚本会：强制本仓库作者为 Shigurekaya → 暂存改动（排除 `_rain_analysis/`）→ commit → 走代理 `git push origin main`。

```powershell
cd E:\网站\测试框架\shigure-web
.\push.ps1
.\push.ps1 -Message "简述本次改动"
.\push.ps1 -DryRun   # 只预览，不提交不推送
```

需本机 Clash 等代理在 `127.0.0.1:7890`（或改 `gal-\ops\proxy.ps1`）。

## 运维

- [更新浮游 WORK 页（B 站投稿）](docs/update-fuyuu-videos.md)
- **大雨逐帧打磨（换机续作）**：[差距清单](docs/rain-gap-checklist.md) · [进度](docs/rain-polish-progress-2026-08-21.md) · [交接](docs/rain-handoff.md)

## 站点互链规则

- 根路径 `/` 为时雨榧主页；页脚可见链接「浮游Lev」→ `/fuyuu/`。
- **fuyuu** 仅保留页脚隐秘入口 `fy-kaya-corner` 指向 `/`，不链接其它 creator 站。
