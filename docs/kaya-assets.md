# 时雨榧站 · 图片资源

站点根路径下的静态图均在 `assets/images/`（URL 前缀 `/assets/images/`）。

## 目录一览

| 目录/文件 | 用途 | 页面 |
|-----------|------|------|
| `avatar.jpg` | 头像、favicon | 全站 |
| `pendant.png` | 挂件（数据里引用） | 主页数据 |
| `script-en.png` | 开幕液体字底图 | 主页开场 |
| `script-zh.png` | 中文脚本图（备用） | — |
| `rainbow-glow.png` | 晴天虹弧贴图 | 晴天背景 |
| `covers/` | B 站视频封面 `{BVid}.jpg` | `/works/` |
| `mv-materials/` | MV 原图 `.jpg` | `/mv-materials/` lightbox |
| `mv-materials/thumbs/` | 列表 WebP 缩略图（原图 80%） | 主页预览、MV 网格 |
| `video_*.jpg/png` | 历史/备用封面，**线上未引用** | — |

缩略图生成：`npm run mv-thumbs`（依赖 `sharp`）。

## 当前规格与体积（2026-08-24）

### 全站通用

| 文件 | 分辨率 | 体积 |
|------|--------|------|
| `avatar.jpg` | 375×375 | 49 KB |
| `pendant.png` | 420×420 | 127 KB |
| `script-en.png` | 1400×440 | 134 KB |
| `rainbow-glow.png` | 1024×682 | 34 KB |

### 作品封面 `covers/`（33 张）

- **合计**：约 **12.8 MB**
- **单张**：约 **64 KB – 1.25 MB**（平均 **397 KB**）
- **分辨率**：多为 **1280×720 – 3840×2160**（B 站封面比例不统一）
- 命名：`{BVid}.jpg`，与 `js/site-data.js` 里 `videos[].bvid` 对应

### MV 素材 `mv-materials/`（18 张原图）

- **原图合计**：约 **6.8 MB**
- **分辨率**：宽边多为 **1920px**（竖图 1345×1920 – 1920×1920 等）
- **单张原图**：约 **162 KB – 572 KB**

### MV 缩略图 `mv-materials/thumbs/`（18 张 WebP）

- **合计**：约 **1.9 MB**（较原图约省 **2.9 MB**）
- **分辨率**：原图 **80%** 等比（例如 1920×1793 → **1536×1434**）
- **单张**：约 **61 KB – 261 KB**

子目录：`ave/`、`v家/`、`柴郡喵/`、`小黑喵/`、`白/`、`骨/`、`其它/`。
