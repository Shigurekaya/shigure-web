# 暴雨参考片分析备忘

来源：`d:\d63123f5e68f97c298dea1bec5aad3a0.mp4`（小米天气 · Heavy rainfall）

运行：

```powershell
cd shigure-web
uv venv .venv
uv pip install pillow numpy opencv-python-headless
.\.venv\Scripts\python.exe _rain_analysis\analyze_rain.py
```

## 量化结论（45 帧 @ 8fps + 二次 gap_check）

| 项 | 值 | 落地 |
|---|---|---|
| 背景主色 | `#344961`（亮区≈`#3d5777`） | CSS `#243448`（略压暗保文字对比） |
| 雨丝倾角 | 天空区 ≈0–3°，近竖直 | `wind` 0.26–0.36，`dir.x *= 0.08` |
| 雨丝长度 | ~1.5%–2.6% 屏高 | GPU 三层 `lenH`，远丝占 ~48% |
| 亮丝占比 | ~11.5% | high 档 ~1980 条 |
| 前景主珠 | 约十几颗、~7–9px | `glassMain` 14–26，小硬边精灵 |
| 前景微珠 | ~300+ 冷凝点 | `glassMicro` 220–420，中下偏置 |
| 竖向雨幕光柱 | **参考片不存在** | 已去掉 CSS repeating 雨幕 |

## 分层（与网上最佳实践一致）

1. **远景雨雾/雨幕** — CSS `.site-fx__mist`
2. **主体雨丝** — 单 WebGL 上下文，顶点着色器算位置
3. **镜头水珠** — Canvas2D 预烘焙精灵（避免第二 WebGL 与 raindrop-fx 抢上下文）
4. **卡片溅花** — 轻量 2D

参考：[Radiant rain-on-glass](https://radiant-shaders.com/learn/rain-on-glass)、[Codrops Rain](https://tympanus.net/codrops/2015/11/04/rain-water-effect-experiments/)、[procedural-weather-threejs](https://github.com/CK42BB/procedural-weather-threejs)
