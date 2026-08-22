"""Deeper motion/layer analysis for rain reference."""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
VIDEO = ROOT / "rain_ref.mp4"
OUT_DIR = ROOT / "deep"
OUT_DIR.mkdir(exist_ok=True)


def load_frames(indices: list[int]) -> dict[int, np.ndarray]:
    cap = cv2.VideoCapture(str(VIDEO))
    want = set(indices)
    got = {}
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        if i in want:
            got[i] = fr
        i += 1
    cap.release()
    return got


def save_rgb(path: Path, bgr: np.ndarray, quality: int = 92) -> None:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb).save(path, quality=quality)


def analyze_streak_geometry(gray: np.ndarray) -> dict:
    """Detect elongated bright structures and measure angle via moments / Hough."""
    # unsharp / highpass emphasizes rain streaks
    blur = cv2.GaussianBlur(gray, (0, 0), 1.5)
    hp = cv2.subtract(gray, blur)
    # keep brighter ridges
    _, bw = cv2.threshold(hp, max(8, int(hp.mean() + 1.2 * hp.std())), 255, cv2.THRESH_BINARY)
    # prefer vertical connectivity
    vert = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 7)))
    lines = cv2.HoughLinesP(vert, 1, np.pi / 180, threshold=28, minLineLength=18, maxLineGap=6)
    angles = []
    lengths = []
    if lines is not None:
        arr = np.asarray(lines).reshape(-1, 4)
        for x1, y1, x2, y2 in arr:
            dx, dy = int(x2) - int(x1), int(y2) - int(y1)
            length = float(np.hypot(dx, dy))
            # angle from vertical: 0 = straight down; positive = lean right
            ang = float(np.degrees(np.arctan2(dx, dy)))  # dy dominant when vertical
            angles.append(ang)
            lengths.append(length)

    # length histogram by layers using opacity-ish: bright vs dim streaks
    bright = gray > np.percentile(gray, 85)
    # sample columns for streak density
    col_activity = vert.mean(axis=0)
    return {
        "hough_line_count": 0 if lines is None else int(np.asarray(lines).reshape(-1, 4).shape[0]),
        "angle_from_vertical_median": float(np.median(angles)) if angles else None,
        "angle_from_vertical_p10": float(np.percentile(angles, 10)) if angles else None,
        "angle_from_vertical_p90": float(np.percentile(angles, 90)) if angles else None,
        "length_median": float(np.median(lengths)) if lengths else None,
        "length_p90": float(np.percentile(lengths, 90)) if lengths else None,
        "col_activity_mean": float(col_activity.mean()),
        "col_activity_std": float(col_activity.std()),
        "bright_pixel_ratio": float(bright.mean()),
    }


def crop_rois(frame: np.ndarray) -> dict[str, np.ndarray]:
    h, w = frame.shape[:2]
    return {
        "full_small": cv2.resize(frame, (360, int(360 * h / w))),
        "glass_top": frame[int(h * 0.08) : int(h * 0.28), int(w * 0.1) : int(w * 0.9)],
        "card_top_edge": frame[int(h * 0.30) : int(h * 0.42), int(w * 0.08) : int(w * 0.92)],
        "card_face": frame[int(h * 0.38) : int(h * 0.55), int(w * 0.12) : int(w * 0.88)],
        "glass_mid": frame[int(h * 0.55) : int(h * 0.72), int(w * 0.1) : int(w * 0.9)],
        "bottom_mist": frame[int(h * 0.78) : int(h * 0.95), int(w * 0.05) : int(w * 0.95)],
    }


