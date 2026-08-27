# Gal 名言抓取与审阅

从 [VNDB](https://vndb.org/) 批量抓取视觉小说台词，生成 HTML 审阅页；右侧勾选「保留」并写入 `data/approved.json`。

## 目录

```
_gal_quotes/
  fetch_quotes.py      # 抓取 + 生成 review.html
  review_server.py     # 本地审阅服务（持久化勾选状态）
  data/
    quotes.json        # 抓取结果
    approved.json      # 已勾选保留 { "q123": { "approved": true, "quote_zh": "..." } }
  out/
    review.html        # 审阅页
    approved.html      # 仅已保留条目（导出用）
```

## 用法

```powershell
cd shigure-web
. ..\gal-\ops\proxy.ps1; Enable-RepoProxy

# 抓取 + 机翻汉化（默认约 1200 条；机翻默认 8 线程并行）
uv run python _gal_quotes/fetch_quotes.py --translate
uv run python _gal_quotes/fetch_quotes.py --limit 2000 --translate --workers 12

# 不重新抓，只对已有 JSON 补汉化并重生 HTML
uv run python _gal_quotes/fetch_quotes.py --reuse --translate --workers 12

# 启动审阅（勾选写回 approved.json）
uv run python _gal_quotes/review_server.py
# 浏览器打开 http://127.0.0.1:8765/review.html
```

也可直接打开 `out/review.html`（勾选仅存浏览器 localStorage，需点「导出 approved」）。

## 字段说明

| 字段 | 说明 |
|------|------|
| `quote` | VNDB 原文（多为英/日） |
| `quote_zh` | 中文；`known` 公认译 / `mt` 机翻 / `native` 原文中文 |
| `quote_zh_source` | 汉化来源标记 |
| `vn_title_zh` | 作品中文名（aliases / 补丁表） |
| `source` | 固定 `VNDB` |
| `source_url` | `https://vndb.org/q…` |

机翻句务必在审阅页校对后再勾选保留。
