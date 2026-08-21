# 时雨大雨 · 换机交接说明

明天换电脑拉取后续作请按本文操作。

## 1. 拉取

```powershell
git clone https://github.com/Shigurekaya/shigure-web.git
# 或已有仓库：
cd <repo>
git pull origin main
```

Git 身份（本仓库提交必须用 Shigurekaya，否则 Vercel Hobby 会 Blocked）：

```powershell
git config --local user.name "榧"
git config --local user.email "163858348+Shigurekaya@users.noreply.github.com"
```

## 2. 本地预览

```powershell
cd shigure-web
py -3 .\serve-local.py
```

大雨对照页：

- http://127.0.0.1:3000/?rain=heavy  
- 或 http://127.0.0.1:3000/heavy/  

线上对照：

- https://shigure-web.vercel.app/?rain=heavy  
- https://www.shigurekaya.com/?heavy  

## 3. 必读文档（仓库内）

| 文档 | 内容 |
|------|------|
| [rain-gap-checklist.md](./rain-gap-checklist.md) | **当前差距清单**（优先读） |
| [rain-polish-progress-2026-08-21.md](./rain-polish-progress-2026-08-21.md) | 轮次进度与量化 |
| [rain-glass-session-2026-08-21.md](./rain-glass-session-2026-08-21.md) | 贴屏避雷与参数锚点 |
| [thunderstorm-opensource.md](./thunderstorm-opensource.md) | 开源实现调研 |
| [../_rain_analysis/README.md](../_rain_analysis/README.md) | 分析脚本用法 |

## 4. 参考视频

原路径：`d:\d63123f5e68f97c298dea1bec5aad3a0.mp4`（小米天气 Heavy rainfall）。  

换机后请自行拷贝视频；仓库内已有抽帧样本 `_rain_analysis/frame_*.png` 与对照图 `_rain_analysis/local/compare_*.png`。  
高清序列 `_rain_analysis/hi/`、浏览器 profile、录音 **默认不入库**（体积大）；需要时可本地再抽。

## 5. 截图对比流程

```powershell
cd shigure-web
# 若缺 playwright：
cd _rain_analysis
npm install
cd ..

$env:RAIN_URL="http://127.0.0.1:3000/?rain=heavy"
$env:RAIN_TAG="iterXX"
$env:RAIN_W="390"
$env:RAIN_H="844"
node _rain_analysis\capture-local2.mjs
```

改 HTML `?v=` 用 Python UTF-8，勿用 PowerShell 乱码写中文文件。

推送：

```powershell
.\push.ps1 -Message "简述"
```

`push.ps1` 会排除不应提交的大体量分析缓存；脚本/对照图/文档已纳入版本库。

## 6. 硬约束提醒

1. **禁止**用参考视频截帧当天空底图（自研 CSS/Canvas）  
2. 贴屏成功时 **不要**再挂第二个 WebGL 雨丝  
3. 勿开黑底 + `mix-blend-mode: screen`  
4. 雨丝忌「硬针白帘」与「粗胶囊块」；目标是细针 + 软晕  

## 7. 当前代码状态（推送点）

- 自研积雨：`paintSelfSkyClouds` → `.site-bg__clouds`  
- 贴屏银丝叠层：`.site-fx__streak-overlay` + `createBgStreakField`  
- 截图冻结雨层：`window.__kayaFreezeFx`  
- 最新本地截图标签：`iter34`  

**尚未与参考视频肉眼一致**，请从差距清单 A/B/C 继续。
