"""
分析小米天气暴雨参考片：颜色、雨丝角度、密度、前景水珠占比。
输出 JSON + 控制台摘要，供 heavy-rain / gpu-streak 调参。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
FRAMES = sorted(ROOT.glob("frame_*.png"))


def sample_bg_color(rgb: np.ndarray) -> dict:
    """避开亮雨丝：取偏暗像素中位色。"""
    flat = rgb.reshape(-1, 3).astype(np.float32)
    lum = 0.2126 * flat[:, 0] + 0.7152 * flat[:, 1] + 0.0722 * flat[:, 2]
    dark = flat[lum < np.percentile(lum, 45)]
    if len(dark) < 100:
        dark = flat
    med = np.median(dark, axis=0)
    return {
        "rgb": [int(med[0]), int(med[1]), int(med[2])],
        "hex": "#{:02x}{:02x}{:02x}".format(int(med[0]), int(med[1]), int(med[2])),
        "mean_lum": float(np.mean(lum)),
        "p10_lum": float(np.percentile(lum, 10)),
        "p90_lum": float(np.percentile(lum, 90)),
    }


def streak_stats(gray: np.ndarray) -> dict:
    """用边缘 + Hough 估雨丝倾角与长度分布。"""
    h, w = gray.shape
    # 强化竖向结构：纵向差分
    blur = cv2.GaussianBlur(gray, (3, 5), 0)
    sobel_y = cv2.Sobel(blur, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.abs(sobel_y)
    thr = np.percentile(mag, 92)
    edges = (mag > thr).astype(np.uint8) * 255
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=28, minLineLength=max(12, h // 80), maxLineGap=6
    )
    angles = []
    lengths = []
    if lines is not None:
        for line in lines:
            pts = line.reshape(-1)
            if pts.size < 4:
                continue
            x1, y1, x2, y2 = map(float, pts[:4])
            dx, dy = x2 - x1, y2 - y1
            length = math.hypot(dx, dy)
            if length < 8:
                continue
            # 相对垂直的偏角（0=竖直，正=右倾）
            ang = math.degrees(math.atan2(dx, dy))
            if abs(ang) > 35:
                continue
            angles.append(ang)
            lengths.append(length / h)

    bright = gray.astype(np.float32)
    hi = bright > np.percentile(bright, 88)
    density = float(hi.mean())

    return {
        "line_count": len(angles),
        "angle_mean_deg": float(np.mean(angles)) if angles else 0.0,
        "angle_std_deg": float(np.std(angles)) if angles else 0.0,
        "angle_p10_deg": float(np.percentile(angles, 10)) if angles else 0.0,
        "angle_p90_deg": float(np.percentile(angles, 90)) if angles else 0.0,
        "len_mean_frac_h": float(np.mean(lengths)) if lengths else 0.0,
        "len_p90_frac_h": float(np.percentile(lengths, 90)) if lengths else 0.0,
        "bright_pixel_frac": density,
    }


def droplet_stats(rgb: np.ndarray) -> dict:
    """
    前景水珠：局部高亮 + 圆形 blob（相对雨丝更圆、更大）。
    """
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    # 顶光高光：局部最大 - 局部中位
    k = max(5, min(w, h) // 90) | 1
    med = cv2.medianBlur(gray, k)
    spec = cv2.subtract(gray, med)
    _, mask = cv2.threshold(spec, max(12, int(np.percentile(spec, 97))), 255, cv2.THRESH_BINARY)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask, connectivity=8)
    blobs = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        bw = int(stats[i, cv2.CC_STAT_WIDTH])
        bh = int(stats[i, cv2.CC_STAT_HEIGHT])
        if area < 8 or area > (w * h) * 0.01:
            continue
        aspect = bw / max(1, bh)
        if aspect < 0.35 or aspect > 2.8:
            continue
        # 雨丝细长；水珠更接近圆
        if max(bw, bh) > min(w, h) * 0.08:
            continue
        if abs(1 - aspect) > 0.85 and min(bw, bh) < 4:
            continue
        blobs.append({"area": area, "w": bw, "h": bh, "cx": float(cents[i][0]), "cy": float(cents[i][1])})

    sizes = [math.sqrt(b["area"]) for b in blobs]
    return {
        "blob_count": len(blobs),
        "size_mean_px": float(np.mean(sizes)) if sizes else 0.0,
        "size_p90_px": float(np.percentile(sizes, 90)) if sizes else 0.0,
        "coverage_frac": float(sum(b["area"] for b in blobs) / (w * h)),
    }


def motion_between(a: np.ndarray, b: np.ndarray) -> dict:
    """相邻帧差分，估雨丝下落速度量级。"""
    ga = cv2.cvtColor(a, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gb = cv2.cvtColor(b, cv2.COLOR_RGB2GRAY).astype(np.float32)
    # 相位相关 / 块匹配简化：垂直投影互相关
    pa = ga.mean(axis=1)
    pb = gb.mean(axis=1)
    pa = pa - pa.mean()
    pb = pb - pb.mean()
    corr = np.correlate(pb, pa, mode="full")
    lags = np.arange(-len(pa) + 1, len(pa))
    best = int(lags[int(np.argmax(corr))])
    # 帧间隔约 1/8 s（ffmpeg fps=8）
    px_per_sec = best * 8.0
    return {"vert_shift_px": best, "est_fall_px_per_sec": float(px_per_sec)}


def main() -> None:
    if not FRAMES:
        raise SystemExit("no frames")

    per_frame = []
    motions = []
    prev = None
    for path in FRAMES:
        img = Image.open(path).convert("RGB")
        rgb = np.asarray(img)
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        row = {
            "file": path.name,
            "bg": sample_bg_color(rgb),
            "streak": streak_stats(gray),
            "droplet": droplet_stats(rgb),
        }
        per_frame.append(row)
        if prev is not None:
            motions.append(motion_between(prev, rgb))
        prev = rgb

    def avg(key_path):
        vals = []
        for row in per_frame:
            cur = row
            for k in key_path.split("."):
                cur = cur[k]
            vals.append(float(cur))
        return float(np.mean(vals))

    summary = {
        "frame_count": len(per_frame),
        "bg_hex_median": per_frame[len(per_frame) // 2]["bg"]["hex"],
        "bg": {
            "hex_mid": per_frame[len(per_frame) // 2]["bg"]["hex"],
            "mean_lum": avg("bg.mean_lum"),
            "p10_lum": avg("bg.p10_lum"),
            "p90_lum": avg("bg.p90_lum"),
        },
        "streak": {
            "angle_mean_deg": avg("streak.angle_mean_deg"),
            "angle_std_deg": avg("streak.angle_std_deg"),
            "angle_p10_deg": avg("streak.angle_p10_deg"),
            "angle_p90_deg": avg("streak.angle_p90_deg"),
            "len_mean_frac_h": avg("streak.len_mean_frac_h"),
            "len_p90_frac_h": avg("streak.len_p90_frac_h"),
            "bright_pixel_frac": avg("streak.bright_pixel_frac"),
            "line_count_mean": avg("streak.line_count"),
        },
        "droplet": {
            "blob_count_mean": avg("droplet.blob_count"),
            "size_mean_px": avg("droplet.size_mean_px"),
            "size_p90_px": avg("droplet.size_p90_px"),
            "coverage_frac": avg("droplet.coverage_frac"),
        },
        "motion": {
            "vert_shift_mean_px": float(np.mean([m["vert_shift_px"] for m in motions])) if motions else 0,
            "fall_px_per_sec_mean": float(np.mean([m["est_fall_px_per_sec"] for m in motions])) if motions else 0,
        },
        "recommended_params": {},
    }

    # 背景 RGB 平均
    br = np.mean([r["bg"]["rgb"] for r in per_frame], axis=0)
    summary["bg"]["rgb_mean"] = [int(br[0]), int(br[1]), int(br[2])]
    summary["bg"]["hex_mean"] = "#{:02x}{:02x}{:02x}".format(int(br[0]), int(br[1]), int(br[2]))

    # 推荐参数映射到现有引擎
    ang = summary["streak"]["angle_mean_deg"]
    # windAmt * 0.06 ≈ tan(angle)；angle≈atan(wind*0.06)
    # wind ≈ tan(ang_rad) / 0.06
    wind = abs(math.tan(math.radians(ang))) / 0.06 if abs(ang) > 0.05 else 0.08
    wind = max(0.05, min(0.45, wind))

    len_p90 = summary["streak"]["len_p90_frac_h"]
    fall = abs(summary["motion"]["fall_px_per_sec_mean"])
    # 参考片高度约 1328；站点按视口高度换算
    speed_mul = max(0.85, min(1.55, (fall / 900.0) if fall > 50 else 1.15))

    density = summary["streak"]["bright_pixel_frac"]
    # 当前 high≈1100；亮像素占比越高 → 粒子越多
    streak_high = int(clamp(900 + density * 18000, 900, 2200))

    drop_n = summary["droplet"]["blob_count_mean"]
    drop_size = summary["droplet"]["size_p90_px"]

    summary["recommended_params"] = {
        "wind": round(wind, 3),
        "speedMul": round(speed_mul, 3),
        "streakCount_high": streak_high,
        "lenH_near_max": round(max(0.028, min(0.055, len_p90 * 1.35)), 4),
        "lenH_far_max": round(max(0.012, min(0.022, len_p90 * 0.55)), 4),
        "lensDrops_mid": int(clamp(drop_n * 0.55, 40, 180)),
        "lensDrops_high": int(clamp(drop_n * 0.85, 60, 280)),
        "lensSize_px_p90": round(drop_size, 1),
        "notes": [
            "参考片雨丝近乎竖直，倾角很小",
            "同时有明显前景玻璃水珠（当前 GPU 雨丝开启时被关掉了 raindrop-fx）",
            "应在同一视觉层叠加：密雨丝 + 镜头水珠 + 雨雾雨幕",
        ],
    }

    out = {"summary": summary, "frames_sample": per_frame[::8]}
    out_path = ROOT / "analysis.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== 参考片暴雨分析 ===")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\nWrote {out_path}")


def clamp(n, lo, hi):
    return max(lo, min(hi, n))


if __name__ == "__main__":
    main()
