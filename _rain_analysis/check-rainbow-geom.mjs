/** 虹弧几何 + 高度自检（桌面/手机） */
const cases = [
  { name: "desktop", w: 1920, h: 1080, phone: false },
  { name: "mobile", w: 390, h: 844, phone: true },
];

function layout(w, h, phone) {
  if (phone) {
    const r0 = w * 2.1;
    return {
      cx: w * 0.5,
      cy: h + r0 * 0.1,
      r0,
      a0: Math.PI * 1.435,
      a1: Math.PI * 1.565,
      maxYRatio: 0.2,
    };
  }
  return {
    cx: w * 0.48,
    cy: h * 1.1,
    r0: Math.min(w * 1.0, h * 1.0),
    a0: Math.PI * 1.36,
    a1: Math.PI * 1.64,
    maxYRatio: 0.42,
  };
}

function arcFade(t) {
  const c = Math.max(0, Math.min(1, t));
  return Math.pow(Math.sin(c * Math.PI), 0.82);
}

let failed = 0;
for (const { name, w, h, phone } of cases) {
  const { cx, cy, r0, a0, a1, maxYRatio } = layout(w, h, phone);
  const top = cy - r0;
  let inCount = 0;
  let maxY = 0;
  let minFade = 1;
  const samples = [];

  for (let i = 0; i <= 16; i += 1) {
    const t = i / 16;
    const a = a0 + (a1 - a0) * t;
    const x = cx + r0 * Math.cos(a);
    const y = cy + r0 * Math.sin(a);
    const inside = x >= 0 && x <= w && y >= 0 && y <= h;
    if (inside) inCount += 1;
    if (inside) maxY = Math.max(maxY, y);
    minFade = Math.min(minFade, arcFade(t));
    samples.push({ x: Math.round(x), y: Math.round(y), inside, fade: arcFade(t).toFixed(2) });
  }

  const ok = inCount >= (phone ? 12 : 10)
    && top >= 0
    && top <= h * 0.2
    && maxY <= h * maxYRatio
    && minFade < 0.08;

  if (!ok) failed += 1;
  console.log(name, {
    w,
    h,
    r0: Math.round(r0),
    top: Math.round(top),
    maxY: Math.round(maxY),
    maxYLimit: Math.round(h * maxYRatio),
    inCount,
    minFade: minFade.toFixed(3),
    ok,
    samples,
  });
}

process.exit(failed ? 1 : 0);
