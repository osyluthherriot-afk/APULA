"use client";

import React, { useEffect, useRef } from "react";
import { useApulaTheme } from "@/context/ThemeContext";

export interface CosmicNebulaShaderProps {
  airflowCmS?: number;
}

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_flow;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    value += amp * noise(p);
    p = rot * p * 2.03 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return value;
}

vec3 starLayer(vec2 suv, float timeVal, float seedOffset, float glintChance) {
  vec2 gv = fract(suv) - 0.5;
  vec2 id = floor(suv);
  float h = hash21(id + seedOffset);
  if (h < 0.74) {
    return vec3(0.0);
  }

  float h2 = fract(h * 37.91);
  float h3 = fract(h * 91.17);
  vec2 jitter = (vec2(h2, h3) - 0.5) * 0.62;
  vec2 dp = gv - jitter;
  float dist = length(dp);

  float twinkle = 0.65 + 0.35 * sin(timeVal * (2.6 + h2 * 1.4) + h * 6.28318);
  float radiusMask = smoothstep(0.42, 0.0, dist);
  float core = exp(-dist * dist * (140.0 + h3 * 120.0)) * radiusMask;

  // 4-point diffraction cross-glints on brightest stars without cell-edge clipping.
  float rawCross = 1.0 / (abs(dp.x * dp.y) * 3000.0 + 0.45);
  float glint = step(glintChance, h) * min(0.75, rawCross * 0.16) * radiusMask;

  vec3 blueWhite = vec3(0.74, 0.88, 1.0);
  vec3 warmGold = vec3(1.0, 0.85, 0.64);
  vec3 tint = mix(blueWhite, warmGold, step(0.56, h2));

  return tint * (core * (0.55 + h3 * 0.6) + glint) * twinkle;
}

