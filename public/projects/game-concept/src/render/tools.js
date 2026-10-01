import * as THREE from 'three';
import {Assembly, AXIS, cylinder, extrude, lathe, roundedBox, torus} from './kit.js';
import {decalMaterial, getMaterials, stencil} from './materials.js';

// Three interchangeable utility modules. Each faces -X and carries the same
// universal coupling at +X, so the vessel saddle and the bench cradle can hold
// any of them at the same origin.

const PI = Math.PI;
const cache = new Map();
let labels;

function getLabels() {
  labels ??= {
    kestrel: decalMaterial(stencil('KESTREL C-8', {color: '#26241f', size: 150})),
    latch: decalMaterial(stencil('LATCH G-2', {color: '#26241f', size: 160})),
    helios: decalMaterial(stencil('HELIOS A-9', {color: '#26241f', size: 150})),
  };
  return labels;
}

// Support point under each module on the bench turntable (module X of the
// part that rests on the pads).
export const BENCH_SUPPORT = {cutter: 0.2, grapple: 0.42, arc: 0.31};

function coupling(a, m) {
  a.add(lathe([[0, 0.82], [0.18, 0.82], [0.24, 0.84], [0.33, 0.96], [0.33, 1.08], [0.27, 1.12], [0, 1.12]], {segments: 40, fillet: 0.02}), m.gunmetal, {rotation: AXIS.x});
  a.add(torus(0.33, 0.024, {tubular: 56}), m.frame, {position: [1.02, 0, 0], rotation: [0, PI / 2, 0]});
  // Bolt heads stand proud of the flange face rather than flush with it.
  const bolt = cylinder(0.024, 0.04, {segments: 8, bevel: 0.006});
  for (let i = 0; i < 8; i++) {
    const angle = i * PI / 4 + PI / 8;
    a.add(bolt, m.steel, {position: [1.12, Math.cos(angle) * 0.2, Math.sin(angle) * 0.2], rotation: AXIS.x});
  }
  a.add(cylinder(0.2, 0.34, {bevel: 0.03}), m.frame, {position: [0.72, 0, 0], rotation: AXIS.x});
}

