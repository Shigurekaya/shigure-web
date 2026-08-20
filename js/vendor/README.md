# Vendor notes

## raindrop-fx

- Source: https://github.com/SardineFish/raindrop-fx
- Version: 1.0.8 (`bundle/index.js`)
- License: MIT
- Used by: `js/heavy-rain.js`（暴雨玻璃水珠 / 折射）

## Light rain（非整库 vendor）

小雨未嵌入完整第三方包，而是在 `js/light-rain.js` 中组合实现：

- [@vgerbot/weather-canvas](https://github.com/vgerbot-libraries/weather-canvas) `RainElement` 思路（MIT）：风速连动倾角、触底溅花
- [Codrops RainEffect](https://github.com/codrops/RainEffect) 思路：远 / 中 / 近分层
- 本站：透明叠加 + 紫丁香品牌色（不用 weather-canvas 的不透明天气底图）
