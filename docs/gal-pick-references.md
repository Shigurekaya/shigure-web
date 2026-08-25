# Gal 萌新推荐 — 参考网站

本页记录 `gal-pick`（萌新入坑推荐）样板所参考的外部站点。

## 1. galgatest（玩法 / UI 参考）

- 地址：<http://galgatest.netlify.app/>
- 全称：萌新的你，最适合哪款 Galgame？（177 结果版）
- 托管：Netlify

**借鉴点：**

- 轻松 / 硬核双模式（森绿 / 海蓝主题切换）
- 多选题 + 权重矩阵（如 +5 / +3 / +1）计分
- 结果页：2 个主推荐 + 若干次要推荐；第 2 主推荐倾向拉开风格差异
- 娱乐向定位，结果仅供参考

当前本站样板为缩小版：12 候选作品、每模式 8 题，本地路径 `/gal-pick/`。

## 2. Bangumi（封面 / 条目数据）

- 地址：<https://bgm.tv/>
- API 封面示例：`https://api.bgm.tv/v0/subjects/{id}/image?type=medium`
- 条目页：`https://bgm.tv/subject/{id}`

**用途：**

- 结果卡片封面图走 Bangumi，不本地存图
- 结果可跳转对应 Bangumi 条目
- 题库里的 `subjectId` 与 Bangumi 游戏条目对应

---

| 本站页面 | 路径 |
|----------|------|
| 萌新入坑推荐 | `/gal-pick/` |
| 相关实现 | `gal-pick.html`、`js/gal-pick.js`、`js/gal-pick-data.js`、`css/gal-pick.css` |