function cutter(a, m) {
  a.add(roundedBox(1.4, 0.62, 0.7, 0.1, 3), m.frame, {position: [0.05, 0, 0]});
  a.add(roundedBox(0.96, 0.2, 0.78, 0.07, 3), m.orange, {position: [0.18, 0.31, 0]});
  a.add(roundedBox(0.92, 0.14, 0.74, 0.05, 3), m.orange, {position: [0.2, -0.32, 0]});
  a.add(new THREE.PlaneGeometry(0.62, 0.12), getLabels().kestrel, {position: [0.18, 0.412, 0.02], rotation: [-PI / 2, 0, PI], edge: 0});
  for (const z of [-0.22, 0.22]) {
    // Emitter barrel: sleeve, finned cooling stack, ceramic nozzle, lens.
    const fins = [[0, -0.46], [0.15, -0.46], [0.16, -0.4]];
    for (let i = 6; i >= 0; i--) fins.push([0.17, 0.055 - i * 0.07], [0.2, 0.075 - i * 0.07], [0.2, 0.1 - i * 0.07], [0.17, 0.12 - i * 0.07]);
    fins.push([0.18, 0.2], [0.19, 0.5], [0, 0.5]);
    a.add(lathe(fins, {segments: 32}), m.gunmetal, {position: [-0.55, 0, z], rotation: AXIS.x});
    a.add(lathe([[0, -0.72], [0.07, -0.72], [0.1, -0.7], [0.13, -0.62], [0.15, -0.52], [0.15, -0.46], [0, -0.46]], {segments: 28, fillet: 0.015}), m.ceramic, {position: [-0.55, 0, z], rotation: AXIS.x});
    a.add(cylinder(0.052, 0.02, {bevel: 0.005}), m.teal, {position: [-1.28, 0, z], rotation: AXIS.x, edge: 0});
    a.add(torus(0.205, 0.018), m.copper, {position: [-0.2, 0, z], rotation: [0, PI / 2, 0]});
    a.between([-1.05, 0.2, z * 1.05], [0.35, 0.36, z], 0.026, m.chrome, {segments: 10});
  }
  for (let i = 0; i < 7; i++) a.add(roundedBox(0.035, 0.36, 0.03, 0.012), m.dark, {position: [-0.12 + i * 0.075, 0.02, 0.354], edge: 0});
  a.add(lathe([[0, -0.2], [0.09, -0.19], [0.1, 0.18], [0.07, 0.21], [0, 0.21]], {segments: 20, fillet: 0.02}), m.ochre, {position: [0.35, -0.12, -0.42], rotation: AXIS.x});
  // Power from the body side and coolant from the ochre tank run outside the
  // body to glands on the exposed front of each barrel.
  a.cable([[0.3, -0.2, 0.35], [0.2, -0.3, 0.46], [-0.4, -0.3, 0.47], [-0.7, -0.18, 0.42], [-0.8, -0.1, 0.39]], 0.032, m.rubber, m.gunmetal);
  a.cable([[0.56, -0.12, -0.42], [0.68, -0.14, -0.43], [0.62, -0.3, -0.47], [0, -0.31, -0.47], [-0.6, -0.2, -0.44], [-0.8, -0.1, -0.39]], 0.02, m.copper, m.gunmetal);
  const bolt = cylinder(0.02, 0.02, {segments: 8, bevel: 0.005});
  for (const [x, z] of [[-0.18, -0.26], [-0.18, 0.26], [0.55, -0.26], [0.55, 0.26]]) a.add(bolt, m.steel, {position: [x, 0.412, z]});
}

// Point in a finger's local frame (x along the tool, r radial, t tangential).
function framePoint(angle, x, r, t = 0) {
  return [x, r * Math.cos(angle) - t * Math.sin(angle), r * Math.sin(angle) + t * Math.cos(angle)];
}

