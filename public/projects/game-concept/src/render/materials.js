import * as THREE from 'three';

// Procedural PBR library. Painted metal uses an object-space triplanar wear
// layer: large blotches vary the paint, grit breaks up roughness, scratches and
// curvature-driven chips expose bare metal, and vertical runs carry grime.
// Everything is generated at start-up; no bitmap files are shipped.

let seed = 7129;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

function periodicValueNoise(size, cells) {
  const grid = Array.from({length: cells * cells}, random);
  const at = (x, y) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)];
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = x / size * cells, gy = y / size * cells;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      let fx = gx - ix, fy = gy - iy;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      const top = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx;
      const bottom = at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx;
      out[y * size + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
}

function fbm(size, cells, octaves) {
  const out = new Float32Array(size * size);
  let amplitude = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) {
    const layer = periodicValueNoise(size, cells << o);
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  let min = Infinity, max = -Infinity;
  for (const v of out) { min = Math.min(min, v); max = Math.max(max, v); }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - min) / (max - min);
  return out;
}

// Draws with wrap-around so strokes tile seamlessly, then returns luminance.
function paintChannel(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    ctx.save(); ctx.translate(dx, dy); paint(ctx, size); ctx.restore();
  }
  const data = ctx.getImageData(0, 0, size, size).data;
  const out = new Float32Array(size * size);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4] / 255;
  return out;
}

