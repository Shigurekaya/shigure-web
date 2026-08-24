# 本地开发（固定地址）

本仓库本地预览 **统一使用 `127.0.0.1`**，不要用 `localhost`（避免部分环境 IPv6/hosts 解析差异）。

| 项 | 值 |
|----|-----|
| 主机 | `127.0.0.1` |
| 端口 | `3000` |
| 根 URL | `http://127.0.0.1:3000/` |

## 启动

```powershell
cd E:\网站\测试框架\shigure-web
py -3 .\serve-local.py
# 或
.\start-local.ps1
```

## 常用路径

| URL | 页面 |
|-----|------|
| http://127.0.0.1:3000/ | 时雨榧主页 |
| http://127.0.0.1:3000/works/ | 作品集 |
| http://127.0.0.1:3000/links/ | 链接 |
| http://127.0.0.1:3000/mv-materials/ | MV 素材 |
| http://127.0.0.1:3000/fuyuu/ | 浮游Lev |
| http://127.0.0.1:3000/?rain=heavy | 大雨测试 |
| http://127.0.0.1:3000/?rain=storm | 雷暴测试 |

`serve-local.py` 默认 `--host 127.0.0.1`；代理推送见 README（GitHub 走 `127.0.0.1:7890`）。