function grapple(a, m) {
  // Hub housing with an exposed winch drum and cable windings.
  a.add(lathe([[0, -0.05], [0.2, -0.05], [0.3, -0.02], [0.36, 0.1], [0.36, 0.2], [0.34, 0.22], [0, 0.22]], {segments: 44, fillet: 0.03}), m.orange, {rotation: AXIS.x});
  a.add(cylinder(0.27, 0.34, {bevel: 0.01, segments: 44}), m.steel, {position: [0.39, 0, 0], rotation: AXIS.x});
  // Cable pack as one wound surface: separate rings left drum-coloured gaps
  // one or two pixels wide that shimmered as the camera moved.
  const pack = [[0.262, 0.236]];
  for (let x = 0.236; x < 0.5405; x += 0.034 / 8) pack.push([0.28 + 0.006 * Math.cos(2 * PI * (x - 0.25) / 0.034), x]);
  pack.push([0.262, 0.54], [0.262, 0.236]);
  a.add(lathe(pack, {segments: 48}), m.copper, {rotation: AXIS.x});
  a.add(lathe([[0.27, 0.56], [0.3, 0.56], [0.36, 0.58], [0.38, 0.66], [0.3, 0.74], [0.27, 0.74], [0.27, 0.56]], {segments: 44, fillet: 0.02}), m.frame, {rotation: AXIS.x});
  a.add(lathe([[0.27, 0.2], [0.3, 0.2], [0.36, 0.22], [0.38, 0.24], [0.3, 0.26], [0.27, 0.26], [0.27, 0.2]], {segments: 44}), m.frame, {rotation: AXIS.x});
  // Central winch line and magnetic clamp head.
  a.add(cylinder(0.018, 0.9, {bevel: 0.004, segments: 10}), m.steel, {position: [-0.5, 0, 0], rotation: AXIS.x});
  a.add(lathe([[0, -0.1], [0.14, -0.1], [0.16, -0.07], [0.16, 0.02], [0.08, 0.06], [0.03, 0.1], [0, 0.1]], {segments: 36, fillet: 0.02}), m.gunmetal, {position: [-0.98, 0, 0], rotation: AXIS.x});
  a.add(cylinder(0.12, 0.012, {bevel: 0.003, segments: 32}), m.amber, {position: [-1.085, 0, 0], rotation: AXIS.x, edge: 0});

  // Three articulated fingers: clevis side plates, claw link, actuator, pins.
  const clevis = [[0.22, 0.12], [0.22, 0.3], [-0.05, 0.47], [-0.5, 0.64], [-0.7, 0.62], [-0.74, 0.5], [-0.6, 0.44], [-0.14, 0.28], [0.06, 0.14]];
  const claw = [[-0.56, 0.62], [-0.9, 0.6], [-1.18, 0.47], [-1.36, 0.29], [-1.34, 0.18], [-1.2, 0.2], [-0.98, 0.35], [-0.66, 0.46]];
  const plate = extrude(clevis, 0.035, {fillet: 0.035, bevel: 0.008});
  const link = extrude(claw, 0.1, {fillet: 0.035, bevel: 0.014});
  const pad = roundedBox(0.2, 0.05, 0.12, 0.018);
  const pin = cylinder(0.035, 0.2, {bevel: 0.008, segments: 16});
  for (const angle of [0, 2 * PI / 3, 4 * PI / 3]) {
    const rotation = [angle, 0, 0];
    for (const side of [-0.07, 0.07]) a.add(plate, m.orange, {position: framePoint(angle, 0, 0, side), rotation});
    a.add(link, m.orange, {rotation});
    a.add(pad, m.rubber, {position: framePoint(angle, -1.1, 0.29), rotation: [angle, 0, 0.62]});
    a.add(roundedBox(0.09, 0.05, 0.09, 0.015), m.steel, {position: framePoint(angle, -1.33, 0.22), rotation: [angle, 0, 0.9]});
    for (const [x, r] of [[0.12, 0.22], [-0.62, 0.54]]) a.add(pin, m.steel, {position: framePoint(angle, x, r), rotation: [angle + PI / 2, 0, 0]});
    a.between(framePoint(angle, 0.45, 0.38), framePoint(angle, -0.08, 0.6), 0.05, m.gunmetal);
    a.between(framePoint(angle, -0.08, 0.6), framePoint(angle, -0.42, 0.66), 0.024, m.chrome);
    a.cable([framePoint(angle, 0.6, 0.365, 0.05), framePoint(angle, 0.5, 0.44, 0.1), framePoint(angle, 0.3, 0.442, 0.05)], 0.016, m.rubber, m.gunmetal);
  }
  a.add(new THREE.PlaneGeometry(0.34, 0.08), getLabels().latch, {position: [0.1, 0.372, 0], rotation: [-PI / 2, 0, PI], edge: 0});
}

