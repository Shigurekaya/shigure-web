"""Frame-accurate layer decomposition of Xiaomi heavy-rain reference."""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
VIDEO = ROOT / "rain_ref.mp4"
OUT = ROOT / "deep2"
OUT.mkdir(exist_ok=True)


def main() -> None:
    cap = cv2.VideoCapture(str(VIDEO))
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 24)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)

    # load consecutive mid frames densely
    start = max(0, n // 2 - 6)
    idxs = list(range(start, min(n, start + 14)))
    frames: dict[int, np.ndarray] = {}
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        if i in idxs:
            frames[i] = fr
        i += 1
    cap.release()

    mid = idxs[len(idxs) // 2]
    fr = frames[mid]
    gray = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(fr, cv2.COLOR_BGR2HSV)

    # --- streak geometry via anisotropic highpass ---
    blur = cv2.GaussianBlur(gray, (0, 0), 1.4)
    hp = cv2.subtract(gray, blur)
    thr = max(6, int(hp.mean() + 0.9 * hp.std()))
    _, bw = cv2.threshold(hp, thr, 255, cv2.THRESH_BINARY)
    vert = cv2.morphologyEx(bw, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 5)))
    lines = cv2.HoughLinesP(vert, 1, np.pi / 180, threshold=22, minLineLength=12, maxLineGap=5)
    tilts = []
    lens = []
    if lines is not None:
        for x1, y1, x2, y2 in np.asarray(lines).reshape(-1, 4):
            dx, dy = int(x2) - int(x1), int(y2) - int(y1)
            length = float(np.hypot(dx, dy))
            # angle from vertical in degrees, signed
            ang = float(np.degrees(np.arctan2(dx, dy if dy != 0 else 1)))
            if ang > 90:
                ang -= 180
            if ang < -90:
                ang += 180
            tilts.append(ang)
            lens.append(length)

    # brightness of streak vs bg
    streak_mask = vert > 0
    streak_v = float(gray[streak_mask].mean()) if streak_mask.any() else 0
    bg_v = float(gray[~streak_mask].mean()) if (~streak_mask).any() else 0

    # layer by brightness of streak pixels (far dim / near bright)
    streak_vals = gray[streak_mask] if streak_mask.any() else np.array([0])
    layers_q = {
        "far_lt_p40": float(np.percentile(streak_vals, 40)),
        "mid_p40_p70": [float(np.percentile(streak_vals, 40)), float(np.percentile(streak_vals, 70))],
        "near_gt_p70": float(np.percentile(streak_vals, 70)),
        "p10": float(np.percentile(streak_vals, 10)),
        "p90": float(np.percentile(streak_vals, 90)),
    }

    # --- glass droplet detection (DoG + circularity) ---
    g1 = cv2.GaussianBlur(gray, (0, 0), 1.0)
    g2 = cv2.GaussianBlur(gray, (0, 0), 3.8)
    dog = cv2.subtract(g1, g2)
    _, db = cv2.threshold(dog, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cnts, _ = cv2.findContours(db, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    drops = []
    for c in cnts:
        x, y, bw_, bh = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        if area < 18 or area > 2200:
            continue
        asp = bh / max(bw_, 1)
        peri = cv2.arcLength(c, True)
        circ = 4 * np.pi * area / (peri * peri + 1e-6)
        if circ < 0.28 or asp < 0.45 or asp > 3.2:
            continue
        # local contrast inside blob
        roi = gray[y : y + bh, x : x + bw_]
        drops.append(
            {
                "x": int(x + bw_ / 2),
                "y": int(y + bh / 2),
                "w": int(bw_),
                "h": int(bh),
                "asp": round(float(asp), 2),
                "circ": round(float(circ), 2),
                "mean": float(roi.mean()),
                "y_frac": round(float((y + bh / 2) / h), 3),
            }
        )

    # persistence of droplet-like highlights across sequence
    masks = []
    for idx in idxs:
        g = cv2.cvtColor(frames[idx], cv2.COLOR_BGR2GRAY)
        b = cv2.GaussianBlur(g, (0, 0), 2.2)
        m = ((g.astype(np.int16) - b.astype(np.int16)) > 12).astype(np.uint8)
        masks.append(m)
    stack = np.stack(masks, axis=0)
    persist = {
        "frames": len(masks),
        "any_ratio": float(stack.max(axis=0).mean()),
        "all_ratio": float(stack.min(axis=0).mean()),
        "persist_over_any": float(stack.min(axis=0).mean() / (stack.max(axis=0).mean() + 1e-9)),
        "mean_lifetime_est_frames": float(stack.sum(axis=0).mean() / (stack.max(axis=0).mean() + 1e-9)),
    }

    # motion: frame diff streak orientation + speed via centroid shift of bright ridges
    diffs = []
    for a, b in zip(idxs, idxs[1:]):
        ga = cv2.cvtColor(frames[a], cv2.COLOR_BGR2GRAY).astype(np.float32)
        gb = cv2.cvtColor(frames[b], cv2.COLOR_BGR2GRAY).astype(np.float32)
        d = np.abs(gb - ga)
        diffs.append(float(d.mean()))
    # optical flow only on highpass
    ga = cv2.cvtColor(frames[mid], cv2.COLOR_BGR2GRAY)
    gb = cv2.cvtColor(frames[mid + 1], cv2.COLOR_BGR2GRAY)
    hp0 = cv2.subtract(ga, cv2.GaussianBlur(ga, (0, 0), 1.3))
    hp1 = cv2.subtract(gb, cv2.GaussianBlur(gb, (0, 0), 1.3))
    flow = cv2.calcOpticalFlowFarneback(hp0, hp1, None, 0.5, 3, 13, 3, 5, 1.1, 0)
    mag, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1], angleInDegrees=True)
    strong = mag > np.percentile(mag, 90)
    flow_stats = {
        "mag_p50": float(np.median(mag[strong])) if strong.any() else 0,
        "mag_p90": float(np.percentile(mag[strong], 90)) if strong.any() else 0,
        "vy_p50": float(np.median(flow[..., 1][strong])) if strong.any() else 0,
        "vx_p50": float(np.median(flow[..., 0][strong])) if strong.any() else 0,
        "ang_p50": float(np.median(ang[strong])) if strong.any() else 0,
        "down_ratio": float(((ang[strong] > 60) & (ang[strong] < 120)).mean()) if strong.any() else 0,
    }

    # UI card top-edge splash: horizontal edge × temporal sparkle
    soby = np.abs(cv2.Sobel(gray.astype(np.float32), cv2.CV_32F, 0, 1, ksize=3))
    edge = soby > np.percentile(soby, 92)
    # approximate main card band
    y0, y1 = int(h * 0.30), int(h * 0.58)
    band_edge = np.zeros_like(edge)
    band_edge[y0:y1] = edge[y0:y1]
    next_g = cv2.cvtColor(frames[mid + 1], cv2.COLOR_BGR2GRAY)
    sparkle = (next_g.astype(np.int16) - gray.astype(np.int16)) > 16
    splash = {
        "edge_pixels_in_card_band": int(band_edge.sum()),
        "sparkle_on_edge": float((sparkle & band_edge).mean()),
        "sparkle_off_edge": float((sparkle & ~band_edge).mean()),
        "gain": float((sparkle & band_edge).mean() / ((sparkle & ~band_edge).mean() + 1e-9)),
    }

    # color mood
    mood = {
        "mean_bgr": [float(x) for x in fr.mean(axis=(0, 1))],
        "mean_hsv": [float(x) for x in hsv.mean(axis=(0, 1))],
        "v_mean": float(hsv[..., 2].mean()),
        "s_mean": float(hsv[..., 1].mean()),
        "h_mean": float(hsv[..., 0].mean()),
    }

    # save annotated overlays
    vis = fr.copy()
    if lines is not None:
        for x1, y1, x2, y2 in np.asarray(lines).reshape(-1, 4)[:400]:
            cv2.line(vis, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 180), 1, cv2.LINE_AA)
    for d in drops[:80]:
        color = (0, 140, 255) if d["asp"] < 1.35 else (255, 120, 40)
        cv2.ellipse(vis, (d["x"], d["y"]), (max(2, d["w"] // 2), max(2, d["h"] // 2)), 0, 0, 360, color, 1)
    Image.fromarray(cv2.cvtColor(vis, cv2.COLOR_BGR2RGB)).save(OUT / "annot_mid.jpg", quality=90)

    # ROI exports
    for name, box in {
        "glass_top": (0.05, 0.22, 0.08, 0.92),
        "card_edge": (0.30, 0.42, 0.06, 0.94),
        "temp_zone": (0.18, 0.38, 0.05, 0.55),
        "glass_mid": (0.55, 0.78, 0.08, 0.92),
    }.items():
        ya, yb, xa, xb = box
        crop = fr[int(h * ya) : int(h * yb), int(w * xa) : int(w * xb)]
        Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)).save(OUT / f"roi_{name}.jpg", quality=90)

    scale_1080 = 1080 / h
    report = {
        "meta": {"w": w, "h": h, "fps": fps, "n": n, "duration_s": n / fps},
        "streaks": {
            "hough_count": 0 if lines is None else int(np.asarray(lines).reshape(-1, 4).shape[0]),
            "pixel_ratio": float(streak_mask.mean()),
            "count_per_mpx_est": float((0 if lines is None else np.asarray(lines).reshape(-1, 4).shape[0]) / (w * h / 1e6)),
            "tilt_deg_median": float(np.median(tilts)) if tilts else None,
            "tilt_deg_p10": float(np.percentile(tilts, 10)) if tilts else None,
            "tilt_deg_p90": float(np.percentile(tilts, 90)) if tilts else None,
            "len_px_median": float(np.median(lens)) if lens else None,
            "len_px_p90": float(np.percentile(lens, 90)) if lens else None,
            "len_1080p_median": float(np.median(lens) * scale_1080) if lens else None,
            "len_1080p_p90": float(np.percentile(lens, 90) * scale_1080) if lens else None,
            "len_frac_h_median": float(np.median(lens) / h) if lens else None,
            "brightness": {"streak_mean": streak_v, "bg_mean": bg_v, "delta": streak_v - bg_v},
            "brightness_layers": layers_q,
            "color_hint": "cool white / light cyan on dark blue-grey",
        },
        "glass_drops": {
            "count": len(drops),
            "per_mpx": float(len(drops) / (w * h / 1e6)),
            "size_med_px": float(np.median([max(d["w"], d["h"]) for d in drops])) if drops else 0,
            "size_1080p": float(np.median([max(d["w"], d["h"]) for d in drops]) * scale_1080) if drops else 0,
            "roundish_ratio": float(np.mean([d["asp"] < 1.35 for d in drops])) if drops else 0,
            "elongated_ratio": float(np.mean([d["asp"] >= 1.6 for d in drops])) if drops else 0,
            "y_frac_median": float(np.median([d["y_frac"] for d in drops])) if drops else None,
            "persistence": persist,
        },
        "motion": {
            "diff_mean_seq": diffs,
            "diff_mean_avg": float(np.mean(diffs)),
            "flow": flow_stats,
            "note": "Particles respawn; flow underestimates bulk rain speed. Use streak length/speed coupling instead.",
        },
        "splash": splash,
        "mood": mood,
        "implementation_recipe": {
            "layers": [
                "0 storm-cloud dark blue-grey atmosphere",
                "1 far dense short faint nearly-vertical streaks",
                "2 mid streaks",
                "3 near longer brighter streaks",
                "4 UI cards (sandwiched)",
                "5 foreground streaks over UI (~8-12%)",
                "6 glass static beads with refraction/specular",
                "7 sliding beads + wet trails",
                "8 card-top splash sparkles + wet rim + crown rings",
                "9 soft mist veil",
            ],
            "glass_tech": "Heartfelt-style procedural droplet field + normal refraction (WebGL) preferred over painted ellipses",
            "ui_sandwich": "Confirmed by V2EX/MIUI discussions: weather FX has layers both under and over text",
            "targets_1080p": {
                "streaks_total": "280-420",
                "streak_len_med_px": 10,
                "streak_len_p90_px": 28,
                "tilt_deg": "0 ± 4",
                "glass_drops": "40-80",
                "drop_size_med_px": 5,
                "fg_streak_share": 0.08,
            },
        },
    }
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report["implementation_recipe"], ensure_ascii=False, indent=2))
    print("--- streaks ---")
    print(json.dumps(report["streaks"], ensure_ascii=False, indent=2))
    print("--- glass ---")
    print(json.dumps(report["glass_drops"], ensure_ascii=False, indent=2))
    print("--- splash ---")
    print(json.dumps(report["splash"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
