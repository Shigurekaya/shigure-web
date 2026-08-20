/**
 * 时雨榧 · 大雨特效（尽量贴近小米天气「暴雨」）
 * 分层：暴雨云氛围(CSS) → 背景雨丝(WebGL) → UI → 前景雨丝/玻璃折射水珠(WebGL) → 卡片溅花(Canvas)
 * 玻璃水珠参考 Heartfelt 程序化水滴场 + 法线折射（社区/技术文通用方案）
 */
(() => {
  const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uIntensity;

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p){
  float n = hash12(p);
  return vec2(n, hash12(p + 27.13));
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return v;
}

/* Heartfelt 风格：主水珠 + 拖尾 */
vec2 dropLayer(vec2 uv, float t, float gridY, float speed){
  vec2 a = vec2(6.0, gridY);
  vec2 uv2 = uv * a;
  vec2 id = floor(uv2);
  uv2.y += t * speed;
  float colShift = hash12(vec2(id.x, 7.1));
  uv2.y += colShift;
  id = floor(uv2);
  vec2 gv = fract(uv2) - vec2(0.5, 0.0);
  vec3 n = vec3(hash12(id), hash12(id + 19.2), hash12(id + 47.8));
  float x = (n.x - 0.5) * 0.7;
  float yWave = sin(uv.y * 10.0 + n.z * 6.28) * 0.08 * n.y;
  x += yWave;
  float ti = fract(t * 0.15 + n.z);
  float y = (smoothstep(0.0, 0.85, ti) - 0.5) * 0.9 + 0.5;
  vec2 p = vec2(x, y);
  float d = length((gv - p) * vec2(1.0, a.x / a.y));
  float mainDrop = smoothstep(0.38, 0.0, d);
  float r = sqrt(smoothstep(1.0, y, gv.y));
  float cd = abs(gv.x - x);
  float trail = smoothstep(0.22 * r, 0.1 * r * r, cd);
  float trailFront = smoothstep(-0.02, 0.05, gv.y - y);
  trail *= trailFront * r * r;
  float droplets = 0.0;
  float yy = uv.y * 12.0 + n.z * 20.0;
  float trail2 = smoothstep(0.2 * r, 0.0, cd);
  droplets = max(0.0, (sin(yy) - gv.y)) * trail2 * trailFront * n.y;
  float dd = length(gv - vec2(x, fract(yy) - 0.5));
  droplets = smoothstep(0.28, 0.0, dd) * trailFront * r;
  float m = mainDrop + droplets * 0.65;
  return vec2(m, trail);
}

vec2 staticDrops(vec2 uv, float t){
  uv *= 42.0;
  vec2 id = floor(uv);
  uv = fract(uv) - 0.5;
  vec2 n = hash22(id);
  /* 约 55% 格子有珠，贴近参考片密度 */
  if (n.y > 0.58) return vec2(0.0);
  float p = sin(n.x * 6.28 + t * 0.05) * 0.015;
  vec2 center = (n - 0.5) * 0.55;
  float d = length(uv - center - vec2(p, 0.0));
  float r = 0.08 + n.x * 0.16;
  float drop = smoothstep(r, r * 0.5, d);
  return vec2(drop, 0.0);
}

vec2 rainNormal(vec2 uv, float t){
  float asp = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * asp, uv.y - 0.5) + 0.5;
  vec2 s1 = staticDrops(p * 1.15, t);
  vec2 s2 = staticDrops(p * 1.85 + 0.37, t * 1.1);
  vec2 d1 = dropLayer(p, t, 12.0, 0.75);
  vec2 d2 = dropLayer(p * 1.35 + 0.13, t * 1.05, 16.0, 0.95);
  vec2 d3 = dropLayer(p * 0.85 - 0.07, t * 0.9, 9.5, 0.55);
  float drop = s1.x * 0.85 + s2.x * 0.55 + d1.x * 0.9 + d2.x * 0.55 + d3.x * 0.35;
  float trail = d1.y * 0.7 + d2.y * 0.45 + d3.y * 0.25;
  /* 数值梯度 → 屏幕空间法线 */
  float e = 1.5 / max(uRes.y, 1.0);
  vec2 dx = vec2(e, 0.0);
  vec2 dy = vec2(0.0, e);
  float ddx = (staticDrops((p + dx) * 1.15, t).x + dropLayer(p + dx, t, 12.0, 0.75).x)
            - (staticDrops((p - dx) * 1.15, t).x + dropLayer(p - dx, t, 12.0, 0.75).x);
  float ddy = (staticDrops((p + dy) * 1.15, t).x + dropLayer(p + dy, t, 12.0, 0.75).x)
            - (staticDrops((p - dy) * 1.15, t).x + dropLayer(p - dy, t, 12.0, 0.75).x);
  return vec2(drop + trail * 0.35, length(vec2(ddx, ddy)));
}

