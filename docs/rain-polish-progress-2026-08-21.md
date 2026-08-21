# 时雨大雨 · 逐帧打磨进程

对照 URL：

| 环境 | URL |
|------|-----|
| 本地 | `http://127.0.0.1:3000/?rain=heavy` |
| 线上 Vercel | `https://shigure-web.vercel.app/?rain=heavy` |
| 线上域名 | `https://www.shigurekaya.com/?heavy` |

视口：手机 **390×844**  
参考：`d:\d63123f5e68f97c298dea1bec5aad3a0.mp4`（小米天气 Heavy rainfall）  
硬约束：**天空必须自研**（CSS/Canvas），禁止视频截帧作底。

完整差距表见：[rain-gap-checklist.md](./rain-gap-checklist.md)  
换机说明见：[rain-handoff.md](./rain-handoff.md)

---

## 参考片细节盘点

| 维度 | 观察 |
|------|------|
| 雨势 | 中密大雨，非暴雨白幕；银丝可辨 |
| 密度 | 远淡近亮分层；横向覆盖广 |
| 方向 | 近竖直，轻倾角 |
| 速度 | 偏快短针感 |
| 形态 | **细针 + 软晕运动模糊**；贴屏小珠+竖泪痕；忌粗胶囊/硬针帘 |
| 模糊 | 无大虚焦圆斑抢戏 |
| 光影 | 冷灰蓝积雨；可见云体起伏；中部略亮但勿强 bloom |
| 音效 | 可有雨声；站点非硬门槛 |
| UI | 只对齐雨氛围，不抄天气 UI |

---

## 当前差距摘要（iter34）

| # | 差距 | 状态 |
|---|------|------|
| A | 整体偏暗（mean 72.5 vs REF 86.4） | **未达标** |
| B | 自研积雨云体对比仍弱 | **未达标** |
| C | 雨丝密度/景深/节奏未跟帧 | **未达标** |
| D | 贴屏珠 b150 0.030 vs 0.018 | 控中 |
| E | 顶缘溅花已加强 | 待肉眼确认 |
| F | ~~视频截帧天空~~ | **已禁** |

## 量化备忘

| 指标 | REF | i32 | i33 | i34 |
|------|-----|-----|-----|-----|
| mean | 86.4 | 75.5 | 75.4 | **72.5** |
| sky | 83.1 | 79.1 | 77.5 | 76.1 |
| sat | 0.423 | 0.360 | 0.378 | 0.392 |
| b150 | 0.018 | 0.030 | 0.030 | 0.030 |

## 轮次摘要

| 轮 | 结果 |
|----|------|
| R1–R12 | 天空自研初版、贴屏珠、丝参数 |
| R13 | 叠层过密 → 硬针白帘（iter28） |
| R14 | 软化但过暗（iter29） |
| R15 | `site-bg__clouds` 自研积雨 + `__kayaFreezeFx`（iter32） |
| R16 | 硬边积雨；胶囊丝过头 → 回细针软晕；溅花加强（**iter34**） |

## 关键实现备忘

- `js/heavy-rain.js`：`paintSelfSkyClouds`、`createBgStreakField`、溅花、贴屏编排  
- `css/style.css`：`body.heavy-rain` / `.site-bg__clouds`  
- 贴屏时雨丝主路径：`.site-fx__streak-overlay`（勿双 WebGL）  
- HTML 缓存戳：`index.html` 内 `?v=`

## 对照截图（仓库内）

- `_rain_analysis/local/iter34.png`  
- `_rain_analysis/local/compare_iter33_sky.png`  
- `_rain_analysis/frame_010.png`（参考抽帧样本）

---

**未完成**：与参考视频尚未肉眼一致。换机后从差距 A/B/C 继续，勿提前收工。
