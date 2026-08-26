# 本地开发（固定地址）

本仓库本地预览 **统一使用 `127.0.0.1`**，不要用 `localhost`（避免部分环境 IPv6/hosts 解析差异）。

| 项 | 值 |
|----|-----|
| 主机 | `127.0.0.1` |
| 端口 | `3456` |
| 根 URL | `http://127.0.0.1:3456/` |

## 启动

```powershell
cd E:\网站\测试框架\shigure-web
.\start-local.ps1
# 等价：uv run python .\serve-local.py
```

本目录用 **uv**（`pyproject.toml` + `.venv`），不要再装到 C 盘的系统 Python。

## 常用路径

| URL | 页面 |
|-----|------|
| http://127.0.0.1:3456/ | 时雨榧主页 |
| http://127.0.0.1:3456/works/ | 作品集 |
| http://127.0.0.1:3456/links/ | 链接 |
| http://127.0.0.1:3456/mv-materials/ | MV 素材 |
| http://127.0.0.1:3456/fuyuu/ | 浮游Lev |
| http://127.0.0.1:3456/gal-pick/ | 入坑风向标 |
| http://127.0.0.1:3456/gal-quiz/ | Gal 水平测试 |
| http://127.0.0.1:3456/gal-sedai/ | Gal 世代 |

`serve-local.py` 默认 `--host 127.0.0.1`；代理推送见 README（GitHub 走 `127.0.0.1:7890`）。
