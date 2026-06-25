# 统一部署包

上传 **`web` 文件夹内的全部内容** 到服务器网站根目录即可。**不需要** 在服务器上运行 Python 或 `login_server.py`。

## 是否需要后端？

| 场景 | 是否需要 |
|------|----------|
| 访客浏览网站 | **否** — 纯静态 HTML / CSS / JS，数据已在 `js/site-data.js` 和图片里 |
| 本地预览 | 任意静态服务器即可（见下），不是 Flask 后端 |
| 更新 B 站投稿数据 | **仅在你自己的电脑上** 运行抓取脚本（见下），与线上站点无关 |

`login_server.py`、`login_scrape.py` 是**开发用工具**，用来登录 B 站并重新抓取数据，**不要**部署到公网服务器。

## 结构

```
web/
├── index.html      ← 入口：选择时雨榧 / 浮游Lev
├── portal.css
├── vercel.json
├── shiyuki/        ← 时雨榧（手书 · 视频）
└── komowata/       ← 浮游Lev（插画 · 绘画过程）
```

## 部署注意

1. 把 `web/` **里面的文件**放到网站根目录（例如 Nginx 的 `root` 指向含 `index.html` 的那一层）。
2. 不要只上传 HTML，必须连同 `shiyuki/assets/`、`komowata/assets/` 一起上传。
3. 不要用 `file://` 双击打开 HTML 做正式测试；用下面任意一种 HTTP 方式预览更可靠。

## 本地预览

```bash
cd web
py -m http.server 8080
```

浏览器打开 `http://127.0.0.1:8080/`

## 更新 B 站数据

在项目根目录执行（需先登录 B 站）：

```bash
# 时雨榧
py scripts/scrape_shiyuki.py

# 浮游Lev
py login_scrape.py --target fuyu
```

数据会写入 `web/shiyuki/` 与 `web/komowata/`。

## 静态托管

- 将 `web` 目录内容作为网站根目录部署
- 或整包上传后把 Web 服务器根目录指向 `web`