let wearTexture;
export function getWearTexture() {
  if (wearTexture) return wearTexture;
  const size = 512;
  seed = 7129;
  const blotch = fbm(size, 4, 5);
  const grit = fbm(size, 48, 2);
  const scratchSeed = Array.from({length: 1100}, () => [random(), random(), random(), random(), random()]);
  const scratches = paintChannel(size, (ctx) => {
    for (const [x, y, a, l, w] of scratchSeed) {
      // Scratches cluster along a few handling directions, as tools slide on plates.
      const angle = (a < 0.6 ? 0.08 : a < 0.85 ? 1.52 : a * 3.1) + (random() - 0.5) * 0.25;
      const length = 4 + l * l * 46;
      ctx.strokeStyle = `rgba(255,255,255,${0.25 + w * 0.6})`;
      ctx.lineWidth = 0.5 + w * 0.9;
      ctx.beginPath();
      ctx.moveTo(x * size, y * size);
      ctx.lineTo(x * size + Math.cos(angle) * length, y * size + Math.sin(angle) * length);
      ctx.stroke();
    }
  });
  const runs = paintChannel(size, (ctx) => {
    for (let i = 0; i < 150; i++) {
      const x = random() * size, y = random() * size, length = 30 + random() * 190, width = 1 + random() * 5;
      const gradient = ctx.createLinearGradient(0, y, 0, y + length);
      gradient.addColorStop(0, `rgba(255,255,255,${0.35 + random() * 0.5})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, length);
    }
  });
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = blotch[i] * 255;
    data[i * 4 + 1] = scratches[i] * 255;
    data[i * 4 + 2] = grit[i] * 255;
    data[i * 4 + 3] = Math.min(1, runs[i] * (0.4 + blotch[i])) * 255;
  }
  wearTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  wearTexture.wrapS = wearTexture.wrapT = THREE.RepeatWrapping;
  wearTexture.magFilter = THREE.LinearFilter;
  wearTexture.minFilter = THREE.LinearMipmapLinearFilter;
  wearTexture.generateMipmaps = true;
  wearTexture.anisotropy = 4;
  wearTexture.needsUpdate = true;
  return wearTexture;
}

const WEAR_VERTEX = /* glsl */`
attribute float edge;
varying float vEdge;
varying vec3 vObjPos;
varying vec3 vObjNormal;
`;

const WEAR_FRAGMENT = /* glsl */`
uniform sampler2D wearMap;
uniform float wearAmount;
uniform float grimeAmount;
uniform float wearScale;
uniform float gritAmount;
uniform vec3 edgeColor;
uniform vec3 grimeColor;
uniform float edgeRoughness;
uniform vec3 seamSize;
uniform float seamDepth;
varying float vEdge;
varying vec3 vObjPos;
varying vec3 vObjNormal;
float lacunaWear = 0.0;
float lacunaGrime = 0.0;
float lacunaSeam = 0.0;
float lacunaGrit = 0.5;
vec3 lacunaWeights(vec3 n) { vec3 w = pow(abs(n), vec3(5.0)); return w / (w.x + w.y + w.z + 1e-5); }
vec4 lacunaTri(vec3 p, vec3 w) {
  return texture2D(wearMap, p.zy) * w.x + texture2D(wearMap, p.xz) * w.y + texture2D(wearMap, p.xy) * w.z;
}
float lacunaSeamLines(vec2 q) {
  vec2 c = q / seamSize.xy;
  c.x += step(1.0, mod(floor(c.y), 2.0)) * 0.5;
  vec2 d = (0.5 - abs(fract(c) - 0.5)) * seamSize.xy;
  float dist = min(d.x, d.y);
  float aa = fwidth(dist) * 1.5 + 1e-5;
  return 1.0 - smoothstep(seamSize.z, seamSize.z + aa, dist);
}
vec3 lacunaPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos)), sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm), r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

const WEAR_SURFACE = /* glsl */`
{
  vec3 w = lacunaWeights(normalize(vObjNormal));
  vec4 broad = lacunaTri(vObjPos * wearScale * 0.3, w);
  vec4 fine = lacunaTri(vObjPos * wearScale * 1.7, w);
  float runs = lacunaTri(vObjPos * vec3(0.8, 0.22, 0.8) * wearScale, w).a;
  lacunaGrit = fine.b;
  float edgeMask = smoothstep(0.18, 0.6, vEdge);
  float chipNoise = broad.r * 0.55 + fine.b * 0.6 + edgeMask * 0.45;
  float chip = edgeMask * smoothstep(1.12 - wearAmount * 0.5, 1.2 - wearAmount * 0.5, chipNoise);
  float scratch = smoothstep(0.55, 0.9, fine.g) * wearAmount * 0.45 * smoothstep(0.35, 0.85, broad.r + 0.15);
  lacunaGrime = clamp(smoothstep(0.25, 0.9, runs) * grimeAmount + (1.0 - broad.r) * grimeAmount * 0.35, 0.0, 1.0);
  diffuseColor.rgb *= mix(0.86, 1.07, broad.r) * mix(1.0 - 0.04 * gritAmount, 1.0 + 0.03 * gritAmount, fine.b);
  diffuseColor.rgb = mix(diffuseColor.rgb, grimeColor, lacunaGrime * 0.6);
  lacunaWear = clamp(max(chip, scratch), 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, edgeColor * mix(0.8, 1.1, fine.b), lacunaWear);
  #ifdef LACUNA_SEAMS
    lacunaSeam = lacunaSeamLines(vObjPos.zy) * w.x + lacunaSeamLines(vObjPos.xz) * w.y + lacunaSeamLines(vObjPos.xy) * w.z;
    diffuseColor.rgb *= 1.0 - lacunaSeam * 0.5;
  #endif
}
`;

function applyWear(material, options) {
  const uniforms = {
    wearMap: {value: getWearTexture()},
    wearAmount: {value: options.wear ?? 0.5},
    grimeAmount: {value: options.grime ?? 0.25},
    wearScale: {value: options.scale ?? 1},
    gritAmount: {value: options.grit ?? 1},
    edgeColor: {value: new THREE.Color(options.edgeColor ?? '#9a9c94')},
    grimeColor: {value: new THREE.Color(options.grimeColor ?? '#2f2a22')},
    edgeRoughness: {value: options.edgeRoughness ?? 0.32},
    seamSize: {value: new THREE.Vector3(...(options.seams ?? [0.9, 0.62, 0.0035]))},
    seamDepth: {value: options.seamDepth ?? 0.0012},
  };
  material.userData.wear = uniforms;
  if (options.seams) material.defines = {...material.defines, LACUNA_SEAMS: ''};
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WEAR_VERTEX}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEdge = edge; vObjPos = position; vObjNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WEAR_FRAGMENT}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${WEAR_SURFACE}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(1.0 - 0.2 * gritAmount, 1.0 + 0.2 * gritAmount, lacunaGrit) + lacunaGrime * 0.12 + lacunaSeam * 0.2, 0.04, 1.0);
        roughnessFactor = mix(roughnessFactor, edgeRoughness, lacunaWear);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 1.0, lacunaWear);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef LACUNA_SEAMS
          float lacunaHeight = -lacunaSeam * seamDepth;
          normal = lacunaPerturb(-vViewPosition, normal, vec2(dFdx(lacunaHeight), dFdy(lacunaHeight)), faceDirection);
        #endif`);
  };
  material.customProgramCacheKey = () => `lacuna-wear-${options.seams ? 'seams' : 'plain'}`;
  return material;
}

export function wearMaterial(name, {color, roughness = 0.6, metalness = 0, physical = false, ...options}) {
  const Material = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const material = new Material({name, color, roughness, metalness, ...(options.params || {})});
  return applyWear(material, options);
}

function plain(name, params, Material = THREE.MeshStandardMaterial) {
  return new Material({name, ...params});
}

