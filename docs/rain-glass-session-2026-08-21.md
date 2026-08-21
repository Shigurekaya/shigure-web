# 贴屏玻璃雨效会话实录（避雷 / 决策）

> 记录日期：2026-08-21  
> 范围：`shigure-web` 大雨/暴雨「雨水打在玻璃屏上」  
> 参考：小米天气录屏；用户认可的「半透明大折射珠」实机截图  
> 配套规则：`.cursor/rules/rain-realism.mdc`  
> 相关调研：`docs/thunderstorm-opensource.md`

本文供后续改雨效时对照，**先读「已证伪」再改参数**。

---

## 1. 产品目标（稳定）

| 优先级 | 要求 |
|--------|------|
| 1 | **最真实**：半透明大水滴打在屏上，有折射体积感、高光、会下滑 |
| 2 | 冷凝微珠要有，但**不要满屏霜点**盖住主珠 |
| 3 | 手机可读；允许整体略暗（用户明确接受「之前暗一点但珠好看」） |
| 4 | 文字经水珠略糊/折射（真折射路径才有） |

测试入口：

- 暴雨贴屏：`https://www.shigurekaya.com/?storm`
- 大雨贴屏：`https://www.shigurekaya.com/?heavy`
- **首页无参数多为小雨** → 看不到贴屏大珠（曾被误判为「推了没变化」）

推送：`.\push.ps1`；HTML `?v=` 用 **Python UTF-8** 改，勿用 PowerShell 写中文文件。

代理：`http://127.0.0.1:7890`（GitHub 相关先注入）。

---

## 2. 架构分层（当前意图）

```
site-bg          GPU/2D 短密雨丝 + 淡雾（贴屏成功时 GPU 不创建）
site-fx          溅花 / 闪电
  └─ rain-glass  raindrop-fx 贴屏真折射（盖住活 UI）
  └─ glass-drops Canvas2D 珠（贴屏未就绪或 demote 时用）
```

关键文件：

| 文件 | 职责 |
|------|------|
| `js/heavy-rain.js` | 编排：贴屏开关、截图、GPU、demote、raindrop 参数 |
| `js/glass-drops.js` | 2D 贴屏珠 / 冷凝 / 泪痕（回退路径） |
| `js/gpu-streak-rain.js` | 背景雨丝 WebGL |
| `js/vendor/raindrop-fx.js` | 真折射库（默认 `spawnSize:[60,100]`） |
| `js/vendor/html2canvas.min.js` | DOM 截成折射底图 |
| `css/style.css` | `.site-fx__rain-glass` 层级与轻微 brightness |

---

## 3. 时间线（本会话关键转折）

| 阶段 | 做法 | 实机结果 | 结论 |
|------|------|----------|------|
| A | 关贴屏，只用 2D 珠 + 密冷凝 | 无「打屏折射」感 | 不够真 |
| B | 2D 加强透亮珠 / 下滑 | 有下滑，仍无真折射 | 过渡方案 |
| C | 黑底 canvas + CSS `mix-blend-mode:screen` | **整页黑布**，只剩白点 | **严禁再开** |
| D | 透明 2D 亮珠（防墨点） | 珠过淡，像只有雨丝 | 防墨点过度 |
| E | 用户出示「暗屏大半透明珠」截图，要求恢复 | 目标锁定为 **raindrop 贴屏** | 产品拍板 |
| F | 开贴屏但同时挂 GPU 雨丝 | **推了像没变化**（raindrop 静默失败 demote） | 双 WebGL 坑 |
| G | 贴屏时不建 GPU；珠径加大；阴影拉高 | 大珠变**黑糊墨团** | 光照参数坑 |
| H（当前） | 大珠 + **中等阴影/漫反射**；少冷凝 | 应对齐用户认可的半透明大珠 | 待实机确认 |

---

## 4. 已证伪（勿再默认开启）

### 4.1 黑底 + CSS `mix-blend-mode: screen`

- 意图：黑变透明、珠只加亮，防白头像墨点  
- 实机：手机上 blend 常失效 → **整页黑布**  
- 提交警示：`3ad3b9b` 已回退  

### 4.2 贴屏时同时创建 GPU 雨丝 WebGL

- 手机常见 **单/少 WebGL 上下文**  
- GPU 先占 → raindrop 起不来 → `demote` → 看起来「部署了没变化」  
- **贴屏路径禁止先挂 `KayaGpuStreakRain`**；雨丝画进折射底图 `paintBgStreaks`；demote 后再 `ensureGpuStreaks()`  

### 4.3 mist / 近黑 mistColor / backgroundBlurSteps 默认

- 库默认 `mist:true`、`mistColor≈黑`、`mistBlurStep:4` → 整屏灰蒙  
- 贴屏必须强制：`mist:false`、`backgroundBlurSteps:0`、`mistBlurStep:0`  

### 4.4 WebGL 雨丝 `drawImage` 进 2D 折射底图

- 预乘/黑缓冲 → 发黑；只用 CPU `paintBgStreaks`  

### 4.5 阴影 / 漫反射「用力过猛」

