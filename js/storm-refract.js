/**
 * 时雨榧 · 暴雨全屏 WebGL 折射层
 * 参考 Codrops RainEffect / Radiant water-map：采样页面快照 + 程序化水珠法线偏移 UV。
 * 挂载在 body（z-index 45），叠在正文之上、site-fx 部分层之下。
 */
(() => {
  const VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  const FS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texSize;
uniform float u_time;
uniform float u_intensity;
uniform float u_flash;
uniform float u_wind;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 dropLens(vec2 uv, vec2 center, float radius) {
  vec2 d = uv - center;
  float dist = length(d);
  if (dist >= radius) return vec2(0.0);
  float t = dist / max(radius, 0.0001);
  float h = cos(t * 1.5707963);
  return normalize(d + vec2(0.0001, 0.0)) * h * radius * 1.15;
}

vec2 waterField(vec2 uv) {
  vec2 off = vec2(0.0);
  off += dropLens(uv, vec2(0.1 + sin(u_time * 0.28) * 0.04, 0.07), 0.09);
  off += dropLens(uv, vec2(0.92, 0.14 + cos(u_time * 0.22) * 0.05), 0.075);
  off += dropLens(uv, vec2(0.5 + u_wind * 0.06, 0.92), 0.11);
  off += dropLens(uv, vec2(0.22 + sin(u_time * 0.35) * 0.08, 0.55), 0.055);
  off += dropLens(uv, vec2(0.78 + cos(u_time * 0.31) * 0.07, 0.48), 0.05);

  vec2 g1 = floor(uv * 14.0 + vec2(u_time * 0.12, -u_time * 0.09));
  vec2 r1 = vec2(hash(g1), hash(g1 + 3.7));
  vec2 c1 = (g1 + r1) / 14.0;
  off += dropLens(uv, c1, 0.01 + r1.x * 0.012) * 0.42;

  vec2 g2 = floor(uv * 22.0 + vec2(-u_time * 0.08, u_time * 0.11));
  vec2 r2 = vec2(hash(g2 + 9.1), hash(g2 + 2.3));
  vec2 c2 = (g2 + r2) / 22.0;
  off += dropLens(uv, c2, 0.006 + r2.y * 0.009) * 0.35;

  off += vec2(
    noise(uv * 9.0 + vec2(u_time * 0.18, 0.0)) - 0.5,
    noise(uv * 9.0 + vec2(0.0, u_time * 0.16)) - 0.5
  ) * 0.0055;

  return off;
}

void main() {
  vec2 uv = v_uv;
  vec2 off = waterField(uv);
  float amp = u_intensity * (1.0 + u_flash * 0.45);
  off *= amp;

  vec2 px = vec2(1.0) / max(u_texSize, vec2(1.0));
  vec2 suv = clamp(uv + off, px, 1.0 - px);
  vec4 col = texture2D(u_tex, suv);

  float refr = length(off) * 14.0;
  float fres = pow(1.0 - abs(dot(normalize(vec3(off, 0.12)), vec3(0.0, 0.0, 1.0))), 2.2);
  float edge = smoothstep(0.0, 0.18, uv.y) * smoothstep(0.0, 0.12, 1.0 - uv.y);
  float alpha = clamp(0.1 + refr * 0.55 + fres * 0.08, 0.0, 0.38) * amp * mix(0.72, 1.0, edge);

  vec3 hi = vec3(0.92, 0.96, 1.0) * fres * u_flash * 0.22;
  gl_FragColor = vec4(col.rgb + hi, alpha);
}`;

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  /**
   * @param {{ getSource?: () => { canvas?: HTMLCanvasElement, w?: number, h?: number } | null }} [opts]
   */
  function attach(opts = {}) {
    const getSource = opts.getSource || (() => null);

    const canvas = document.createElement("canvas");
    canvas.className = "site-fx__storm-refract";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      desynchronized: true,
    }) || canvas.getContext("experimental-webgl", { alpha: true });
    if (!gl) {
      canvas.remove();
      return null;
    }

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn("[kaya] storm-refract shader", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) {
      canvas.remove();
      return null;
    }
    const prog = gl.createProgram();
    if (!prog) {
      canvas.remove();
      return null;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[kaya] storm-refract link", gl.getProgramInfoLog(prog));
      canvas.remove();
      return null;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTex = gl.getUniformLocation(prog, "u_tex");
    const uTexSize = gl.getUniformLocation(prog, "u_texSize");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uIntensity = gl.getUniformLocation(prog, "u_intensity");
    const uFlash = gl.getUniformLocation(prog, "u_flash");
    const uWind = gl.getUniformLocation(prog, "u_wind");

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let w = 0;
    let h = 0;
    let dpr = 1;
    let intensity = 0;
    let enabled = true;
    let wind = 0;
    let time = 0;
    let lastTexAt = 0;

    const fit = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      if (window.visualViewport) {
        w = Math.round(window.visualViewport.width);
        h = Math.round(window.visualViewport.height);
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(1, Math.floor(w * dpr));
      const ch = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      gl.viewport(0, 0, cw, ch);
    };

    const uploadSource = (force = false) => {
      const now = performance.now();
      if (!force && now - lastTexAt < 28) return;
      const src = getSource();
      const c = src?.canvas;
      if (!c || c.width < 2 || c.height < 2) return;
      lastTexAt = now;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.uniform1i(uTex, 0);
      gl.uniform2f(uTexSize, c.width, c.height);
    };

    const draw = (dt) => {
      if (!enabled || intensity < 0.04 || w < 2) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      time += dt || 0.016;
      uploadSource();
      const flash = typeof window.__kayaStormFlash === "number" ? window.__kayaStormFlash : 0;
      gl.useProgram(prog);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uIntensity, intensity);
      gl.uniform1f(uFlash, flash);
      gl.uniform1f(uWind, wind);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    fit();

    return {
      resize: fit,
      setIntensity(v) {
        intensity = clamp(v, 0, 1);
        canvas.classList.toggle("is-on", enabled && intensity > 0.04);
      },
      setWind(v) { wind = v; },
      setEnabled(on) {
        enabled = !!on;
        canvas.classList.toggle("is-on", enabled && intensity > 0.04);
      },
      draw,
      refreshTexture() { uploadSource(true); },
      clear() {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      },
      destroy() {
        gl.deleteTexture(tex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        canvas.remove();
      },
    };
  }

  window.KayaStormRefract = { attach };
})();
