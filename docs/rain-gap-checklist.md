# 时雨大雨 · 差距清单（换机续作必读）

> 更新日期：2026-08-21  
> 对照 URL：本地 `http://127.0.0.1:3000/?rain=heavy`  
> 线上：`https://shigure-web.vercel.app/?rain=heavy` / `https://www.shigurekaya.com/?heavy`  
> 参考视频（本机路径，换机需自备）：`d:\d63123f5e68f97c298dea1bec5aad3a0.mp4`  
> 硬约束：**天空自研模仿，禁止视频截帧作底图**

配套文档：

- [进度实录](./rain-polish-progress-2026-08-21.md)
- [换机交接](./rain-handoff.md)
- [贴屏避雷](./rain-glass-session-2026-08-21.md)
- [开源调研](./thunderstorm-opensource.md)

---

## 1. 验收标准（未达成）

与参考视频在 **雨形态 / 节奏 / 氛围 / 页面细节** 上肉眼几乎一致。  
当前 **未达标**，勿提前收工。

---

## 2. 参考片观察（要对齐的目标）

| 维度 | 参考表现 |
|------|----------|
| 雨势 | 中密大雨，非暴雨白幕；银丝可辨 |
| 密度 | 远淡近亮分层；横向覆盖广（bright_cols≈0.47） |
| 方向 | 近竖直，轻倾角（约 2–6°） |
| 速度 | 偏快短针感 |
| 形态 | **细针 + 软晕运动模糊**；贴屏小珠 + 竖泪痕 |
| 忌讳 | 硬针白帘、粗胶囊块、大虚焦圆斑、视频截帧天空 |
| 光影 | 冷灰蓝积雨；层状云起伏；中部略亮但无强 bloom |
| 音效 | 参考片可有雨声；站点非硬门槛 |
| UI | 只对齐雨氛围，不抄小米天气 UI |

---

## 3. 当前差距（相对 iter34）

| ID | 差距 | 严重度 | 状态 | 建议下一步 |
|----|------|--------|------|------------|
| A | 整体偏暗：mean **72.5** vs REF **86.4** | 高 | 未达标 | 抬亮自研天空底色与中缝，勿只加雨丝白 |
| B | 积雨云体对比仍弱，肉眼仍偏「渐变+糊」 | 高 | 未达标 | 强化 `paintSelfSkyClouds` 暗团/亮缝；降 CSS `::before` 洗白 |
| C | 雨丝密度/景深/节奏未跟帧 | 高 | 未达标 | 叠层细针+软晕；对照 `compare_*_sky.png` |
| D | 贴屏珠过亮热点 b150 **0.030** vs REF **0.018** | 中 | 控中 | 少冷凝、小 spawnSize；勿大 soft bokeh |
| E | 顶缘溅花已加强，待肉眼确认 | 中 | 待确认 | 大雨页卡片顶缘看白簇 |
| F | 中心亮缝/头像后 bloom 曾过强 | 中 | 已压一版 | 勿再把中缝 alpha 拉回 >0.5 |
| G | ~~视频截帧天空~~ | — | **已禁** | 只用 CSS + `site-bg__clouds` Canvas |

### 量化锚点

| 指标 | REF (frame_010) | iter32 | iter33 | iter34 |
|------|-----------------|--------|--------|--------|
| mean | 86.4 | 75.5 | 75.4 | **72.5** |
| sky | 83.1 | 79.1 | 77.5 | 76.1 |
| sat | 0.423 | 0.360 | 0.378 | 0.392 |
| b150 | 0.018 | 0.030 | 0.030 | 0.030 |

截图：`_rain_analysis/local/iter34.png`、`compare_iter33_sky.png`

---

## 4. 架构（改哪里）

```
site-bg
  ├─ CSS 底色 / ::before 淡氛围
  ├─ .site-bg__clouds     ← paintSelfSkyClouds（自研积雨，禁视频底）
  ├─ .site-bg__heavy      ← GPU 雨丝（贴屏成功时通常不占）
  └─ .site-bg__heavy-mist
site-fx
  ├─ .site-fx__rain-glass ← raindrop-fx 贴屏折射
  ├─ .site-fx__streak-overlay ← Canvas2D 银丝叠层（贴屏时主可见雨）
  ├─ .site-fx__glass-drops ← demote 回退 2D 珠
  └─ .site-fx__splash     ← 卡片顶缘溅花
```

关键文件：

| 文件 | 职责 |
|------|------|
| `js/heavy-rain.js` | 编排、天空、叠层丝、溅花、贴屏参数 |
| `js/gpu-streak-rain.js` | WebGL 雨丝（demote 后） |
| `js/glass-drops.js` | 2D 珠回退 |
| `css/style.css` | `body.heavy-rain` 天空/层级 |
| `index.html` | `?v=` 缓存戳 |

---

## 5. 已证伪（勿再开）

详见 [rain-glass-session-2026-08-21.md](./rain-glass-session-2026-08-21.md)：

1. 黑底 + `mix-blend-mode: screen` → 整页黑布  
2. 贴屏时同时创建 GPU 雨丝 WebGL → 手机 demote  
3. 库默认 mist / 高 shadow → 墨团  
4. 过密细针 + 叠层 opacity 过高 → 白帘  
5. 近景粗胶囊芯 → 像精灵块非雨丝  

---

## 6. 下一轮优先顺序

1. **抬亮整体**（mean→~84–88），同时保持云体起伏  
2. **跟帧雨丝**：细、软晕、横向覆盖，忌硬针/粗胶囊  
3. **压 b150**：珠更少更小更透  
4. **顶缘溅花**肉眼确认  
5. 每改一轮：`node _rain_analysis/capture-local2.mjs` + 三联对照图  

---

*本清单与进度文档同步维护；换机后先读 `rain-handoff.md`。*
