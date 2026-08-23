/**
 * 时雨榧 · 晴天（云 / 太阳 / 虹弧）
 *
 * 小雨同款浅色底 + 雾层；单层静态 Canvas（云/太阳/虹弧 resize 时烘焙一次，无逐帧循环）。
 */
(() => {
  const STATIC_BUF_SCALE = 0.62;
  const RAINBOW_TEX = "assets/images/rainbow-glow.png";
  const RAINBOW_SATURATE = 0.86;
  const RAINBOW_CONTRAST = 0.92;
  const RAINBOW_ALPHA_BOOST = 0.74;
  const RAINBOW_PASTEL_LIFT = 0.48;
  const RAINBOW_BRIGHTNESS = 1.04;
  const RAINBOW_COVERAGE_MIN = 0.88;
  /** 虹弧相对默认锚点的微调（屏宽/高比例，负值 = 左/上） */
  const RAINBOW_OFFSET_X = -0.06;
  const RAINBOW_OFFSET_Y = -0.07;
  /** 放大贴图，让虹弧铺满屏宽 */
  const RAINBOW_SCALE_MUL = 1.12;

  /** 虹弧烘焙分辨率：大屏降采样，避免 sculpt 卡死主线程 */
  function rainbowBakeDims(w, h) {
    const px = w * h;
    let scale = 0.56;
    if (px > 2560 * 1440) scale = 0.38;
    else if (px > 1920 * 1080) scale = 0.44;
    else if (px > 1280 * 720) scale = 0.5;
    return {
      bw: Math.max(320, Math.round(w * scale)),
      bh: Math.max(200, Math.round(h * scale)),
    };
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function isPhoneLike() {
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|MiuiBrowser/i.test(ua)
      || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) <= 920);
  }

  function hash(ix, iy) {
    let n = ix * 374761393 + iy * 668265263;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function vnoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = hash(x0, y0);
    const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1);
    const d = hash(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  function fbm(x, y, oct = 5) {
    let a = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < oct; o += 1) {
      a += amp * vnoise(x * f, y * f);
      amp *= 0.5;
      f *= 2.03;
    }
    return a;
  }

  function bakeWispyClouds(cw, ch) {
    const off = document.createElement("canvas");
    off.width = cw;
    off.height = ch;
    const ox = off.getContext("2d");
    if (!ox) return off;
    const img = ox.createImageData(cw, ch);
    const data = img.data;

    for (let y = 0; y < ch; y += 1) {
      const ny = y / ch;
      for (let x = 0; x < cw; x += 1) {
        const nx = x / cw;
        let d = fbm(nx * 3.4 + 0.2, ny * 5.6 + 0.6, 5);
        d += 0.2 * fbm(nx * 9.5 - 1.0, ny * 3.0 + 1.4, 3);
        const envelope = 0.12 + 0.58 * Math.exp(-Math.pow((ny - 0.24) / 0.4, 2));
        let dens = clamp((d - 0.56) / 0.26, 0, 1) * envelope;
        dens = dens * dens * (3 - 2 * dens);

        const bright = clamp(1 - ny * 0.72, 0.55, 1);
        const r = Math.round(lerp(228, 255, bright));
        const g = Math.round(lerp(238, 254, bright));
        const b = Math.round(lerp(248, 255, bright));
        const a = Math.round(255 * dens * 0.52);
        const i = (y * cw + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }
    ox.putImageData(img, 0, 0);
    return off;
  }

  let rainbowTex = null;
  let rainbowTexReady = false;
  let rainbowTexLoading = false;
  /** @type {Array<() => void>} */
  const rainbowTexWaiters = [];

  function flushRainbowTexWaiters() {
    const waiters = rainbowTexWaiters.splice(0);
    waiters.forEach((cb) => cb?.());
  }

  function loadRainbowTex(onReady) {
    if (onReady) rainbowTexWaiters.push(onReady);
    if (rainbowTexReady) {
      flushRainbowTexWaiters();
      return;
    }
    if (rainbowTexLoading) return;
    rainbowTexLoading = true;
    const img = new Image();
    img.decoding = "async";
    const finish = (ok) => {
      rainbowTexLoading = false;
      if (ok) {
        rainbowTex = img;
        rainbowTexReady = true;
      } else {
        console.warn("[kaya] rainbow texture unavailable, using procedural arc:", RAINBOW_TEX);
      }
      flushRainbowTexWaiters();
    };
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = RAINBOW_TEX;
    window.setTimeout(() => {
      if (!rainbowTexReady && rainbowTexLoading) finish(false);
    }, 8000);
  }

  function layoutRainbowDraw(w, h, phone) {
    const padX = w * (phone ? 0.04 : 0.02);
    const padY = h * (phone ? 0.03 : 0.01);
    const scale = (phone ? 1.1 : 1.08) * RAINBOW_SCALE_MUL;
    const drawW = (w + padX * 2) * scale;
    const drawH = (h + padY * 2) * scale;
    return {
      x: -(padX + (drawW - w) * 0.5) + w * RAINBOW_OFFSET_X,
      y: -(padY + (drawH - h) * 0.42) + h * RAINBOW_OFFSET_Y,
      w: drawW,
      h: drawH,
    };
  }

  /** 由贴图布局推导弧几何，保证补弧 / 自检与画面一致 */
  function getArcLayout(w, h, phone) {
    const box = layoutRainbowDraw(w, h, phone);
    const cx = box.x + box.w * 0.035;
    const cy = box.y + box.h * 1.1;
    const R = Math.hypot(box.w, box.h) * 0.88;
    /* 左弧脚锚在视口左下角，尽量贴近屏角避免弧带截断 */
    const leftFoot = {
      x: Math.max(2, w * 0.006),
      y: h - 2,
    };
    const rightFoot = {
      x: Math.min(w - 10, box.x + box.w * 0.985),
      y: Math.max(8, Math.min(h * 0.28, box.y + box.h * 0.12)),
    };
    let a0 = Math.atan2(leftFoot.y - cy, leftFoot.x - cx);
    let a1 = Math.atan2(rightFoot.y - cy, rightFoot.x - cx);
    if (a1 < a0) {
      const tmp = a0;
      a0 = a1;
      a1 = tmp;
    }
    return {
      cx,
      cy,
      R,
      a0: a0 - 0.2,
      a1: a1 + 0.02,
      box,
      leftFoot,
      corner: { x: 0, y: h },
    };
  }

  /**
   * 左缘可见虹弧锚点：贴图虹弧不在几何弧线上，需从缓冲扫描真实入点。
   * @returns {{ x: number, y: number, scanned?: boolean }}
   */
  function getLeftRainbowAnchor(ctx, w, h, phone) {
    if (ctx) {
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const xMax = Math.round(w * 0.18);
      const yMin = Math.round(h * 0.46);
      let best = null;
      for (let y = yMin; y < h - 6; y += 4) {
        for (let x = 0; x < xMax; x += 4) {
          const i = (y * w + x) * 4;
          const a = d[i + 3];
          if (a < 22) continue;
          const chroma = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
          if (chroma < 30) continue;
          const score = chroma * 1.6 + (h - y) * 0.06 + x * 0.12;
          if (!best || score > best.score) best = { x, y, score };
        }
      }
      if (best) return { x: best.x, y: best.y, scanned: true };
    }
    return {
      x: Math.max(10, w * 0.03),
      y: Math.round(h * (phone ? 0.77 : 0.8)),
      scanned: false,
    };
  }

  /** 左下楔区权重：仅屏角小三角，避免整条左缘被填色 */
  function cornerWedgeWeight(nx, ny) {
    if (nx > 0.2 || ny < 0.78) return 0;
    const fromLeft = smooth(clamp((0.18 - nx) / 0.16, 0, 1));
    const fromBottom = smooth(clamp((ny - 0.8) / 0.18, 0, 1));
    return fromLeft * fromBottom * 0.72;
  }

  function arcPoint(w, h, t, phone) {
    const arc = getArcLayout(w, h, phone);
    const ang = lerp(arc.a0, arc.a1, t);
    return {
      x: arc.cx + Math.cos(ang) * arc.R,
      y: arc.cy + Math.sin(ang) * arc.R,
      ang,
      cx: arc.cx,
      cy: arc.cy,
      R: arc.R,
      a0: arc.a0,
      a1: arc.a1,
    };
  }

  function distToArcNorm(nx, ny, w, h, phone) {
    const px = nx * w;
    const py = ny * h;
    let best = Infinity;
    for (let t = 0; t <= 1; t += 0.04) {
      const p = arcPoint(w, h, t, phone);
      if (p.x < -w * 0.05 || p.x > w * 1.02 || p.y < -h * 0.05 || p.y > h * 1.02) continue;
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < best) best = d;
    }
    return best / Math.min(w, h);
  }

  /**
   * 程序化虹弧底：贴图缺口处铺完整弧带（先画，贴图再叠上）。
   * @param {number} strength
   */
  function paintProceduralRainbowArc(ctx, w, h, phone, strength = 1) {
    const arc = getArcLayout(w, h, phone);
    const bands = [
      [0, 0.042], [16, 0.04], [34, 0.038], [52, 0.036],
      [78, 0.034], [125, 0.032], [188, 0.03], [248, 0.028], [292, 0.026],
    ];
    const strip = w * 0.024;
    ctx.save();
    ctx.filter = "blur(18px)";
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "screen";
    bands.forEach(([hue, alpha], idx) => {
      const r = arc.R + idx * strip * 0.8;
      ctx.beginPath();
      ctx.arc(arc.cx, arc.cy, r, arc.a0, arc.a1);
      ctx.strokeStyle = `hsla(${hue}, 58%, 78%, ${alpha * strength})`;
      ctx.lineWidth = strip * 1.35;
      ctx.stroke();
    });
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  /** 左下屏角轻柔衔接：单曲线 + 小柔光，避免竖向色柱 */
  function paintLeftCornerBridge(ctx, w, h, phone, strength = 1, anchor = null) {
    const entry = anchor || getLeftRainbowAnchor(ctx, w, h, phone);
    const corner = { x: 2, y: h - 2 };
    const strip = w * 0.026;

    ctx.save();
    ctx.filter = "blur(22px)";
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "screen";

    const bands = [[10, 0.04], [34, 0.035], [58, 0.03]];
    bands.forEach(([hue, alpha], idx) => {
      const off = idx * strip * 0.12;
      const sx = Math.max(4, entry.x - off);
      const sy = entry.y;
      const cx = lerp(sx, corner.x, 0.42);
      const cy = lerp(sy, corner.y, 0.58);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx, cy, corner.x, corner.y);
      ctx.strokeStyle = `hsla(${hue}, 56%, 80%, ${alpha * strength})`;
      ctx.lineWidth = strip * 1.35;
      ctx.stroke();
    });

    const cornerCap = strip * 5.2;
    const cg = ctx.createRadialGradient(corner.x, corner.y, 0, corner.x, corner.y, cornerCap);
    cg.addColorStop(0, `hsla(30, 52%, 84%, ${0.058 * strength})`);
    cg.addColorStop(0.5, `hsla(42, 48%, 86%, ${0.03 * strength})`);
    cg.addColorStop(1, "hsla(0,0%,100%,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(corner.x - cornerCap, corner.y - cornerCap, cornerCap * 2, cornerCap * 2);

    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  /** 弧端圆帽：仅补左下弧脚，右侧不画（避免竖向黄条） */
  function paintArcEndpointCaps(ctx, w, h, phone, strength = 1) {
    const strip = w * 0.026;
    const p = arcPoint(w, h, 0.02, phone);
    if (p.x < -strip || p.x > w + strip || p.y < -strip || p.y > h + strip) return;
    const hue = lerp(4, 52, 0.02);
    ctx.save();
    ctx.filter = "blur(22px)";
    ctx.globalCompositeOperation = "screen";
    const capR = strip * 4.8;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, capR);
    g.addColorStop(0, `hsla(${hue}, 56%, 80%, ${0.07 * strength})`);
    g.addColorStop(0.55, `hsla(${hue}, 52%, 82%, ${0.032 * strength})`);
    g.addColorStop(1, "hsla(0,0%,100%,0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.x - capR, p.y - capR, capR * 2, capR * 2);
    ctx.restore();
  }

  /** 裁掉右侧贴图边缘竖条伪影 */
  function trimRainbowRightEdge(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const xStart = Math.round(w * 0.84);
    for (let y = 0; y < h; y += 1) {
      for (let x = xStart; x < w; x += 1) {
        const nx = x / w;
        const fade = smooth(clamp((0.96 - nx) / 0.14, 0, 1));
        const i = (y * w + x) * 4;
        if (fade <= 0.02) {
          d[i + 3] = 0;
        } else {
          d[i + 3] = Math.round(d[i + 3] * fade * fade);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** 在弧线路径点附近取最大 alpha（容忍 blur 偏移） */
  function sampleArcAlpha(d, w, h, px, py, radius = 3) {
    let bestA = 0;
    let bestChroma = 0;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = px + dx;
        const y = py + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const a = d[i + 3];
        const chroma = Math.max(r, g, b) - Math.min(r, g, b);
        if (a > bestA) bestA = a;
        if (chroma > bestChroma) bestChroma = chroma;
      }
    }
    return { a: bestA, chroma: bestChroma };
  }

  /** @returns {{ coverage: number, gaps: object[], total: number, ok: number }} */
  function auditRainbowCoverage(ctx, w, h, phone) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const gaps = [];
    let ok = 0;
    let total = 0;
    const bandOffsets = [-0.014, 0, 0.014];
    const sampleAt = (xi, yi, tHint) => {
      if (xi < 4 || xi >= w - 4 || yi < 4 || yi >= h - 4) return;
      total += 1;
      const sample = sampleArcAlpha(d, w, h, xi, yi, 5);
      if (sample.a >= 16 && sample.chroma >= (tHint < 0.15 ? 22 : 7)) {
        ok += 1;
      } else {
        gaps.push({ t: tHint, x: xi, y: yi, a: sample.a, chroma: sample.chroma });
      }
    };
    for (let t = 0.015; t <= 0.985; t += 0.028) {
      const p = arcPoint(w, h, t, phone);
      const perpX = -Math.sin(p.ang);
      const perpY = Math.cos(p.ang);
      const unit = Math.min(w, h);
      for (const off of bandOffsets) {
        sampleAt(Math.round(p.x + perpX * off * unit), Math.round(p.y + perpY * off * unit), t);
      }
    }
    /* 左下角楔形区域强制采样 */
    const cornerPts = [
      [0.008, 0.992], [0.015, 0.985], [0.02, 0.95], [0.03, 0.97],
      [0.05, 0.99], [0.07, 0.995], [0.04, 0.99], [0.06, 0.94],
      [0.08, 0.96], [0.025, 0.998], [0.01, 0.97], [0.12, 0.99],
      [0.03, 0.82], [0.02, 0.78], [0.04, 0.74], [0.05, 0.7],
    ];
    cornerPts.forEach(([nx, ny], i) => {
      sampleAt(Math.round(nx * w), Math.round(ny * h), i * 0.02);
    });
    return { coverage: total ? ok / total : 0, gaps, total, ok };
  }

  function repairRainbowGaps(ctx, w, h, gaps, phone, strength = 1) {
    if (!gaps.length) return;
    ctx.save();
    ctx.filter = "blur(18px)";
    ctx.lineCap = "round";
    ctx.globalCompositeOperation = "screen";
    const strip = w * 0.024;
    gaps.forEach((g) => {
      const p = arcPoint(w, h, g.t, phone);
      const hue = lerp(4, 298, g.t);
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, p.R, p.ang - 0.05, p.ang + 0.05);
      ctx.strokeStyle = `hsla(${hue}, 62%, 78%, ${0.05 * strength})`;
      ctx.lineWidth = strip * 1.4;
      ctx.stroke();
    });
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  /**
   * 视口内虹弧 sculpt：裁掉顶栏/边角溢出，补强主弧可见段。
   * @param {CanvasRenderingContext2D} ctx
   */
  function closestArcT(nx, ny, w, h, phone) {
    const px = nx * w;
    const py = ny * h;
    let bestT = 0.5;
    let bestD = Infinity;
    for (let t = 0; t <= 1; t += 0.02) {
      const p = arcPoint(w, h, t, phone);
      const d = Math.hypot(px - p.x, py - p.y);
      if (d < bestD) {
        bestD = d;
        bestT = t;
      }
    }
    return bestT;
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  function sculptRainbowInViewport(ctx, w, h, phone) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const arcTube = 0.112;
    const step = w * h > 700000 ? 2 : 1;
    for (let y = 0; y < h; y += step) {
      const ny = y / h;
      for (let x = 0; x < w; x += step) {
        const nx = x / w;
        const i = (y * w + x) * 4;
        const a = d[i + 3];
        const cornerW = cornerWedgeWeight(nx, ny);
        if (a < 8 && cornerW < 0.02) continue;

        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const dist = distToArcNorm(nx, ny, w, h, phone);
        const onArc = Math.exp(-Math.pow(dist / arcTube, 2));

        let mask = 1;
        if (ny < 0.06) mask *= smooth(ny / 0.06);
        if (nx > 0.86) mask *= smooth((0.98 - nx) / 0.12);
        if (a < 4 && onArc < 0.05 && cornerW < 0.04) continue;

        let boost = 1 + 0.76 * onArc + 0.55 * cornerW;
        if (onArc > 0.18 && a < 110) boost += 0.52 * onArc;

        let nextA = Math.round((a || 0) * mask * boost);

        const needFill = (onArc > 0.1 && nextA < 38)
          || (cornerW > 0.1 && nextA < 48);
        if (needFill) {
          const t = cornerW > onArc * 0.5
            ? lerp(0, 0.12, cornerW)
            : closestArcT(nx, ny, w, h, phone);
          const hue = lerp(4, 298, t);
          const sat = cornerW > 0.2 ? 0.54 : 0.5;
          const [nr, ng, nb] = hslToRgb(hue, sat, 0.79);
          const fillA = Math.round((48 * onArc + 58 * cornerW) * mask);
          const lift = RAINBOW_PASTEL_LIFT * 0.55;
          d[i] = Math.round(lerp(nr, 255, lift));
          d[i + 1] = Math.round(lerp(ng, 255, lift));
          d[i + 2] = Math.round(lerp(nb, 255, lift));
          nextA = Math.max(nextA, fillA);
        }

        const outA = nextA < 4 ? 0 : Math.min(255, nextA);
        if (step > 1) {
          for (let dy = 0; dy < step; dy += 1) {
            for (let dx = 0; dx < step; dx += 1) {
              const j = ((y + dy) * w + (x + dx)) * 4;
              d[j] = d[i];
              d[j + 1] = d[i + 1];
              d[j + 2] = d[i + 2];
              d[j + 3] = outA;
            }
          }
        } else {
          d[i + 3] = outA;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** 抠掉贴图黑底，保留透明 + 彩色，便于在浅色底上用 source-over 叠浓色虹弧 */
  function knockOutRainbowBlack(ctx, cw, ch) {
    const img = ctx.getImageData(0, 0, cw, ch);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (a < 8) continue;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const sat = maxC === 0 ? 0 : chroma / maxC;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const colorWeight = clamp(chroma / 130 + sat * 0.34, 0, 1);
      const darkFade = clamp((lum - 14) / 96, 0, 1);
      const nextA = Math.round(a * colorWeight * darkFade * RAINBOW_ALPHA_BOOST);
      d[i] = Math.round(lerp(r, 255, RAINBOW_PASTEL_LIFT));
      d[i + 1] = Math.round(lerp(g, 255, RAINBOW_PASTEL_LIFT));
      d[i + 2] = Math.round(lerp(b, 255, RAINBOW_PASTEL_LIFT));
      d[i + 3] = nextA < 10 ? 0 : Math.min(255, nextA);
    }
    ctx.putImageData(img, 0, 0);
  }

  function bakeRainbowComposite(dw, dh, phone, rainbowBuf, out) {
    if (!rainbowBuf || !out) return null;
    const rctx = rainbowBuf.getContext("2d");
    const octx = out.getContext("2d");
    if (!rctx || !octx) return null;

    const { bw, bh } = rainbowBakeDims(dw, dh);
    const box = layoutRainbowDraw(bw, bh, phone);
    const hasTex = rainbowTexReady && !!rainbowTex;
    if (rainbowBuf.width !== bw || rainbowBuf.height !== bh) {
      rainbowBuf.width = bw;
      rainbowBuf.height = bh;
    }
    rctx.clearRect(0, 0, bw, bh);
    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = "high";
    paintProceduralRainbowArc(rctx, bw, bh, phone, hasTex ? 1 : 1.1);
    paintArcEndpointCaps(rctx, bw, bh, phone, 1);
    if (hasTex) {
      rctx.drawImage(rainbowTex, box.x, box.y, box.w, box.h);
      knockOutRainbowBlack(rctx, bw, bh);
      trimRainbowRightEdge(rctx, bw, bh);
    }
    let leftAnchor = getLeftRainbowAnchor(rctx, bw, bh, phone);
    paintLeftCornerBridge(rctx, bw, bh, phone, 0.82, leftAnchor);
    sculptRainbowInViewport(rctx, bw, bh, phone);
    trimRainbowRightEdge(rctx, bw, bh);
    paintArcEndpointCaps(rctx, bw, bh, phone, 0.85);

    let audit = auditRainbowCoverage(rctx, bw, bh, phone);
    let repairPass = 0;
    while (audit.coverage < RAINBOW_COVERAGE_MIN && repairPass < 2) {
      repairPass += 1;
      paintProceduralRainbowArc(rctx, bw, bh, phone, 0.9 + repairPass * 0.25);
      leftAnchor = getLeftRainbowAnchor(rctx, bw, bh, phone);
      paintLeftCornerBridge(rctx, bw, bh, phone, 0.75 + repairPass * 0.1, leftAnchor);
      paintArcEndpointCaps(rctx, bw, bh, phone, 0.85 + repairPass * 0.15);
      repairRainbowGaps(rctx, bw, bh, audit.gaps, phone, 1 + repairPass * 0.25);
      sculptRainbowInViewport(rctx, bw, bh, phone);
      trimRainbowRightEdge(rctx, bw, bh);
      audit = auditRainbowCoverage(rctx, bw, bh, phone);
    }

    if (audit.coverage < RAINBOW_COVERAGE_MIN) {
      console.warn(
        "[kaya] rainbow coverage below target:",
        Math.round(audit.coverage * 100),
        "% gaps:",
        audit.gaps.length,
      );
    }

    if (out.width !== dw || out.height !== dh) {
      out.width = dw;
      out.height = dh;
    }
    octx.clearRect(0, 0, dw, dh);

    const colorFilter = `saturate(${RAINBOW_SATURATE}) contrast(${RAINBOW_CONTRAST}) brightness(${RAINBOW_BRIGHTNESS})`;
    const drawBloom = (blurPx, alpha) => {
      octx.save();
      octx.filter = `blur(${blurPx}px) ${colorFilter}`;
      octx.globalCompositeOperation = "source-over";
      octx.globalAlpha = alpha;
      octx.drawImage(rainbowBuf, 0, 0, bw, bh, 0, 0, dw, dh);
      octx.filter = "none";
      octx.globalAlpha = 1;
      octx.restore();
    };

    drawBloom(38, 0.2);
    drawBloom(22, 0.28);
    drawBloom(10, 0.16);
    octx.save();
    octx.filter = `blur(6px) ${colorFilter}`;
    octx.globalCompositeOperation = "source-over";
    octx.globalAlpha = 0.4;
    octx.drawImage(rainbowBuf, 0, 0, bw, bh, 0, 0, dw, dh);
    octx.restore();
    return {
      out,
      coverage: audit.coverage,
      repairPass,
      coverageOk: audit.coverage >= RAINBOW_COVERAGE_MIN,
      arcSamples: audit.total,
    };
  }

  /**
   * @param {HTMLElement} host
   */
  function attach(host) {
    if (!host) return null;
    loadRainbowTex();
    const phone = isPhoneLike();

    const mist = document.createElement("div");
    mist.className = "site-bg__light-mist";
    mist.setAttribute("aria-hidden", "true");
    host.appendChild(mist);

    const sceneImg = document.createElement("img");
    sceneImg.className = "site-bg__sunny-scene";
    sceneImg.alt = "";
    sceneImg.setAttribute("aria-hidden", "true");
    sceneImg.decoding = "async";
    host.appendChild(sceneImg);

    /** @type {HTMLCanvasElement} */
    const bakeCanvas = document.createElement("canvas");
    const bakeCtx = bakeCanvas.getContext("2d", { alpha: true });
    if (!bakeCtx) return null;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let running = false;
    let cloudLayer = null;
    let bakeKey = "";
    /** @type {HTMLCanvasElement | null} */
    let rainbowBuf = null;
    /** @type {HTMLCanvasElement | null} */
    let rainbowBaked = null;

    host.classList.add("has-sunny-css");
    document.body.classList.add("kaya-ambient-eco");

    const paintSkyBase = (c) => {
      if (!c) return;
      const sky = c.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "rgba(88, 188, 232, 0.42)");
      sky.addColorStop(0.35, "rgba(120, 205, 242, 0.28)");
      sky.addColorStop(0.72, "rgba(175, 222, 248, 0.14)");
      sky.addColorStop(1, "rgba(210, 236, 252, 0.06)");
      c.fillStyle = sky;
      c.fillRect(0, 0, w, h);
    };

    const paintClouds = (c) => {
      if (!cloudLayer || !c) return;
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = "low";
      c.save();
      c.globalCompositeOperation = "screen";
      c.globalAlpha = phone ? 0.48 : 0.54;
      c.drawImage(cloudLayer, -w * 0.05, -h * 0.02, w * 1.1, h * 0.5);
      c.globalAlpha = phone ? 0.34 : 0.38;
      c.drawImage(cloudLayer, w * 0.08, h * 0.08, w * 0.92, h * 0.42);
      c.globalAlpha = 0.24;
      c.drawImage(cloudLayer, -w * 0.08, h * 0.14, w * 0.88, h * 0.36);
      c.restore();
    };

    const paintSun = (c) => {
      if (!c) return;
      const sx = w * (phone ? 0.88 : 0.9);
      const sy = h * (phone ? 0.14 : 0.12);
      const sunR = Math.min(w, h) * (phone ? 0.32 : 0.36);
      c.save();
      c.globalCompositeOperation = "screen";
      const sun = c.createRadialGradient(sx, sy, 0, sx, sy, sunR);
      sun.addColorStop(0, "rgba(255,248,225,0.16)");
      sun.addColorStop(0.3, "rgba(255,238,195,0.07)");
      sun.addColorStop(0.65, "rgba(255,225,170,0.02)");
      sun.addColorStop(1, "rgba(255,220,150,0)");
      c.fillStyle = sun;
      c.fillRect(sx - sunR, sy - sunR, sunR * 2, sunR * 2);
      c.restore();
    };

    const bakeClouds = () => {
      const key = `${w}x${h}`;
      if (key === bakeKey && cloudLayer) return;
      bakeKey = key;
      const scale = phone ? 2.8 : 2.5;
      const cw = Math.max(96, Math.floor(w / scale));
      const ch = Math.max(64, Math.floor(h / scale));
      cloudLayer = bakeWispyClouds(cw, ch);
    };

    let rainbowCoverage = 0;
    let rainbowRepairPass = 0;
    let rainbowCoverageOk = false;

    const refreshRainbowBake = () => {
      if (!rainbowBuf) rainbowBuf = document.createElement("canvas");
      if (!rainbowBaked) rainbowBaked = document.createElement("canvas");
      const baked = bakeRainbowComposite(w, h, phone, rainbowBuf, rainbowBaked);
      if (baked) {
        rainbowCoverage = baked.coverage;
        rainbowRepairPass = baked.repairPass;
        rainbowCoverageOk = baked.coverageOk;
      }
    };

    const bakeStaticScene = () => {
      bakeCanvas.width = w;
      bakeCanvas.height = h;
      bakeCtx.setTransform(1, 0, 0, 1, 0, 0);
      bakeCtx.clearRect(0, 0, w, h);
      paintSkyBase(bakeCtx);
      paintClouds(bakeCtx);
      paintSun(bakeCtx);
      if (rainbowBaked) {
        bakeCtx.save();
        bakeCtx.globalCompositeOperation = "source-over";
        bakeCtx.globalAlpha = 1;
        bakeCtx.drawImage(rainbowBaked, 0, 0, w, h);
        bakeCtx.restore();
      }
      sceneImg.src = bakeCanvas.toDataURL("image/png");
    };

    let resizeTimer = 0;
    let sceneRevealed = false;
    let bakedWithTex = false;

    const revealScene = () => {
      if (sceneRevealed) return;
      sceneRevealed = true;
      sceneImg.classList.add("is-on");
    };

    const applyResize = () => {
      let cssW = window.innerWidth;
      let cssH = window.innerHeight;
      if (window.visualViewport) {
        cssW = Math.round(window.visualViewport.width);
        cssH = Math.round(window.visualViewport.height);
      }
      const weak = window.KayaPerfGovernor?.isWeakGpu?.() ?? false;
      const Gov = window.KayaPerfGovernor;
      dpr = Gov?.ambientDprCap
        ? Math.min(window.devicePixelRatio || 1, Gov.ambientDprCap(phone))
        : Math.min(window.devicePixelRatio || 1, phone ? 1.05 : (weak ? 1 : 1.08));
      w = Math.max(1, Math.round(cssW));
      h = Math.max(1, Math.round(cssH));
      sceneImg.style.width = `${w}px`;
      sceneImg.style.height = `${h}px`;

      if (!rainbowBuf) rainbowBuf = document.createElement("canvas");
      refreshRainbowBake();

      bakeClouds();
      bakeStaticScene();
      revealScene();
    };

    const resize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(applyResize, 80);
    };

    window.__KayaSunnyStats = () => ({
      mode: "img-static",
      frameMs: 0,
      effectFps: 0,
      staticLayer: true,
      static: true,
      dpr,
      staticScale: STATIC_BUF_SCALE,
      staticPx: w * h,
      w,
      h,
      rainbow: rainbowTexReady,
      rainbowCoverage: Math.round(rainbowCoverage * 1000) / 1000,
      rainbowCoverageOk,
      rainbowRepairPass,
      weakGpu: window.KayaPerfGovernor?.isWeakGpu?.() ?? false,
    });

    const rebakeWithTexture = () => {
      if (!running || bakedWithTex || !rainbowTexReady) return;
      bakedWithTex = true;
      refreshRainbowBake();
      bakeStaticScene();
    };

    return {
      start() {
        if (running) return;
        running = true;
        loadRainbowTex(rebakeWithTexture);
        applyResize();
      },
      stop() {
        running = false;
        sceneRevealed = false;
        sceneImg.classList.remove("is-on");
      },
      resize,
      destroy() {
        this.stop();
        host.classList.remove("has-sunny-css");
        document.body.classList.remove("kaya-ambient-eco");
        mist.remove();
        sceneImg.remove();
        delete window.__KayaSunnyStats;
      },
    };
  }

  loadRainbowTex();
  window.KayaSunnySky = { attach, preloadRainbow: loadRainbowTex };
})();
