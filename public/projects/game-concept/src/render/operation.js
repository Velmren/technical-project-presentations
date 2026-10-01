import * as THREE from 'three';
import {Assembly, AXIS, cylinder, extrude, filletPolygon, hullLoft, lathe, roundedBox, torus, tube} from './kit.js';
import {decalMaterial, decalTexture, getMaterials, stencil, wearMaterial} from './materials.js';
import {createVessel, TOOL_MOUNT} from './vessel.js';
import {createTool} from './tools.js';
import {atmosphere, planetMaterial, sky, stars, SUN} from './sector.js';
import {createExhaust} from './exhaust.js';

// Operation vignette: MULE-06 working a target in the ring, with Morrow below.
// Each decision plays a short, physical sequence (approach path, cable brake,
// cutting sparks, cargo coming aboard, departure). Everything is a tween that
// can be jumped to its end, so reduced motion and reloads land on the same state.

const PI = Math.PI;
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// Travel along a path: a burn to speed, a coast, then braking (a third of the
// time each way), as a craft with mass moves; returns the distance fraction.
const BURN = 0.3;
const travel = (t) => {
  const v = 1 / (1 - BURN);
  if (t < BURN) return v * t * t / (2 * BURN);
  if (t < 1 - BURN) return v * (BURN / 2 + t - BURN);
  return 1 - v * (1 - t) * (1 - t) / (2 * BURN);
};
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const WRECK = new THREE.Vector3(0, 0, 0);

// Wreck-only finishes: a courier livery that reads apart from MULE-06's
// orange, weathered harder, and an unlit liner for the torn-open section.
let wreckKit;
function getWreckKit() {
  if (wreckKit) return wreckKit;
  wreckKit = {
    skin: wearMaterial('wreckSkin', {color: '#8e948d', roughness: 0.62, wear: 0.72, grime: 0.55, grit: 1.4, seams: [0.85, 0.5, 0.003], physical: true}),
    livery: wearMaterial('wreckLivery', {color: '#27485a', roughness: 0.52, wear: 0.62, grime: 0.4, edgeColor: '#8a8d86', physical: true}),
    liner: new THREE.MeshStandardMaterial({name: 'wreckLiner', color: '#101413', roughness: 0.9, metalness: 0.2, side: THREE.DoubleSide}),
    name: decalMaterial(stencil('NACRE 9', {color: '#1c2427', size: 176, spacing: 14})),
    soot: decalMaterial(decalTexture(256, 256, (ctx, w) => {
      const g = ctx.createRadialGradient(w * 0.62, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(12,11,10,0.9)'); g.addColorStop(0.55, 'rgba(14,12,11,0.45)'); g.addColorStop(1, 'rgba(14,12,11,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    }), {roughness: 0.9}),
    seraph: decalMaterial(stencil('SERAPH 2', {color: '#231d18', size: 170, spacing: 12})),
    tallow: decalMaterial(stencil('TALLOW REACH', {color: '#d8d2bf', size: 150, spacing: 10})),
    brine: decalMaterial(stencil('CASSEL VAULT 3', {color: '#1d1d1a', size: 130, spacing: 8})),
    hazard: decalMaterial(decalTexture(1024, 64, (ctx, w, h) => {
      ctx.fillStyle = '#c29a38'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d1d1a';
      for (let x = -h; x < w + h; x += 48) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 24, h); ctx.lineTo(x + 24 + h, 0); ctx.lineTo(x + h, 0); ctx.fill(); }
    })),
  };
  return wreckKit;
}

const COURIER_STATIONS = [
  {x: -3.05, w: 0.62, h: 0.52, y: -0.04, top: 0.6, r: 0.12},
  {x: -2.5, w: 1.3, h: 1.1, y: 0, top: 0.74, r: 0.2},
  {x: -1.6, w: 1.8, h: 1.5, y: 0.04, top: 0.82, r: 0.24},
  {x: 0.4, w: 1.9, h: 1.6, y: 0.05, top: 0.86, r: 0.26},
  {x: 1.3, w: 1.84, h: 1.54, y: 0.03, top: 0.86, r: 0.25},
];

// Cross-section outline of a hull station as [y, z] pairs.
function ring({w, h, y, top, r}, grow = 0) {
  const hw = w / 2 + grow, hh = h / 2 + grow;
  return filletPolygon([[-hw, -hh], [hw, -hh], [hw * top, hh], [-hw * top, hh]], r, 4).map(([z, yy]) => [yy + y, z]);
}

// Station interpolated along the hull, for bands wrapped around it.
function stationAt(x, grow) {
  const i = COURIER_STATIONS.findIndex(st => st.x >= x);
  const s0 = COURIER_STATIONS[i - 1], s1 = COURIER_STATIONS[i], f = (x - s0.x) / (s1.x - s0.x);
  const mix = (key) => s0[key] + (s1[key] - s0[key]) * f;
  return {x, w: mix('w') + grow, h: mix('h') + grow, y: mix('y'), top: mix('top'), r: mix('r')};
}

