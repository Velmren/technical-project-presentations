// Assembly mosaic: a real screen of a work built from a grid of tiles. Tiles fly in on load, flip in a
// wave to the next work, and lift under the pointer to show the interface structure underneath.
// Everything per tile is computed in the vertex shader; the loop renders only while something moves.

export type MosaicSource = { color: string; structure: string; accent: [number, number, number] };
export type Mosaic = {
  show(index: number, direction: 1 | -1, origin?: [number, number]): void;
  point(x: number, y: number): void;
  leave(): void;
  drag(dx: number, dy: number): void;
  release(vx: number, vy: number): void;
  nudge(dx: number, dy: number): void;
  structure(on: boolean): void;
  frame(rect: { x: number; y: number; width: number; height: number }): void;
  reset(): void;
  dispose(): void;
};
type Options = { sources: MosaicSource[]; cols: number; rows: number; reduced: boolean; maxRatio: number; onFirstFrame?: () => void; onLost?: () => void };

const BOARD_W = 1.6;

const VERTEX = `
attribute vec2 aCorner;
attribute vec2 aTile;
attribute float aSeed;
uniform vec2 uGrid, uCanvas, uRot, uFlipOrigin;
uniform vec3 uFrame, uLens;
uniform float uD, uIntro, uFlip, uStructure;
varying vec2 vUvA, vUvB, vLocal;
varying float vBack, vShade, vBlue, vAlpha, vLift;

float h(float n) { return fract(sin(n) * 43758.5453); }
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
vec3 board(vec3 p) { return rotX(rotY(p, uRot.x), uRot.y); }
vec2 project(vec3 p) { float w = (uD - p.z) / uD; return uFrame.xy + p.xy * uFrame.z / w; }

void main() {
  vec2 size = vec2(${BOARD_W.toFixed(2)}, 1.0) / uGrid;
  vec2 center = vec2(-${(BOARD_W / 2).toFixed(2)}, -0.5) + (aTile + 0.5) * size;
  float s1 = h(aSeed * 91.7), s2 = h(aSeed * 13.3 + 4.1), s3 = h(aSeed * 57.1 + 9.7);

  // Intro: tiles arrive from a loose cloud, the left side first.
  float order = aTile.x / uGrid.x * 0.55 + aTile.y / uGrid.y * 0.25 + s1 * 0.2;
  float ip = clamp((uIntro - order * 0.75) / 0.6, 0.0, 1.0);
  ip = 1.0 - pow(1.0 - ip, 3.0);

  // Flip wave from the origin; the back face already carries the next work.
  float dist = length(center - uFlipOrigin) / 1.9;
  float fp = clamp((uFlip * 1.75 - dist * 0.95 - s2 * 0.1) / 0.42, 0.0, 1.0);
  fp = fp * fp * (3.0 - 2.0 * fp);
  float angle = fp * 3.14159265;

  // Structure layer: a sweep across the board, or a lens around the pointer.
  float sp = clamp((uStructure * 1.5 - aTile.x / uGrid.x * 0.4 - s3 * 0.1) / 0.5, 0.0, 1.0);
  vec2 centerPx = project(board(vec3(center, 0.0)));
  float r = uFrame.z * 0.2;
  vec2 dp = centerPx - uLens.xy;
  float lens = uLens.z * exp(-dot(dp, dp) / (2.0 * r * r));

  float scale = 1.004 - lens * 0.2 - sin(angle) * 0.08;
  vec3 local = vec3(aCorner * size * scale, 0.0);
  local = rotX(local, angle);
  // Lifted tiles tilt away from the lens centre like a pressed dome.
  vec2 away = normalize(dp + 0.0001);
  local = rotY(rotX(local, -away.y * lens * 0.55), away.x * lens * 0.55);
  vec3 pos = vec3(center, 0.0) + local + vec3(0.0, 0.0, lens * 0.16 + sin(angle) * 0.05);

  vec3 cloud = vec3(center * 2.3, 0.0) + (vec3(s1, s2, s3) - 0.5) * vec3(2.2, 1.5, 2.6) + vec3(0.0, 0.0, 0.6);
  vec3 spun = rotY(rotX(local, (s2 - 0.5) * 7.0 * (1.0 - ip)), (s3 - 0.5) * 7.0 * (1.0 - ip));
  pos = mix(cloud + spun, pos, ip);

  vec2 px = project(board(pos));
  gl_Position = vec4(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0, 0.0, 1.0);

  vUvA = (aTile + 0.5 + aCorner) / uGrid;
  vUvB = (aTile + 0.5 + vec2(aCorner.x, -aCorner.y)) / uGrid;
  vLocal = aCorner;
  vBack = step(1.5707963, angle);
  vShade = 0.62 + 0.38 * abs(cos(angle)) - lens * 0.08;
  vBlue = max(lens * 1.15, sp);
  vLift = max(lens, sin(angle));
  vAlpha = smoothstep(0.0, 0.2, ip);
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D uColorA, uColorB, uStructA, uStructB;
uniform vec3 uAccentA, uAccentB;
uniform float uFade;
varying vec2 vUvA, vUvB, vLocal;
varying float vBack, vShade, vBlue, vAlpha, vLift;

void main() {
  // A slight negative mip bias keeps text on the boards crisp when the board is shown a little smaller
  // than its texture; trilinear filtering alone blends in the half-size level and softens it.
  vec3 colA = texture2D(uColorA, vUvA, -0.6).rgb, colB = texture2D(uColorB, vUvB, -0.6).rgb;
  float edgeA = texture2D(uStructA, vUvA).r, edgeB = texture2D(uStructB, vUvB).r;
  // Reduced motion replaces the flip with a crossfade of the same two screens.
  colA = mix(colA, texture2D(uColorB, vUvA, -0.6).rgb, uFade);
  edgeA = mix(edgeA, texture2D(uStructB, vUvA).r, uFade);
  vec3 col = mix(colA, colB, vBack);
  float edge = smoothstep(0.14, 0.62, mix(edgeA, edgeB, vBack));
  vec3 accent = mix(mix(uAccentA, uAccentB, uFade), uAccentB, vBack);

  // Structure view: the interface outlines over a dark plate, with the tile grid as construction lines.
  vec2 border = abs(vLocal) * 2.0;
  float grid = smoothstep(0.9, 0.99, max(border.x, border.y));
  vec3 plate = vec3(0.055, 0.06, 0.066) + accent * 0.06;
  vec3 structure = plate + mix(accent * 1.25 + 0.15, vec3(0.95), edge * 0.35) * edge + accent * grid * 0.35;
  col = mix(col, structure, clamp(vBlue, 0.0, 1.0));

  // Separated tiles get a thin shaded rim so they read as physical pieces.
  float rim = smoothstep(0.82, 1.0, max(border.x, border.y)) * vLift;
  col *= vShade * (1.0 - rim * 0.45);
  gl_FragColor = vec4(col * vAlpha, vAlpha);
}`;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

