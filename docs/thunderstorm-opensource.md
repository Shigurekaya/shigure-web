# 雷雨天效果开源调研

调研日期：2026-08-20  
用途：评估能否在时雨站现有暴雨（`heavy-rain` + raindrop-fx）上叠加雷电/雷声，而非整站替换。

## 结论（先看）

- **不必换整库。** 现有玻璃水珠 + 雨丝溅花可保留。
- **更稳的增量方案：**
  1. 画面：偶发全屏/局部闪光 + 短时分叉闪电
  2. 声音（可选）：Web Audio 或短 thunder 采样；「先闪后雷」带距离延迟
  3. 时机：仅在 `body.heavy-rain` 下低频触发，注意移动端性能与自动播放策略
- **抽算法优先：** [diwsi/Javascript-Lightning-Effect](https://github.com/diwsi/Javascript-Lightning-Effect)（MIT，纯 Canvas，轻）
- **节奏参考：** [panmona/stormsimulator](https://github.com/panmona/stormsimulator)（MIT，闪电后延迟打雷）

你们已有基础：

- 暴雨：`js/heavy-rain.js` + `js/vendor/raindrop-fx.js`
- 小雨：`js/light-rain.js`（借鉴 weather-canvas / Codrops 思路）

---

## 最贴合本站（Canvas / 轻量）

| 项目 | 许可 | 要点 | 嫁接建议 |
|------|------|------|----------|
| [vgerbot-libraries/weather-canvas](https://github.com/vgerbot-libraries/weather-canvas) | MIT | 自带 `thunderstorm`；Canvas 2D；零依赖 | 小雨已借鉴过；雷暴是整页天气画，不宜整库叠在玻璃暴雨上 |
| [diwsi/Javascript-Lightning-Effect](https://github.com/diwsi/Javascript-Lightning-Effect) | MIT | 纯 Canvas 分叉闪电，很轻 | **最适合**抽中点位移/分叉逻辑，叠在 `heavy-rain` 上 |
| [panmona/stormsimulator](https://github.com/panmona/stormsimulator) | MIT | 雨 + 闪电 + 雷声延迟（距离感） | 偏氛围页；可参考「先闪后雷」节奏，勿整站搬 |

Demo：

- 闪电：https://diwsi.github.io/jslightning/index.html
- 雷雨氛围：https://stormsimulator.netlify.app/

---

## 效果强，但偏「整站模拟器」

| 项目 | 许可 | 技术 | 备注 |
|------|------|------|------|
| [jesse-lane-ai/fulgor](https://github.com/jesse-lane-ai/fulgor) | 以仓库为准 | 纯 JS + WebGL2 | 积雨云 + 枝状闪电 + 程序化雷声，独立场景感强 |
| [rauschermate/react-weather-effects](https://github.com/rauschermate/react-weather-effects) | MIT | React / WebGL / Three.js | Storm 带闪电；依赖重，本站为静态 HTML 不适合整迁 |
| [rubenvieira/rain-simulator](https://github.com/rubenvieira/rain-simulator) | 需确认 LICENSE | React + Canvas + Tone.js | 窗玻璃雨 + 程序化雷声 |
| [greywen/web-weather](https://github.com/greywen/web-weather) | 以仓库为准 | Next + Canvas + Web Audio | 分形闪电 + 程序化雷/雨/风 |
| [CK42BB/procedural-weather-threejs](https://github.com/CK42BB/procedural-weather-threejs) | 以仓库为准 | Three.js / WebGPU | 技能式天气系统，含闪电与状态机；过重 |

Demo（若有）：

- react-weather-effects：https://react-weather-effects.vercel.app

---

## 其它相关（雨为主，雷电较弱）

| 项目 | 说明 |
|------|------|
| [SardineFish/raindrop-fx](https://github.com/SardineFish/raindrop-fx) | 已在用（MIT）；玻璃折射水珠，**无**雷电 |
| [codrops/RainEffect](https://github.com/codrops/RainEffect) | 小雨分层思路已参考；非雷暴库 |
| [Kinza98/Lightening](https://github.com/Kinza98/Lightening) | Canvas 雨+闪电小品；星少，可作参考 demo |

---

## 若落地到本站（建议步骤，未实施）

1. 新建可选模块（例如 `js/storm-lightning.js`），仅 `heavy-rain` 时加载。
2. 画面：低频全屏 flash（CSS/canvas 白光衰减）+ 可选 1～2 道分叉线（diwsi 思路）。
3. 声音：默认关或需用户手势后开；雷声落后闪电约 0.3～2s（按「距离」随机）。
4. 开关：URL 如 `?rain=storm&thunder=1`，或仅 storm 页启用，避免日常 10% 暴雨也打雷。
5. 性能：手机端降低闪光频率、关闭音频、避免与 raindrop-fx 同帧过重。

---

## 链接速查

```
https://github.com/diwsi/Javascript-Lightning-Effect
https://github.com/panmona/stormsimulator
https://github.com/vgerbot-libraries/weather-canvas
https://github.com/jesse-lane-ai/fulgor
https://github.com/rauschermate/react-weather-effects
https://github.com/rubenvieira/rain-simulator
https://github.com/greywen/web-weather
https://github.com/CK42BB/procedural-weather-threejs
https://github.com/SardineFish/raindrop-fx
```