// NACRE-9: a courier broken behind its cargo bay. Livery band, glazing, the
// orange flight recorder on the spine, and a torn aft end with bent skin,
// broken frames, loose stringers and cable runs.
function courier(a, m) {
  const k = getWreckKit();
  a.add(hullLoft(COURIER_STATIONS, {capEnd: false}), k.skin);
  const band = (x0, x1) => hullLoft([stationAt(x0, 0.028), stationAt(x1, 0.028)], {capStart: false, capEnd: false});
  a.add(band(-1.35, -0.8), k.livery);
  a.add(band(-0.72, -0.62), m.ochre);
  // Liner behind the tear so the open end shows a dark interior, not space.
  a.add(hullLoft([stationAt(0.7, -0.07), {...COURIER_STATIONS[4], w: 1.77, h: 1.47}], {capStart: true, capEnd: false}), k.liner);
  // Glazing on the sloped nose, set just proud of the skin.
  for (const side of [-1, 1]) a.add(roundedBox(0.62, 0.035, 0.34, 0.03), m.glass, {position: [-2.08, 0.7, side * 0.24], rotation: [side * 0.18, 0, 0.27]});
  a.add(roundedBox(0.2, 0.05, 0.9, 0.02), m.frame, {position: [-1.74, 0.8, 0], rotation: [0, 0, 0.2]});
  // Broken frames: partial rings standing out of the tear.
  for (const [x, from, to] of [[1.18, 0, 0.78], [1.52, 0.1, 0.55], [1.86, 0.35, 0.5]]) {
    const points = ring(COURIER_STATIONS[4], -0.03);
    const n = points.length;
    const part = points.slice(Math.floor(n * from), Math.floor(n * to)).map(([y, z]) => [x, y, z]);
    if (part.length > 2) a.add(tube(part, 0.045, {radial: 8}), m.frame);
  }
  // Skin plates peeled outward around the tear.
  const rim = ring(COURIER_STATIONS[4]);
  for (let i = 0; i < rim.length; i += 3) {
    const [y, z] = rim[i];
    const theta = Math.atan2(y - 0.03, z);
    const length = 0.35 + ((i * 37) % 11) / 20;
    a.add(roundedBox(length, 0.028, 0.3 + ((i * 13) % 5) / 25, 0.01), i % 2 ? k.skin : k.livery, {
      position: [1.3 + length * 0.42, y * 1.02, z * 1.02],
      rotation: [PI / 2 - theta, 0, 0.25 + ((i * 7) % 5) * 0.12],
    });
  }
  // Loose stringers and cable runs trailing from the tear.
  for (const [y, z, dy, dz] of [[0.55, 0.5, 0.35, 0.1], [-0.5, 0.6, -0.2, 0.3], [0.3, -0.72, 0.1, -0.4], [-0.62, -0.3, -0.35, -0.1]]) {
    a.between([1.0, y, z], [2.05, y + dy, z + dz], 0.028, m.gunmetal);
  }
  for (const [y, z, sag] of [[0.1, 0.2, -0.5], [-0.2, -0.1, -0.8], [0.35, -0.3, -0.3]]) {
    a.add(tube([[0.9, y, z], [1.6, y + sag * 0.4, z + 0.1], [2.3, y + sag, z + 0.25]], 0.022, {radial: 6}), m.rubber);
  }
  // Markings and scorch on the flank.
  a.add(new THREE.PlaneGeometry(1.5, 0.375), k.name, {position: [-0.05, -0.08, 0.905], rotation: [-0.085, 0, 0], edge: 0});
  a.add(new THREE.PlaneGeometry(1.3, 1.0), k.soot, {position: [0.85, 0.05, 0.9], rotation: [-0.085, 0, 0], edge: 0});
  a.add(new THREE.PlaneGeometry(1.1, 0.9), k.soot, {position: [0.9, 0.84, 0.1], rotation: [-PI / 2, 0, 0], edge: 0});
  // Sensor mast and a sheared antenna.
  a.between([-1.0, 0.82, 0.3], [-1.0, 1.35, 0.34], 0.022, m.steel);
  a.add(cylinder(0.09, 0.05, {segments: 20, bevel: 0.015}), m.frame, {position: [-1.0, 1.36, 0.34]});
  a.between([0.1, 0.84, -0.3], [0.45, 1.1, -0.42], 0.018, m.steel);
}

// The flight recorder: a hazard-orange armoured box on the spine clamps.
function recorder(a, m) {
  a.add(roundedBox(0.9, 0.46, 0.62, 0.06), m.orange);
  for (const x of [-0.32, 0.32]) a.add(roundedBox(0.08, 0.5, 0.66, 0.02), m.frame, {position: [x, 0, 0]});
  a.add(roundedBox(0.4, 0.04, 0.3, 0.012), m.dark, {position: [0, 0.24, 0]});
  a.between([-0.24, 0.3, 0], [0.24, 0.3, 0], 0.028, m.steel);
  for (const x of [-0.36, 0.36]) a.add(roundedBox(0.16, 0.1, 0.8, 0.02), m.gunmetal, {position: [x, -0.26, 0]});
}

