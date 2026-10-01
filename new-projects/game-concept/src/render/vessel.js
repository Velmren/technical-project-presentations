import * as THREE from 'three';
import {Assembly, AXIS, cylinder, extrude, hullLoft, lathe, roundedBox, torus} from './kit.js';
import {decalMaterial, decalTexture, getMaterials, stencil} from './materials.js';
import {createTool} from './tools.js';

// MULE-06, an original orbital salvage tug. Vessel space: -X forward, +Y up,
// +Z is the service side carrying the utility hardpoint. Units are metres.

const PI = Math.PI;
export const TOOL_MOUNT = new THREE.Vector3(-0.88, -0.05, 1.96);
// Main engines (centre x and z, radial scale; nozzle exit 0.98 m aft of x at
// y = -0.13) and reaction-control pods with the directions their nozzles fire.
export const ENGINES = [{x: 2.33, z: -1.11, scale: 0.97}, {x: 2.66, z: 1.1, scale: 1.06}];
export const ENGINE_Y = -0.13, NOZZLE_EXIT = 0.98;
export const RCS = [
  {at: [-2.85, 0, -0.98], jets: [[0, 0, -1], [-1, 0, 0]]},
  {at: [-2.85, 0, 0.98], jets: [[0, 0, 1], [-1, 0, 0]]},
  {at: [1.3, 0.05, -0.9], jets: [[0, 0, -1]]},
  {at: [1.3, 0.05, 0.9], jets: [[0, 0, 1]]},
];
// Where a pod's nozzle opens, in vessel space.
export const jetOrigin = (at, dir) => at.map((v, i) => v + dir[i] * (i === 2 ? 0.095 : 0.125));

// Plane through two horizontal edges of the cabin loft; used to seat the
// windshield exactly on the sloped nose surface.
function slopeFrame(from, to) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const along = end.clone().sub(start);
  const length = along.length();
  along.normalize();
  const normal = new THREE.Vector3(-along.y, along.x, 0);
  return {start, along, normal, length, point: (s, z, lift = 0) => start.clone().addScaledVector(along, s * length).addScaledVector(normal, lift).setZ(z)};
}

function quad(points) {
  const geometry = new THREE.BufferGeometry();
  const [a, b, c, d] = points;
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  geometry.computeVertexNormals();
  return geometry;
}

function engine(a, m, x, z, scale) {
  const y = ENGINE_Y;
  const rot = AXIS.x;
  // Structural shroud: rolled intake lip, inner duct wall, a bulkhead behind
  // the intake and three load rings.
  a.add(lathe([[0.46, -0.78], [0.6, -0.72], [0.63, -0.5], [0.63, 0.34], [0.58, 0.46], [0.5, 0.48], [0.44, 0.44], [0.44, -0.72], [0.46, -0.78]], {segments: 40, fillet: 0.035}), m.frame, {position: [x, y, z], rotation: rot, scale: [scale, 1, scale]});
  a.add(cylinder(0.445 * scale, 0.04, {segments: 40, bevel: 0.01}), m.dark, {position: [x + 0.3, y, z], rotation: rot});
  for (const offset of [-0.52, -0.1, 0.3]) a.add(torus(0.628 * scale, 0.034, {tubular: 56}), m.steel, {position: [x + offset, y, z], rotation: [0, PI / 2, 0]});
  // Bell nozzle: thin wall, flared, heat-darkened; the throat glows faintly.
  a.add(lathe([[0.3, 0.44], [0.33, 0.52], [0.46, 0.72], [0.56, 0.9], [0.585, 0.97], [0.56, 0.98], [0.52, 0.9], [0.42, 0.72], [0.29, 0.54], [0.27, 0.46], [0.3, 0.44]], {segments: 44, fillet: 0.02}), m.nozzle, {position: [x, y, z], rotation: rot, scale: [scale, 1, scale]});
  a.add(cylinder(0.265 * scale, 0.05, {segments: 32, bevel: 0.01}), m.teal, {position: [x + 0.47, y, z], rotation: rot});
  a.add(lathe([[0, 0.3], [0.14, 0.36], [0.2, 0.46], [0.08, 0.6], [0, 0.62]], {segments: 24}), m.gunmetal, {position: [x, y, z], rotation: rot, scale: [scale, 1, scale]});
  // Gimbal actuators on the shroud.
  for (const side of [-1, 1]) {
    a.between([x - 0.2, y + side * 0.5 * scale, z + 0.36 * scale], [x + 0.5, y + side * 0.42 * scale, z + 0.33 * scale], 0.045, m.gunmetal);
    a.between([x + 0.2, y + side * 0.46 * scale, z + 0.35 * scale], [x + 0.62, y + side * 0.4 * scale, z + 0.32 * scale], 0.022, m.chrome);
  }
  // Heat-shield slats, and a power cable from the drive block to the pod box.
  for (let i = 0; i < 10; i++) {
    const angle = i * PI / 5 + 0.3;
    const cy = y + Math.cos(angle) * 0.642 * scale, cz = z + Math.sin(angle) * 0.642 * scale;
    a.add(roundedBox(0.5, 0.05, 0.14, 0.012), i % 5 === 0 ? m.orange : m.gunmetal, {position: [x - 0.2, cy, cz], rotation: [angle, 0, 0]});
  }
  a.add(roundedBox(0.9, 0.16, 0.46, 0.04), m.orange, {position: [x - 0.25, y + 0.66 * scale, z], rotation: [0, 0, 0]});
  const top = y + 0.66 * scale + 0.08, side = Math.sign(z);
  a.cable([[1.66, 0.545, side * 0.55], [1.7, 0.7, side * 0.68], [x - 0.55, top + 0.14, z * 0.9], [x - 0.45, top, z * 0.93]], 0.032, m.copper, m.gunmetal);
}

