"""
详细拆解小米天气暴雨参考片中所有「雨滴类」视觉效果。
输出：JSON + 标注示意图 + 控制台中文报告。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
FRAMES = sorted(ROOT.glob("frame_*.png"))
OUT_ANN = ROOT / "effect_overlays"
OUT_JSON = ROOT / "rain_effects_detail.json"


def load_rgb(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"))


def streak_mask(gray: np.ndarray) -> tuple[np.ndarray, dict]:
    """细长竖向结构 = 下落雨丝（运动模糊）。"""
    h, w = gray.shape
    blur = cv2.GaussianBlur(gray, (3, 5), 0)
    # 纵向边缘强、横向弱 → 竖线
    gy = np.abs(cv2.Sobel(blur, cv2.CV_32F, 0, 1, ksize=3))
    gx = np.abs(cv2.Sobel(blur, cv2.CV_32F, 1, 0, ksize=3))
    score = gy - 0.35 * gx
    thr = np.percentile(score, 93)
    m = (score > thr).astype(np.uint8) * 255
    # 去掉过圆的区域（留给水珠）
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    longish = 0
    lengths = []
    for i in range(1, n):
        bw = stats[i, cv2.CC_STAT_WIDTH]
        bh = stats[i, cv2.CC_STAT_HEIGHT]
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 6:
            continue
        aspect = bh / max(1, bw)
        if aspect >= 1.8 or (bh >= 10 and bw <= 4):
            keep[labels == i] = 255
            longish += 1
            lengths.append(bh / h)
    return keep, {
        "count": longish,
        "coverage": float((keep > 0).mean()),
        "len_mean_h": float(np.mean(lengths)) if lengths else 0.0,
        "len_p90_h": float(np.percentile(lengths, 90)) if lengths else 0.0,
    }


def glass_droplet_mask(rgb: np.ndarray, gray: np.ndarray) -> tuple[np.ndarray, dict]:
    """
    玻璃水珠：局部高光 + 近似圆形 blob。
    分为大滴（滑动主珠）与微珠（冷凝/拖尾珠）。
    """
    h, w = gray.shape
    k = max(5, min(w, h) // 85) | 1
    med = cv2.medianBlur(gray, k)
    spec = cv2.subtract(gray, med)
    _, mask = cv2.threshold(spec, max(10, int(np.percentile(spec, 96.5))), 255, cv2.THRESH_BINARY)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    # 再叠加亮圆检测（Hough）辅助大滴
    blur = cv2.GaussianBlur(gray, (9, 9), 0)
    circles = cv2.HoughCircles(
        blur, cv2.HOUGH_GRADIENT, dp=1.2, minDist=10,
        param1=80, param2=14, minRadius=3, maxRadius=max(8, min(w, h) // 28),
    )

    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask, 8)
    big, micro, trailish = [], [], []
    keep_big = np.zeros_like(mask)
    keep_micro = np.zeros_like(mask)

    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        bw = int(stats[i, cv2.CC_STAT_WIDTH])
        bh = int(stats[i, cv2.CC_STAT_HEIGHT])
        if area < 5 or area > w * h * 0.008:
            continue
        aspect = bw / max(1, bh)
        # 排除细长雨丝
        if max(bw, bh) / max(1, min(bw, bh)) > 3.2 and min(bw, bh) <= 3:
            continue
        size = math.sqrt(area)
        item = {
            "area": area,
            "w": bw,
            "h": bh,
            "size": size,
            "cx": float(cents[i][0]),
            "cy": float(cents[i][1]),
            "aspect": aspect,
        }
        # 略扁长 → 可能是滑动拖尾湿痕
        if aspect < 0.55 or aspect > 1.8:
            if size >= 3:
                trailish.append(item)
            continue
        if size >= 5.5:
            big.append(item)
            keep_big[labels == i] = 255
        else:
            micro.append(item)
            keep_micro[labels == i] = 255

    hough_n = 0 if circles is None else int(circles.shape[1])
    return keep_big | keep_micro, {
        "big_count": len(big),
        "micro_count": len(micro),
        "trailish_count": len(trailish),
        "hough_circles": hough_n,
        "big_size_mean": float(np.mean([b["size"] for b in big])) if big else 0.0,
        "big_size_p90": float(np.percentile([b["size"] for b in big], 90)) if big else 0.0,
        "micro_size_mean": float(np.mean([b["size"] for b in micro])) if micro else 0.0,
        "coverage": float(((keep_big | keep_micro) > 0).mean()),
        "big_y_mean_norm": float(np.mean([b["cy"] / h for b in big])) if big else 0.5,
    }


def mist_score(gray: np.ndarray) -> dict:
    """低频雾感：大尺度亮度起伏 + 低对比。"""
    h, w = gray.shape
    small = cv2.resize(gray, (max(32, w // 16), max(48, h // 16)), interpolation=cv2.INTER_AREA)
    small = small.astype(np.float32)
    local = cv2.GaussianBlur(small, (0, 0), 3)
    contrast = float(np.std(small - local))
    mean = float(np.mean(gray))
    # 顶部比底部略亮 → 顶光雨雾
    top = float(gray[: h // 5].mean())
    bot = float(gray[4 * h // 5 :].mean())
    return {
        "mean_lum": mean,
        "lowfreq_contrast": contrast,
        "top_minus_bot": top - bot,
        "foggy": contrast < 8.5 and mean < 110,
    }


def sheet_bands(gray: np.ndarray) -> dict:
    """竖向雨幕带：列平均的周期性起伏。"""
    col = gray.astype(np.float32).mean(axis=0)
    col = col - cv2.GaussianBlur(col.reshape(1, -1), (1, 31), 0).ravel()
    # 自相关找周期
    c = col - col.mean()
    if np.std(c) < 1e-3:
        return {"band_strength": 0.0, "period_px": 0.0}
    corr = np.correlate(c, c, mode="full")
    mid = len(corr) // 2
    right = corr[mid + 8 : mid + min(180, len(col) // 2)]
    if len(right) == 0:
        return {"band_strength": 0.0, "period_px": 0.0}
    period = int(np.argmax(right) + 8)
    strength = float(right.max() / (corr[mid] + 1e-6))
    return {"band_strength": strength, "period_px": float(period)}


def motion_optical(prev: np.ndarray, cur: np.ndarray) -> dict:
    """光流：下落雨丝为主向下；水珠接近静止。"""
    g0 = cv2.cvtColor(prev, cv2.COLOR_RGB2GRAY)
    g1 = cv2.cvtColor(cur, cv2.COLOR_RGB2GRAY)
    flow = cv2.calcOpticalFlowFarneback(g0, g1, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    fx, fy = flow[..., 0], flow[..., 1]
    mag = np.sqrt(fx * fx + fy * fy)
    # 只看运动明显的像素
    m = mag > np.percentile(mag, 85)
    if not np.any(m):
        return {"down_px": 0.0, "side_px": 0.0, "still_frac": 1.0}
    return {
        "down_px": float(np.median(fy[m])),
        "side_px": float(np.median(fx[m])),
        "still_frac": float((mag < 0.35).mean()),
        "fast_down_frac": float(((fy > 1.2) & (mag > 1.0)).mean()),
    }


def ui_mask_heuristic(rgb: np.ndarray) -> np.ndarray:
    """粗略排除 UI 卡片区域（偏暗矩形），专注天气层。"""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    # 中下半部较暗且平坦的区域
    m = np.zeros((h, w), np.uint8)
    # 不做强 mask，避免误伤；仅用于注释
    return m


def annotate(rgb: np.ndarray, streak: np.ndarray, drops: np.ndarray, path: Path) -> None:
    img = rgb.copy()
    # 雨丝标青，水珠标品红
    img[streak > 0] = (img[streak > 0] * 0.45 + np.array([40, 200, 255]) * 0.55).astype(np.uint8)
    img[drops > 0] = (img[drops > 0] * 0.4 + np.array([255, 80, 200]) * 0.6).astype(np.uint8)
    Image.fromarray(img).save(path)


def main() -> None:
    if not FRAMES:
        raise SystemExit("no frames — extract first")

    OUT_ANN.mkdir(parents=True, exist_ok=True)
    per = []
    motions = []
    prev = None

    for i, path in enumerate(FRAMES):
        rgb = load_rgb(path)
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        sm, ss = streak_mask(gray)
        dm, ds = glass_droplet_mask(rgb, gray)
        mist = mist_score(gray)
        bands = sheet_bands(gray)
        row = {
            "file": path.name,
            "streak": ss,
            "glass_drops": ds,
            "mist": mist,
            "rain_sheet": bands,
        }
        per.append(row)
        if prev is not None:
            motions.append(motion_optical(prev, rgb))
        prev = rgb
        if i % 8 == 0:
            annotate(rgb, sm, dm, OUT_ANN / f"overlay_{path.stem}.png")

    def avg(key: str):
        parts = key.split(".")
        vals = []
        for r in per:
            cur = r
            for p in parts:
                cur = cur[p]
            vals.append(float(cur) if not isinstance(cur, bool) else float(cur))
        return float(np.mean(vals))

    # 分类结论
    effects = [
        {
            "id": "A_falling_streaks",
            "name": "下落雨丝（运动模糊线）",
            "evidence": {
                "blob_count_mean": avg("streak.count"),
                "coverage_mean": avg("streak.coverage"),
                "len_mean_frac_h": avg("streak.len_mean_h"),
                "len_p90_frac_h": avg("streak.len_p90_h"),
                "flow_down_px": float(np.mean([m["down_px"] for m in motions])) if motions else 0,
                "fast_down_frac": float(np.mean([m["fast_down_frac"] for m in motions])) if motions else 0,
            },
            "look": "细长近竖直半透明白/青线条，长度短、下落快，占画面主体密度",
            "depth": "至少 2–3 层：远淡细、中主、近略粗亮",
            "impl_hint": "GPU 线段/四边形粒子；顶点着色器循环下落",
        },
        {
            "id": "B_glass_main_drops",
            "name": "玻璃主水珠（粘附/滑动大滴）",
            "evidence": {
                "count_mean": avg("glass_drops.big_count"),
                "size_mean_px": avg("glass_drops.big_size_mean"),
                "size_p90_px": avg("glass_drops.big_size_p90"),
                "hough_circles_mean": avg("glass_drops.hough_circles"),
                "y_mean_norm": avg("glass_drops.big_y_mean_norm"),
            },
            "look": "近圆形、带顶侧高光、边缘折射感；部分缓慢下滑",
            "depth": "最前景（叠在 UI 之上，像贴在屏幕玻璃）",
            "impl_hint": "raindrop-fx / 折射 shader / 预烘焙精灵+法线",
        },
        {
            "id": "C_glass_micro_beads",
            "name": "玻璃微珠（冷凝小点）",
            "evidence": {
                "count_mean": avg("glass_drops.micro_count"),
                "size_mean_px": avg("glass_drops.micro_size_mean"),
                "coverage": avg("glass_drops.coverage"),
            },
            "look": "大量 2–5px 级小高光点，几乎静止或极慢漂移",
            "depth": "前景玻璃层，填充「湿润感」",
            "impl_hint": "静态噪声戳点 + 大滴经过时 destination-out 擦除（Codrops 手法）",
        },
        {
            "id": "D_slide_trails",
            "name": "滑动拖尾/湿痕",
            "evidence": {
                "trailish_count_mean": avg("glass_drops.trailish_count"),
            },
            "look": "主滴下滑留下细湿痕与零星拖尾珠",
            "depth": "前景玻璃层",
            "impl_hint": "大滴路径上间歇 spawn 微珠；湿痕用细椭圆/条带淡出",
        },
        {
            "id": "E_atmosphere_mist",
            "name": "雨雾/大气散射",
            "evidence": {
                "mean_lum": avg("mist.mean_lum"),
                "lowfreq_contrast": avg("mist.lowfreq_contrast"),
                "top_minus_bot": avg("mist.top_minus_bot"),
                "foggy_ratio": float(np.mean([1.0 if r["mist"]["foggy"] else 0.0 for r in per])),
            },
            "look": "整体冷蓝灰低对比，顶部略亮的霾，降低远景清晰度",
            "depth": "背景与中景之间",
            "impl_hint": "CSS 径向雾 + 轻微 vignette；不要做成飘动大光斑",
        },
        {
            "id": "F_rain_sheet",
            "name": "雨幕体积带（竖向帘幕）",
            "evidence": {
                "band_strength": avg("rain_sheet.band_strength"),
                "period_px": avg("rain_sheet.period_px"),
            },
            "look": "宽而淡的竖向明暗带缓慢横移，增加「成片雨」体积感",
            "depth": "中远景",
            "impl_hint": "极淡 repeating-linear-gradient + 慢速 translate；强度要低",
        },
        {
            "id": "G_storm_sky",
            "name": "暴雨天空底（非雨滴，但是雨景底座）",
            "evidence": {
                "note": "色相冷蓝灰，主色约 #344961",
            },
            "look": "层积云状暗蓝灰背景，无阳光",
            "depth": "最底层",
            "impl_hint": "纯色 + 多团径向渐变模糊",
        },
    ]

    # 明确「不是」的东西，避免再加羽毛光斑
    not_effects = [
        {
            "name": "大块软边羽毛/光斑粒子乱飘",
            "why": "参考片前景是贴玻璃的小圆滴与细雨丝，没有大片 boeh/羽毛状漂浮物",
        },
        {
            "name": "彩色霓虹粒子",
            "why": "色板严格冷青白/灰蓝",
        },
    ]

    report = {
        "source": "d63123f5e68f97c298dea1bec5aad3a0.mp4",
        "frames": len(per),
        "effects": effects,
        "not_effects": not_effects,
        "motion_summary": {
            "down_px_mean": float(np.mean([m["down_px"] for m in motions])) if motions else 0,
            "side_px_mean": float(np.mean([m["side_px"] for m in motions])) if motions else 0,
            "still_frac_mean": float(np.mean([m["still_frac"] for m in motions])) if motions else 0,
        },
        "priority_for_shigure": [
            "A 下落雨丝（已有 GPU）",
            "E 雨雾 + F 极淡雨幕",
            "B+C 玻璃水珠（需真实折射/贴玻璃，勿用大软斑冒充）",
            "D 拖尾（次要）",
            "卡片溅花为站点交互增强，参考片 UI 卡片上不明显",
        ],
        "per_frame_sample": per[::10],
    }

    OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=" * 60)
    print("参考片雨滴类效果清单")
    print("=" * 60)
    for e in effects:
        print(f"\n【{e['id']}】{e['name']}")
        print(f"  外观: {e['look']}")
        print(f"  景深: {e['depth']}")
        print(f"  证据: {json.dumps(e['evidence'], ensure_ascii=False)}")
        print(f"  实现: {e['impl_hint']}")
    print("\n—— 不应出现 ——")
    for n in not_effects:
        print(f"  × {n['name']}: {n['why']}")
    print(f"\nJSON → {OUT_JSON}")
    print(f"标注图 → {OUT_ANN}")


if __name__ == "__main__":
    # fix accidental space in constant if any
    main()
