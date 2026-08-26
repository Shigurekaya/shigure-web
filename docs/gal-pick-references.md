# 入坑风向标

独立页面：`/gal-pick/`

## 机制

- 作品池 = **Gal 世代页有外站标签的作品** + **Getchu 年榜人气补位**，目标 **400** 部（全部有 VNDB/Bangumi/CnGal 标签）
- 标签轴来自 **VNDB / Bangumi / CnGal**（`_sedai_raw/fetch_sedai_tags.py`）
- 题库 ≤100，每局随机打乱抽取
- 每题：**加权（boost）+ 排除（drop）**
- 若排除后候选 **只剩 1 部** → 提前结束并展示
- 若题答完仍有多部 → 按分取 Top 3

## 生成

```powershell
# 一键：重试未命中 + Getchu/人气种子补到 400（需代理）
. ..\gal-\ops\proxy.ps1; Enable-RepoProxy
uv run python _sedai_raw/fill_pick_pool.py
uv run python _sedai_raw/extract_pick_catalog.py
```

也可分步：`fetch_sedai_tags.py` → `fetch_sedai_tags.py --supplement` → `extract_pick_catalog.py`

产出：
- `_sedai_raw/sedai_tags.json`（仅保留有 tags 的进池）
- `_sedai_raw/pick_supplement_tags.json`（人气补位）
- `js/gal-pick-data.js`