function skid(a, m, sign) {
  const z = sign * 1.18;
  a.add(hullLoft([
    {x: -2.3, w: 0.2, h: 0.1, y: -1.1, z, r: 0.04},
    {x: -1.95, w: 0.28, h: 0.17, y: -1.22, z, r: 0.05},
    {x: 1.2, w: 0.28, h: 0.17, y: -1.22, z, r: 0.05},
    {x: 1.42, w: 0.2, h: 0.1, y: -1.13, z, r: 0.04},
  ]), m.frame);
  a.add(roundedBox(2.9, 0.05, 0.3, 0.015), m.steel, {position: [-0.35, -1.318, z]});
  a.add(roundedBox(0.52, 0.07, 0.31, 0.02), m.orange, {position: [-1.45, -1.29, z]});
  for (const x of [-1.9, 0.76]) {
    a.between([x, -0.58, sign * 0.84], [x + 0.13, -1.13, z], 0.075, m.frame);
    a.between([x + 0.22, -0.64, sign * 0.78], [x + 0.2, -1.1, sign * 1.15], 0.04, m.chrome);
    a.add(cylinder(0.095, 0.2, {bevel: 0.02}), m.gunmetal, {position: [x + 0.15, -1.07, z], rotation: AXIS.z});
  }
}

let decals;
function getDecals() {
  if (decals) return decals;
  decals = {
    name: decalMaterial(stencil('MULE 06', {color: '#2a2a25', size: 180})),
    brand: decalMaterial(stencil('LACUNA', {color: '#262621', size: 176, spacing: 18})),
    hazard: decalMaterial(decalTexture(1024, 64, (ctx, w, h) => {
      ctx.fillStyle = '#c29a38'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1d1d1a';
      for (let x = -h; x < w + h; x += 48) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 24, h); ctx.lineTo(x + 24 + h, 0); ctx.lineTo(x + h, 0); ctx.fill(); }
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 90; i++) { ctx.globalAlpha = Math.random() * 0.7; ctx.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 20, 2 + Math.random() * 4); }
    })),
    noStep: decalMaterial(decalTexture(256, 256, (ctx, w) => {
      ctx.strokeStyle = '#3b3f37'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(w / 2, w / 2, 100, 0, PI * 2); ctx.stroke();
      ctx.fillStyle = '#3b3f37';
      ctx.beginPath(); ctx.ellipse(w / 2, 150, 34, 52, 0, 0, PI * 2); ctx.fill();
      for (const [dx, dy, r] of [[-30, 82, 12], [-8, 70, 13], [16, 70, 12], [36, 82, 11]]) { ctx.beginPath(); ctx.arc(w / 2 + dx, dy, r, 0, PI * 2); ctx.fill(); }
      ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(58, 58); ctx.lineTo(198, 198); ctx.stroke();
    }), {opacity: 0.85}),
    soot: decalMaterial(decalTexture(256, 256, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(18,16,14,0.75)'); g.addColorStop(0.6, 'rgba(18,16,14,0.3)'); g.addColorStop(1, 'rgba(18,16,14,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, w);
    }), {roughness: 0.8}),
    streak: decalMaterial(decalTexture(64, 256, (ctx, w, h) => {
      for (let i = 0; i < 9; i++) {
        const x = 6 + i * 6 + Math.random() * 4, g = ctx.createLinearGradient(0, 0, 0, h * (0.5 + Math.random() * 0.5));
        g.addColorStop(0, 'rgba(30,26,20,0.55)'); g.addColorStop(1, 'rgba(30,26,20,0)');
        ctx.fillStyle = g; ctx.fillRect(x, 0, 2 + Math.random() * 3, h);
      }
    }), {roughness: 0.8}),
    labels: ['O2 / 4', 'H2O', '82 KW', 'TOW 18T', 'SERVICE'].map(text => decalMaterial(stencil(text, {color: '#2f302b', size: 150}))),
    cockpit: decalTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#05090a'; ctx.fillRect(0, 0, w, h);
      const glow = ctx.createLinearGradient(0, h, 0, 0);
      glow.addColorStop(0, 'rgba(60,140,135,0.35)'); glow.addColorStop(0.5, 'rgba(20,50,52,0.1)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 38; i++) {
        ctx.fillStyle = i % 5 === 0 ? 'rgba(255,180,90,0.9)' : 'rgba(120,230,220,0.8)';
        ctx.fillRect(40 + (i % 19) * 23, h - 60 - Math.floor(i / 19) * 22, 8 + (i % 3) * 5, 4);
      }
      ctx.fillStyle = 'rgba(120,230,220,0.25)'; ctx.fillRect(150, h - 120, 210, 46);
    }),
  };
  return decals;
}