- `raindropShadowOffset` 接近库默认 **0.8**，且 `raindropDiffuseLight` 过暗（如 `[0.16,…]`）  
- 大 `spawnSize` 时 → **大黑糊块**，被用户判为「又改错了」  
- 建议区间：`shadowOffset ≈ 0.30–0.42`；diffuse 保持中亮；靠 **refract + specular** 出细节  

### 4.6 把珠径压到远小于库默认

- 库默认 `spawnSize:[60,100]`  
- 曾用 `[14,48]` / `[22,96]` → 珠「太小、没细节」  
- 手机风暴建议大约 **`[72,150]`** 量级（可微调，勿再砍回 20 档）  

### 4.7 过严「截图过黑」探测

- `mean < 22` 等阈值会误杀正常暗色暴风雨底  
- 已放宽；截图可轻微 `brightness`，但 **CSS 勿大幅提亮**（冲掉珠边阴影）  

### 4.8 满屏密冷凝

- 用户明确要 **冷凝少一些**，突出大打屏珠  
- `dropletsPerSeconds` 宜低（约数十级），勿回到成百上千糊罩  

---

## 5. 推荐参数锚点（storm + screenGlass）

> 以代码为准；此处为避雷锚点，改前对照实机。

| 参数 | 建议方向 | 勿做什么 |
|------|----------|----------|
| `spawnSize` | 手机 ~`[72,150]`，桌面更大 | 别回到 `[14,48]`；也别无限加大再配高阴影 |
| `spawnLimit` | 偏少（~120–320） | 别用 2000+ 小珠淹没 |
| `spawnInterval` | 稍慢 | 过密会糊 |
| `dropletsPerSeconds` | 少（~12–70） | 勿满屏霜 |
| `refractBase/Scale` | 中高（~0.46 / 0.86） | 过低无透镜感 |
| `raindropShadowOffset` | **~0.34，硬顶 ≤0.42** | **勿 ≥0.6 配大珠** |
| `raindropDiffuseLight` | 中亮 ~`[0.4,0.46,0.54]` | 勿 `[0.16,…]` |
| `raindropSpecular*` | 明确高光 | 勿全黑 specular |
| `mist` | `false` | 勿开默认 mist |

构造时注意：曾把 `raindropShadowOffset` **钳死在 0.28** 会丢立体；钳到 **0.78** 又出墨团。用 **~0.42 顶**。

---

## 6. 回退路径（demote）

触发：截图失败 / 过黑 / raindrop 抛错 / 无 html2canvas。

行为：

1. 关掉 `.site-fx__rain-glass`  
2. `ensureGpuStreaks()` 再挂雨丝  
3. 打开 `glass-drops.js`（**仅亮色精灵，无暗芯**）  
4. 控制台：`[kaya] screen glass demoted → …`  

成功时应有：`[kaya] screen glass ready storm|heavy`。

---

## 7. 「推了没变化」排查清单

1. URL 是否 `?storm` / `?heavy`？（首页小雨无贴屏）  
2. 强刷 / 无痕；确认 HTML 里 `heavy-rain.js?v=` 已更新  
3. 控制台是 `screen glass ready` 还是 `demoted`？  
4. 若 demoted：是否双 WebGL、html2canvas、过黑探测  
5. Vercel Ready ≠ 手机一定加载到新 `?v=`（看 Network）  

---

## 8. 用户认可 vs 拒绝的观感

**认可（要对齐）：**

- 半透明大水滴，能折射/扭曲背后 UI  
- 上缘高光、有体积感  
- 可略暗整体；冷凝不要抢戏  

**拒绝：**

- 整页黑布 / 白头像纯黑墨点  
- 只有背景雨丝、没有贴屏大珠  
- 大黑糊团 / 软焦黑斑当「水珠」  
- 满屏细霜点盖住大珠  

---

## 9. 后续若要再优化

1. **先手机 `?storm` 实机**，再动 `spawnSize` / 光照  
2. 改光照时 **一次只动一类**（阴影 XOR 漫反射 XOR 珠径）  
3. 真「字过水发糊」依赖贴屏成功；勿再尝试全屏截图 + 默认 mist  
4. 若探索活 DOM 折射（无 html2canvas）：需单独方案，验证对比度后再替换贴屏路径  

---

## 10. 关键提交（本会话相关，便于 git bisect）

| Commit | 含义 |
|--------|------|
| `8accb92` | 曾关贴屏（发黑） |
| `85a250e` | 曾开贴屏 + 修复尝试 |
| `67fce7c` / `3ad3b9b` | screen-blend 墨点修复 → 整页黑 → 回退 |
| `1d1c2c1` | 恢复可见 2D 下滑珠 |
| `500de7e` | 再开贴屏（少冷凝、提亮） |
| `0f3b996` | **修双 WebGL 静默失败** |
| `4d80544` | 珠径加大（随后阴影过猛出墨团） |
| （本推送） | 大珠保留 + 光照回调；本文档入库 |

---

*完。修改雨效前请先勾选第 4 节避雷项。*
