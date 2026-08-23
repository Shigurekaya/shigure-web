/**
 * GPU 雨丝引擎（WebGL）
 * 属性一次上传；顶点着色器按 time 算位置。
 * 观感对齐小米天气大雨参考片：近乎竖直、三层景深、轻微阵风。
 * 注意：同页勿再开第二个 WebGL（如 raindrop-fx），否则易丢上下文。
 */
(() => {
  const VS = `
attribute float aId;
attribute float aCorner;
attribute float aSide;
uniform vec2 uRes;
uniform float uTime;
uniform float uWind;
uniform float uGust;
uniform float uIntensity;
uniform float uSpeedMul;
uniform float uTilt; /* 水平倾角系数；阵风时略偏，暴雨雨帘保持近竖直 */
uniform float uSizeMul; /* 雨丝长短/粗细 */
uniform float uSheet; /* >0.5：小米天气式短密雨帘 */
varying float vAlpha;
varying float vEdge;
varying float vLayer;
varying float vSheet;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  float id = aId + 0.13;
  float h0 = hash(id);
  float h1 = hash(id * 1.71 + 2.3);
  float h2 = hash(id * 3.91 + 7.1);
  float h3 = hash(id * 5.17 + 11.9);
  float h4 = hash(id * 8.33 + 19.7);
  float hx = hash(id * 13.7 + 0.91);
  float sm = max(uSizeMul, 0.7);
  float sheet = clamp(uSheet, 0.0, 1.0);
  /* 远/中/近：长度对齐 light-rain.js DROP_SPEC（短针 + 尾渐隐） */
  float nearCut = mix(0.8, 0.7, sheet);
  float midCut = mix(0.46, 0.34, sheet);
  nearCut = mix(nearCut, mix(0.8, 0.74, clamp((sm - 1.0) * 2.5, 0.0, 1.0)), 1.0 - sheet);
  midCut = mix(midCut, mix(0.46, 0.4, clamp((sm - 1.0) * 2.5, 0.0, 1.0)), 1.0 - sheet);
  float lp = hash(id * 2.17 + 0.4);
  float layer = lp < midCut ? 0.0 : (lp < nearCut ? 1.0 : 2.0);
  float lenH = mix(0.012, 0.022, h1) * sm;
  float speed = mix(1100.0, 1500.0, h2);
  float alpha = mix(0.28, 0.46, h3);
  float widthPx = mix(1.1, 1.5, h1) * sm;

  if (layer > 0.5 && layer < 1.5) {
    lenH = mix(0.018, 0.034, h1) * sm;
    speed = mix(1240.0, 1680.0, h2);
    alpha = mix(0.36, 0.58, h3);
    widthPx = mix(1.25, 1.7, h1) * sm;
  } else if (layer > 1.5) {
    lenH = mix(0.024, 0.045, h1) * sm;
    speed = mix(1420.0, 1980.0, h2);
    alpha = mix(0.44, 0.68, h3);
    widthPx = mix(1.4, 2.0, h1) * sm;
  }

  if (sheet > 0.5) {
    speed = mix(speed, speed * 1.18, sheet);
    alpha = mix(alpha, alpha * 1.22, sheet);
    widthPx = mix(widthPx, widthPx * 1.08, sheet);
  }

  speed *= uSpeedMul;
  float resX = max(uRes.x, 1.0);
  float resY = max(uRes.y, 1.0);
  float len = max(4.0, resY * lenH);

  float x = hx * (resX + 56.0) - 28.0;
  if (sheet > 0.5) {
    x += (hash(id * 17.31 + 4.7) - 0.5) * mix(8.0, 18.0, sheet);
    lenH *= mix(1.0, 0.82, sheet);
    len = max(4.0, resY * lenH);
  }
  float cycle = resY + len + 48.0;
  float phase = fract(h2 + uTime * (speed / cycle));
  float yHead = phase * cycle - len - 24.0;

  float gust = uGust * mix(0.55, 1.35, h4);
  float windAmt = (uWind + gust) * mix(0.4, 1.15, h3);
  /* 雨帘模式压低倾角：阵风只做轻微横移，保持近竖直 */
  float tilt = uTilt > 0.001 ? uTilt : 0.08;
  tilt *= mix(1.0, 0.32, sheet);
  vec2 dir = normalize(vec2(windAmt * tilt, 1.0));
  vec2 nrm = vec2(-dir.y, dir.x);

  float corner = aCorner;
  vec2 along = dir * (len * corner);
  vec2 pos = vec2(x, yHead) + along + nrm * (aSide * widthPx * 0.5);

  vec2 ndc = vec2(pos.x / resX, pos.y / resY) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  gl_Position = vec4(ndc, 0.0, 1.0);

  float layerMul = layer > 1.5 ? 1.0 : (layer > 0.5 ? 0.74 : 0.48);
  layerMul = mix(layerMul, layer > 1.5 ? 1.12 : (layer > 0.5 ? 0.9 : 0.62), sheet);
  vAlpha = alpha * uIntensity * layerMul;
  vEdge = corner;
  vLayer = layer;
  vSheet = sheet;
}
`;

  const FS = `
precision mediump float;
varying float vAlpha;
varying float vEdge;
varying float vLayer;
varying float vSheet;

float streakFade(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t <= 0.15) return mix(0.0, 0.25, t / 0.15);
  if (t <= 0.42) return mix(0.25, 0.46, (t - 0.15) / 0.27);
  if (t <= 0.72) return mix(0.46, 0.84, (t - 0.42) / 0.30);
  return mix(0.84, 1.0, (t - 0.72) / 0.28);
}

void main() {
  /* 尾(上)淡 → 中段低谷 → 头(下)亮；sheet 模式加亮银丝帘 */
  float fade = streakFade(vEdge);
  float sheet = clamp(vSheet, 0.0, 1.0);
  float a = vAlpha * fade * mix(1.0, 1.14, sheet);
  if (a < 0.005) discard;
  vec3 farC = mix(vec3(0.48, 0.62, 0.78), vec3(0.42, 0.58, 0.76), sheet);
  vec3 midC = mix(vec3(0.62, 0.76, 0.9), vec3(0.7, 0.82, 0.96), sheet);
  vec3 nearC = mix(vec3(0.82, 0.9, 0.98), vec3(0.9, 0.95, 1.0), sheet);
  vec3 col = mix(farC, midC, clamp(vLayer, 0.0, 1.0));
  col = mix(col, nearC, clamp(vLayer - 1.0, 0.0, 1.0));
  col = mix(col, vec3(0.78, 0.84, 0.98), smoothstep(0.72, 1.0, vEdge) * mix(0.06, 0.12, sheet));
  gl_FragColor = vec4(col * a, a);
}
`;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function createShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("[gpu-rain] shader", gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createProgram(gl) {
    const vs = createShader(gl, gl.VERTEX_SHADER, VS);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[gpu-rain] link", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{
   *   count?: number,
   *   speedMul?: number,
   *   wind?: number,
   *   dprCap?: number,
   *   wanderWind?: boolean,
   *   tilt?: number,
   *   sizeMul?: number,
   *   sheet?: number|boolean,
   * }} [opts]
   */
  function attach(canvas, opts = {}) {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      /* 暴雨贴屏玻璃要 html2canvas / 合成底图，需可读帧缓冲 */
      preserveDrawingBuffer: !!opts.sheet || !!opts.preserveDrawingBuffer,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    });
    if (!gl) return null;

    const prog = createProgram(gl);
    if (!prog) return null;

    const aId = gl.getAttribLocation(prog, "aId");
    const aCorner = gl.getAttribLocation(prog, "aCorner");
    const aSide = gl.getAttribLocation(prog, "aSide");
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uWind = gl.getUniformLocation(prog, "uWind");
    const uGust = gl.getUniformLocation(prog, "uGust");
    const uIntensity = gl.getUniformLocation(prog, "uIntensity");
    const uSpeedMul = gl.getUniformLocation(prog, "uSpeedMul");
    const uTilt = gl.getUniformLocation(prog, "uTilt");
    const uSizeMul = gl.getUniformLocation(prog, "uSizeMul");
    const uSheet = gl.getUniformLocation(prog, "uSheet");

    let count = Math.max(32, opts.count | 0 || 500);
    let speedMul = opts.speedMul ?? 1.16;
    /** 基准风速幅值（可正可负；setWind 更新） */
    let windBase = opts.wind ?? 0.32;
    /** 当前平滑风速（含换向） */
    let windLive = windBase;
    let windTarget = windBase;
    let windTimer = 0;
    let gustSpike = 0;
    const wanderWind = !!opts.wanderWind;
    let tilt = opts.tilt ?? (wanderWind ? 0.14 : 0.08);
    let sizeMul = opts.sizeMul ?? 1;
    let sheet = opts.sheet === true ? 1 : clamp(+opts.sheet || 0, 0, 1);
    let intensity = 1;
    let dprCap = opts.dprCap ?? 1.5;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let buf = null;
    let running = false;
    let raf = 0;
    let t0 = performance.now();
    let lastDraw = 0;
    let frameBudgetMs = 1000 / 30;
    /* 暴雨效果优先：opts.adaptive === false 时永不自动降档 */
    let adaptive = opts.adaptive !== false;
    let slowFrames = 0;
    const countCap = Math.max(7200, opts.countCap | 0 || 0);
    let contextLost = false;

    const rand = (a, b) => a + Math.random() * (b - a);

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      contextLost = true;
      running = false;
      cancelAnimationFrame(raf);
      console.warn("[gpu-rain] context lost");
    }, false);

    canvas.addEventListener("webglcontextrestored", () => {
      contextLost = false;
      console.warn("[gpu-rain] context restored — caller should recreate");
    }, false);

    const rebuildBuffer = () => {
      const data = new Float32Array(count * 6 * 3);
      let p = 0;
      for (let i = 0; i < count; i += 1) {
        const quad = [
          [0, -1], [0, 1], [1, -1],
          [1, -1], [0, 1], [1, 1],
        ];
        for (let v = 0; v < 6; v += 1) {
          data[p++] = i;
          data[p++] = quad[v][0];
          data[p++] = quad[v][1];
        }
      }
      if (!buf) buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    };

    const resize = (cssW, cssH) => {
      w = Math.max(1, cssW | 0);
      h = Math.max(1, cssH | 0);
      dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const bw = Math.max(1, Math.floor(w * dpr));
      const bh = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
    };

    const setCount = (n) => {
      count = clamp(n | 0, 48, countCap || 7200);
      rebuildBuffer();
    };

    rebuildBuffer();

    const draw = (now) => {
      if (!running || contextLost) return;
      raf = requestAnimationFrame(draw);
      if (w < 2 || h < 2) return;
      if (lastDraw && now - lastDraw < frameBudgetMs - 0.5) return;
      const dtMs = lastDraw ? now - lastDraw : frameBudgetMs;
      lastDraw = now;
      const dt = Math.min(0.05, dtMs / 1000);

      const t = (now - t0) / 1000;
      const mag = Math.max(0.18, Math.abs(windBase));

      /* 不规则风向：目标风速可换向；阵风尖峰叠加 */
      windTimer -= dt;
      if (windTimer <= 0) {
        if (wanderWind) {
          windTimer = rand(0.9, 2.8);
          const flip = Math.random() < 0.55;
          const sign = flip
            ? (Math.random() < 0.5 ? -1 : 1)
            : Math.sign(windLive || windBase || 1) || 1;
          windTarget = sign * mag * rand(0.55, 1.25);
          if (Math.random() < 0.42) {
            gustSpike = sign * mag * rand(0.55, 1.35);
          }
        } else {
          windTimer = rand(2.4, 5.2);
          const sign = Math.sign(windBase || 1) || 1;
          /* 大雨：同向为主，偶发轻柔反向 */
          windTarget = (Math.random() < 0.12 ? -sign : sign) * mag * rand(0.7, 1.15);
          if (Math.random() < 0.18) gustSpike = sign * mag * rand(0.25, 0.7);
        }
      }
      const ease = wanderWind ? 1.35 : 0.7;
      windLive += (windTarget - windLive) * Math.min(1, dt * ease);
      gustSpike *= Math.exp(-dt * (wanderWind ? 1.8 : 2.4));

      const waveGust = Math.sin(t * 0.7) * 0.35 * windLive
        + Math.sin(t * 1.37 + 1.2) * 0.18 * windLive
        + Math.sin(t * 2.9 + 0.4) * (wanderWind ? 0.2 : 0.08) * mag;
      const gust = waveGust + gustSpike;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(prog);

      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uWind, windLive);
      gl.uniform1f(uGust, gust);
      gl.uniform1f(uIntensity, intensity * (1 + (typeof window.__kayaStormFlash === "number"
        ? window.__kayaStormFlash * 0.38
        : 0)));
      gl.uniform1f(uSpeedMul, speedMul);
      gl.uniform1f(uTilt, tilt);
      gl.uniform1f(uSizeMul, sizeMul);
      gl.uniform1f(uSheet, sheet);

      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const stride = 12;
      gl.enableVertexAttribArray(aId);
      gl.vertexAttribPointer(aId, 1, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aCorner);
      gl.vertexAttribPointer(aCorner, 1, gl.FLOAT, false, stride, 4);
      gl.enableVertexAttribArray(aSide);
      gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, stride, 8);

      gl.drawArrays(gl.TRIANGLES, 0, count * 6);

      if (adaptive && dtMs > 40) {
        slowFrames += 1;
        if (slowFrames >= 10) {
          slowFrames = 0;
          if (count > 280) setCount(Math.round(count * 0.82));
          if (dprCap > 1.15) {
            dprCap = Math.max(1.15, dprCap - 0.15);
            resize(w, h);
          }
        }
      } else {
        slowFrames = Math.max(0, slowFrames - 1);
      }
    };

    return {
      resize,
      setCount,
      setIntensity(v) { intensity = clamp(v, 0, 1); },
      setWind(v) {
        windBase = v;
        if (!wanderWind) {
          windTarget = v;
          if (Math.abs(windLive) < 0.05) windLive = v;
        }
      },
      getWind() { return windLive; },
      setTilt(v) { tilt = Math.max(0.04, v); },
      setSizeMul(v) { sizeMul = Math.max(0.55, v); },
      setSheet(v) { sheet = clamp(+v || 0, 0, 1); },
      setSpeedMul(v) { speedMul = Math.max(0.2, v); },
      setFrameBudget(ms) { frameBudgetMs = ms; },
      setAdaptive(on) { adaptive = !!on; },
      start() {
        if (running || contextLost) return;
        if (w < 2 || h < 2) {
          resize(window.innerWidth || 1, window.innerHeight || 1);
        }
        running = true;
        t0 = performance.now();
        lastDraw = 0;
        windTimer = 0;
        raf = requestAnimationFrame(draw);
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        if (!contextLost) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
      },
      destroy() {
        this.stop();
        if (buf) gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
        try { gl.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* ignore */ }
      },
      get count() { return count; },
      get ok() { return !contextLost; },
    };
  }

  window.KayaGpuStreakRain = { attach };
})();