vec3 stormBg(vec2 uv, float t){
  vec2 p = uv * vec2(1.6, 1.0);
  float n = fbm(p * 2.2 + vec2(0.0, t * 0.02));
  float n2 = fbm(p * 4.0 - vec2(t * 0.015, 0.0));
  vec3 c0 = vec3(0.07, 0.10, 0.16);
  vec3 c1 = vec3(0.16, 0.22, 0.32);
  vec3 c2 = vec3(0.28, 0.36, 0.48);
  vec3 col = mix(c0, c1, n);
  col = mix(col, c2, n2 * 0.45);
  col += vec3(0.05, 0.07, 0.1) * smoothstep(0.45, 0.9, n);
  /* 底部更暗 */
  col *= mix(0.75, 1.05, uv.y);
  return col;
}

/* 下落雨丝：短密、近乎竖直、冷白 */
float rainStreaks(vec2 uv, float t, float dens, float len, float speed, float alpha){
  float asp = uRes.x / max(uRes.y, 1.0);
  vec2 p = vec2(uv.x * asp, uv.y);
  float cols = dens;
  float x = p.x * cols;
  float id = floor(x);
  float f = fract(x);
  float rnd = hash12(vec2(id, 3.1));
  float y = fract(p.y + t * speed + rnd);
  float cx = abs(f - 0.5);
  float streak = smoothstep(0.028, 0.0, cx);
  float head = smoothstep(len, 0.0, y) * smoothstep(0.0, len * 0.2, y);
  return streak * head * alpha * (0.55 + 0.45 * hash12(vec2(id, 9.7)));
}