function decal(a, material, w, h, position, rotation = [0, 0, 0]) {
  a.add(new THREE.PlaneGeometry(w, h), material, {position, rotation, edge: 0});
}

// Secondary detail: service panels, vents, stencils, handrails, soot and the
// cockpit console glow on the glazing. These break up the large hull surfaces.
function details(a, m, d) {
  const tilt = 0.073;
  for (const sign of [-1, 1]) {
    // Upper handrail on standoffs along the cabin shoulder.
    a.between([-1.7, 0.86, sign * 0.97], [0.35, 0.78, sign * 0.98], 0.016, m.steel, {segments: 8});
    for (const x of [-1.6, -0.9, -0.2, 0.3]) a.between([x, 0.8 - (x + 1.6) * 0.03, sign * 0.93], [x, 0.86 - (x + 1.6) * 0.04, sign * 0.975], 0.012, m.steel, {segments: 6});
    // Lower access panels with recessed frames and latch bolts.
    for (const [x, w] of [[-2.55, 0.34], [-1.12, 0.46], [1.0, 0.42]]) {
      a.add(roundedBox(w + 0.04, 0.3, 0.02, 0.02), m.frame, {position: [x, -0.33, sign * 1.058], rotation: [sign * tilt, 0, 0]});
      a.add(roundedBox(w, 0.26, 0.026, 0.018), x > 0 ? m.panelAlt : m.panel, {position: [x, -0.33, sign * 1.066], rotation: [sign * tilt, 0, 0]});
      a.add(cylinder(0.014, 0.012, {segments: 8, bevel: 0.004}), m.steel, {position: [x + w / 2 - 0.04, -0.33, sign * 1.082], rotation: AXIS.z});
    }
  }
  // Service-side vent grille between the hatch and the drive section.
  a.add(roundedBox(0.5, 0.56, 0.03, 0.035), m.frame, {position: [0.78, 0.2, 1.02], rotation: [-tilt, 0, 0]});
  for (let i = 0; i < 7; i++) a.add(roundedBox(0.42, 0.028, 0.05, 0.01), m.gunmetal, {position: [0.78, -0.03 + i * 0.075, 1.035], rotation: [-tilt - 0.5, 0, 0]});
  decal(a, d.streak, 0.36, 0.62, [0.78, -0.4, 1.028], [-tilt, 0, 0]);
  // Replaced plate on the port side, a slightly different paint batch.
  a.add(roundedBox(0.9, 0.46, 0.028, 0.03), m.panelAlt, {position: [-0.55, 0.36, -1.05], rotation: [tilt, 0, 0]});
  decal(a, d.labels[0], 0.36, 0.09, [-0.55, 0.36, -1.066], [tilt, PI, 0]);
  // Stencils: water, reactor output, tow point, service access.
  decal(a, d.labels[1], 0.3, 0.075, [0.24, -0.02, -1.405], [0, PI, 0]);
  decal(a, d.labels[2], 0.34, 0.085, [0.29, 0.932, 0.82], [-PI / 2, 0, 0]);
  decal(a, d.labels[3], 0.36, 0.09, [-3.35, -0.46, 0.35], [0, -PI / 2, 0]);
  decal(a, d.labels[4], 0.42, 0.105, [-0.36, 0.47, 1.147]);
  // Soot around the drive block and under the engine pods.
  for (const [x, y, z, size, rot] of [[1.83, 0.2, 0.81, 0.9, [0, 0, 0]], [1.83, 0.2, -0.81, 0.9, [0, PI, 0]], [1.64, 0.56, 0, 1.1, [-PI / 2, 0, 0]], [2.02, -0.02, 0.61, 0.7, [0, 0, 0]]]) {
    decal(a, d.soot, size, size * 0.8, [x, y, z], rot);
  }
  // Sensor dome on the nose.
  a.add(lathe([[0, 0], [0.11, 0], [0.105, 0.04], [0.07, 0.09], [0, 0.11]], {segments: 24, fillet: 0.02}), m.glass, {position: [-2.9, 0.43, -0.35], edge: 0});
  a.add(cylinder(0.12, 0.03, {bevel: 0.008}), m.frame, {position: [-2.9, 0.42, -0.35]});
}

