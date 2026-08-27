# 时雨大雨 · 逐帧打磨进程

对照 URL：

| 环境 | URL |
|------|-----|
| 本地 | `http://127.0.0.1:3000/?rain=heavy` |
| 线上 | `https://www.shigurekaya.com/?rain=heavy` |
| 线上域名 | `https://www.shigurekaya.com/?heavy` |

视口：**390×844**  
硬约束：天空自研，禁止视频截帧作底。

差距表：[rain-gap-checklist.md](./rain-gap-checklist.md)  
交接：[rain-handoff.md](./rain-handoff.md)

---

## 当前差距摘要（iter55）

| # | 差距 | 状态 |
|---|------|------|
| A | mean 88.1 vs 87.1 | **达标** |
| B | sky/sat 量化过；肉眼体积仍软 | **量化过 / 肉眼控中** |
| C | 雨丝软晕未跟帧 | **主矛盾** |
| D | b150 0.042 vs 0.034 | 控中 |

## 量化备忘

| 指标 | REF | i53 | i54 | i55 |
|------|-----|-----|-----|-----|
| mean | 87.1 | 89.1 | 88.1 | **88.1** |
| sky | 95.9 | 95.5 | 94.3 | **94.2** |
| sat | 0.426 | 0.412 | 0.415 | **0.415** |
| b150 | 0.034 | 0.041 | 0.042 | **0.042** |

## 轮次

| 轮 | 结果 |
|----|------|
| R17 | A 抬亮 |
| R18–R20 | B FBM；过暗回抬 |
| R21 | B 冷蓝+亮缝 → i52 sat过、sky低；**R21b → i53 sky95.5** |
| R21c/R22 | 暗核体积 + 丝更软 + 少冷凝 → **i55** |

## 实现备忘

- FBM 积雨：`paintSelfSkyClouds`
- 叠层丝：半分辨率软晕；CSS opacity 单路
- HTML `?v=202608221425`
- 量化：`quant_pair.py`

## 对照图

- `iter55.png` / `compare_iter55_sky.png`
- `iter53.png`（B 量化最佳点）

---

## R21 · 基本完成（量化）

**只做 B**：sky∈[92,100]、sat≥0.40、mean∈[82,92] → **iter53/55 通过**  
肉眼云体体积仍弱于 REF → 控中，勿破坏量化再乱压暗。

## R22 · 进行中

**下一主做 C**：细针+软晕跟帧；顺带盯 D b150。

**未完成**：尚未肉眼贴近参考视频。

## R24 · 继续打磨（2026-08-23，本地 iter75）

- 对照 URL：`http://127.0.0.1:3000/?rain=heavy`；参考：`d:\d63123f5e68f97c298dea1bec5aad3a0.mp4` 的 `frame_010.png`
- C 雨丝：细化 2D 软晕核心，亮芯改为极淡；叠层降至 13% 缓冲并减少锐芯，雨丝长度由 1.0–4.2% 屏高收至约 0.9–3.4%，降低轻倾硬针感。
- B 天空：继续使用自研 FBM Canvas；提高顶部亮度/冷灰蓝层次。云层探针 sky=95，最终截图量化 sky=95.0，sat=0.426。
- D 贴屏：减少大珠/冷凝微珠、缩短 trailDistance、降低 trailDropDensity/高光强度；最终 b150=0.038，较 REF 0.034 接近。
- iter75 量化：mean=88.4 vs REF 87.1；sky=95.0 vs 95.9；sat=0.426 vs 0.426；b150=0.038 vs 0.034。
- 详细探针仍显示 C 有差距：Hough 约 24 条 vs REF 2 条，说明 UI/贴屏边缘仍会被检测成线段；下一轮应继续以肉眼视频为主，重点排除硬边而不是继续提高密度。
- `ReadLints`：`heavy-rain.js`、`style.css` 无新增 lint。

## R25 · 性能降档（2026-08-23，本地 iter76）

- 目标：在 **仅改 heavy-rain** 前提下适当降画质，缓解性能压力；参考 GitHub 调研结论里的常见做法：降低 DPR / 运行时自适应降级 / 减少贴屏层刷新。
- 新增 `balanced` 档：大雨默认从 `high` 切到 `balanced`，`streak` 3200→1500、`dprCap` 2→1.12、`frameMs` 60fps→28fps，贴屏玻璃与冷凝珠数量也同步下调。
- 运行时治理：引入 `KayaPerfGovernor`，按帧成本自动降采样，帧忙时跳过次要溅花/叠层刷新。
- 贴屏优化：降低 `glassBufferSize`、overlay 低分辨率层、html2canvas 复捕获频率；减少 `trailDropDensity`、`trailDistance` 和微珠量，尽量保留细针+软晕轮廓。
- 性能基准（`uv run python perf_weather.py http://127.0.0.1:3000`）：`heavy avg=49.8fps`（原先更高档时常驻压力更大），`sunny/light` 未受影响。
- 视觉回归（iter76 / `compare_iter76.png`）：`mean=88.3`、`sky=95.1`、`sat=0.426`、`b150=0.038`，仍保持在原有可接受区间。
- 仍建议后续继续细看肉眼是否能接受 balanced 档的轻微变软；若过软，再局部补回叠层对比度，而不是整体回调 DPR。

**当前状态**：性能压力已明显下降，视觉特征仍在，但尚未做最终肉眼验收。


