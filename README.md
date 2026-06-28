# shigure-web

个人网站静态页面，部署于 [Vercel](https://shigure-web.vercel.app)。

- `/fuyulev` — 浮游Lev 作品集
- `/kaya` — 时雨榧 主页
- `/koharu` — 小春日向 主页
- `/shiotsuki` — 汐月空_poi 主页（建设中）

## 前端展示规范

**所有站点的前端页面均不得展示 B 站量化数据**，包括但不限于：

- 投稿总数、作品总数（如「共 N 部」）
- 粉丝数、关注数
- 获赞数、播放数、点赞数等互动数据
- 基于上述数字的统计卡片或排行榜

`data/profile.json` 中可保留抓取到的原始字段供内部使用，但 `js/site-data.js` 与页面 UI 不得引用或渲染这些数字。作品卡片仅展示标题、日期、时长等非量化信息。

## 站点互链规则

- **kaya**（`/kaya`）是唯一聚合导航站，可在 `sites.html` 等处链接到其它个人页。
- **fuyulev** 仅保留页脚隐秘入口 `fy-kaya-corner` 指向 kaya，不链接其它 creator 站。
- **koharu、shiotsuki** 等 creator 站**互不链接**，链接页仅展示 B 站等外部平台。