export function createVessel() {
  const m = getMaterials();
  const d = getDecals();
  const a = new Assembly('MULE-06');
  const glazing = m.glass.clone();
  glazing.emissiveMap = d.cockpit;
  glazing.emissive.set('#ffffff');
  glazing.emissiveIntensity = 0.55;

  // Pressure cabin: rounded trapezoid sections, lofted from nose to drive.
  const nose = {x: -3.14, w: 1.9, h: 1.0, y: -0.08, top: 0.82, r: 0.2};
  const shoulder = {x: -2.5, w: 2.08, h: 1.62, y: 0.12, top: 0.86, r: 0.24};
  a.add(hullLoft([
    {x: -3.32, w: 1.26, h: 0.56, y: -0.18, top: 0.78, r: 0.13},
    nose, shoulder,
    {x: -1.3, w: 2.16, h: 1.64, y: 0.13, top: 0.9, r: 0.26},
    {x: 0.55, w: 2.12, h: 1.46, y: 0.07, top: 0.9, r: 0.26},
    {x: 1.58, w: 1.7, h: 1.2, y: -0.02, top: 0.92, r: 0.24},
  ]), m.hull);
  // Keel / impact shoe.
  a.add(hullLoft([
    {x: -3.4, w: 1.2, h: 0.16, y: -0.4, r: 0.06},
    {x: -2.6, w: 1.88, h: 0.26, y: -0.66, r: 0.08},
    {x: 1.75, w: 1.6, h: 0.3, y: -0.62, r: 0.09},
  ]), m.frame);

  // Windshield: bezel, three laminated panes, mullions, wiper-less clear view.
  const topOf = (s) => s.y + s.h / 2;
  const slope = slopeFrame([nose.x, topOf(nose), 0], [shoulder.x, topOf(shoulder), 0]);
  const halfAt = (s) => THREE.MathUtils.lerp(nose.w * nose.top / 2 - nose.r, shoulder.w * shoulder.top / 2 - shoulder.r, s);
  a.add(quad([slope.point(0.06, -halfAt(0.06) - 0.02, 0.004), slope.point(0.06, halfAt(0.06) + 0.02, 0.004), slope.point(0.95, halfAt(0.95) + 0.02, 0.004), slope.point(0.95, -halfAt(0.95) - 0.02, 0.004)]), m.dark, {edge: 0});
  const panes = [[-1, -0.36], [-0.32, 0.32], [0.36, 1]];
  for (const [left, right] of panes) {
    const s0 = 0.12, s1 = 0.9;
    a.add(quad([
      slope.point(s0, left * halfAt(s0), 0.012), slope.point(s0, right * halfAt(s0), 0.012),
      slope.point(s1, right * halfAt(s1), 0.012), slope.point(s1, left * halfAt(s1), 0.012),
    ]), glazing, {edge: 0});
  }
  for (const t of [-0.34, 0.34]) {
    const p0 = slope.point(0.08, t * halfAt(0.08), 0.02), p1 = slope.point(0.93, t * halfAt(0.93), 0.02);
    a.between(p0.toArray(), p1.toArray(), 0.022, m.frame, {segments: 8});
  }
  a.between(slope.point(0.97, -halfAt(0.97) - 0.08, 0.03).toArray(), slope.point(0.97, halfAt(0.97) + 0.08, 0.03).toArray(), 0.035, m.frame);
  // Sun visor lip over the glazing.
  a.add(roundedBox(0.26, 0.05, 1.86, 0.02), m.frame, {position: [shoulder.x + 0.02, topOf(shoulder) + 0.02, 0], rotation: [0, 0, -0.12]});

  for (const sign of [-1, 1]) {
    // Quarter windows follow the cabin shoulder.
    const zWin = sign * 1.05;
    a.add(roundedBox(0.94, 0.3, 0.03, 0.05), m.dark, {position: [-1.96, 0.63, zWin], rotation: [sign * -0.08, 0, 0]});
    a.add(roundedBox(0.84, 0.21, 0.02, 0.04), m.glass, {position: [-1.96, 0.63, zWin + sign * 0.012], rotation: [sign * -0.08, 0, 0]});
    // Armour patch with a rebate, bolt row and the hull name.
    a.add(roundedBox(1.14, 0.48, 0.05, 0.035), m.frame, {position: [-2.0, 0.1, sign * 1.075]});
    a.add(roundedBox(1.08, 0.43, 0.06, 0.03), m.panel, {position: [-2.0, 0.1, sign * 1.09]});
    a.add(roundedBox(1.03, 0.15, 0.07, 0.025), m.orange, {position: [-2.0, -0.26, sign * 1.088]});
    const boltGeo = cylinder(0.022, 0.02, {segments: 8, bevel: 0.006});
    for (const bx of [-2.47, -2.16, -1.84, -1.53]) for (const by of [0.28, -0.07]) a.add(boltGeo, m.steel, {position: [bx, by, sign * 1.123], rotation: AXIS.z});
    decal(a, d.name, 0.9, 0.2, [-2.0, 0.1, sign * 1.1215], [0, sign < 0 ? PI : 0, 0]);
    // Impact rails tie cabin bulkhead to drive frame.
    a.between([-2.83, -0.48, sign * 0.9], [1.81, -0.57, sign * 1.08], 0.07, m.frame);
    a.between([-1.23, 0.82, sign * 0.86], [-1.23, -0.6, sign * 1.12], 0.065, m.frame);
    a.between([0.9, 0.65, sign * 0.9], [1.3, -0.6, sign * 1.08], 0.065, m.frame);
    a.between([-1.27, 0.84, sign * 0.88], [1.18, 0.69, sign * 0.93], 0.05, m.steel);
    for (const x of [-1.22, 0.96]) a.add(roundedBox(0.29, 0.2, 0.1, 0.03), m.gunmetal, {position: [x, -0.53, sign * 1.12]});
    // Nose work lamps: housings on the nose face, lens proud of the bezel, a brow above.
    a.add(roundedBox(0.12, 0.15, 0.24, 0.03), m.frame, {position: [-3.37, -0.03, sign * 0.36]});
    a.add(roundedBox(0.02, 0.09, 0.18, 0.008), m.amber, {position: [-3.435, -0.03, sign * 0.36], edge: 0});
    a.add(roundedBox(0.1, 0.02, 0.26, 0.008), m.frame, {position: [-3.4, 0.055, sign * 0.36]});
  }

  // Nose bumper, tow eye and sensor.
  a.add(roundedBox(0.2, 0.24, 1.36, 0.06), m.orange, {position: [-3.34, -0.29, 0]});
  a.add(cylinder(0.115, 0.14, {bevel: 0.02}), m.gunmetal, {position: [-3.45, -0.26, 0], rotation: AXIS.x});
  a.add(torus(0.12, 0.034), m.steel, {position: [-3.53, -0.26, 0], rotation: [0, PI / 2, 0]});
  a.add(cylinder(0.06, 0.06, {bevel: 0.01}), m.glass, {position: [-3.25, 0.12, 0.42], rotation: AXIS.x});

  // Top deck: service spine, reactor access, louvres, handholds, "no step".
  a.add(roundedBox(2.76, 0.19, 0.68, 0.06), m.panel, {position: [-0.06, 0.835, -0.27], rotation: [0, 0, -0.03]});
  a.add(roundedBox(1.45, 0.14, 0.52, 0.05), m.orange, {position: [0.22, 0.965, -0.27]});
  a.add(roundedBox(0.72, 0.03, 0.98, 0.02), m.frame, {position: [-1.94, 0.94, -0.14]});
  a.add(roundedBox(0.66, 0.03, 0.92, 0.018), m.hull, {position: [-1.94, 0.955, -0.14]});
  decal(a, d.noStep, 0.2, 0.2, [-1.94, 0.972, -0.14], [-PI / 2, 0, 0]);
  a.add(roundedBox(0.98, 0.22, 0.88, 0.07), m.frame, {position: [0.29, 0.82, 0.37]});
  a.add(cylinder(0.32, 0.15, {bevel: 0.03, segments: 36}), m.gunmetal, {position: [0.3, 0.97, 0.36]});
  a.add(torus(0.296, 0.03), m.steel, {position: [0.3, 1.05, 0.36], rotation: [PI / 2, 0, 0]});
  a.add(cylinder(0.2, 0.02, {bevel: 0.005, segments: 32}), m.dark, {position: [0.3, 1.062, 0.36]});
  a.add(torus(0.16, 0.014), m.teal, {position: [0.3, 1.073, 0.36], rotation: [PI / 2, 0, 0]});
  for (let i = 0; i < 6; i++) a.add(roundedBox(0.03, 0.05, 0.49, 0.01), m.dark, {position: [-0.84 + i * 0.12, 0.945, -0.29]});
  for (const x of [-1.71, -0.95]) {
    a.between([x, 0.93, -0.65], [x, 1.08, -0.65], 0.022, m.steel);
    a.between([x + 0.29, 0.91, -0.65], [x + 0.29, 1.08, -0.65], 0.022, m.steel);
    a.between([x, 1.08, -0.65], [x + 0.29, 1.08, -0.65], 0.022, m.steel);
  }
  // Roof umbilical: a junction box behind the cabin feeds the one at the reactor hatch.
  a.add(roundedBox(0.24, 0.12, 0.3, 0.03), m.frame, {position: [-1.15, 0.97, 0.52]});
  a.add(roundedBox(0.2, 0.16, 0.3, 0.03), m.frame, {position: [-0.34, 0.92, 0.5]});
  a.cable([[-1.03, 0.97, 0.56], [-0.9, 1.03, 0.57], [-0.6, 1.03, 0.57], [-0.44, 0.93, 0.56]], 0.048, m.rubber, m.gunmetal);
  a.cable([[-1.03, 0.95, 0.44], [-0.88, 0.99, 0.43], [-0.6, 0.99, 0.43], [-0.44, 0.89, 0.44]], 0.024, m.copper, m.gunmetal);

  // Service-side hatch with rebate, grab handles, brand stencil, hazard band.
  a.add(roundedBox(1.32, 0.95, 0.06, 0.07), m.dark, {position: [-0.36, 0.055, 1.07]});
  a.add(roundedBox(1.22, 0.86, 0.08, 0.06), m.panel, {position: [-0.36, 0.055, 1.105]});
  a.add(roundedBox(0.68, 0.13, 0.05, 0.02), m.ochre, {position: [-0.35, 0.34, 1.15]});
  decal(a, d.brand, 0.86, 0.19, [-0.35, 0.12, 1.146]);
  for (const x of [-0.72, 0.07]) a.between([x, -0.24, 1.17], [x, -0.1, 1.17], 0.02, m.steel);
  const hatchBolt = cylinder(0.02, 0.02, {segments: 8, bevel: 0.005});
  for (const [x, y] of [[-0.91, 0.42], [0.19, 0.42], [-0.91, -0.31], [0.19, -0.31]]) a.add(hatchBolt, m.steel, {position: [x, y, 1.147], rotation: AXIS.z});
  decal(a, d.hazard, 1.72, 0.11, [0.2, -0.487, 1.1], [0, 0, 0]);
  a.add(roundedBox(1.76, 0.13, 0.03, 0.01), m.frame, {position: [0.2, -0.487, 1.085]});

  // Consumable canisters behind an open cage on the port side.
  for (let i = 0; i < 3; i++) {
    const x = -0.82 + i * 0.53;
    a.add(lathe([[0, -0.4], [0.12, -0.39], [0.18, -0.33], [0.19, 0.3], [0.13, 0.38], [0.06, 0.4], [0.06, 0.47], [0, 0.47]], {segments: 28, fillet: 0.04}), i === 1 ? m.ochre : m.panel, {position: [x, -0.01, -1.21]});
    for (const y of [0.24, -0.24]) a.add(torus(0.19, 0.022), m.frame, {position: [x, y, -1.21], rotation: [PI / 2, 0, 0]});
  }
  a.between([-1.17, 0.46, -1.46], [0.5, 0.46, -1.46], 0.045, m.frame);
  a.between([-1.17, -0.45, -1.46], [0.5, -0.45, -1.46], 0.045, m.frame);
  for (const x of [-1.17, -0.3, 0.5]) a.between([x, -0.45, -1.46], [x, 0.46, -1.46], 0.045, m.frame);
  // The canisters stand on a shelf; standoffs hold the cage off the hull.
  a.add(roundedBox(1.74, 0.04, 0.48, 0.012), m.frame, {position: [-0.33, -0.43, -1.23]});
  for (const x of [-1.17, 0.5]) for (const y of [0.46, -0.45]) a.between([x, y, -1.44], [x, y, -0.92], 0.03, m.frame);

  // Radiator wing between the canister cage and the engine pod: frame, fins,
  // coolant manifolds, two braces to the hull and a hose into the hull.
  a.add(roundedBox(0.84, 0.16, 0.87, 0.05), m.frame, {position: [1.03, 0.23, -1.6], rotation: [-0.12, 0, 0]});
  const fin = roundedBox(0.05, 0.24, 0.8, 0.012);
  for (let i = 0; i < 9; i++) a.add(fin, m.steel, {position: [0.646 + i * 0.096, 0.29, -1.61], rotation: [-0.12, 0, 0]});
  for (const z of [-1.24, -1.98]) a.between([0.63, 0.38, z], [1.55, 0.38, z], 0.04, m.copper);
  a.add(roundedBox(0.98, 0.1, 0.08, 0.025), m.orange, {position: [1.03, 0.22, -2.03]});
  for (const [x, hull] of [[0.75, -0.9], [1.3, -0.8]]) a.between([x, 0.23, hull], [x, 0.23, -1.22], 0.035, m.frame);
  a.cable([[1.2, 0.45, -0.85], [1.26, 0.53, -0.99], [1.45, 0.55, -1.15], [1.52, 0.42, -1.24]], 0.035, m.rubber, m.gunmetal);

  // Comms mast and navigation lamps.
  a.add(roundedBox(0.31, 0.18, 0.33, 0.04), m.frame, {position: [0.94, 0.84, -0.51]});
  a.between([0.94, 0.9, -0.51], [0.94, 1.55, -0.51], 0.022, m.steel);
  a.add(roundedBox(0.11, 0.35, 0.25, 0.03), m.panel, {position: [0.94, 1.43, -0.51], rotation: [0, 0, -0.07]});
  a.between([0.94, 1.5, -0.51], [0.94, 1.8, -0.51], 0.008, m.steel, {segments: 6});
  a.add(cylinder(0.035, 0.06, {bevel: 0.01}), m.red, {position: [0.94, 1.63, -0.51], edge: 0});
  for (const [side, lamp] of [[-1, m.red], [1, m.teal]]) {
    a.add(roundedBox(0.2, 0.17, 0.15, 0.035), m.frame, {position: [1.45, 0.42, side * 0.86]});
    a.add(roundedBox(0.11, 0.05, 0.02, 0.008), lamp, {position: [1.45, 0.42, side * 0.94], edge: 0});
  }

  // Drive block and two staggered engines on braced arms.
  a.add(roundedBox(0.56, 1.19, 1.6, 0.14), m.frame, {position: [1.64, -0.05, 0]});
  a.add(roundedBox(0.36, 0.86, 1.21, 0.09), m.orange, {position: [1.95, -0.02, 0]});
  for (const sign of [-1, 1]) {
    a.between([1.23, 0.5, sign * 0.54], [2.39, 0.33, sign * 1.19], 0.1, m.frame);
    a.between([1.28, -0.59, sign * 0.56], [2.65, -0.53, sign * 1.19], 0.08, m.frame);
  }
  for (const {x, z, scale} of ENGINES) engine(a, m, x, z, scale);
  for (const z of [-0.28, 0.28]) {
    a.add(cylinder(0.11, 0.18, {bevel: 0.02}), m.steel, {position: [2.22, -0.05, z], rotation: AXIS.x});
    a.add(cylinder(0.07, 0.03, {bevel: 0.008}), m.dark, {position: [2.32, -0.05, z], rotation: AXIS.x});
  }

  skid(a, m, -1);
  skid(a, m, 1);

  // Reaction-control pods: side and forward nozzles at the nose, side nozzles aft.
  for (const {at, jets} of RCS) {
    a.add(roundedBox(0.2, 0.16, 0.14, 0.03), m.frame, {position: at});
    for (const dir of jets) {
      const p = at.map((v, i) => v + dir[i] * (i === 2 ? 0.075 : 0.105));
      a.add(cylinder(0.028, 0.04, {segments: 10, bevel: 0.006}), m.dark, {position: p, rotation: dir[0] ? AXIS.x : AXIS.z});
    }
  }

  // Service saddle behind the module: hull block, hinge, arm and strut hold the
  // receiver plate the module coupling bolts onto; two umbilicals feed it.
  a.add(roundedBox(0.36, 0.3, 0.22, 0.05), m.frame, {position: [0.5, -0.25, 1.12]});
  a.add(cylinder(0.08, 0.34, {bevel: 0.02}), m.gunmetal, {position: [0.5, -0.22, 1.27], rotation: AXIS.x});
  a.between([0.5, -0.2, 1.3], [0.5, -0.1, 1.86], 0.07, m.frame);
  a.between([0.62, -0.38, 1.2], [0.53, -0.33, 1.52], 0.05, m.gunmetal);
  a.between([0.53, -0.33, 1.52], [0.44, -0.3, 1.9], 0.028, m.chrome);
  a.add(lathe([[0, 0], [0.3, 0], [0.33, 0.03], [0.33, 0.12], [0.26, 0.18], [0, 0.18]], {segments: 40, fillet: 0.02}), m.frame, {position: [0.25, -0.05, 1.96], rotation: AXIS.x});
  a.add(cylinder(0.12, 0.08, {bevel: 0.015}), m.gunmetal, {position: [0.46, -0.05, 1.96], rotation: AXIS.x});
  a.cable([[0.68, -0.2, 1.14], [0.78, -0.2, 1.24], [0.76, -0.08, 1.7], [0.58, 0.12, 1.88], [0.43, 0.15, 1.88]], 0.045, m.rubber, m.gunmetal);
  a.cable([[0.68, -0.33, 1.12], [0.75, -0.34, 1.2], [0.86, -0.22, 1.62], [0.66, 0.04, 2.08], [0.43, 0.06, 2.1]], 0.022, m.copper, m.gunmetal);

  details(a, m, d);

  const group = a.finish();
  group.name = 'MULE-06';

  const toolMount = new THREE.Group();
  toolMount.name = 'Utility hardpoint';
  toolMount.position.copy(TOOL_MOUNT);
  group.add(toolMount);
  let mounted = null;
  const setTool = (kind) => {
    toolMount.clear();
    mounted = kind;
    if (kind) toolMount.add(createTool(kind));
  };
  return {group, toolMount, setTool, get mounted() { return mounted; }};
}
