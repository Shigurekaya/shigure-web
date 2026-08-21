"""对照参考片与当前实现参数的差距摘要。"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent
FRAMES = sorted(ROOT.glob("frame_*.png"))


def analyze(img: np.ndarray) -> dict:
    h, w = img.shape[:2]
    sky = img[int(h * 0.08) : int(h * 0.28), int(w * 0.55) : int(w * 0.98)]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    bright = gray > np.percentile(gray, 88)
    sx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    sy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    vert = (np.abs(sy) > np.abs(sx) * 1.4) & bright

    sky_rgb = sky[:, :, ::-1].reshape(-1, 3).astype(np.float32)
    lum = 0.2126 * sky_rgb[:, 0] + 0.7152 * sky_rgb[:, 1] + 0.0722 * sky_rgb[:, 2]
    dark = sky_rgb[lum < np.percentile(lum, 50)]
    med = np.median(dark, axis=0)

    blur = cv2.GaussianBlur(gray, (0, 0), 1.2)
    hi = gray.astype(np.float32) - blur.astype(np.float32)
    beads = (hi > 8) & (gray > 90)
    mid = beads[int(h * 0.35) : int(h * 0.65)].mean()
    bot = beads[int(h * 0.72) : int(h * 0.90)].mean()
    return {
        "bg_hex": "#{:02x}{:02x}{:02x}".format(*map(int, med)),
        "bg_rgb": [int(med[0]), int(med[1]), int(med[2])],
        "bright_frac": float(bright.mean()),
        "vert_bright_frac": float(vert.mean()),
        "bead_mid": float(mid),
        "bead_bot": float(bot),
        "bot_mid_ratio": float(bot / max(mid, 1e-6)),
    }


def sky_hough(img: np.ndarray) -> dict:
    h, w = img.shape[:2]
    sky = img[int(h * 0.05) : int(h * 0.32), int(w * 0.5) : int(w * 0.98)]
    g = cv2.cvtColor(sky, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(g, 40, 120)
    lines = cv2.HoughLinesP(e, 1, np.pi / 180, 25, minLineLength=12, maxLineGap=4)
    angles, lengths = [], []
    if lines is not None:
        for line in lines:
            pts = line.reshape(-1)
            if pts.size < 4:
                continue
            x1, y1, x2, y2 = map(float, pts[:4])
            dx, dy = x2 - x1, y2 - y1
            ln = (dx * dx + dy * dy) ** 0.5
            if ln < 8:
                continue
            ang = float(np.degrees(np.arctan2(dx, dy)))
            if abs(ang) > 30:
                continue
            angles.append(ang)
            lengths.append(ln / sky.shape[0])
    if not angles:
        return {"n": 0}
    return {
        "n": len(angles),
        "ang_mean": float(np.mean(angles)),
        "ang_p50": float(np.median(angles)),
        "ang_p90": float(np.percentile(angles, 90)),
        "len_mean_h": float(np.mean(lengths)),
        "len_p90_h": float(np.percentile(lengths, 90)),
    }


def main() -> None:
    rows = [analyze(cv2.imread(str(p))) for p in FRAMES]
    mid = cv2.imread(str(FRAMES[len(FRAMES) // 2]))

    def avg(key: str):
        vals = [r[key] for r in rows]
        if isinstance(vals[0], list):
            return np.mean(vals, axis=0).tolist()
        return float(np.mean(vals))

    out = {
        "frames": len(rows),
        "bg_hex_mode": max(
            set(r["bg_hex"] for r in rows),
            key=lambda x: sum(1 for r in rows if r["bg_hex"] == x),
        ),
        "bg_rgb_mean": [int(x) for x in avg("bg_rgb")],
        "bright_frac": avg("bright_frac"),
        "vert_bright_frac": avg("vert_bright_frac"),
        "bead_mid": avg("bead_mid"),
        "bead_bot": avg("bead_bot"),
        "bot_mid_ratio": avg("bot_mid_ratio"),
        "sky_hough_mid": sky_hough(mid),
        "gaps_vs_current_code": [
            "参考片无稳定竖向雨幕光柱 → CSS repeating 雨幕应关掉或极淡",
            "底缘微珠密度 > 中部（bot/mid≈%.2f）→ 玻璃层应底部偏置" % avg("bot_mid_ratio"),
            "主珠约十几颗、微珠约三百 → glassMain 偏少、micro 偏密、尺寸更小",
            "天空主色 #344961，站点 #1a2436 偏黑 → 可抬到 ~#243448 仍保对比",
            "雨丝倾角均值约 5–10° → wind 略加大（当前 0.18–0.28 偏竖直）",
        ],
    }
    path = ROOT / "gap_check.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
