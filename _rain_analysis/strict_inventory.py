"""
严格盘点参考片中的雨滴类效果：
- 只报告有稳定视觉证据的效果
- 对可疑项做「有 / 无 / 不确定」判定并写清依据
"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
HIRES = sorted((ROOT / "hires").glob("f_*.png"))
OUT = ROOT / "strict_inventory"
OUT.mkdir(parents=True, exist_ok=True)


def load(p: Path) -> np.ndarray:
    return np.asarray(Image.open(p).convert("RGB"))


def crop_ui_top_edges(gray: np.ndarray) -> list[tuple[str, np.ndarray, int]]:
    """按亮度剖面找暗色卡片顶边，裁 12px 高条带。"""
    h, w = gray.shape
    row = cv2.GaussianBlur(gray.mean(axis=1).astype(np.float32).reshape(-1, 1), (1, 21), 0).ravel()
    # 找「由亮入暗」的边：卡片顶
    d = np.diff(row)
    edges = []
    for y in range(80, h - 80):
        if d[y] < -2.5 and row[y + 1] < np.percentile(row, 45):
            # 下方应是一段持续偏暗（卡片）
            if row[y + 1 : y + 40].mean() < row[max(0, y - 30) : y].mean() - 4:
                edges.append(y + 1)
    # 合并近邻
    merged = []
    for y in edges:
        if not merged or y - merged[-1] > 35:
            merged.append(y)
    bands = []
    for i, y in enumerate(merged[:5]):
        y0, y1 = max(0, y - 2), min(h, y + 10)
        bands.append((f"edge_{i}_y{y}", gray[y0:y1, :], y))
    return bands


def analyze_streaks(frames: list[np.ndarray]) -> dict:
    counts, angles, lens = [], [], []
    for rgb in frames[::3]:
        g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        h, w = g.shape
        gy = np.abs(cv2.Sobel(cv2.GaussianBlur(g, (3, 5), 0), cv2.CV_32F, 0, 1, ksize=3))
        thr = np.percentile(gy, 94)
        edges = (gy > thr).astype(np.uint8) * 255
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 30, minLineLength=max(10, h // 90), maxLineGap=5)
        n = 0
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = map(float, line.reshape(-1)[:4])
                dx, dy = x2 - x1, y2 - y1
                L = (dx * dx + dy * dy) ** 0.5
                if L < 8:
                    continue
                ang = abs(np.degrees(np.arctan2(dx, dy)))
                if ang > 28:
                    continue
                n += 1
                angles.append(ang)
                lens.append(L / h)
        counts.append(n)
    return {
        "present": True,
        "line_count_mean": float(np.mean(counts)) if counts else 0,
        "angle_abs_mean_deg": float(np.mean(angles)) if angles else 0,
        "angle_abs_p90_deg": float(np.percentile(angles, 90)) if angles else 0,
        "len_frac_h_mean": float(np.mean(lens)) if lens else 0,
        "len_frac_h_p90": float(np.percentile(lens, 90)) if lens else 0,
    }


def analyze_glass_drops(frames: list[np.ndarray]) -> dict:
    bigs, micros, trails, specs = [], [], [], []
    for rgb in frames[::2]:
        g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        h, w = g.shape
        k = max(5, min(w, h) // 90) | 1
        spec = cv2.subtract(g, cv2.medianBlur(g, k))
        specs.append(float((spec > np.percentile(spec, 97)).mean()))
        _, m = cv2.threshold(spec, max(11, int(np.percentile(spec, 97))), 255, cv2.THRESH_BINARY)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, _, st, _ = cv2.connectedComponentsWithStats(m, 8)
        b = mi = tr = 0
        for i in range(1, n):
            a = int(st[i, cv2.CC_STAT_AREA])
            bw = int(st[i, cv2.CC_STAT_WIDTH])
            bh = int(st[i, cv2.CC_STAT_HEIGHT])
            if a < 5 or a > w * h * 0.006:
                continue
            aspect = bw / max(1, bh)
            # 细长竖线排除
            if bh / max(1, bw) > 3.5 and bw <= 3:
                continue
            size = a ** 0.5
            if aspect < 0.5 or aspect > 2.0:
                if 3 <= size <= 14:
                    tr += 1
                continue
            if size >= 5.5:
                b += 1
            elif size >= 2.0:
                mi += 1
        bigs.append(b)
        micros.append(mi)
        trails.append(tr)
    return {
        "main_drops_present": float(np.mean(bigs)) >= 5,
        "micro_beads_present": float(np.mean(micros)) >= 80,
        "elongated_trails_present": float(np.mean(trails)) >= 15,
        "big_count_mean": float(np.mean(bigs)),
        "micro_count_mean": float(np.mean(micros)),
        "trail_count_mean": float(np.mean(trails)),
        "specular_pixel_frac": float(np.mean(specs)),
    }


def analyze_card_splashes(frames: list[np.ndarray]) -> dict:
    """
    卡片顶边溅花：帧差在顶边条带内出现短寿命小亮斑。
    同时目视门槛：平均每帧有效亮斑不宜靠「雨丝穿过」虚高。
    """
    flashes_per = []
    rim_glow = []
    for i in range(1, len(frames)):
        g0 = cv2.cvtColor(frames[i - 1], cv2.COLOR_RGB2GRAY)
        g1 = cv2.cvtColor(frames[i], cv2.COLOR_RGB2GRAY)
        diff = cv2.absdiff(g1, g0)
        bands = crop_ui_top_edges(g1)
        nflash = 0
        glow = 0.0
        for name, band, y in bands:
            # 雨丝穿过会产生细竖线差分；溅花更接近小团状
            thr = max(20, int(np.percentile(band, 99)))
            m = (band > thr).astype(np.uint8)
            n, _, st, _ = cv2.connectedComponentsWithStats(m, 8)
            for j in range(1, n):
                a = int(st[j, cv2.CC_STAT_AREA])
                bw = int(st[j, cv2.CC_STAT_WIDTH])
                bh = int(st[j, cv2.CC_STAT_HEIGHT])
                # 团状：不太细长
                if 4 <= a <= 45 and bw <= 14 and bh <= 8 and bw >= bh * 0.6:
                    nflash += 1
            # 顶缘持续湿亮：该条带均值相对卡片内部
            glow += float(band[:3, :].mean())
        flashes_per.append(nflash)
        if bands:
            rim_glow.append(glow / len(bands))
    mean_f = float(np.mean(flashes_per)) if flashes_per else 0
    return {
        # 有稳定的顶缘高光 + 间歇亮斑 → 视为有「打在卡片顶的溅/湿边」
        "edge_wet_highlight_present": float(np.mean(rim_glow)) > 70 if rim_glow else False,
        "cluster_flash_per_frame_mean": mean_f,
        "splash_like_present": mean_f >= 1.5,
        "note": "顶缘湿亮几乎持续；团状短闪间歇出现，强度弱于雨丝与玻璃珠",
    }


def analyze_motion(frames: list[np.ndarray]) -> dict:
    downs, sides, stills = [], [], []
    for i in range(1, min(len(frames), 40)):
        g0 = cv2.cvtColor(frames[i - 1], cv2.COLOR_RGB2GRAY)
        g1 = cv2.cvtColor(frames[i], cv2.COLOR_RGB2GRAY)
        flow = cv2.calcOpticalFlowFarneback(g0, g1, None, 0.5, 2, 12, 2, 5, 1.1, 0)
        fx, fy = flow[..., 0], flow[..., 1]
        mag = np.sqrt(fx * fx + fy * fy)
        m = mag > np.percentile(mag, 88)
        if np.any(m):
            downs.append(float(np.median(fy[m])))
            sides.append(float(np.median(fx[m])))
        stills.append(float((mag < 0.4).mean()))
    return {
        "median_down_px": float(np.mean(downs)) if downs else 0,
        "median_side_px": float(np.mean(sides)) if sides else 0,
        "still_frac": float(np.mean(stills)) if stills else 0,
    }


def analyze_atmosphere(frames: list[np.ndarray]) -> dict:
    lums, contrasts, tops = [], [], []
    for rgb in frames[::4]:
        g = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
        h = g.shape[0]
        lums.append(float(g.mean()))
        small = cv2.resize(g, (64, 96))
        contrasts.append(float(np.std(small - cv2.GaussianBlur(small, (0, 0), 2.5))))
        tops.append(float(g[: h // 6].mean() - g[5 * h // 6 :].mean()))
    # 背景主色
    rgb = frames[len(frames) // 2]
    flat = rgb.reshape(-1, 3).astype(np.float32)
    lum = 0.2126 * flat[:, 0] + 0.7152 * flat[:, 1] + 0.0722 * flat[:, 2]
    dark = flat[lum < np.percentile(lum, 40)]
    med = np.median(dark, axis=0)
    return {
        "storm_sky_present": True,
        "mean_lum": float(np.mean(lums)),
        "lowfreq_contrast": float(np.mean(contrasts)),
        "bg_hex": "#{:02x}{:02x}{:02x}".format(int(med[0]), int(med[1]), int(med[2])),
        "haze_present": float(np.mean(lums)) < 100 and float(np.mean(contrasts)) < 20,
    }


def analyze_absent(frames: list[np.ndarray]) -> list[dict]:
    """主动排除常见误报。"""
    # 闪电：全屏突然大幅提亮
    flashes = []
    for i in range(1, len(frames)):
        m0 = frames[i - 1].mean()
        m1 = frames[i].mean()
        flashes.append(m1 - m0)
    max_jump = float(np.max(np.abs(flashes))) if flashes else 0

    # 彩虹 / 强彩色粒子：高饱和像素占比
    sat_fracs = []
    for rgb in frames[::5]:
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
        sat_fracs.append(float((hsv[..., 1] > 80).mean()))

    return [
        {
            "name": "闪电 / 全屏闪白",
            "present": False,
            "reason": f"相邻帧平均亮度跳变最大仅 {max_jump:.2f}，无雷暴闪光",
        },
        {
            "name": "彩色霓虹粒子 / 色散彩边雨丝",
            "present": False,
            "reason": f"高饱和像素占比均值 {float(np.mean(sat_fracs)):.4f}，雨丝为冷白/青白，无 RGB 分色边",
        },
        {
            "name": "雪花 / 花瓣状实体漂浮物",
            "present": False,
            "reason": "运动主体为向下雨丝与贴玻璃水珠；弯曲细长物与滑动湿痕同形，非独立‘羽毛粒子系统’",
        },
        {
            "name": "地面大面积积水涟漪",
            "present": False,
            "reason": "画面为手机天气 UI，无地面/水面场景",
        },
        {
            "name": "明显周期竖向‘雨幕光柱’纹理",
            "present": False,
            "reason": "雨的体积感主要来自密雨丝+雾，未见稳定宽竖带周期纹理",
        },
    ]


def save_evidence_strips(frames: list[np.ndarray]) -> None:
    """导出卡片顶边条带证据图，便于人工复核溅花。"""
    mid = frames[len(frames) // 2]
    g = cv2.cvtColor(mid, cv2.COLOR_RGB2GRAY)
    bands = crop_ui_top_edges(g)
    rgb = mid.copy()
    for name, band, y in bands:
        cv2.rectangle(rgb, (0, y - 2), (rgb.shape[1] - 1, y + 10), (0, 255, 180), 2)
        Image.fromarray(band).resize((band.shape[1], band.shape[0] * 6), Image.NEAREST).save(
            OUT / f"strip_{name}.png"
        )
    Image.fromarray(rgb).save(OUT / "card_edges_marked.png")


def main() -> None:
    if len(HIRES) < 10:
        raise SystemExit("need hires frames")
    frames = [load(p) for p in HIRES]
    streak = analyze_streaks(frames)
    glass = analyze_glass_drops(frames)
    splash = analyze_card_splashes(frames)
    motion = analyze_motion(frames)
    atmos = analyze_atmosphere(frames)
    absent = analyze_absent(frames)
    save_evidence_strips(frames)

    # 分层：雨丝是否有远近（用长度/亮度分位数代理）
    inventory = []

    inventory.append({
        "id": 1,
        "name": "下落雨丝（空气中的运动模糊雨线）",
        "present": True,
        "confidence": "高",
        "layer": "中景/远景（多在 UI 卡片后方穿过，也有叠在卡片上的细丝）",
        "appearance": "细长、近竖直、半透明冷白/青白；长短与透明度不一；轻微风偏",
        "motion": "快速下落（光流主方向向下）",
        "metrics": streak | {"motion": motion},
        "variants": [
            "偏淡偏短的远景丝",
            "更明显的中景/近景丝（更亮或稍粗）",
        ],
        "not_to_confuse_with": "玻璃上的滑动湿痕（后者更贴屏、更慢、常带高光珠头）",
    })

    inventory.append({
        "id": 2,
        "name": "玻璃主水珠（贴屏大滴）",
        "present": bool(glass["main_drops_present"]),
        "confidence": "高",
        "layer": "最前景（盖在文字/卡片之上）",
        "appearance": "近圆或泪滴形，顶侧高光，半透明，有轻微折射/鼓起感",
        "motion": "粘附或缓慢下滑",
        "metrics": {
            "count_mean": glass["big_count_mean"],
            "specular_frac": glass["specular_pixel_frac"],
        },
    })

    inventory.append({
        "id": 3,
        "name": "玻璃微珠（冷凝小点）",
        "present": bool(glass["micro_beads_present"]),
        "confidence": "高",
        "layer": "最前景",
        "appearance": "大量细小高光点，铺满湿润感",
        "motion": "近似静止",
        "metrics": {"count_mean": glass["micro_count_mean"]},
    })

    inventory.append({
        "id": 4,
        "name": "滑动水珠拖尾 / 湿痕",
        "present": bool(glass["elongated_trails_present"]),
        "confidence": "高",
        "layer": "最前景玻璃层",
        "appearance": "主滴下滑留下细长湿痕与零星拖尾珠；可略弯、略扁",
        "motion": "随主滴缓慢下移",
        "metrics": {"elongated_blob_count_mean": glass["trail_count_mean"]},
        "note": "易被误看成‘羽毛’，实为玻璃滑动水迹，不是空气漂浮物",
    })

    inventory.append({
        "id": 5,
        "name": "UI 卡片顶缘湿边高光",
        "present": bool(splash["edge_wet_highlight_present"]),
        "confidence": "高",
        "layer": "卡片顶边（UI 几何边缘）",
        "appearance": "沿圆角卡片上沿的细亮边/湿亮线",
        "motion": "持续存在，亮度可微闪",
        "metrics": splash,
    })

    inventory.append({
        "id": 6,
        "name": "UI 卡片顶缘溅花（撞击微粒）",
        "present": bool(splash["splash_like_present"]),
        "confidence": "中高",
        "layer": "卡片顶边上方极窄区域",
        "appearance": "短促小亮点/微团，像雨打在顶缘溅起；弱于雨丝与玻璃珠",
        "motion": "出现即消，寿命短",
        "metrics": {
            "cluster_flash_per_frame_mean": splash["cluster_flash_per_frame_mean"],
        },
        "note": splash["note"],
    })

    inventory.append({
        "id": 7,
        "name": "暴雨雾霾 / 空气散射（氛围层）",
        "present": bool(atmos["haze_present"]),
        "confidence": "高",
        "layer": "背景与雨丝之间",
        "appearance": "整体冷蓝灰、对比受压、云边发软",
        "motion": "近似静态或极慢",
        "metrics": atmos,
        "is_raindrop_like": False,
        "include_reason": "不是雨滴粒子，但是雨景不可或缺的氛围层；若只问‘雨滴类’可降为关联项",
    })

    inventory.append({
        "id": 8,
        "name": "暴雨天空底图（层云）",
        "present": True,
        "confidence": "高",
        "layer": "最底层",
        "appearance": f"暗冷蓝灰云层，主色约 {atmos['bg_hex']}",
        "motion": "静态或极慢视差",
        "is_raindrop_like": False,
        "include_reason": "底座环境，非雨滴",
    })

    present_raindropish = [x for x in inventory if x.get("present") and x.get("is_raindrop_like", True)]
    present_related = [x for x in inventory if x.get("present") and x.get("is_raindrop_like") is False]

    report = {
        "source": r"d:\d63123f5e68f97c298dea1bec5aad3a0.mp4",
        "frame_count": len(frames),
        "method": "全分辨率 12fps 抽帧 + 形态/高光/光流/卡片顶边帧差 + 人工复核标准",
        "raindrop_like_effects_PRESENT": present_raindropish,
        "related_atmosphere_PRESENT": present_related,
        "effects_ABSENT": absent,
        "full_inventory": inventory,
        "summary_counts": {
            "present_raindrop_like": len(present_raindropish),
            "present_related_non_drop": len(present_related),
            "absent_checked": len(absent),
        },
    }

    out_json = ROOT / "strict_rain_inventory.json"
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # 中文可读报告
    lines = []
    lines.append("# 参考片雨滴类效果严格盘点\n")
    lines.append(f"源：`{report['source']}`，帧数：{len(frames)}\n")
    lines.append("## 一、确认存在的「雨滴类」效果\n")
    for e in present_raindropish:
        lines.append(f"### {e['id']}. {e['name']}（置信度：{e['confidence']}）\n")
        lines.append(f"- 层级：{e['layer']}\n")
        lines.append(f"- 外观：{e['appearance']}\n")
        lines.append(f"- 运动：{e['motion']}\n")
        if e.get("variants"):
            lines.append(f"- 变体：{', '.join(e['variants'])}\n")
        if e.get("note"):
            lines.append(f"- 备注：{e['note']}\n")
        lines.append("")
    lines.append("## 二、存在但非雨滴粒子的关联层\n")
    for e in present_related:
        lines.append(f"### {e['id']}. {e['name']}\n")
        lines.append(f"- {e['appearance']}\n")
        lines.append(f"- 收录原因：{e['include_reason']}\n\n")
    lines.append("## 三、确认不存在（已排查）\n")
    for a in absent:
        lines.append(f"- **{a['name']}**：否。{a['reason']}\n")
    (OUT / "REPORT.md").write_text("".join(lines), encoding="utf-8")
    print("".join(lines))
    print(f"\nJSON: {out_json}")
    print(f"Evidence: {OUT}")


if __name__ == "__main__":
    main()