// SERAPH-2: a high-visibility escape capsule with its hatch, thrusters and
// strobe, drifting since the courier broke up.
function lifeboat(a, m) {
  const k = getWreckKit();
  a.add(lathe([[0, -1], [0.4, -0.95], [0.6, -0.7], [0.62, 0.5], [0.45, 0.85], [0.2, 1], [0, 1.02]], {segments: 40, fillet: 0.08}), m.orange, {rotation: AXIS.x});
  for (const x of [-0.62, 0.02, 0.46]) a.add(torus(0.628, 0.028, {tubular: 56}), m.frame, {position: [x, 0, 0], rotation: [0, PI / 2, 0]});
  // Side hatch with frame and handle, facing the camera side.
  a.add(roundedBox(0.52, 0.5, 0.05, 0.05), k.skin, {position: [-0.3, 0, 0.6]});
  a.add(roundedBox(0.58, 0.56, 0.03, 0.06), m.frame, {position: [-0.3, 0, 0.585]});
  a.between([-0.45, -0.12, 0.64], [-0.15, -0.12, 0.64], 0.018, m.steel);
  for (const y of [0.3, -0.3]) a.add(cylinder(0.05, 0.03, {segments: 16}), m.glass, {position: [0.25, y, 0.58], rotation: AXIS.z});
  // Attitude thrusters on the aft cone and a strobe on the nose.
  for (const angle of [0, PI / 2, PI, PI * 1.5]) {
    a.add(cylinder(0.06, 0.14, {radiusTop: 0.04, segments: 12}), m.nozzle, {position: [-0.86, Math.sin(angle) * 0.36, Math.cos(angle) * 0.36], rotation: AXIS.x});
  }
  a.add(cylinder(0.05, 0.06, {segments: 14}), m.red, {position: [1.04, 0, 0], rotation: AXIS.x});
  a.between([0.2, 0.6, 0], [0.35, 1.05, 0.05], 0.014, m.steel);
  a.add(new THREE.PlaneGeometry(0.7, 0.175), k.seraph, {position: [0.05, 0.34, 0.54], rotation: [-0.55, 0, 0], edge: 0});
}

// TALLOW REACH: an abandoned bulk freighter, frames and plating, some plates
// already gone, bridge block at the bow.
function freighter(a, m) {
  const k = getWreckKit();
  a.add(roundedBox(7, 3.2, 3.4, 0.2), k.liner);
  for (let i = 0; i < 9; i++) a.add(roundedBox(0.16, 3.3, 3.5, 0.03), m.frame, {position: [-3.2 + i * 0.8, 0, 0]});
  // Hull plating between the frames; gaps show the dark hold behind.
  for (let i = 0; i < 8; i++) {
    for (const [y, h] of [[1.05, 1.0], [0, 1.0], [-1.05, 1.0]]) {
      const seed = (i * 7 + Math.round(y * 3) * 5 + 11) % 13;
      if (seed === 3 || seed === 8) continue;
      const tone = seed % 5 === 0 ? m.ochre : seed % 4 === 0 ? m.orange : k.skin;
      a.add(roundedBox(0.62, h - 0.05, 0.06, 0.02), tone, {position: [-2.8 + i * 0.8, y, 1.72]});
      a.add(roundedBox(0.62, 0.06, h - 0.05, 0.02), k.skin, {position: [-2.8 + i * 0.8, 1.62, y * 1.06]});
    }
  }
  a.add(roundedBox(1.2, 1.3, 2.4, 0.08), k.skin, {position: [-3.9, 1.2, 0]});
  a.add(roundedBox(0.05, 0.28, 2.0, 0.02), m.glass, {position: [-4.51, 1.4, 0]});
  a.between([-3.9, 1.9, 0.4], [-3.9, 2.6, 0.45], 0.03, m.steel);
  a.add(new THREE.PlaneGeometry(3.2, 0.8), k.tallow, {position: [0.2, -1.3, 1.756], edge: 0});
  a.add(new THREE.PlaneGeometry(6.6, 0.18), k.hazard, {position: [0, -1.52, 1.757], edge: 0});
}

// K-17: a traffic beacon on its mast, with a dead lamp and panels.
function beacon(a, m) {
  const k = getWreckKit();
  a.between([0, -2, 0], [0, 2.2, 0], 0.12, m.gunmetal);
  a.add(lathe([[0, -0.4], [0.5, -0.4], [0.55, -0.3], [0.4, 0.3], [0, 0.35]], {segments: 32, fillet: 0.04}), k.skin);
  a.add(torus(0.53, 0.035, {tubular: 48}), m.orange, {position: [0, -0.33, 0], rotation: [PI / 2, 0, 0]});
  a.add(torus(1.1, 0.05, {tubular: 64}), m.steel, {rotation: [PI / 2, 0, 0]});
  for (const angle of [0, PI / 2, PI, PI * 1.5]) {
    a.add(roundedBox(1.2, 0.03, 0.5, 0.01), m.dark, {position: [Math.cos(angle) * 1.9, 0, Math.sin(angle) * 1.9], rotation: [0, -angle, 0]});
    a.add(roundedBox(1.26, 0.05, 0.56, 0.015), m.steel, {position: [Math.cos(angle) * 1.9, -0.02, Math.sin(angle) * 1.9], rotation: [0, -angle, 0]});
    a.between([Math.cos(angle) * 0.5, 0, Math.sin(angle) * 0.5], [Math.cos(angle) * 1.3, 0, Math.sin(angle) * 1.3], 0.03, m.steel);
  }
  a.add(lathe([[0, 0], [0.16, 0], [0.16, 0.2], [0.1, 0.3], [0, 0.32]], {segments: 24, fillet: 0.02}), m.glass, {position: [0, 2.2, 0]});
  a.add(roundedBox(0.5, 0.5, 0.06, 0.03), m.ochre, {position: [0, -0.9, 0.14]});
}