def droplet_blob_stats(bgr: np.ndarray) -> dict:
    """Find roundish bright-edge blobs that look like glass droplets."""
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    # bilateral keeps edges of droplets
    smooth = cv2.bilateralFilter(gray, 7, 40, 40)
    # LoG-ish: blob via difference of gaussians
    g1 = cv2.GaussianBlur(smooth, (0, 0), 1.2)
    g2 = cv2.GaussianBlur(smooth, (0, 0), 3.5)
    dog = cv2.subtract(g1, g2)
    _, bw = cv2.threshold(dog, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cnts, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    drops = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        if area < 12 or area > 2500:
            continue
        aspect = h / max(w, 1)
        peri = cv2.arcLength(c, True)
        circularity = 4 * np.pi * area / (peri * peri + 1e-6)
        if 0.55 <= aspect <= 2.8 and circularity > 0.25:
            drops.append(
                {
                    "x": int(x),
                    "y": int(y),
                    "w": int(w),
                    "h": int(h),
                    "area": float(area),
                    "aspect": round(float(aspect), 2),
                    "circularity": round(float(circularity), 2),
                }
            )
    sizes = [max(d["w"], d["h"]) for d in drops]
    aspects = [d["aspect"] for d in drops]
    return {
        "count": len(drops),
        "size_median": float(np.median(sizes)) if sizes else 0,
        "size_p90": float(np.percentile(sizes, 90)) if sizes else 0,
        "aspect_median": float(np.median(aspects)) if aspects else 0,
        "roundish_ratio": float(np.mean([a < 1.35 for a in aspects])) if aspects else 0,
        "elongated_ratio": float(np.mean([a >= 1.6 for a in aspects])) if aspects else 0,
        "samples": drops[:12],
    }


def splash_edge_activity(prev: np.ndarray, cur: np.ndarray) -> dict:
    """Activity concentrated on horizontal edges of UI cards."""
    g0 = cv2.cvtColor(prev, cv2.COLOR_BGR2GRAY).astype(np.float32)
    g1 = cv2.cvtColor(cur, cv2.COLOR_BGR2GRAY).astype(np.float32)
    diff = np.abs(g1 - g0)
    # horizontal Sobel of current to find card top edges
    soby = cv2.Sobel(g1, cv2.CV_32F, 0, 1, ksize=3)
    edge = np.abs(soby)
    # normalize
    edge_n = edge / (edge.max() + 1e-6)
    # splash proxy = high temporal change AND near strong horizontal edge
    near_edge = edge_n > 0.25
    splash = (diff > 12) & near_edge
    # also pure temporal bright flashes (impact sparkles)
    sparkle = (g1 > g0 + 18) & (g1 > 140)
    return {
        "edge_diff_ratio": float(splash.mean()),
        "sparkle_ratio": float(sparkle.mean()),
        "diff_on_edge_mean": float(diff[near_edge].mean()) if near_edge.any() else 0,
        "diff_off_edge_mean": float(diff[~near_edge].mean()) if (~near_edge).any() else 0,
    }


def annotate_overlay(frame: np.ndarray, title: str) -> np.ndarray:
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, img.width, 36), fill=(0, 0, 0))
    draw.text((10, 10), title, fill=(255, 255, 255))
    return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)


