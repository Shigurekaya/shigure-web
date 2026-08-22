# 晴天 / 雨后彩虹开源调研

调研日期：2026-08-22  
用途：评估如何替换当前草稿级 `sunny-sky.js` / `after-rain.js`，达到「可当站背景」的质感，而非玩具椭圆云 + 硬描边彩虹。

## 产品约束

- 与雷暴调研一致：**增量嫁接**，不整站换天气模拟器。
- 本站已是静态 HTML + Canvas；Three.js / 整页 living-sky 仅作观感参考。
- 晴天、彩虹仅 URL/会话强制（`?sunny` / `?rainbow`），日常不抽签。
- 观感应贴近「窗外真实天气」，与小雨/大雨同一品牌气质（冷紫丁香可略偏暖晴、雨后偏澄澈）。

## 结论（先看）

| 目标 | 推荐路径 | 不推荐 |
|------|----------|--------|
| 晴天天空 | **抽算法**：大气渐变 + soft FBM/多层云 + 太阳晕（借鉴 weather-canvas / weather-animations / Climatic） | 整迁 Three.js Sky；纯 CSS 卡通云（Bowley 那类）当主视觉 |
| 雨后彩虹 | **抽算法**：HSL 多带半透明弧 + 径向柔化 + 破云逆光（借鉴 krazydad + zaur-world 叙事） | 实色 `stroke` 七色硬环（当前草稿问题）；整嵌 zaur-world |
| 观感上限参考 | [zaur-world](https://github.com/nomideusz/zaur-world) Demo（真蓝晴空 + 雨停彩虹） | 作依赖嵌入本站 |

**当前草稿差在哪**

1. **晴天**：椭圆叠云像贴纸；太阳是硬盘 + 简单径向；缺大气散射层次与高积云/卷云丝感。  
2. **彩虹**：七色不透明描边弧，像教材示意图；缺柔边、屏混、双虹、与破云光对比。

**建议落地顺序**

1. 重写天空底色（多停靠点渐变 + 地平线漂白），参考 weather-canvas sunny / Climatic Sky 层。  
2. 云：用与大雨 `paintSelfSkyClouds` 同族的 **FBM 软云**（低覆盖），或 2～3 层低对比 sprite/blob 视差；禁止硬边椭圆团。  
3. 彩虹：改 **HSL 环带 + 低 alpha + `screen`/`soft-light`**，必要时径向渐变蒙版做内外柔边；可加极淡副虹。  
4. 雨后叙事：左侧/偏侧破云暖光 + 极稀残留雨丝 + 底部湿气（已有雏形，加强对比即可）。

---

## 最值得看的 Demo（先打开）

| 项目 | Demo | 看什么 |
|------|------|--------|
| **zaur-world** | https://dino.zaur.app | 真蓝晴空、卷云丝、雨停时彩虹；观感天花板 |
| **weather-canvas** | 仓库 readme 截图 / examples | `sunny`：太阳晕、轻量 Canvas，最易抽 |
| **weather-animations** | https://g3sthousen.github.io/weather-animations/ | `clear` / cloudy 日间色板与过渡 |
| **Climatic** | 仓库 `dist/demo.html` / unpkg bundle | 9 层 CSS：天空渐变 + 太阳位 + 飘云 |
| **Three.js Sky** | https://threejs.org/examples/#webgl_shaders_sky | 物理散射天空（过重，只学观感） |
| **krazydad 彩虹教程** | http://www.krazydad.com/tutorials/rainbow/ | HSL 双虹 + 天空渐变，彩虹算法首选 |

---

## 晴天：贴合本站的开源

| 项目 | 许可 | 技术 | 要点 | 嫁接建议 |
|------|------|------|------|----------|
| [vgerbot-libraries/weather-canvas](https://github.com/vgerbot-libraries/weather-canvas) | MIT | Canvas 2D | 已有 `sunny`；日夜、强度；零依赖 | **最优先抽**：太阳 glow / 射线 / 天空色；小雨曾借鉴过同库 |
| [g3sthousen/weather-animations](https://github.com/g3sthousen/weather-animations) | MIT | Canvas + TS | `clear` 等状态、日间 palette、云层 fidelity | 抽 clear 天空色板与云密度；勿整包 npm 进静态站 |
| [santoshtvk-new/CLIMATIC_APP](https://github.com/santoshtvk-new/CLIMATIC_APP) | MIT | CSS 9 层 + JS | 天文太阳位、飘云、季节地面 | 可借「分层天空 + 太阳光晕」结构；整 widget 偏重 |
| [nomideusz/zaur-world](https://github.com/nomideusz/zaur-world) | 以仓库为准 | Canvas 环境天空 | 真蓝、卷云、视差云、实况天气 | **观感标杆**；整库过重，只抄参数感 |
| [mrdoob/three.js Sky](https://threejs.org/examples/#webgl_shaders_sky) | MIT | WebGL / Three | Rayleigh/Mie + 新版 FBM 云 | 过重（同雷暴结论）；学 turbidity/散射直觉即可 |
| CSS 卡通云 ([CodePen xEbuI](https://codepen.io/Mark_Bowley/pen/xEbuI) 等) | 各 Pen 自有 | CSS | 圆角盒子云 | 仅玩具感，**勿作主视觉** |

本站已有可复用资产：`heavy-rain.js` 里 `paintSelfSkyClouds`（FBM）——晴天可降密度、提亮、加暖光，比重画椭圆云更统一。

---

## 彩虹 / 雨后：贴合本站的开源

| 项目 / 资料 | 许可 | 要点 | 嫁接建议 |
|-------------|------|------|----------|
| [krazydad · Double Rainbow](http://www.krazydad.com/tutorials/rainbow/) | 教程（实现自写） | HSL 动画双虹、天空渐变、弧而非硬色块 | **彩虹算法首选**：按 H 步进画半透明弧，内外 alpha 衰减 |
| [SO · radial gradient rainbow](https://stackoverflow.com/questions/37700784/drawing-a-rainbow-with-canvas-and-javascript) | — | `createRadialGradient` 七色停靠 | 适合柔边「雾虹」；可与弧描边混用 |
| **zaur-world** | 以仓库为准 | 「太阳遇上 clearing shower」才出虹 | 叙事对：雨后 = 破云光 + 虹，不是单独贴一张虹 |
| weather-canvas / Climatic | MIT | 无独立「彩虹天气」或很弱 | 天空与残云仍可借；虹自己画 |

不相关（搜索噪音，跳过）：Matrix「rainbow mode」、数字雨变色——与气象彩虹无关。

---

## 效果强但偏「整站模拟器」（跳过整迁）

| 项目 | 说明 |
|------|------|
| zaur-world | 实况天气 + 天文 + 彩虹；优秀但体量大 |
| Climatic Widget | 可嵌入，但会接管整页背景与定位 API |
| Three.js Sky / volumetric cloud repos | 真散射/体云，体积与双 WebGL 风险不适合主站 |
| Codrops RainEffect / CrazyGL rain-on-glass | **雨后玻璃**方向强；本站大雨已有 raindrop-fx，彩虹页不必再叠一套玻璃 |

---

## 若落地到本站（已实施 · 2026-08-22）

1. `js/sunny-sky.js`：真蓝天顶→地平漂白 + 多层太阳晕/光柱 + **FBM 卷云/积云**烘焙慢漂  
2. `js/after-rain.js`：破云暖光（左）+ **HSL 柔边主虹/副虹**（screen）+ FBM 残云 + 稀雨丝 + 湿气  
3. CSS `body.sunny-sky` / `body.after-rain` 仅 UI token 与极轻叠光  
4. 入口：`?sunny` / `/sunny/`，`?rainbow` / `/rainbow/`

---

## 链接速查

```
https://dino.zaur.app
https://github.com/nomideusz/zaur-world
https://github.com/vgerbot-libraries/weather-canvas
https://g3sthousen.github.io/weather-animations/
https://github.com/g3sthousen/weather-animations
https://github.com/santoshtvk-new/CLIMATIC_APP
https://threejs.org/examples/#webgl_shaders_sky
http://www.krazydad.com/tutorials/rainbow/
https://codepen.io/Mark_Bowley/pen/xEbuI
```