// BRINE HOLLOW: a sealed vault on a platform, marked for radiation.
function platform(a, m) {
  const k = getWreckKit();
  a.add(roundedBox(5, 2.6, 3.6, 0.2), m.frame);
  a.add(roundedBox(3.6, 0.4, 3.8, 0.1), m.ochre, {position: [0, 1.4, 0]});
  for (const x of [-2.2, 2.2]) a.add(roundedBox(0.3, 2.7, 3.7, 0.06), m.gunmetal, {position: [x, 0, 0]});
  a.add(cylinder(0.95, 0.35, {bevel: 0.05, segments: 48}), m.gunmetal, {position: [0, 0, 1.9], rotation: AXIS.z});
  a.add(cylinder(0.6, 0.1, {bevel: 0.02, segments: 40}), k.skin, {position: [0, 0, 2.1], rotation: AXIS.z});
  for (let i = 0; i < 12; i++) {
    const angle = i * PI / 6;
    a.add(cylinder(0.06, 0.12, {segments: 10, bevel: 0.01}), m.steel, {position: [Math.cos(angle) * 0.8, Math.sin(angle) * 0.8, 2.1], rotation: AXIS.z});
  }
  a.add(new THREE.PlaneGeometry(4.2, 0.2), k.hazard, {position: [0, -1.12, 1.806], edge: 0});
  a.add(new THREE.PlaneGeometry(1.6, 0.4), k.brine, {position: [-1.3, 0.85, 1.806], edge: 0});
  a.add(tube([[-2.5, 1, 1.5], [-3.4, 1.5, 0.8], [-3, 2.6, -0.5]], 0.08), m.rubber);
}

const WRECKS = {courier, lifeboat, freighter, beacon, platform};

function build(fn) {
  const a = new Assembly('target');
  fn(a, getMaterials());
  return a.finish();
}

// Debris field: thin, bevelled hull fragments and snapped struts rather than
// rocks, in hull paint, primer and bare metal, thinning out with distance.
function debris(seed = 5) {
  const cameraSide = new THREE.Vector3(Math.sin(SHOT.yaw), 0, Math.cos(SHOT.yaw));
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const shard = (points) => extrude(points, 0.035, {fillet: 0.03, filletSegments: 2, bevel: 0.01, bevelSegments: 1});
  const shapes = [
    shard([[-0.5, -0.3], [0.45, -0.38], [0.6, 0.1], [0.1, 0.42], [-0.42, 0.2]]),
    shard([[-0.7, -0.12], [0.62, -0.2], [0.7, 0.05], [-0.1, 0.22], [-0.66, 0.1]]),
    shard([[-0.35, -0.35], [0.4, -0.3], [0.2, 0.4]]),
    cylinder(0.05, 1.4, {segments: 8, bevel: 0.01}),
  ];
  const tones = ['#6b716b', '#565c59', '#27485a', '#7c807a', '#3d4240', '#8c4322', '#2e3331'].map(c => new THREE.Color(c));
  // Less metal than hull plate, with a floor of self-light: dark-toned shards
  // turned from the sun read as grey metal, never as black holes.
  const material = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.55, metalness: 0.3, emissive: '#101416'});
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  shapes.forEach((geometry, index) => {
    const strut = index === 3;
    const count = strut ? 24 : 46;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    for (let i = 0; i < count; i++) {
      // Nothing drifts between the camera and the work: resample points on the near side.
      do {
        const angle = random() * PI * 2, radius = 5 + Math.pow(random(), 0.7) * 24;
        p.set(Math.cos(angle) * radius, (random() - 0.5) * (3 + radius * 0.3), Math.sin(angle) * radius);
      } while (p.dot(cameraSide) > 3);
      const size = (strut ? 0.4 : 0.15) + Math.pow(random(), 2.5) * (strut ? 0.9 : 1.0);
      sc.set(size, size, strut ? size : 1);
      m4.compose(p, q.setFromEuler(e.set(random() * 6.3, random() * 6.3, random() * 6.3)), sc);
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, tones[Math.floor(random() * tones.length)]);
    }
    group.add(mesh);
  });
  return group;
}

// Poses for the vessel (position, heading) at each stage of the job. The
// hardpoint is on the port flank (+Z) and works forward, so on station the
// nose points at the target (yaw 0.85) and the vessel sits offset sideways by
// the mount's reach. Stand-off distances grow with the target's size.
const APPROACH = new THREE.Vector3(0.66, 0, -0.75).normalize();
const PORT = new THREE.Vector3(Math.sin(0.85), 0, Math.cos(0.85));
const REACH = 1.96;
function posesFor(radius) {
  const at = (standoff, y) => APPROACH.clone().multiplyScalar(radius + standoff).addScaledVector(PORT, -REACH).setY(y);
  return {
    far: {pos: at(14, 2.2), yaw: 0.85},
    near: {pos: at(5, 0.6), yaw: 0.85},
    close: {pos: at(2.2, 0.1), yaw: 0.85},
    away: {pos: new THREE.Vector3(26, 5, -31), yaw: -2.29},
  };
}
// The shot looks at the working (port) flank from slightly ahead of the nose:
// target left, vessel right, the tool reaching between them.
const SHOT = {yaw: 0.35, pitch: 0.3, distance: 18};
const DEPART_FROM = 20, DEPART_TO = 34;