let library;
// Paint is dielectric (metalness 0); chips reveal the steel underneath.
export function getMaterials() {
  if (library) return library;
  library = {
    hull: wearMaterial('hull', {color: '#aba797', roughness: 0.56, wear: 0.5, grime: 0.34, seams: [0.95, 0.55, 0.0028], physical: true, params: {clearcoat: 0.12, clearcoatRoughness: 0.6}}),
    panel: wearMaterial('panel', {color: '#c2bca9', roughness: 0.55, wear: 0.45, grime: 0.26, physical: true, params: {clearcoat: 0.1, clearcoatRoughness: 0.55}}),
    panelAlt: wearMaterial('panelAlt', {color: '#9ea5a1', roughness: 0.6, wear: 0.5, grime: 0.3, physical: true, params: {clearcoat: 0.08, clearcoatRoughness: 0.6}}),
    orange: wearMaterial('orange', {color: '#ad4f26', roughness: 0.5, wear: 0.5, grime: 0.3, edgeColor: '#7f7f78', physical: true, params: {clearcoat: 0.16, clearcoatRoughness: 0.5}}),
    ochre: wearMaterial('ochre', {color: '#b08430', roughness: 0.55, wear: 0.45, grime: 0.3}),
    frame: wearMaterial('frame', {color: '#252928', roughness: 0.58, metalness: 0.3, wear: 0.22, grime: 0.2, edgeColor: '#5d615c'}),
    gunmetal: wearMaterial('gunmetal', {color: '#343a3a', roughness: 0.46, metalness: 0.7, wear: 0.15, grime: 0.18, edgeColor: '#7d817b'}),
    steel: wearMaterial('steel', {color: '#767a75', roughness: 0.36, metalness: 1, wear: 0.15, grime: 0.12, edgeColor: '#a8aaa4', edgeRoughness: 0.22}),
    // Rods and piston chrome: rough enough that the bench spot leaves a soft
    // sheen instead of hard white lines blooming as the module turns.
    chrome: plain('chrome', {color: '#c7cbc9', roughness: 0.26, metalness: 1}),
    copper: wearMaterial('copper', {color: '#9a5c36', roughness: 0.38, metalness: 1, wear: 0.12, grime: 0.25, edgeColor: '#c07f55'}),
    rubber: wearMaterial('rubber', {color: '#171b1a', roughness: 0.84, wear: 0.02, grime: 0.15, edgeColor: '#262a28'}),
    ceramic: wearMaterial('ceramic', {color: '#cbc5b2', roughness: 0.8, wear: 0.25, grime: 0.42, edgeColor: '#aea895'}),
    nozzle: wearMaterial('nozzle', {color: '#2b2724', roughness: 0.45, metalness: 1, wear: 0.1, grime: 0.5, edgeColor: '#6a5847', grimeColor: '#141110'}),
    dark: plain('dark', {color: '#0e1312', roughness: 0.72, metalness: 0.25}),
    glass: plain('glass', {color: '#0a1a1e', roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, reflectivity: 0.55, envMapIntensity: 1.4}, THREE.MeshPhysicalMaterial),
    teal: plain('teal', {color: '#285f5a', emissive: '#6fe4d8', emissiveIntensity: 2.2, roughness: 0.3}),
    amber: plain('amber', {color: '#5d3f1b', emissive: '#ffb45a', emissiveIntensity: 2.4, roughness: 0.3}),
    red: plain('red', {color: '#4f1a10', emissive: '#ff5635', emissiveIntensity: 2.0, roughness: 0.3}),
  };
  return library;
}

// Stencil and plate decals, drawn once into canvas textures.
export function decalTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function decalMaterial(texture, {roughness = 0.62, metalness = 0, opacity = 1} = {}) {
  const material = new THREE.MeshStandardMaterial({
    map: texture, transparent: true, alphaTest: 0.08, roughness, metalness, opacity,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  material.userData.noShadow = true;
  return material;
}

export const DISPLAY_FONT = '"Tektur", "Arial Narrow", sans-serif';

export function stencil(text, {color = '#242420', size = 170, weight = 700, width = 1024, height = 256, spacing = 6, breaks = true} = {}) {
  return decalTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, w / 2, h * 0.54, w * 0.94);
    if (breaks) {
      // Stencil bridges and paint loss keep the marking physical.
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 70; i++) {
        ctx.globalAlpha = 0.15 + random() * 0.6;
        ctx.fillRect(random() * w, random() * h, 2 + random() * 16, 1 + random() * 5);
      }
      ctx.globalAlpha = 1;
    }
  });
}
