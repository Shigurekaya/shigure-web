# Vendor notes

## raindrop-fx

- Source: https://github.com/SardineFish/raindrop-fx
- Version: 1.0.8 (`bundle/index.js`)
- License: MIT
- Used by: `js/heavy-rain.js`（大雨玻璃水珠 / 折射）

## html2canvas

- Source: https://github.com/niklasvh/html2canvas
- Version: 1.4.1 (`dist/html2canvas.min.js`)
- License: MIT
- Used by: `js/heavy-rain.js` 暴雨贴屏玻璃——把页面快照作为 raindrop-fx 折射底图（小米天气「雨水打在屏上」）

## Light rain（非整库 vendor）

小雨未嵌入完整第三方包，而是在 `js/light-rain.js` 中组合实现：

- [@vgerbot/weather-canvas](https://github.com/vgerbot-libraries/weather-canvas) `RainElement` 思路（MIT）：风速连动倾角、触底溅花
- [Codrops RainEffect](https://github.com/codrops/RainEffect) 思路：远 / 中 / 近分层
- 本站：透明叠加 + 紫丁香品牌色（不用 weather-canvas 的不透明天气底图）

## Heavy rain glass drops（本站 `js/glass-drops.js`）

大雨贴屏水珠未再开第二个 WebGL（避免与 GPU 雨丝抢上下文），按下列开源思路用 Canvas 2D 实现：

- [Codrops RainEffect](https://github.com/codrops/RainEffect)：冷凝微珠离屏层 + 大滴 `destination-out` 擦轨迹
- [Radiant rain-on-glass](https://radiant-shaders.com/learn/rain-on-glass)：尺寸概率 kick、合并、泪滴形 spread
- [raindrop-fx](https://github.com/SardineFish/raindrop-fx)：观感参考（无 GPU 时仍作 fallback）

## Storm lightning（本站 `js/storm-lightning.js`）

雷暴仅 URL 强制（`?rain=storm` / `/storm/`），叠在加重版大雨上，非整库嵌入：

- 垂直中点位移分叉：[diwsi/Javascript-Lightning-Effect](https://github.com/diwsi/Javascript-Lightning-Effect)、[shadcn Lightning Background](https://www.shadcn.io/background/lightning)、Cod Chill Thunder Breathing
- 环境闪光衰减：[@vgerbot/weather-canvas](https://github.com/vgerbot-libraries/weather-canvas) `LightningElement`（其螺栓本身偏简，仅参考闪光节奏）
- 先闪后雷：[panmona/stormsimulator](https://github.com/panmona/stormsimulator)
- 贴屏水珠 / 持续泪痕：Codrops RainEffect + Radiant rain-on-glass
- 过重未整迁：Three.js / fulgor / CrazyGL hero-rain-on-glass