// The Lacuna ring as a dusty band behind the work; with the sky gradient
// (sector.js) the space around the vessel reads as a place, not a black void.
function ringBand() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */`
      varying vec2 vLocal;
      void main() { vLocal = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying vec2 vLocal;
      void main() {
        float r = length(vLocal);
        float edge = smoothstep(1.0, 1.1, r) * (1.0 - smoothstep(1.78, 1.92, r));
        float bands = 0.6 + 0.25 * sin(r * 17.0 + 0.6) + 0.15 * sin(r * 41.0 + 1.3);
        float gap = smoothstep(1.34, 1.37, r) * (1.0 - smoothstep(1.41, 1.44, r));
        float density = edge * bands * (1.0 - gap * 0.8);
        vec3 col = mix(vec3(0.46, 0.46, 0.42), vec3(0.62, 0.55, 0.44), sin(r * 9.0) * 0.5 + 0.5);
        gl_FragColor = vec4(col * 0.55, density * 0.3);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(new THREE.RingGeometry(1, 1.92, 256, 1), material);
}

export function createOperationWorld(environment) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05090c');
  scene.environment = environment;
  scene.environmentIntensity = 0.18;
  scene.add(stars(1600));
  const planet = new THREE.Group();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(24, 96, 64), planetMaterial());
  planet.add(globe, atmosphere(24));
  planet.position.set(40, -46, -70);
  scene.add(planet);
  scene.add(sky(planet.position));
  // The ring lies in Morrow's equatorial plane, seen at a shallow angle.
  const ring = ringBand();
  ring.scale.setScalar(62);
  ring.position.copy(planet.position);
  ring.rotation.set(-PI / 2 + 0.22, 0, 0.38);
  scene.add(ring);
  const sun = new THREE.DirectionalLight('#fff3df', 3.4);
  sun.position.copy(SUN).multiplyScalar(-60).add(new THREE.Vector3(0, 30, 0));
  const fill = new THREE.DirectionalLight('#7fa4b8', 0.5);
  fill.position.set(10, -6, 12);
  scene.add(sun, fill, new THREE.AmbientLight('#3a4a52', 0.5), new THREE.HemisphereLight('#8fa9b6', '#2d2a26', 0.6));

  const vessel = createVessel();
  scene.add(vessel.group);
  // Heading, then pitch, then bank, as a craft is flown.
  vessel.group.rotation.order = 'YZX';
  const field = debris();
  scene.add(field);
  const cableMaterial = new THREE.LineBasicMaterial({color: '#c9d2d4', transparent: true, opacity: 0.8});
  const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), cableMaterial);
  cable.visible = false;
  scene.add(cable);
  const sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(240 * 3), 3)),
    new THREE.PointsMaterial({color: '#ffcf8a', size: 0.08, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
  scene.add(sparks);

  let target = null, cargo = null, wreckType = null, spin = 0, spinTarget = 0.6, targetRadius = 3;
  const vesselRadius = new THREE.Box3().setFromObject(vessel.group).getBoundingSphere(new THREE.Sphere()).radius * 0.8;
  // Added after measuring the vessel, so plumes never change the framing.
  const exhaust = createExhaust(vessel.group);
  let poses = posesFor(3);
  let pose = {pos: poses.far.pos.clone(), yaw: poses.far.yaw};
  let tween = null, cargoAttached = false, sparking = 0;

  // Targets are built once and kept. The stage builds them all while the
  // browser is idle after start-up and draws them once, so the first launch
  // neither rebuilds geometry nor waits on shader compilation.
  const targets = new Map();
  const CARGO_SEAT = new THREE.Vector3(-0.35, 1.07, 0);
  function targetFor(wreck) {
    if (!targets.has(wreck)) {
      const group = build(WRECKS[wreck]);
      group.position.copy(WRECK);
      let load = null;
      if (wreck === 'courier') { load = build(recorder); load.position.copy(CARGO_SEAT); group.add(load); }
      const radius = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere()).radius;
      group.visible = false;
      scene.add(group);
      targets.set(wreck, {group, cargo: load, radius});
    }
    return targets.get(wreck);
  }
  // Builds the next target not yet built; false once all exist.
  function prepareNext() {
    const next = Object.keys(WRECKS).find(w => !targets.has(w));
    if (next) targetFor(next);
    return Boolean(next);
  }
  // Warm-up only: show every target for one off-screen draw, then restore.
  function showAll(show) {
    for (const entry of targets.values()) entry.group.visible = show || entry.group === target;
  }

  function setContract(contractId, wreck, installed) {
    // Cargo taken aboard on an earlier run goes back onto its own wreck.
    for (const entry of targets.values()) {
      if (entry.cargo && entry.cargo.parent !== entry.group) entry.group.add(entry.cargo);
      if (entry.cargo) { entry.cargo.position.copy(CARGO_SEAT); entry.cargo.rotation.set(0, 0, 0); }
      entry.group.visible = false;
    }
    const entry = targetFor(wreck);
    wreckType = wreck;
    target = entry.group;
    cargo = entry.cargo;
    targetRadius = entry.radius;
    target.visible = true;
    target.rotation.set(0, 0, 0);
    poses = posesFor(targetRadius);
    vessel.setTool(installed);
    spinTarget = wreck === 'courier' ? 0.6 : 0.05;
    spin = spinTarget;
  }

  // The path sets where the vessel is; its attitude is flown. The nose swings
  // into the direction of travel as the burn starts and back to the station
  // heading while braking, the hull pitches with the climb and banks into turns, and each
  // axis follows with lag (critically damped springs), like a heavy craft.
  const flight = {yaw: 0, yawRate: 0, yawAccel: 0, pitch: 0, pitchRate: 0, bank: 0, bankRate: 0, last: null, velocity: new THREE.Vector3(), accel: new THREE.Vector3()};
  const vesselAt = (p) => { vessel.group.position.copy(p.pos); vessel.group.rotation.set(flight.bank, flight.yaw, flight.pitch); };
  function settleFlight() {
    Object.assign(flight, {yaw: pose.yaw, yawRate: 0, yawAccel: 0, pitch: 0, pitchRate: 0, bank: 0, bankRate: 0, last: null});
    flight.velocity.set(0, 0, 0);
    flight.accel.set(0, 0, 0);
    exhaust.off();
  }

  // Instant state for a given number of completed steps and their choices.
  function applyState(steps, operation) {
    const done = operation.step;
    const chose = (id) => { const i = steps.findIndex(s => s.id === id); return i >= 0 && i < done ? operation.choices[i] : null; };
    tween = null;
    clearPreview();
    cable.visible = false;
    sparks.material.opacity = 0;
    const returned = done >= steps.length;
    const at = returned ? poses.away : done > 1 ? poses.close : done === 1 ? poses.near : poses.far;
    pose = {pos: at.pos.clone(), yaw: at.yaw};
    settleFlight();
    vesselAt(pose);
    spin = spinTarget = chose('stabilize') ? 0 : (wreckType === 'courier' ? 0.6 : 0.05);
    cargoAttached = Boolean(chose('extract') || chose('swap') || chose('cut'));
    target.visible = !(returned && chose('extract') === 'nose');
    placeCargo();
  }

  function placeCargo() {
    if (!cargo) return;
    if (cargoAttached) {
      if (cargo.parent !== vessel.group) { vessel.group.add(cargo); }
      cargo.position.copy(TOOL_MOUNT).add(new THREE.Vector3(-2.1, -0.1, 0.1));
      cargo.rotation.set(0, 0, 0);
    }
  }

  // Where a decision takes the vessel and how long it runs. Shared by the
  // preview (drawn before the player commits) and the timeline itself.
  function motion(stepId, optionId, operation) {
    const from = {pos: pose.pos.clone(), yaw: pose.yaw};
    const m = {from, to: from, duration: 1600, path: null, cable: false, sparking: 0, after: null};
    if (stepId === 'approach') {
      m.to = poses.near;
      // The long way swings out behind the target, away from the camera.
      const mid = from.pos.clone().lerp(m.to.pos, 0.5).add(optionId === 'around' ? new THREE.Vector3(-1.7, 2.2, -4.7) : new THREE.Vector3(0, -0.3, 0));
      m.path = (k) => from.pos.clone().lerp(mid, k).lerp(mid.clone().lerp(m.to.pos, k), k);
      m.duration = 2200;
    } else if (stepId === 'stabilize' || (stepId === 'extract' && wreckType === 'lifeboat')) {
      m.to = poses.close;
      m.cable = optionId === 'winch';
      m.duration = m.cable ? 2400 : 1200;
    } else if (stepId === 'extract' || stepId === 'swap') {
      m.to = poses.close;
      m.after = () => { cargoAttached = true; placeCargo(); };
    } else if (stepId === 'cut' || stepId === 'breach') {
      m.to = poses.close;
      m.sparking = optionId === 'fast' || optionId === 'full' ? 1 : 0.6;
      m.duration = stepId === 'cut' && optionId === 'precise' ? 2400 : 1800;
    } else if (stepId === 'extra') {
      m.to = poses.close;
      m.duration = optionId === 'leave' ? 500 : 1400;
    } else if (stepId === 'return') {
      m.to = poses.away;
      const mid = from.pos.clone().lerp(m.to.pos, 0.35).add(new THREE.Vector3(0, 1, 0));
      m.path = (k) => from.pos.clone().lerp(mid, k).lerp(mid.clone().lerp(m.to.pos, k), k);
      m.duration = optionId === 'fast' ? 1600 : 2400;
      m.after = () => { if (wreckType === 'courier' && operation.choices.includes('nose')) target.visible = false; };
    }
    return m;
  }

  // Timeline for one decision. Returns its duration in milliseconds.
  function play(stepId, optionId, steps, operation) {
    clearPreview();
    const m = motion(stepId, optionId, operation);
    const option = steps.find(st => st.id === stepId)?.options.find(o => o.id === optionId);
    if (m.cable) cable.visible = true;
    if (stepId === 'stabilize' || (stepId === 'extract' && wreckType === 'lifeboat')) spinTarget = 0;
    sparking = m.sparking;
    const at = m.path ?? ((e) => m.from.pos.clone().lerp(m.to.pos, e));
    let length = 0;
    for (let i = 1; i <= 24; i++) length += at(i / 24).distanceTo(at((i - 1) / 24));
    // Real moves fly a burn, coast and brake; holding station keeps the old ease.
    const flies = length > 1;
    tween = {start: performance.now(), duration: m.duration, from: m.from, to: m.to, at, flies, profile: flies ? travel : ease,
      shake: option?.hull ? Math.min(1, -option.hull / 4) : 0,
      after: () => { cable.visible = false; sparking = 0; m.after?.(); }};
    return m.duration;
  }

  // Dashed preview of a chosen option: the flight path, or the cable run.
  const previewLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({color: '#e9e4d6', dashSize: 0.45, gapSize: 0.32, transparent: true, opacity: 0.75}));
  previewLine.visible = false;
  previewLine.frustumCulled = false;
  scene.add(previewLine);
  function preview(stepId, optionId, steps, operation) {
    if (!stepId || !optionId || tween) { clearPreview(); return; }
    const m = motion(stepId, optionId, operation);
    let points = null;
    if (m.path) points = Array.from({length: 48}, (_, i) => m.path(i / 47));
    else if (m.cable && target) points = [vessel.group.localToWorld(TOOL_MOUNT.clone().add(new THREE.Vector3(-1.2, 0, 0))), target.localToWorld(new THREE.Vector3(1.0, 0.6, 0))];
    else if (m.to.pos.distanceTo(pose.pos) > 0.3) points = [pose.pos.clone(), m.to.pos.clone()];
    if (!points) { clearPreview(); return; }
    previewLine.geometry.setFromPoints(points);
    previewLine.computeLineDistances();
    previewLine.visible = true;
  }
  function clearPreview() { previewLine.visible = false; }

  // Centre and size of the target, for the targeting brackets in the interface.
  function targetAnchor() {
    return target && target.visible ? {center: WRECK.clone(), radius: targetRadius} : null;
  }

  const tmp = new THREE.Vector3(), tangent = new THREE.Vector3(), forward = new THREE.Vector3(), side = new THREE.Vector3(), lastVelocity = new THREE.Vector3();
  let still = false;
  // Targets for the attitude springs from the path, then the springs, then the
  // thrust the motion implies. Returns whether the vessel is still settling.
  function fly(dt, now, reduced) {
    let yawTarget = pose.yaw, pitchTarget = 0, weight = 0;
    if (tween && tween.flies && !reduced) {
      const k = Math.min(1, (now - tween.start) / tween.duration);
      const e = tween.profile(k);
      tangent.subVectors(tween.at(Math.min(1, e + 0.01)), tween.at(Math.max(0, e - 0.01)));
      const level = Math.hypot(tangent.x, tangent.z);
      weight = THREE.MathUtils.smoothstep(k, 0.02, 0.22) * (1 - THREE.MathUtils.smoothstep(k, 0.72, 0.97));
      if (level > 1e-4) yawTarget = pose.yaw + wrapAngle(Math.atan2(tangent.z, -tangent.x) - pose.yaw) * weight;
      pitchTarget = -THREE.MathUtils.clamp(Math.atan2(tangent.y, level) * 0.8, -0.35, 0.35) * weight;
    }
    if (reduced) {
      settleFlight();
      flight.yaw = yawTarget;
      vesselAt(pose);
      return false;
    }
    // Velocity and acceleration of the hull, for banking and for the thrusters.
    const step = Math.max(dt, 1 / 240);
    lastVelocity.copy(flight.velocity);
    if (flight.last) flight.velocity.subVectors(pose.pos, flight.last).divideScalar(step);
    flight.last = (flight.last ?? new THREE.Vector3()).copy(pose.pos);
    tmp.subVectors(flight.velocity, lastVelocity).divideScalar(step);
    flight.accel.lerp(tmp, 1 - Math.exp(-dt * 12));
    const yawAccel = 3.4 * 3.4 * wrapAngle(yawTarget - flight.yaw) - 2 * 3.4 * flight.yawRate;
    flight.yawRate += yawAccel * dt;
    flight.yaw = wrapAngle(flight.yaw + flight.yawRate * dt);
    flight.yawAccel += (yawAccel - flight.yawAccel) * (1 - Math.exp(-dt * 10));
    const speed = flight.velocity.length();
    const bankTarget = THREE.MathUtils.clamp(flight.yawRate * speed * 0.07, -0.45, 0.45);
    flight.pitchRate += (3 * 3 * (pitchTarget - flight.pitch) - 2 * 3 * flight.pitchRate) * dt;
    flight.pitch += flight.pitchRate * dt;
    flight.bankRate += (2.6 * 2.6 * (bankTarget - flight.bank) - 2 * 2.6 * flight.bankRate) * dt;
    flight.bank += flight.bankRate * dt;
    vesselAt(pose);
    // Thrust implied by the motion: the main engines push along the nose,
    // braking and side forces come from the reaction-control pods.
    forward.set(-1, 0, 0).applyQuaternion(vessel.group.quaternion);
    side.set(0, 0, 1).applyQuaternion(vessel.group.quaternion);
    const along = flight.accel.dot(forward), across = flight.accel.dot(side);
    const cruising = tween && tween.flies ? THREE.MathUtils.smoothstep(speed, 0.4, 2) * (0.22 + 0.12 * Math.min(1, speed / 12)) : 0;
    const burning = exhaust.update({
      main: Math.min(1, THREE.MathUtils.clamp(along / 9, 0, 1) * 0.85 + cruising),
      retro: tween && tween.flies ? THREE.MathUtils.clamp(-along / 9, 0, 1) : 0,
      yaw: THREE.MathUtils.clamp(flight.yawAccel / 2.5, -1, 1),
      lateral: tween && tween.flies ? THREE.MathUtils.clamp(across / 6, -1, 1) : 0,
    }, dt, now);
    const settling = Math.abs(wrapAngle(yawTarget - flight.yaw)) + Math.abs(flight.yawRate) + Math.abs(flight.pitch) + Math.abs(flight.bank) + Math.abs(flight.pitchRate) + Math.abs(flight.bankRate) > 0.002;
    return burning || settling;
  }

  function update(dt, now, reduced) {
    still = reduced;
    let moving = false;
    if (tween) {
      const k = reduced ? 1 : Math.min(1, (now - tween.start) / tween.duration);
      const e = tween.profile(k);
      pose.pos.copy(tween.at(e));
      // Station heading: from the start heading to the end one, the short way.
      pose.yaw = tween.from.yaw + wrapAngle(tween.to.yaw - tween.from.yaw) * ease(k);
      moving = true;
    }
    if (fly(dt, now, reduced)) moving = true;
    if (tween && (reduced || now - tween.start >= tween.duration)) { tween.after?.(); tween = null; }
    spin += (spinTarget - spin) * (reduced ? 1 : 1 - Math.exp(-dt * 1.2));
    if (target && Math.abs(spin) > 0.002) { target.rotation.x += spin * dt; target.rotation.z += spin * 0.35 * dt; moving = true; }
    if (cable.visible && target) {
      const a = vessel.group.localToWorld(TOOL_MOUNT.clone().add(new THREE.Vector3(-1.2, 0, 0)));
      cable.geometry.setFromPoints([a, target.localToWorld(new THREE.Vector3(1.0, 0.6, 0))]);
      moving = true;
    }
    if (sparking || sparks.material.opacity > 0.01) {
      sparks.material.opacity += ((sparking ? 1 : 0) - sparks.material.opacity) * Math.min(1, dt * 6);
      const positions = sparks.geometry.attributes.position;
      const origin = vessel.group.localToWorld(TOOL_MOUNT.clone().add(new THREE.Vector3(-2.2, 0, 0.2)));
      for (let i = 0; i < positions.count; i++) {
        const life = ((now * 0.001 * (1 + (i % 7) * 0.2)) + i * 0.137) % 1;
        tmp.set(Math.sin(i * 12.9) , Math.cos(i * 7.3) , Math.sin(i * 3.1)).normalize().multiplyScalar(life * 2.2 * sparking);
        positions.setXYZ(i, origin.x + tmp.x, origin.y + tmp.y - life * life * 0.6, origin.z + tmp.z);
      }
      positions.needsUpdate = true;
      moving = true;
    }
    globe.rotation.y += reduced ? 0 : dt * 0.004;
    return moving;
  }

  // On station the shot holds vessel and target together. As the vessel
  // departs, framing hands over to the vessel alone, so the last beat shows it
  // heading home with the cargo rather than an empty field.
  const departure = () => THREE.MathUtils.smoothstep(vessel.group.position.distanceTo(WRECK), DEPART_FROM, DEPART_TO);
  // A hit to the hull shakes the shot briefly around the moment of impact.
  function shake(now) {
    if (!tween || !tween.shake || still) return null;
    const t = (now - tween.start) / tween.duration;
    if (t < 0.5 || t > 0.85) return null;
    const a = tween.shake * 0.16 * (1 - (t - 0.5) / 0.35);
    return new THREE.Vector3(Math.sin(now * 0.071) * a, Math.sin(now * 0.053 + 1) * a, Math.sin(now * 0.061 + 2) * a);
  }
  function cameraRig() {
    const v = vessel.group.position;
    const focus = v.clone().lerp(WRECK, 0.5 * (1 - departure()));
    const jolt = shake(performance.now());
    if (jolt) focus.add(jolt);
    return {target: focus, ...SHOT};
  }

  const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(v => new THREE.Vector3(...v));
  function framePoints() {
    const w = departure(), v = vessel.group.position;
    const other = WRECK.clone().lerp(v, w), radius = THREE.MathUtils.lerp(targetRadius, vesselRadius * 1.5, w);
    return [...AXES.map(d => d.clone().multiplyScalar(vesselRadius * (1 + 0.5 * w)).add(v)), ...AXES.map(d => d.clone().multiplyScalar(radius).add(other))];
  }

  return {scene, setContract, prepareNext, showAll, applyState, play, preview, clearPreview, targetAnchor, update, cameraRig, framePoints, isAnimating: () => Boolean(tween)};
}