function plasmaArray(a, m) {
  // The body ends behind the coil stack, so the coils wind round the open
  // barrel instead of cutting through the housing.
  a.add(roundedBox(0.83, 0.76, 0.86, 0.12, 3), m.frame, {position: [0.355, 0, 0]});
  for (const sign of [-1, 1]) {
    a.add(roundedBox(0.62, 0.12, 0.9, 0.04, 2), m.ceramic, {position: [0.31, sign * 0.43, 0]});
    for (let i = 0; i < 5; i++) a.add(roundedBox(0.04, 0.04, 0.78, 0.012), m.dark, {position: [0.07 + i * 0.12, sign * 0.49, 0], edge: 0});
    for (let i = 0; i < 3; i++) a.add(lathe([[0, -0.16], [0.07, -0.15], [0.075, 0.14], [0.05, 0.17], [0, 0.17]], {segments: 16, fillet: 0.015}), m.steel, {position: [0.52 - i * 0.2, sign * 0.2, 0.47], rotation: AXIS.z});
  }
  // Coil stack: copper windings on ceramic standoffs around the barrel.
  a.add(cylinder(0.3, 1.5, {bevel: 0.02, segments: 36}), m.dark, {position: [-0.3, 0, 0], rotation: AXIS.x});
  const standoff = cylinder(0.035, 0.12, {bevel: 0.01, segments: 10});
  for (const x of [-0.72, -0.52, -0.32, -0.12]) {
    a.add(torus(0.39, 0.06, {tubular: 64, radial: 14}), m.copper, {position: [x, 0, 0], rotation: [0, PI / 2, 0]});
    a.add(torus(0.3, 0.02, {tubular: 48}), m.teal, {position: [x - 0.06, 0, 0], rotation: [0, PI / 2, 0], edge: 0});
    for (let i = 0; i < 6; i++) {
      const angle = i * PI / 3;
      a.add(standoff, m.ceramic, {position: [x, Math.cos(angle) * 0.33, Math.sin(angle) * 0.33], rotation: [angle, 0, 0]});
    }
  }
  a.add(lathe([[0.3, -0.08], [0.4, -0.08], [0.42, 0], [0.42, 0.12], [0.36, 0.16], [0.3, 0.16], [0.3, -0.08]], {segments: 44, fillet: 0.02}), m.ochre, {position: [-0.95, 0, 0], rotation: AXIS.x});
  a.add(lathe([[0, 0.1], [0.34, 0.1], [0.3, 0.24], [0.2, 0.4], [0.13, 0.46], [0, 0.47]], {segments: 36, fillet: 0.02}), m.ceramic, {position: [-1.46, 0, 0], rotation: [0, 0, PI / 2]});
  a.add(cylinder(0.08, 0.02, {bevel: 0.005}), m.teal, {position: [-1.93, 0, 0], rotation: AXIS.x, edge: 0});
  // Four struts carry the emitter cone from the ochre ring.
  for (let i = 0; i < 4; i++) {
    const angle = PI / 4 + i * PI / 2;
    a.between([-0.95, Math.cos(angle) * 0.36, Math.sin(angle) * 0.36], [-1.63, Math.cos(angle) * 0.28, Math.sin(angle) * 0.28], 0.03, m.steel);
  }
  // Two feeds from glands on the body's rear face to the ochre emitter ring.
  a.cable([[0.77, -0.22, 0.28], [0.92, -0.3, 0.4], [0.75, -0.42, 0.6], [0, -0.44, 0.62], [-0.6, -0.4, 0.58], [-0.88, -0.24, 0.44], [-0.93, -0.17, 0.38]], 0.045, m.rubber, m.gunmetal);
  a.cable([[0.77, 0.22, -0.28], [0.92, 0.3, -0.4], [0.75, 0.42, -0.6], [0, 0.44, -0.62], [-0.6, 0.4, -0.58], [-0.88, 0.24, -0.44], [-0.93, 0.17, -0.38]], 0.045, m.rubber, m.gunmetal);
  a.add(new THREE.PlaneGeometry(0.46, 0.11), getLabels().helios, {position: [0.2, 0.5, 0.2], rotation: [-PI / 2, 0, PI], edge: 0});
}

const builders = {cutter, grapple, arc: plasmaArray};

export function createTool(kind) {
  if (!builders[kind]) throw new RangeError(`Unknown utility module: ${kind}`);
  if (!cache.has(kind)) {
    const m = getMaterials();
    const a = new Assembly(`module / ${kind}`);
    coupling(a, m);
    builders[kind](a, m);
    const group = a.finish();
    group.userData.kind = kind;
    cache.set(kind, group);
  }
  // Clones share geometry and materials; only transforms are independent.
  return cache.get(kind).clone(true);
}
