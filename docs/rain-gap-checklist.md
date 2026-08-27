# 时雨大雨 · 差距清单（换机续作必读）

> 更新日期：2026-08-22  
> 对照 URL：本地 `http://127.0.0.1:3000/?rain=heavy`  
> 线上：`https://www.shigurekaya.com/?rain=heavy`
> 参考视频（本机路径，换机需自备）：`d:\Documents\Tencent Files\2205003070\nt_qq\nt_data\Video\2026-08\Ori\d63123f5e68f97c298dea1bec5aad3a0.mp4`  
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
| 密度 | 远淡近亮分层；横向覆盖广 |
| 方向 | 近竖直，轻倾角（约 2–6°） |
| 速度 | 偏快短针感 |
| 形态 | **细针 + 软晕运动模糊**；贴屏小珠 + 竖泪痕 |
| 忌讳 | 硬针白帘、粗胶囊块、大虚焦圆斑、视频截帧天空 |
| 光影 | 冷灰蓝积雨；层状云起伏；中部略亮但无强 bloom |
| UI | 只对齐雨氛围，不抄小米天气 UI |

---

## 3. 当前差距（相对 iter55）

| ID | 差距 | 严重度 | 状态 | 建议下一步 |
|----|------|--------|------|------------|
| A | 整体亮度 mean **88.1** vs REF **87.1** | 高 | **达标** | 维持 82–92 |
| B | 积雨：量化接近，肉眼体积感仍弱 | 高 | **量化过 / 肉眼控中** | 云缘高光/暗底更硬；忌再压 mean |
| C | 雨丝仍略粗硬于 REF 软晕 | 高 | **主矛盾** | 更细芯 + 更强半分辨率软化；忌白帘 |
| D | b150 **0.042** vs REF **0.034** | 中 | 控中 | 已减冷凝；热点或来自丝/头像 |
| E | 顶缘溅花 | 中 | 待确认 | 卡片顶缘看白簇 |
| F | 中缝 bloom | 中 | 已压 | alpha ≤0.5 |
| G | ~~视频截帧天空~~ | — | **已禁** | FBM Canvas |

### 量化锚点（`quant_pair.py`）

| 指标 | REF | i52 | i53 | i54 | i55 |
|------|-----|-----|-----|-----|-----|
| mean | 87.1 | 84.3 | **89.1** | 88.1 | **88.1** |
| sky | 95.9 | 88.2 | **95.5** | 94.3 | **94.2** |
| sat | 0.426 | 0.450 | **0.412** | 0.415 | **0.415** |
| b150 | 0.034 | 0.042 | 0.041 | 0.042 | **0.042** |

截图：`_rain_analysis/local/iter55.png`、`compare_iter55_sky.png`

---

## 4. 架构（改哪里）

```
site-bg
  ├─ CSS 底色 / ::before
  ├─ .site-bg__clouds     ← paintSelfSkyClouds（FBM，禁视频底）
  ├─ .site-bg__heavy      ← GPU（贴屏成功时通常不占）
  └─ .site-bg__heavy-mist
site-fx
  ├─ .site-fx__rain-glass ← raindrop-fx（z6）
  ├─ .site-fx__streak-overlay ← 半分辨率银丝（z7）
  ├─ .site-fx__glass-drops
  └─ .site-fx__splash
```

| 文件 | 职责 |
|------|------|
| `js/heavy-rain.js` | 天空 / 叠层丝 / 贴屏参数 |
| `css/style.css` | `body.heavy-rain` |
| `index.html` | `?v=` |
| `_rain_analysis/quant_pair.py` | 量化 |

---

## 5. 已证伪

1. 黑底 + `mix-blend-mode: screen`  
2. 贴屏 + 第二 WebGL 雨丝  
3. 库默认 mist / 高 shadow → 墨团  
4. 过密硬针 / 粗胶囊  
5. 叠层 CSS×canvas 双重 opacity → 雨丝过淡  

---

## 6. 下一轮优先

1. **C 雨丝软晕**：更细、更软，对齐 REF 运动模糊银丝  
2. **B 肉眼体积**：云缘亮边/暗底再硬一点（守 mean/sky）  
3. **D b150**：继续少珠/低高光  
4. 每轮：`capture-local2.mjs` + `quant_pair.py`

---

*换机先读 `rain-handoff.md`。*