void main() {
  vec2 st = gl_FragCoord.xy / max(u_resolution, vec2(1.0));
  float minDim = min(u_resolution.x, u_resolution.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / max(minDim, 1.0);

  vec2 mouseShift = (u_mouse - 0.5) * 0.08;
  float flowFactor = 1.0 + clamp(u_flow, 0.0, 60.0) * 0.025;
  float warpT = u_time * 0.035 * flowFactor;

  // 5-octave domain-warped fBm nebula clouds matching the cosmic APULA palette.
  vec2 p = uv * 2.15 + mouseShift * 0.6;
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0) + vec2(warpT, -warpT * 0.45)),
    fbm(p + vec2(5.2, 1.3) + vec2(-warpT * 0.6, warpT * 0.35))
  );
  vec2 r = vec2(
    fbm(p + 2.35 * q + vec2(1.7, 9.2) + 0.65 * warpT),
    fbm(p + 2.35 * q + vec2(8.3, 2.8) - 0.55 * warpT)
  );
  float f = fbm(p + 2.1 * r);

  vec3 voidCol = vec3(0.027, 0.020, 0.063);
  vec3 violetMagenta = vec3(0.55, 0.22, 0.68);
  vec3 solarAmber = vec3(0.88, 0.36, 0.25);
  vec3 sapphire = vec3(0.12, 0.42, 0.88);

  vec3 col = mix(voidCol, sapphire * 0.55, smoothstep(0.18, 0.72, f));
  col = mix(col, violetMagenta * 0.68, smoothstep(0.32, 0.84, q.x) * 0.72);
  col = mix(col, solarAmber * 0.62, smoothstep(0.45, 0.92, r.y * f * 1.45) * 0.58);

  // Preserve deep obsidian contrast across the viewport so glass cards stay legible.
  float ridge = smoothstep(0.25, 0.85, f + 0.35 * length(q - 0.5));
  col = mix(voidCol, col, 0.45 + 0.55 * ridge);

  // 3-layer parallax drifting & twinkling starfield.
  float starTime = u_time * (1.0 + clamp(u_flow, 0.0, 60.0) * 0.015);
  vec3 stars = vec3(0.0);
  stars += starLayer((uv + mouseShift * 0.35 + u_time * vec2(0.004, 0.002) * flowFactor) * 9.0, starTime, 11.3, 0.955) * 0.65;
  stars += starLayer((uv + mouseShift * 0.65 + u_time * vec2(0.007, 0.0035) * flowFactor) * 16.0, starTime, 27.9, 0.972) * 0.80;
  stars += starLayer((uv + mouseShift * 1.05 + u_time * vec2(0.011, 0.0055) * flowFactor) * 26.0, starTime, 53.7, 0.985) * 0.95;
  col += stars;

  // Animated top-right spectral prism ray (uv.x > 0.55 && uv.y > 0.55 in screen space).
  float trMask = smoothstep(0.46, 0.74, st.x) * smoothstep(0.46, 0.74, st.y);
  if (st.x > 0.55 && st.y > 0.55) {
    float diag = (st.x - 0.55) * 1.25 - (st.y - 0.55) * 0.95;
    float rayEnv = exp(-abs(diag - 0.05) * 9.5) * trMask;
    float shimmer = 0.72 + 0.28 * sin(u_time * 1.35 + st.x * 12.0 - st.y * 8.0);
    float band = (diag + 0.25) * 3.2 + sin(u_time * 0.55) * 0.35;
    vec3 specCyan = vec3(0.14, 0.88, 0.95);
    vec3 specEmerald = vec3(0.22, 0.86, 0.56);
    vec3 specGold = vec3(1.0, 0.78, 0.24);
    vec3 specMagenta = vec3(0.95, 0.28, 0.76);
    vec3 prism = mix(specCyan, specEmerald, clamp(band, 0.0, 1.0));
    prism = mix(prism, specGold, clamp(band - 0.85, 0.0, 1.0));
    prism = mix(prism, specMagenta, clamp(band - 1.65, 0.0, 1.0));
    col += prism * rayEnv * shimmer * 0.42;
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export default function CosmicNebulaShader({
  airflowCmS = 10,
}: CosmicNebulaShaderProps) {
  const { theme, reducedMotion } = useApulaTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const flowRef = useRef(airflowCmS);
  const reducedMotionRef = useRef(reducedMotion);
  const mouseTargetRef = useRef({ x: 0.5, y: 0.5 });
  const mouseCurrentRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    flowRef.current = airflowCmS;
  }, [airflowCmS]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    if (theme !== "glass") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const contextOptions: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    };

    const gl =
      (canvas.getContext("webgl2", contextOptions) as WebGLRenderingContext | null) ||
      (canvas.getContext("webgl", contextOptions) as WebGLRenderingContext | null);
    if (!gl) return;

    const vert = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vert || !frag) {
      if (vert) gl.deleteShader(vert);
      if (frag) gl.deleteShader(frag);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      return;
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      return;
    }

    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPosLoc = gl.getAttribLocation(program, "a_position");
    const uResLoc = gl.getUniformLocation(program, "u_resolution");
    const uTimeLoc = gl.getUniformLocation(program, "u_time");
    const uMouseLoc = gl.getUniformLocation(program, "u_mouse");
    const uFlowLoc = gl.getUniformLocation(program, "u_flow");

    let width = 1;
    let height = 1;
    const syncCanvasSize = () => {
      const renderScale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;
      width = Math.max(1, Math.floor(window.innerWidth * renderScale));
      height = Math.max(1, Math.floor(window.innerHeight * renderScale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };
    syncCanvasSize();

    let rafId = 0;
    let simTime = 0;
    let lastTimestamp = performance.now();

    const drawFrame = () => {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      if (aPosLoc >= 0) {
        gl.enableVertexAttribArray(aPosLoc);
        gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
      }
      if (uResLoc) gl.uniform2f(uResLoc, width, height);
      if (uTimeLoc) gl.uniform1f(uTimeLoc, simTime);
      if (uMouseLoc) {
        gl.uniform2f(
          uMouseLoc,
          mouseCurrentRef.current.x,
          mouseCurrentRef.current.y
        );
      }
      if (uFlowLoc) gl.uniform1f(uFlowLoc, flowRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const tick = (now: number) => {
      if (document.hidden || reducedMotionRef.current) {
        rafId = 0;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.0, (now - lastTimestamp) / 1000));
      lastTimestamp = now;
      simTime += dt;

      mouseCurrentRef.current.x +=
        (mouseTargetRef.current.x - mouseCurrentRef.current.x) * 0.06;
      mouseCurrentRef.current.y +=
        (mouseTargetRef.current.y - mouseCurrentRef.current.y) * 0.06;

      drawFrame();
      rafId = window.requestAnimationFrame(tick);
    };

    const startOrPauseLoop = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      drawFrame();
      if (!document.hidden && !reducedMotionRef.current) {
        lastTimestamp = performance.now();
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (window.innerWidth <= 0 || window.innerHeight <= 0) return;
      mouseTargetRef.current.x = event.clientX / window.innerWidth;
      mouseTargetRef.current.y = 1.0 - event.clientY / window.innerHeight;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
      } else {
        startOrPauseLoop();
      }
    };

    const handleResize = () => {
      syncCanvasSize();
      drawFrame();
    };

    startOrPauseLoop();

    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (quadBuffer) gl.deleteBuffer(quadBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [theme, reducedMotion]);

  if (theme !== "glass") {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-cosmic-shader="active"
      className="fixed inset-0 h-full w-full pointer-events-none z-0"
    />
  );
}