def main() -> None:
    cap = cv2.VideoCapture(str(VIDEO))
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 24)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
    cap.release()

    # consecutive mid sequence for motion; also a few spaced frames
    mid = n // 2
    idxs = list(range(mid, mid + 10)) + [0, n // 4, 3 * n // 4, n - 1]
    frames = load_frames(idxs)

    # save ROI contact sheets for visual confirmation
    for i in [mid, mid + 3, mid + 6]:
        fr = frames.get(i)
        if fr is None:
            continue
        rois = crop_rois(fr)
        for name, roi in rois.items():
            save_rgb(OUT_DIR / f"roi_{i:05d}_{name}.jpg", roi)

    # consecutive diffs for glass / card regions
    pair_stats = []
    for a in range(mid, mid + 8):
        b = a + 1
        fa, fb = frames.get(a), frames.get(b)
        if fa is None or fb is None:
            continue
        ga = cv2.cvtColor(fa, cv2.COLOR_BGR2GRAY)
        gb = cv2.cvtColor(fb, cv2.COLOR_BGR2GRAY)
        diff = np.abs(gb.astype(np.int16) - ga.astype(np.int16)).astype(np.uint8)
        # amplify and save
        vis = cv2.applyColorMap(np.clip(diff * 6, 0, 255).astype(np.uint8), cv2.COLORMAP_TURBO)
        save_rgb(OUT_DIR / f"diff_{a:05d}_{b:05d}.jpg", vis)

        # ROI diffs
        for name, (y0, y1, x0, x1) in {
            "glass_top": (int(h * 0.08), int(h * 0.28), int(w * 0.1), int(w * 0.9)),
            "card_top": (int(h * 0.30), int(h * 0.42), int(w * 0.08), int(w * 0.92)),
            "card_face": (int(h * 0.38), int(h * 0.55), int(w * 0.12), int(w * 0.88)),
            "glass_mid": (int(h * 0.55), int(h * 0.72), int(w * 0.1), int(w * 0.9)),
        }.items():
            d = diff[y0:y1, x0:x1]
            save_rgb(
                OUT_DIR / f"diffroi_{a:05d}_{name}.jpg",
                cv2.applyColorMap(np.clip(d * 8, 0, 255).astype(np.uint8), cv2.COLORMAP_TURBO),
            )

        streak = analyze_streak_geometry(gb)
        drops_full = droplet_blob_stats(fb)
        # glass-only droplet stats
        glass = fb[int(h * 0.05) : int(h * 0.25), int(w * 0.08) : int(w * 0.92)]
        drops_glass = droplet_blob_stats(glass)
        splash = splash_edge_activity(fa, fb)

        # estimate rain layer speed via phase correlation on highpass (better for streaks)
        hp0 = cv2.subtract(ga, cv2.GaussianBlur(ga, (0, 0), 1.4)).astype(np.float32)
        hp1 = cv2.subtract(gb, cv2.GaussianBlur(gb, (0, 0), 1.4)).astype(np.float32)
        # crop center to avoid UI chrome
        cy0, cy1 = int(h * 0.15), int(h * 0.45)
        cx0, cx1 = int(w * 0.15), int(w * 0.85)
        shift, resp = cv2.phaseCorrelate(hp0[cy0:cy1, cx0:cx1], hp1[cy0:cy1, cx0:cx1])
        dx, dy = float(shift[0]), float(shift[1])

        pair_stats.append(
            {
                "pair": [a, b],
                "streak": streak,
                "drops_full": {k: drops_full[k] for k in ("count", "size_median", "size_p90", "aspect_median", "roundish_ratio", "elongated_ratio")},
                "drops_glass_top": {k: drops_glass[k] for k in ("count", "size_median", "size_p90", "aspect_median", "roundish_ratio", "elongated_ratio")},
                "splash": splash,
                "phase_shift_px": {"dx": dx, "dy": dy, "response": float(resp)},
                "phase_speed_px_s": {"vx": dx * fps, "vy": dy * fps},
            }
        )

    # persistence check: how many bright droplet-like pixels stay across 5 frames
    seq = [frames.get(i) for i in range(mid, mid + 5)]
    persistence = None
    if all(x is not None for x in seq):
        masks = []
        for fr in seq:
            g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
            # local highlight = potential droplet body
            blur = cv2.GaussianBlur(g, (0, 0), 2.5)
            m = ((g.astype(np.int16) - blur.astype(np.int16)) > 10).astype(np.uint8)
            masks.append(m)
        stacked = np.stack(masks, axis=0)
        always = stacked.min(axis=0)
        sometime = stacked.max(axis=0)
        persistence = {
            "highlight_any_ratio": float(sometime.mean()),
            "highlight_persist5_ratio": float(always.mean()),
            "persist_over_any": float(always.mean() / (sometime.mean() + 1e-9)),
            "interpretation": "higher persist_over_any => more static glass droplets; lower => rain streaks dominate change",
        }

    # streak length distribution from one frame with visualization
    fr = frames[mid]
    gray = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (0, 0), 1.5)
    hp = cv2.subtract(gray, blur)
    _, bw = cv2.threshold(hp, max(8, int(hp.mean() + 1.2 * hp.std())), 255, cv2.THRESH_BINARY)
    vert = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 7)))
    lines = cv2.HoughLinesP(vert, 1, np.pi / 180, threshold=28, minLineLength=18, maxLineGap=6)
    vis = fr.copy()
    if lines is not None:
        for x1, y1, x2, y2 in np.asarray(lines).reshape(-1, 4):
            cv2.line(vis, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 180), 1, cv2.LINE_AA)
    save_rgb(OUT_DIR / f"hough_streaks_{mid:05d}.jpg", vis)

    # side-by-side prev/cur glass crop for human inspection
    a, b = mid, mid + 1
    fa, fb = frames[a], frames[b]
    y0, y1, x0, x1 = int(h * 0.08), int(h * 0.28), int(w * 0.1), int(w * 0.9)
    side = np.concatenate([fa[y0:y1, x0:x1], fb[y0:y1, x0:x1]], axis=1)
    save_rgb(OUT_DIR / "glass_top_side_by_side.jpg", side)
    y0, y1 = int(h * 0.30), int(h * 0.42)
    side2 = np.concatenate([fa[y0:y1, x0:x1], fb[y0:y1, x0:x1]], axis=1)
    save_rgb(OUT_DIR / "card_top_side_by_side.jpg", side2)

    # aggregate
    angles = [p["streak"]["angle_from_vertical_median"] for p in pair_stats if p["streak"]["angle_from_vertical_median"] is not None]
    lens = [p["streak"]["length_median"] for p in pair_stats if p["streak"]["length_median"] is not None]
    dys = [p["phase_shift_px"]["dy"] for p in pair_stats]
    dxs = [p["phase_shift_px"]["dx"] for p in pair_stats]
    drop_n = [p["drops_glass_top"]["count"] for p in pair_stats]
    elong = [p["drops_glass_top"]["elongated_ratio"] for p in pair_stats]
    splash_edge = [p["splash"]["diff_on_edge_mean"] / max(p["splash"]["diff_off_edge_mean"], 1e-6) for p in pair_stats]

    summary = {
        "meta": {"w": w, "h": h, "fps": fps, "n": n, "duration_s": n / fps},
        "layer_findings": {
            "rain_streaks": {
                "present": True,
                "approx_hough_lines_per_frame": float(np.median([p["streak"]["hough_line_count"] for p in pair_stats])),
                "tilt_from_vertical_deg_median": float(np.median(angles)) if angles else None,
                "streak_length_px_median": float(np.median(lens)) if lens else None,
                "phase_dy_px_per_frame_median": float(np.median(dys)),
                "phase_dx_px_per_frame_median": float(np.median(dxs)),
                "phase_vy_px_per_sec": float(np.median(dys) * fps),
                "phase_vx_px_per_sec": float(np.median(dxs) * fps),
                "note": "Near-vertical white streaks; phase correlation on highpass estimates bulk shift (can be weak if particles respawn).",
            },
            "glass_droplets": {
                "detected_in_top_band_count_median": float(np.median(drop_n)),
                "elongated_ratio_median": float(np.median(elong)),
                "persistence": persistence,
                "note": "Blob detector undercounts artistic shader droplets; persistence ratio is more reliable for static vs moving.",
            },
            "ui_edge_splash": {
                "edge_vs_offedge_diff_gain_median": float(np.median(splash_edge)),
                "interpretation": ">1 means more temporal change near horizontal UI edges (splash / wet rim).",
            },
            "atmosphere": {
                "mean_brightness_stable": True,
                "brightness_drift": "very small across clip (~85-87)",
                "palette": "cool blue-grey storm, low saturation",
            },
        },
        "pairs": pair_stats,
        "persistence": persistence,
    }

    (OUT_DIR / "deep_report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary["layer_findings"], ensure_ascii=False, indent=2))
    print("wrote", OUT_DIR / "deep_report.json")


if __name__ == "__main__":
    main()