void main(){
  vec2 uv = vUv;
  float t = uTime;
  float inten = clamp(uIntensity, 0.0, 1.5);

  /* 玻璃法线 / 水珠强度 */
  vec2 rn = rainNormal(uv, t);
  float drop = rn.x * inten;
  float nlen = rn.y;

  /* 折射采样暴雨云 */
  vec2 offset = vec2(nlen) * vec2(0.04, 0.055) * inten;
  vec3 refr;
  refr.r = stormBg(uv + offset * 1.12, t).r;
  refr.g = stormBg(uv + offset, t).g;
  refr.b = stormBg(uv + offset * 0.85, t).b;

  vec3 baseStorm = stormBg(uv, t);
  vec3 glass = mix(baseStorm, refr, smoothstep(0.02, 0.55, drop));

  /* 高光（凸透镜） */
  float spec = pow(smoothstep(0.12, 0.65, drop), 2.2) * (0.25 + 0.75 * smoothstep(0.0, 0.08, nlen));
  glass += vec3(0.88, 0.94, 1.0) * spec * 0.75;

  /*
   * 参考片：倾角≈0，长度中位≈0.64%屏高，密度≈223条/MPx
   * dens↑ = 更密短帘；len 取屏高比例
   */
  float streaks =
      rainStreaks(uv, t, 150.0, 0.007, 1.85, 0.28 * inten) +
      rainStreaks(uv + vec2(0.13, 0.0), t * 1.07, 110.0, 0.012, 1.35, 0.38 * inten) +
      rainStreaks(uv + vec2(0.27, 0.0), t * 0.94, 75.0, 0.02, 0.95, 0.5 * inten) +
      rainStreaks(uv + vec2(0.41, 0.0), t * 1.12, 55.0, 0.028, 0.72, 0.42 * inten);
  glass += vec3(0.86, 0.93, 1.0) * min(streaks, 1.0);

  /* 雾 */
  float mist = fbm(uv * 2.5 + vec2(0.0, t * 0.03)) * 0.14 * inten;
  glass = mix(glass, vec3(0.42, 0.52, 0.64), mist);

  float alpha = clamp(
      drop * 0.62 +
      streaks * 0.62 +
      mist * 0.4 +
      spec * 0.3,
      0.0, 0.88) * inten;

  glass *= 0.94;
  fragColor = vec4(glass, alpha);
}`;

  function createGL(canvas) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) return null;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("[heavy-rain]", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[heavy-rain]", gl.getProgramInfoLog(prog));
      return null;
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, "aPos");
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uIntensity = gl.getUniformLocation(prog, "uIntensity");

    return {
      gl,
      draw(w, h, time, intensity) {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const cw = Math.max(1, Math.floor(w * dpr));
        const ch = Math.max(1, Math.floor(h * dpr));
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }
        gl.viewport(0, 0, cw, ch);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(uRes, cw, ch);
        gl.uniform1f(uTime, time);
        gl.uniform1f(uIntensity, intensity);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      destroy() {
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(buf);
      },
    };
  }

  /**
   * @param {HTMLElement} fxRoot
   * @param {{ getLedges: () => Array<{x:number,y:number,w:number,radius:number}> }} opts
   */
  function attach(fxRoot, opts) {
    const glCanvas = document.createElement("canvas");
    glCanvas.className = "site-fx__gl";
    glCanvas.setAttribute("aria-hidden", "true");
    const splashCanvas = document.createElement("canvas");
    splashCanvas.className = "site-fx__splash";
    splashCanvas.setAttribute("aria-hidden", "true");
    const mist = document.createElement("div");
    mist.className = "site-fx__mist";
    fxRoot.appendChild(mist);
    fxRoot.appendChild(glCanvas);
    fxRoot.appendChild(splashCanvas);

    const renderer = createGL(glCanvas);
    const sctx = splashCanvas.getContext("2d", { alpha: true });
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = false;
    let t0 = performance.now();
    let last = t0;
    let splashAcc = 0;
    const splashes = [];
    const rims = [];
    const FRAME_MS = 1000 / 30;
    const FADE_SEC = 0.85;
    let intensity = 0;
    let targetIntensity = 0;
    let stopTimer = 0;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      splashCanvas.width = Math.floor(w * dpr);
      splashCanvas.height = Math.floor(h * dpr);
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnSplash = (ledge) => {
      if (intensity < 0.15) return;
      const inset = Math.min(ledge.radius * 0.7, ledge.w * 0.08);
      const x = ledge.x + inset + Math.random() * Math.max(4, ledge.w - inset * 2);
      const y = ledge.y + Math.random() * 1.2;
      const n = 5 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i += 1) {
        const ang = -Math.PI * 0.05 - Math.random() * Math.PI * 0.9;
        const spd = 70 + Math.random() * 130;
        splashes.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.16 + Math.random() * 0.28,
          age: 0,
          r: 0.8 + Math.random() * 2.0,
          kind: "spark",
        });
      }
      if (Math.random() < 0.65) {
        splashes.push({
          x, y: y + 1,
          vx: 0, vy: 0,
          life: 0.18 + Math.random() * 0.22,
          age: 0,
          r: 4 + Math.random() * 6,
          kind: "ring",
        });
      }
      rims.push({
        x, y: y + 0.6,
        life: 0.5 + Math.random() * 0.7,
        age: 0,
        w: 8 + Math.random() * 18,
        a: 0.4 + Math.random() * 0.4,
      });
    };

    const hardStop = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(stopTimer);
      splashes.length = 0;
      rims.length = 0;
      intensity = 0;
      targetIntensity = 0;
      if (sctx) sctx.clearRect(0, 0, w, h);
    };

    const tick = (now) => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < FRAME_MS) return;
      const dt = Math.min(0.05, elapsed / 1000);
      last = now;
      const time = (now - t0) / 1000;

      const dir = Math.sign(targetIntensity - intensity);
      if (dir !== 0) {
        intensity += dir * (dt / FADE_SEC);
        if ((dir > 0 && intensity >= targetIntensity) || (dir < 0 && intensity <= targetIntensity)) {
          intensity = targetIntensity;
        }
      }

      if (renderer) renderer.draw(w, h, time, intensity);
      if (!sctx) return;

      sctx.clearRect(0, 0, w, h);
      if (intensity <= 0.001) return;

      const ledges = opts.getLedges() || [];
      const aMul = intensity;

      for (let i = 0; i < ledges.length; i += 1) {
        const L = ledges[i];
        const pulse = 0.5 + 0.5 * Math.sin(time * 5.5 + i * 1.3);
        const g = sctx.createLinearGradient(L.x, L.y, L.x + L.w, L.y);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.12, `rgba(210,230,255,${0.12 * pulse * aMul})`);
        g.addColorStop(0.5, `rgba(255,255,255,${0.28 * pulse * aMul})`);
        g.addColorStop(0.88, `rgba(210,230,255,${0.12 * pulse * aMul})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        sctx.fillStyle = g;
        sctx.fillRect(L.x, L.y - 0.5, L.w, 2.4);
      }

      splashAcc += dt;
      const rate = Math.min(26, 5 + ledges.length * 1.1) * intensity;
      while (splashAcc > 1 / Math.max(rate, 0.01) && ledges.length) {
        splashAcc -= 1 / Math.max(rate, 0.01);
        spawnSplash(ledges[(Math.random() * ledges.length) | 0]);
      }

      for (let i = rims.length - 1; i >= 0; i -= 1) {
        const r = rims[i];
        r.age += dt;
        const p = 1 - r.age / r.life;
        if (p <= 0) { rims.splice(i, 1); continue; }
        sctx.fillStyle = `rgba(255,255,255,${r.a * p * aMul})`;
        sctx.beginPath();
        sctx.ellipse(r.x, r.y, r.w * 0.5, 1.2 + (1 - p), 0, 0, Math.PI * 2);
        sctx.fill();
      }

      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        const s = splashes[i];
        s.age += dt;
        const p = 1 - s.age / s.life;
        if (p <= 0) { splashes.splice(i, 1); continue; }
        if (s.kind === "ring") {
          sctx.strokeStyle = `rgba(230,245,255,${0.6 * p * aMul})`;
          sctx.lineWidth = 1.2;
          sctx.beginPath();
          sctx.arc(s.x, s.y, s.r * (0.3 + (1 - p) * 1.5), Math.PI * 1.02, Math.PI * 1.98);
          sctx.stroke();
        } else {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.vy += 280 * dt;
          sctx.fillStyle = `rgba(255,255,255,${0.8 * p * aMul})`;
          sctx.beginPath();
          sctx.arc(s.x, s.y, s.r * (0.65 + p * 0.45), 0, Math.PI * 2);
          sctx.fill();
        }
      }
    };

    return {
      start() {
        window.clearTimeout(stopTimer);
        targetIntensity = 1;
        if (!running) {
          running = true;
          resize();
          if (intensity <= 0) intensity = 0.02;
          t0 = performance.now();
          last = t0;
          raf = requestAnimationFrame(tick);
        }
      },
      stop() {
        targetIntensity = 0;
        window.clearTimeout(stopTimer);
        stopTimer = window.setTimeout(hardStop, FADE_SEC * 1000 + 80);
      },
      resize,
      destroy() {
        hardStop();
        renderer?.destroy();
        glCanvas.remove();
        splashCanvas.remove();
        mist.remove();
      },
    };
  }

  window.KayaHeavyRain = { attach };
})();