async function decode(src: string) {
  // The still image under the canvas has usually fetched this file already.
  const response = await fetch(src, { cache: 'force-cache' });
  const blob = await response.blob();
  // Decoding off the main thread keeps texture uploads from stalling animation.
  return 'createImageBitmap' in window ? createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }) : new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(blob);
  });
}

export async function mountMosaic(canvas: HTMLCanvasElement, { sources, cols, rows, reduced, maxRatio, onFirstFrame, onLost }: Options): Promise<Mosaic> {
  const gl2 = canvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  const gl = (gl2 ?? canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true })) as WebGLRenderingContext | null;
  if (!gl) throw new Error('WebGL is not available');
  const context = gl;
  const instancing = gl2 ? null : context.getExtension('ANGLE_instanced_arrays');
  if (!gl2 && !instancing) throw new Error('Instancing is not available');
  const aniso = context.getExtension('EXT_texture_filter_anisotropic');

  const compile = (type: number, src: string) => {
    const shader = context.createShader(type)!;
    context.shaderSource(shader, src);
    context.compileShader(shader);
    return shader;
  };
  const program = context.createProgram()!;
  const shaders = [compile(context.VERTEX_SHADER, VERTEX), compile(context.FRAGMENT_SHADER, FRAGMENT)];
  shaders.forEach(shader => context.attachShader(program, shader));
  context.linkProgram(program);
  // Shader translation on Windows can take a noticeable fraction of a second; with parallel compile
  // the main thread keeps running and checks back once per frame.
  const parallel = context.getExtension('KHR_parallel_shader_compile');
  if (parallel) await new Promise<void>(resolve => {
    const poll = () => context.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) ? resolve() : requestAnimationFrame(poll);
    poll();
  });
  if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error(shaders.map(sh => context.getShaderInfoLog(sh)).join(' ') || context.getProgramInfoLog(program) || 'link');
  context.useProgram(program);
  context.pixelStorei(context.UNPACK_COLORSPACE_CONVERSION_WEBGL, context.NONE);

  const count = cols * rows;
  const tiles = new Float32Array(count * 2), seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) { tiles[i * 2] = i % cols; tiles[i * 2 + 1] = Math.floor(i / cols); seeds[i] = i + 1; }
  const corners = new Float32Array([-.5, -.5, .5, -.5, -.5, .5, -.5, .5, .5, -.5, .5, .5]);
  const buffers: WebGLBuffer[] = [];
  const attribute = (name: string, data: Float32Array, size: number, perInstance: boolean) => {
    const buffer = context.createBuffer()!;
    buffers.push(buffer);
    context.bindBuffer(context.ARRAY_BUFFER, buffer);
    context.bufferData(context.ARRAY_BUFFER, data, context.STATIC_DRAW);
    const loc = context.getAttribLocation(program, name);
    context.enableVertexAttribArray(loc);
    context.vertexAttribPointer(loc, size, context.FLOAT, false, 0, 0);
    if (perInstance) gl2 ? gl2.vertexAttribDivisor(loc, 1) : instancing!.vertexAttribDivisorANGLE(loc, 1);
  };
  attribute('aCorner', corners, 2, false);
  attribute('aTile', tiles, 2, true);
  attribute('aSeed', seeds, 1, true);
  context.enable(context.BLEND);
  context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);

  const u = (name: string) => context.getUniformLocation(program, name);
  const U = {
    grid: u('uGrid'), canvas: u('uCanvas'), rot: u('uRot'), flipOrigin: u('uFlipOrigin'), frame: u('uFrame'), lens: u('uLens'),
    d: u('uD'), intro: u('uIntro'), flip: u('uFlip'), structure: u('uStructure'), fade: u('uFade'),
    colorA: u('uColorA'), colorB: u('uColorB'), structA: u('uStructA'), structB: u('uStructB'), accentA: u('uAccentA'), accentB: u('uAccentB'),
  };
  context.uniform2f(U.grid, cols, rows);
  context.uniform1f(U.d, 3.2);
  [U.colorA, U.colorB, U.structA, U.structB].forEach((loc, unit) => context.uniform1i(loc, unit));

  // Colour textures load lazily: the first work right away, the rest when the browser is idle.
  // Structure maps are only needed for the lens and the structure view, so they load on demand.
  const color: (WebGLTexture | null)[] = sources.map(() => null), structure: (WebGLTexture | null)[] = sources.map(() => null);
  const pending = new Map<string, Promise<void>>();
  const upload = (image: ImageBitmap | HTMLImageElement, single: boolean) => {
    const texture = context.createTexture()!;
    context.bindTexture(context.TEXTURE_2D, texture);
    const format = single ? context.LUMINANCE : context.RGBA;
    context.texImage2D(context.TEXTURE_2D, 0, format, format, context.UNSIGNED_BYTE, image);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    if (gl2) {
      context.generateMipmap(context.TEXTURE_2D);
      context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR_MIPMAP_LINEAR);
      if (aniso) context.texParameterf(context.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    } else context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    if ('close' in image) image.close();
    return texture;
  };
  const blank = context.createTexture()!;
  context.bindTexture(context.TEXTURE_2D, blank);
  context.texImage2D(context.TEXTURE_2D, 0, context.LUMINANCE, 1, 1, 0, context.LUMINANCE, context.UNSIGNED_BYTE, new Uint8Array([0]));
  const loadInto = (list: (WebGLTexture | null)[], key: 'color' | 'structure', index: number) => {
    if (list[index]) return Promise.resolve();
    const id = key + index;
    if (!pending.has(id)) pending.set(id, decode(sources[index][key]).then(image => {
      if (disposed) return;
      list[index] = upload(image, key === 'structure');
      rebind();
    }));
    return pending.get(id)!;
  };
  const loadColor = (index: number) => loadInto(color, 'color', index);
  const loadStructure = (index: number) => loadInto(structure, 'structure', index);
  let boundA = 0, boundB = 0;
  const bind = (a: number, b: number) => {
    boundA = a; boundB = b;
    const ca = color[a], cb = color[b] ?? ca;
    if (!ca) return;
    [ca, cb!, structure[a] ?? blank, structure[b] ?? structure[a] ?? blank].forEach((tex, unit) => { context.activeTexture(context.TEXTURE0 + unit); context.bindTexture(context.TEXTURE_2D, tex); });
    context.uniform3fv(U.accentA, sources[a].accent);
    context.uniform3fv(U.accentB, sources[b].accent);
  };
  function rebind() { bind(boundA, boundB); wake(); }
  const needStructure = () => { loadStructure(current); if (flipStart >= 0) loadStructure(next); };

  // State
  let disposed = false, frameId = 0, visible = true, ready = false, firstFrame = false;
  let width = 1, height = 1, ratio = Math.min(window.devicePixelRatio || 1, maxRatio);
  let rect = { x: 0, y: 0, width: 1, height: 1 };
  // Reduced motion keeps the board flat so it lines up with the still image it replaces.
  const rest = reduced ? { yaw: 0, pitch: 0 } : { yaw: -0.26, pitch: 0.1 };
  const view = { yaw: rest.yaw, pitch: rest.pitch, vyaw: 0, vpitch: 0, dragging: false };
  const lens = { x: -1e4, y: -1e4, strength: 0, target: 0 };
  let current = 0, next = 0, flipStart = -1, flipOrigin: [number, number] = [-0.8, 0], structureOn = 0, structureValue = 0;
  let introStart = -1, last = performance.now();
  const FLIP = reduced ? 0.45 : 1.25, INTRO = 2.1;
  const frameTimes: number[] = [];

  const resize = () => {
    width = canvas.clientWidth; height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.viewport(0, 0, canvas.width, canvas.height);
    wake();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; wake(); });
  io.observe(canvas);
  // A lost context hands the stage back to the still image underneath.
  const handleLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(frameId); frameId = 0; ready = false; onLost?.(); };
  canvas.addEventListener('webglcontextlost', handleLost);

  function animating(now: number) {
    const t = (now - introStart) / 1000;
    return (!reduced && introStart >= 0 && t < INTRO + 0.2) || flipStart >= 0 || view.dragging
      || Math.abs(view.vyaw) > 1e-3 || Math.abs(view.vpitch) > 1e-3
      || Math.abs(view.yaw - rest.yaw) > 1e-3 || Math.abs(view.pitch - rest.pitch) > 1e-3
      || Math.abs(lens.strength - lens.target) > 1e-3
      || Math.abs(structureValue - structureOn) > 1e-3;
  }

  function render(now: number) {
    frameId = 0;
    if (disposed || !visible || document.hidden || !ready) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frameTimes.push(dt);
    // Adaptive quality: a slow second lowers the pixel ratio a step.
    if (frameTimes.length >= 45) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      frameTimes.length = 0;
      if (avg > 0.024 && ratio > 1) { ratio = Math.max(1, ratio - 0.25); resize(); }
    }

    if (!view.dragging) {
      view.yaw += view.vyaw * dt; view.pitch += view.vpitch * dt;
      view.vyaw *= Math.exp(-dt * 3); view.vpitch *= Math.exp(-dt * 3);
      const spring = 1 - Math.exp(-dt * 1.6);
      view.yaw += (rest.yaw - view.yaw) * spring; view.pitch += (rest.pitch - view.pitch) * spring;
    }
    lens.strength += (lens.target - lens.strength) * (1 - Math.exp(-dt * (lens.target > lens.strength ? 9 : 5)));
    structureValue += (structureOn - structureValue) * (1 - Math.exp(-dt * (reduced ? 30 : 2.6)));

    let flip = 0;
    if (flipStart >= 0) {
      flip = (now - flipStart) / 1000 / FLIP;
      if (flip >= 1) { current = next; flipStart = -1; flip = 0; bind(current, current); }
    }
    const intro = reduced || introStart < 0 ? 2 : (now - introStart) / 1000 / (INTRO * 0.6);

    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT);
    context.uniform2f(U.canvas, width, height);
    context.uniform3f(U.frame, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.height);
    context.uniform2f(U.rot, view.yaw, view.pitch);
    context.uniform1f(U.intro, intro);
    context.uniform1f(U.flip, reduced ? 0 : flip);
    context.uniform1f(U.fade, reduced && flipStart >= 0 ? clamp(flip, 0, 1) : 0);
    context.uniform2f(U.flipOrigin, flipOrigin[0], flipOrigin[1]);
    context.uniform3f(U.lens, lens.x, lens.y, reduced ? 0 : lens.strength);
    context.uniform1f(U.structure, structureValue);
    context.viewport(0, 0, canvas.width, canvas.height);
    gl2 ? gl2.drawArraysInstanced(context.TRIANGLES, 0, 6, count) : instancing!.drawArraysInstancedANGLE(context.TRIANGLES, 0, 6, count);
    if (!firstFrame) { firstFrame = true; onFirstFrame?.(); }
    if (animating(now)) frameId = requestAnimationFrame(render);
  }
  function wake() {
    if (!frameId && !disposed && visible && !document.hidden && ready) { last = performance.now(); frameId = requestAnimationFrame(render); }
  }
  document.addEventListener('visibilitychange', wake);

  loadColor(0).then(() => {
    if (disposed) return;
    bind(0, 0);
    ready = true;
    introStart = performance.now();
    wake();
    // Preload the rest in idle time, one per idle slot, so no upload lands inside an animation.
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 400));
    const queue = sources.map((_, i) => i).slice(1);
    const step = () => { const i = queue.shift(); if (i === undefined || disposed) return; loadColor(i).then(() => idle(step, { timeout: 2500 })); };
    setTimeout(() => idle(step, { timeout: 2500 }), (INTRO + 0.4) * 1000);
  });

  const toBoard = (x: number, y: number): [number, number] => [clamp((x - rect.x - rect.width / 2) / rect.height, -0.8, 0.8), clamp((y - rect.y - rect.height / 2) / rect.height, -0.5, 0.5)];

  return {
    show(index, direction, origin) {
      if (!ready || index === current && flipStart < 0) return;
      if (flipStart >= 0) { current = next; bind(current, current); }
      next = index;
      loadColor(index).then(() => {
        if (disposed || next !== index) return;
        bind(current, next);
        flipOrigin = origin ? toBoard(origin[0], origin[1]) : [direction > 0 ? -0.9 : 0.9, 0];
        flipStart = performance.now();
        if (structureOn || lens.target > 0) loadStructure(index);
        wake();
      });
    },
    point(x, y) { lens.x = x; lens.y = y; lens.target = 1; needStructure(); wake(); },
    leave() { lens.target = 0; wake(); },
    drag(dx, dy) { view.dragging = true; view.yaw = clamp(view.yaw + dx, -1.0, 0.7); view.pitch = clamp(view.pitch + dy, -0.45, 0.55); wake(); },
    release(vx, vy) { view.dragging = false; if (!reduced) { view.vyaw = clamp(vx, -3, 3); view.vpitch = clamp(vy, -2, 2); } wake(); },
    nudge(dx, dy) { view.vyaw += dx; view.vpitch += dy; wake(); },
    structure(on) { structureOn = on ? 1 : 0; if (on) needStructure(); wake(); },
    frame(r) { rect = r; wake(); },
    reset() { view.vyaw = 0; view.vpitch = 0; view.yaw = rest.yaw; view.pitch = rest.pitch; wake(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', wake);
      canvas.removeEventListener('webglcontextlost', handleLost);
      [...color, ...structure, blank].forEach(t => { if (t) context.deleteTexture(t); });
      buffers.forEach(b => context.deleteBuffer(b));
      context.deleteProgram(program);
    },
  };
}
