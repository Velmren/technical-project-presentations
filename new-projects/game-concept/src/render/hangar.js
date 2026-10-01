import * as THREE from 'three';
import {Assembly, AXIS, cylinder, extrude, lathe, roundedBox, torus, tube} from './kit.js';
import {decalMaterial, decalTexture, getMaterials, wearMaterial} from './materials.js';

// Kepler Yard service bay. The vessel rests on a docking cradle; the tool bench
// (turntable) and the storage lift sit beside its service side. Everything is
// authored geometry; distant structure is instanced to keep draw calls low.

const PI = Math.PI;
export const FLOOR_Y = -2.06;
export const ANCHORS = {
  stand: new THREE.Vector3(-1.15, -0.62, 5.2),
  liftTop: new THREE.Vector3(2.3, -1.45, 5.0),
  liftBottom: new THREE.Vector3(2.3, -4.2, 5.0),
};
// Inspection table: it spins and tilts about this point; a module rests on
// two rubber pads (centred at x = pads, 0.3 x 0.5 m) whose top is padTop above it.
export const BENCH = {pivot: new THREE.Vector3(-1.15, -1.1, 5.2), padTop: 0.11, pads: [-0.3, 0.3], padSize: [0.3, 0.5]};

// Height of an object's underside over the pads, relative to its origin, with
// its support point (object x = supportX) over the table centre. Only geometry
// above the pad footprints counts: fingers or barrels may hang lower beyond them.
export function restOnPads(object, supportX) {
  object.updateMatrixWorld(true);
  const [w, d] = BENCH.padSize;
  const pads = BENCH.pads.map(pad => [supportX + pad - w / 2, supportX + pad + w / 2]);
  // Each triangle is clipped to a pad footprint (Sutherland-Hodgman in x and z),
  // so a sloping face that only grazes the footprint counts only where it overlaps.
  const clip = (polygon, axis, limit, keepAbove) => {
    const out = [];
    polygon.forEach((p, i) => {
      const q = polygon[(i + 1) % polygon.length];
      const pin = keepAbove ? p[axis] >= limit : p[axis] <= limit, qin = keepAbove ? q[axis] >= limit : q[axis] <= limit;
      if (pin) out.push(p);
      if (pin !== qin) out.push(p.clone().lerp(q, (limit - p[axis]) / (q[axis] - p[axis])));
    });
    return out;
  };
  let bottom = Infinity;
  object.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
    const at = (i) => new THREE.Vector3().fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const triangle = [at(i), at(i + 1), at(i + 2)];
      for (const [x0, x1] of pads) {
        let polygon = clip(clip(triangle, 'x', x0, true), 'x', x1, false);
        polygon = clip(clip(polygon, 'z', -d / 2, true), 'z', d / 2, false);
        for (const p of polygon) bottom = Math.min(bottom, p.y);
      }
    }
  });
  return bottom;
}
// Lift shaft under the floor hatch (opening 1.6 x 3.2 m) and its landing.
export const LIFT = {x: [1.5, 3.1], z: [3.4, 6.6], landing: -4.75};

let seed = 311;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

function hdr(color, strength) {
  return new THREE.Color(color).multiplyScalar(strength);
}

// A low-cost light probe: the same bay reduced to emitters and dark surfaces,
// prefiltered once. Reflections therefore match the visible light fixtures.
export function createEnvironment(renderer) {
  const probe = new THREE.Scene();
  probe.add(new THREE.Mesh(new THREE.BoxGeometry(46, 17, 38), new THREE.MeshBasicMaterial({color: '#0d1417', side: THREE.BackSide})));
  probe.children[0].position.y = 6;
  const panel = (w, h, color, position, rotation) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color, side: THREE.DoubleSide}));
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    probe.add(mesh);
  };
  for (let x = -15; x <= 15; x += 6) for (const z of [-8, 0, 8]) panel(3.2, 0.7, hdr('#dfeaf0', 9), [x, 13.8, z], [PI / 2, 0, 0]);
  panel(18, 9, hdr('#27465a', 0.7), [-6, 5.5, -18.9], [0, 0, 0]);
  panel(9, 4, hdr('#c9a36a', 1.2), [-9, 3, -18.8], [0, 0, 0]);
  panel(46, 0.3, hdr('#ffb45a', 5), [0, 0.6, -18.8], [0, 0, 0]);
  panel(0.4, 1.2, hdr('#ffae55', 7), [-22.8, 2, 4], [0, PI / 2, 0]);
  panel(8, 3, hdr('#9fc5d8', 2.2), [22.8, 7, -4], [0, -PI / 2, 0]);
  panel(46, 38, hdr('#20282b', 1), [0, -2.4, 0], [-PI / 2, 0, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(probe, 0.035);
  pmrem.dispose();
  probe.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return target;
}

function floorMarkings() {
  return decalTexture(2048, 1280, (ctx, w, h) => {
    const s = w / 20; // 20 m across
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = 'miter';
    // Landing pad outline with corner brackets.
    // Muted paint: the markings describe the bay without competing with the interface accent.
    ctx.strokeStyle = 'rgba(172,156,114,0.62)';
    ctx.lineWidth = 0.14 * s;
    ctx.strokeRect(3.2 * s, 2.3 * s, 13.6 * s, 7.6 * s);
    ctx.lineWidth = 0.05 * s;
    ctx.strokeStyle = 'rgba(172,156,114,0.36)';
    ctx.strokeRect(3.5 * s, 2.6 * s, 13.0 * s, 7.0 * s);
    // Centre line toward the bay door and a clearance hatch at the bench.
    ctx.setLineDash([0.9 * s, 0.6 * s]);
    ctx.beginPath(); ctx.moveTo(1.0 * s, 6.1 * s); ctx.lineTo(19 * s, 6.1 * s); ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.beginPath(); ctx.rect(6.9 * s, 9.9 * s, 6.2 * s, 2.2 * s); ctx.clip();
    ctx.fillStyle = 'rgba(172,156,114,0.5)';
    for (let x = 5; x < 15; x += 0.6) { ctx.beginPath(); ctx.moveTo(x * s, 12.2 * s); ctx.lineTo((x + 0.28) * s, 12.2 * s); ctx.lineTo((x + 2.5) * s, 9.8 * s); ctx.lineTo((x + 2.22) * s, 9.8 * s); ctx.fill(); }
    ctx.restore();
    // Oil and coolant stains under the cradle and along the tow line.
    for (let i = 0; i < 26; i++) {
      const x = (6 + random() * 9) * s, y = (3.5 + random() * 5.5) * s, r = (0.2 + random() * 0.9) * s;
      const stain = ctx.createRadialGradient(x, y, 0, x, y, r);
      stain.addColorStop(0, `rgba(8,10,10,${0.25 + random() * 0.3})`);
      stain.addColorStop(1, 'rgba(8,10,10,0)');
      ctx.fillStyle = stain;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.5 + random() * 0.5), random() * PI, 0, PI * 2); ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(6,8,8,${0.12 + random() * 0.12})`;
      ctx.lineWidth = (0.18 + random() * 0.1) * s;
      ctx.beginPath(); const y = (4 + random() * 4) * s; ctx.moveTo(0, y); ctx.bezierCurveTo(6 * s, y + random() * s, 12 * s, y - random() * s, 20 * s, y + (random() - 0.5) * 2 * s); ctx.stroke();
    }
    // Paint loss: boots, tyres and dragged equipment.
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2600; i++) {
      ctx.globalAlpha = 0.1 + random() * 0.5;
      const x = random() * w, y = random() * h;
      ctx.fillRect(x, y, 2 + random() * 26, 1 + random() * 5);
    }
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.3 + random() * 0.4;
      ctx.beginPath(); ctx.ellipse(random() * w, random() * h, 20 + random() * 90, 8 + random() * 40, random() * PI, 0, PI * 2); ctx.fill();
    }
    // The decal spans x -10.4..9.6 and z -5.95..6.55; the shaft opening is left clear.
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect((LIFT.x[0] + 10.4) * s, (LIFT.z[0] + 5.95) * s, (LIFT.x[1] - LIFT.x[0]) * s, (LIFT.z[1] - LIFT.z[0]) * s);
  });
}

function instanced(geometry, material, transforms, {shadow = false} = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const matrix = new THREE.Matrix4();
  transforms.forEach(([position, rotation = [0, 0, 0], scale = [1, 1, 1]], i) => {
    matrix.compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    mesh.setMatrixAt(i, matrix);
  });
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  return mesh;
}

// I-beam section extruded along its length (Y-up column before rotation).
function iBeam(height, flange = 0.42, web = 0.4, t = 0.05) {
  const f = flange / 2, wb = web / 2;
  const profile = [[-f, -wb], [f, -wb], [f, -wb + t], [t / 2, -wb + t], [t / 2, wb - t], [f, wb - t], [f, wb], [-f, wb], [-f, wb - t], [-t / 2, wb - t], [-t / 2, -wb + t], [-f, -wb + t]];
  const g = extrude(profile, height, {fillet: 0.008, filletSegments: 1, bevel: 0.006, bevelSegments: 1});
  g.rotateX(-PI / 2);
  return g;
}

function cradle(a, m) {
  for (const sign of [-1, 1]) {
    const z = sign * 1.18;
    a.add(roundedBox(5.2, 0.32, 0.5, 0.05), m.frame, {position: [-0.4, FLOOR_Y + 0.28, z]});
    a.add(roundedBox(5.0, 0.06, 0.56, 0.02), m.ochre, {position: [-0.4, FLOOR_Y + 0.46, z]});
    for (const x of [-2.4, -0.4, 1.6]) {
      a.add(cylinder(0.16, 0.5, {bevel: 0.03}), m.gunmetal, {position: [x, FLOOR_Y + 0.72, z]});
      a.add(cylinder(0.09, 0.22, {bevel: 0.015}), m.chrome, {position: [x, FLOOR_Y + 1.06, z]});
      a.add(roundedBox(0.44, 0.14, 0.56, 0.03), m.orange, {position: [x, -1.42, z]});
      for (const side of [-1, 1]) a.add(roundedBox(0.4, 0.3, 0.06, 0.02), m.frame, {position: [x, -1.28, z + side * 0.24]});
    }
    a.add(roundedBox(0.6, 0.12, 0.9, 0.03), m.gunmetal, {position: [-3.1, FLOOR_Y + 0.06, z]});
    a.add(roundedBox(0.6, 0.12, 0.9, 0.03), m.gunmetal, {position: [2.3, FLOOR_Y + 0.06, z]});
  }
  // Umbilical boom: pedestal, column, jointed arm (the lines run inside it) and
  // a head over the port pod; the drop lines are built by umbilicalLines().
  a.add(lathe([[0, 0], [0.55, 0], [0.6, 0.08], [0.42, 0.22], [0.3, 0.3], [0, 0.3]], {segments: 32, fillet: 0.03}), m.frame, {position: [3.4, FLOOR_Y, -3.3]});
  a.add(cylinder(0.22, 2.6, {bevel: 0.03}), m.gunmetal, {position: [3.4, FLOOR_Y + 1.6, -3.3]});
  a.between([3.4, FLOOR_Y + 2.9, -3.3], [2.1, 1.05, -1.4], 0.16, m.orange);
  a.add(cylinder(0.24, 0.5, {bevel: 0.04}), m.frame, {position: [3.4, FLOOR_Y + 2.9, -3.3], rotation: [0, 0.97, PI / 2]});
  a.add(roundedBox(0.36, 0.26, 0.36, 0.05), m.frame, {position: [2.1, 1.05, -1.4]});
  // Supply line from the pedestal across the deck to a wall gland.
  a.cable([[3.4, FLOOR_Y + 0.05, -3.88], [3.55, FLOOR_Y + 0.05, -4.35], [5, FLOOR_Y + 0.05, -4.9], [9, FLOOR_Y + 0.05, -5.8], [16, FLOOR_Y + 0.05, -7], [22.2, FLOOR_Y + 0.05, -7.6]], 0.06, m.rubber, m.gunmetal, {radial: 8});
}

// Lines from the boom head to the pod box on the docked vessel. Separate, so
// they retract into the head when the vessel lifts off. Origin: head bottom.
export function umbilicalLines() {
  const m = getMaterials();
  const a = new Assembly('umbilical lines');
  const head = [2.1, 0.92, -1.4];
  const local = (points) => points.map(([x, y, z]) => [x - head[0], y - head[1], z - head[2]]);
  a.cable(local([[2.02, 0.92, -1.36], [2.02, 0.8, -1.3], [2.08, 0.66, -1.22], [2.12, 0.59, -1.18]]), 0.05, m.rubber, m.gunmetal);
  a.cable(local([[2.2, 0.92, -1.46], [2.24, 0.78, -1.38], [2.28, 0.64, -1.28], [2.3, 0.59, -1.25]]), 0.035, m.copper, m.gunmetal);
  const group = a.finish();
  group.position.set(...head);
  return group;
}

function bench(a, m) {
  const {liftTop} = ANCHORS;
  const {pivot} = BENCH;
  // Inspection stand: weighted base, column and bearing head. The yoke and the
  // tilting table on top are in createTurntable().
  a.add(lathe([[0, 0], [0.72, 0], [0.76, 0.05], [0.62, 0.16], [0.24, 0.24], [0, 0.24]], {segments: 44, fillet: 0.03}), m.frame, {position: [pivot.x, FLOOR_Y, pivot.z]});
  a.add(cylinder(0.13, 0.68, {bevel: 0.02}), m.gunmetal, {position: [pivot.x, FLOOR_Y + 0.56, pivot.z]});
  a.add(torus(0.13, 0.02), m.orange, {position: [pivot.x, FLOOR_Y + 0.62, pivot.z], rotation: [PI / 2, 0, 0]});
  a.add(cylinder(0.16, 0.08, {bevel: 0.02, segments: 36}), m.gunmetal, {position: [pivot.x, pivot.y - 0.11, pivot.z]});
  // Storage lift: shaft walls with ribs, a lit landing at the
  // bottom and a safety border around the opening. Doors and carriage move.
  const [x0, x1] = LIFT.x, [z0, z1] = LIFT.z, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const depth = FLOOR_Y - LIFT.landing + 0.1, wallY = FLOOR_Y - depth / 2 - 0.002;
  for (const x of [x0 - 0.03, x1 + 0.03]) a.add(roundedBox(0.06, depth, z1 - z0 + 0.12, 0.01), m.frame, {position: [x, wallY, cz]});
  for (const z of [z0 - 0.03, z1 + 0.03]) a.add(roundedBox(x1 - x0, depth, 0.06, 0.01), m.frame, {position: [cx, wallY, z]});
  // Ribs stay below the swing of the open doors.
  for (let y = FLOOR_Y - 1.0; y > LIFT.landing; y -= 0.7) {
    for (const x of [x0 + 0.015, x1 - 0.015]) a.add(roundedBox(0.03, 0.08, z1 - z0, 0.01), m.gunmetal, {position: [x, y, cz]});
    for (const z of [z0 + 0.015, z1 - 0.015]) a.add(roundedBox(x1 - x0 - 0.06, 0.08, 0.03, 0.01), m.gunmetal, {position: [cx, y, z]});
  }
  a.add(roundedBox(x1 - x0, 0.1, z1 - z0, 0.02), m.gunmetal, {position: [cx, LIFT.landing - 0.05, cz]});
  // Light strips around the carriage footprint.
  for (const z of [z0 + 0.035, z1 - 0.035]) a.add(roundedBox(x1 - x0 - 0.1, 0.02, 0.05, 0.008), m.amber, {position: [cx, LIFT.landing + 0.01, z], edge: 0});
  for (const x of [x0 + 0.035, x1 - 0.035]) a.add(roundedBox(0.05, 0.02, z1 - z0 - 0.1, 0.008), m.amber, {position: [x, LIFT.landing + 0.01, cz], edge: 0});
  for (const [dx, dz, w, d] of [[0, -1.66, 1.8, 0.12], [0, 1.66, 1.8, 0.12], [-0.86, 0, 0.12, 3.4], [0.86, 0, 0.12, 3.4]]) {
    a.add(roundedBox(w, 0.05, d, 0.015), m.ochre, {position: [liftTop.x + dx, FLOOR_Y + 0.03, liftTop.z + dz]});
  }
  for (const dx of [-0.95, 0.95]) for (const dz of [-1.75, 1.75]) {
    a.add(roundedBox(0.12, 0.9, 0.12, 0.02), m.frame, {position: [liftTop.x + dx, FLOOR_Y + 0.45, liftTop.z + dz]});
    a.add(roundedBox(0.13, 0.12, 0.13, 0.02), m.amber, {position: [liftTop.x + dx, FLOOR_Y + 0.94, liftTop.z + dz], edge: 0});
  }
}

// The table spins on the bearing head and tilts on a ball joint, carrying the
// inspected module, so it is separate from the fixed stand. The group sits on
// the head; userData.spin turns about Y and userData.table tilts about Z.
export function createTurntable() {
  const m = getMaterials();
  const turntable = new THREE.Group();
  turntable.name = 'bench turntable';
  turntable.position.copy(BENCH.pivot).y -= 0.07;
  const yoke = new Assembly('turntable yoke');
  yoke.add(cylinder(0.12, 0.02, {bevel: 0.006, segments: 32}), m.steel, {position: [0, 0.01, 0]});
  yoke.add(new THREE.SphereGeometry(0.05, 20, 12), m.chrome, {position: [0, 0.07, 0]});
  const spin = yoke.finish();
  const top = new Assembly('turntable');
  top.add(cylinder(0.56, 0.08, {bevel: 0.02, segments: 48}), m.gunmetal, {position: [0, 0.04, 0]});
  top.add(torus(0.54, 0.012, {tubular: 64}), m.teal, {position: [0, 0.08, 0], rotation: [PI / 2, 0, 0], edge: 0});
  for (const x of BENCH.pads) top.add(roundedBox(BENCH.padSize[0], 0.03, BENCH.padSize[1], 0.01), m.rubber, {position: [x, BENCH.padTop - 0.015, 0]});
  const table = top.finish();
  table.position.y = 0.07;
  spin.add(table);
  turntable.add(spin);
  turntable.userData = {spin, table};
  return turntable;
}

// Lift doors (two leaves hinged at the long edges, swinging down into the
// shaft) and the carriage that carries a module up and down the shaft.
function createLift(m) {
  const [x0, x1] = LIFT.x, [z0, z1] = LIFT.z, cz = (z0 + z1) / 2;
  const doors = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(side < 0 ? x0 + 0.04 : x1 - 0.04, FLOOR_Y - 0.03, cz);
    const leaf = new Assembly('lift door');
    const offset = -side * 0.36;
    leaf.add(roundedBox(0.79, 0.05, z1 - z0 - 0.02, 0.012), m.frame, {position: [offset, 0, 0]});
    for (let i = 0; i < 9; i++) leaf.add(roundedBox(0.6, 0.012, 0.05, 0.004), m.ochre, {position: [offset, 0.028, z0 - cz + 0.3 + i * 0.33], edge: 0});
    hinge.add(leaf.finish());
    hinge.userData.side = side;
    doors.push(hinge);
  }
  const deck = new Assembly('lift carriage');
  deck.add(roundedBox(x1 - x0 - 0.14, 0.08, z1 - z0 - 0.14, 0.02), m.gunmetal);
  deck.add(roundedBox(x1 - x0 - 0.3, 0.012, z1 - z0 - 0.3, 0.004), m.rubber, {position: [0, 0.044, 0]});
  const carriage = deck.finish();
  carriage.position.set((x0 + x1) / 2, LIFT.landing + 0.04, cz);
  return {doors, carriage};
}

function structure(group, m) {
  const beam = iBeam(15);
  const columns = [];
  for (let x = -20; x <= 20; x += 5) columns.push([[x, FLOOR_Y, -16.5]]);
  for (let z = -12; z <= 12; z += 6) columns.push([[21.5, FLOOR_Y, z], [0, PI / 2, 0]]);
  for (let z = -12; z <= 12; z += 6) columns.push([[-21.5, FLOOR_Y, z], [0, PI / 2, 0]]);
  group.add(instanced(beam, m.gunmetal, columns));
  // Ceiling trusses and girders.
  const girder = iBeam(44, 0.36, 0.7);
  const ceiling = [];
  for (let z = -15; z <= 15; z += 5) ceiling.push([[-22, 11.6, z], [0, 0, -PI / 2]]);
  group.add(instanced(girder, m.frame, ceiling));
  const rail = iBeam(34, 0.3, 0.5);
  group.add(instanced(rail, m.frame, [[[-8, 10.8, -17], [PI / 2, 0, 0]], [[8, 10.8, -17], [PI / 2, 0, 0]]]));
  // Walls: ribbed panels in two tones so depth reads through the haze.
  const wallMat = wearMaterial('bay wall', {color: '#2a3437', roughness: 0.7, metalness: 0.2, wear: 0.3, grime: 0.45, seams: [3.0, 1.6, 0.012], scale: 0.35});
  // Back wall is built around the bay door opening (x -15.2..3.2, 10 m high).
  for (const [w, h, x, y] of [[7.8, 16, -19.1, 8], [19.8, 16, 13.1, 8], [18.4, 6, -6, 13]]) {
    const piece = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    piece.position.set(x, FLOOR_Y + y, -17);
    group.add(piece);
  }
  const front = new THREE.Mesh(new THREE.PlaneGeometry(46, 16), wallMat);
  front.position.set(0, FLOOR_Y + 8, 17);
  front.rotation.y = PI;
  group.add(front);
  // Column light bars and a painted hazard band give the far wall scale.
  const bars = new Assembly('wall lights');
  const barLight = new THREE.MeshStandardMaterial({color: '#1a1f21', emissive: new THREE.Color('#cfe3ec'), emissiveIntensity: 3.2});
  for (let x = -20; x <= 20; x += 5) {
    if (x > -16 && x < 4) continue;
    bars.add(roundedBox(0.12, 2.6, 0.08, 0.03), barLight, {position: [x + 0.32, FLOOR_Y + 6.2, -16.35], edge: 0});
  }
  for (let z = -12; z <= 12; z += 6) bars.add(roundedBox(0.08, 2.6, 0.12, 0.03), barLight, {position: [21.1, FLOOR_Y + 6.2, z + 0.32], edge: 0});
  bars.add(roundedBox(46, 0.5, 0.04, 0.01), m.ochre, {position: [0, FLOOR_Y + 0.25, -16.97]});
  bars.add(roundedBox(0.04, 0.5, 34, 0.01), m.ochre, {position: [22.17, FLOOR_Y + 0.25, 0]});
  // Wall ribs, service pipes and vents repeat along the far walls for scale.
  for (const y of [2.4, 5.6, 8.8]) {
    bars.add(roundedBox(46, 0.22, 0.28, 0.04), m.frame, {position: [0, FLOOR_Y + y, -16.85]});
    bars.add(roundedBox(0.28, 0.22, 34, 0.04), m.frame, {position: [22.05, FLOOR_Y + y, 0]});
  }
  for (const [y, r, mat] of [[1.1, 0.16, m.gunmetal], [1.5, 0.1, m.copper], [1.8, 0.07, m.ochre]]) {
    bars.add(cylinder(r, 46, {segments: 16, bevel: 0}), mat, {position: [0, FLOOR_Y + y, -16.55 + r], rotation: AXIS.x});
    bars.add(cylinder(r, 34, {segments: 16, bevel: 0}), mat, {position: [21.75 - r, FLOOR_Y + y, 0], rotation: AXIS.z});
  }
  for (let x = -21; x <= 21; x += 3) bars.add(roundedBox(0.12, 1.2, 0.5, 0.02), m.frame, {position: [x, FLOOR_Y + 1.45, -16.7]});
  for (let z = -15; z <= 15; z += 3) bars.add(roundedBox(0.5, 1.2, 0.12, 0.02), m.frame, {position: [21.9, FLOOR_Y + 1.45, z]});
  for (const x of [-19.5, 6.5, 11.5, 16.5]) {
    bars.add(roundedBox(1.6, 1.0, 0.1, 0.03), m.frame, {position: [x, FLOOR_Y + 7.2, -16.9]});
    for (let i = 0; i < 6; i++) bars.add(roundedBox(1.4, 0.05, 0.12, 0.01), m.dark, {position: [x, FLOOR_Y + 6.8 + i * 0.16, -16.86], edge: 0});
  }
  group.add(bars.finish({castShadow: false}));
  const side = new THREE.Mesh(new THREE.PlaneGeometry(36, 16), wallMat);
  side.position.set(22.2, FLOOR_Y + 8, 0);
  side.rotation.y = -PI / 2;
  group.add(side);
  const leftSide = side.clone();
  leftSide.position.x = -22.2;
  leftSide.rotation.y = PI / 2;
  group.add(leftSide);
  // Catwalk along the back wall with railings and lights.
  const catwalk = new Assembly('catwalk');
  catwalk.add(roundedBox(44, 0.14, 1.6, 0.03), m.frame, {position: [0, 3.9, -15.9]});
  catwalk.add(roundedBox(44, 0.06, 0.06, 0.02), m.ochre, {position: [0, 4.95, -15.15]});
  catwalk.add(roundedBox(44, 0.05, 0.05, 0.02), m.frame, {position: [0, 4.45, -15.15]});
  for (let x = -21; x <= 21; x += 1.5) catwalk.add(roundedBox(0.05, 1.05, 0.05, 0.01), m.frame, {position: [x, 4.45, -15.15]});
  for (let x = -18; x <= 18; x += 6) catwalk.add(roundedBox(1.3, 0.12, 0.3, 0.03), m.amber, {position: [x, 3.78, -16.5], edge: 0});
  // Ceiling light bays: housing plus emissive diffuser.
  const light = new Assembly('ceiling lights');
  const diffuser = new THREE.MeshStandardMaterial({color: '#1d2224', emissive: new THREE.Color('#e4eef2'), emissiveIntensity: 4.5});
  for (let x = -15; x <= 15; x += 6) for (const z of [-10, -2.5, 5]) {
    light.add(roundedBox(3.4, 0.22, 0.9, 0.05), m.frame, {position: [x, 11.2, z]});
    light.add(roundedBox(3.1, 0.04, 0.62, 0.02), diffuser, {position: [x, 11.08, z], edge: 0});
  }
  group.add(catwalk.finish({castShadow: false}), light.finish({castShadow: false}));
  // Gantry crane: bridge, trolley, hoist cables and hook block.
  const crane = new Assembly('crane');
  crane.add(roundedBox(0.7, 0.9, 32, 0.06), m.ochre, {position: [9.5, 9.9, -1]});
  crane.add(roundedBox(1.3, 0.6, 1.4, 0.08), m.frame, {position: [9.5, 9.25, -7.5]});
  for (const dx of [-0.25, 0.25]) crane.between([9.5 + dx, 8.9, -7.5], [9.5 + dx, 6.6, -7.5], 0.018, m.steel, {segments: 6});
  crane.add(roundedBox(0.8, 0.9, 0.5, 0.08), m.orange, {position: [9.5, 6.2, -7.5]});
  // Hook: a closed bar bent through 252 degrees.
  const hook = Array.from({length: 11}, (_, i) => PI * 0.8 + i * PI * 0.14).map(angle => [9.5 + 0.22 * Math.cos(angle), 5.55 + 0.22 * Math.sin(angle), -7.5]);
  crane.add(tube(hook, 0.07, {radial: 12}), m.gunmetal);
  group.add(crane.finish({castShadow: false}));
  // Bay door: frame and the visible exterior beyond it.
  const door = new Assembly('bay door');
  door.add(roundedBox(19, 0.8, 1.2, 0.1), m.ochre, {position: [-6, FLOOR_Y + 10.4, -16.6]});
  for (const x of [-15.6, 3.6]) door.add(roundedBox(0.8, 10.4, 1.2, 0.1), m.frame, {position: [x, FLOOR_Y + 5.2, -16.6]});
  door.add(roundedBox(19, 1.4, 1.0, 0.1), m.frame, {position: [-6, FLOOR_Y + 9.2, -16.6]});
  group.add(door.finish({castShadow: false}));
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(19, 10), new THREE.MeshBasicMaterial({map: exteriorTexture(), toneMapped: true, fog: false}));
  outside.position.set(-6, FLOOR_Y + 5, -17.4);
  group.add(outside);
}

// View through the pressure curtain: the planet's limb over the ring plane.
function exteriorTexture() {
  return decalTexture(1024, 540, (ctx, w, h) => {
    ctx.fillStyle = '#05090c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(210,225,235,${random() * 0.7})`;
      ctx.fillRect(random() * w, random() * h * 0.7, 1.2, 1.2);
    }
    const cx = w * 0.72, cy = h * 1.9, r = h * 1.55;
    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.6, r * 0.2, cx, cy, r);
    body.addColorStop(0, '#6d8a8c'); body.addColorStop(0.55, '#3c575c'); body.addColorStop(0.9, '#1a2a30'); body.addColorStop(1, '#0d171b');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, PI * 2); ctx.clip();
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(${150 + random() * 60},${130 + random() * 50},${90 + random() * 40},${0.06 + random() * 0.1})`;
      ctx.lineWidth = 4 + random() * 22;
      ctx.beginPath(); ctx.arc(cx, cy, r * (0.72 + random() * 0.27), PI * 1.05, PI * 1.95); ctx.stroke();
    }
    ctx.restore();
    const halo = ctx.createRadialGradient(cx, cy, r * 0.98, cx, cy, r * 1.08);
    halo.addColorStop(0, 'rgba(140,200,210,0.55)'); halo.addColorStop(1, 'rgba(140,200,210,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.08, 0, PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,190,160,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.2, r * 1.6, r * 0.18, -0.08, PI * 1.02, PI * 1.9); ctx.stroke();
  });
}

function props(a, m) {
  // Stacked cargo containers along the back wall, ribbed and stencilled.
  const crates = [[-17.5, 0, -13.6, 0], [-14.6, 0, -13.8, 0.03], [-16.1, 1, -13.7, -0.02], [13.5, 0, -13.5, 0.04], [16.4, 0, -13.2, -0.03], [18.6, 0, -10, PI / 2]];
  for (const [x, level, z, r] of crates) {
    const y = FLOOR_Y + 0.75 + level * 1.5;
    a.add(roundedBox(2.8, 1.5, 1.5, 0.05), level ? m.orange : m.panel, {position: [x, y, z], rotation: [0, r, 0]});
    for (let i = -3; i <= 3; i++) a.add(roundedBox(0.06, 1.3, 1.56, 0.015), m.frame, {position: [x + i * 0.36 * Math.cos(r), y, z - i * 0.36 * Math.sin(r)], rotation: [0, r, 0]});
  }
  // Gas bottle rack and a tool cart near the bench.
  for (let i = 0; i < 5; i++) a.add(lathe([[0, 0], [0.13, 0.01], [0.15, 0.06], [0.15, 1.2], [0.1, 1.32], [0.04, 1.36], [0, 1.36]], {segments: 20, fillet: 0.03}), i % 2 ? m.ochre : m.panel, {position: [15 + i * 0.36, FLOOR_Y, -8.5]});
  a.add(roundedBox(2.0, 0.08, 0.5, 0.02), m.frame, {position: [15.7, FLOOR_Y + 0.9, -8.2]});
}

// Soft additive beams under the far ceiling fixtures: haze made visible,
// fading with height so they never flatten the floor.
function lightShafts() {
  const texture = decalTexture(64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.55, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const edge = ctx.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, 'rgba(0,0,0,1)'); edge.addColorStop(0.3, 'rgba(0,0,0,0)'); edge.addColorStop(0.7, 'rgba(0,0,0,0)'); edge.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = edge; ctx.fillRect(0, 0, w, h);
  });
  const group = new THREE.Group();
  const beam = (top, bottom, radiusTop, radiusBottom, opacity, color = '#cfe2ea') => {
    const height = top.distanceTo(bottom);
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 24, 1, true);
    const material = new THREE.MeshBasicMaterial({map: texture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(top).add(bottom).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize());
    mesh.renderOrder = 5;
    group.add(mesh);
  };
  // Beams stop well above the deck and stay clear of the vessel and the bench:
  // a cone reaching the floor drew a round edge on it, and one crossing a model
  // laid a hard sheet of light across it.
  for (const [x, z] of [[9, -10], [15, -2.5], [-15, -10], [3, -10]]) beam(new THREE.Vector3(x, 11, z), new THREE.Vector3(x + 0.45, FLOOR_Y + 3, z + 0.6), 0.9, 2.2, 0.03);
  return group;
}

export function createHangar() {
  const m = getMaterials();
  const group = new THREE.Group();
  group.name = 'Kepler Yard bay';

  const deck = wearMaterial('deck', {color: '#1a2023', roughness: 0.58, metalness: 0.3, wear: 0.3, grime: 0.75, grit: 0.35, seams: [2.0, 2.0, 0.009], seamDepth: 0.004, scale: 0.28, edgeColor: '#4a524f', grimeColor: '#0c0f0e', params: {envMapIntensity: 0.3}});
  // Same object-space coordinates as the former 46 x 36 plane, with the shaft
  // opening cut out (plane y is world -z).
  const outline = new THREE.Shape([[-23, -18], [23, -18], [23, 18], [-23, 18]].map(([x, y]) => new THREE.Vector2(x, y)));
  outline.holes.push(new THREE.Path([[LIFT.x[0], -LIFT.z[1]], [LIFT.x[0], -LIFT.z[0]], [LIFT.x[1], -LIFT.z[0]], [LIFT.x[1], -LIFT.z[1]]].map(([x, y]) => new THREE.Vector2(x, y))));
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(outline), deck);
  floor.rotation.x = -PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = true;
  group.add(floor);
  const markings = new THREE.Mesh(new THREE.PlaneGeometry(20, 12.5), decalMaterial(floorMarkings(), {roughness: 0.7}));
  markings.rotation.x = -PI / 2;
  markings.position.set(-0.4, FLOOR_Y + 0.004, 0.3);
  markings.receiveShadow = true;
  group.add(markings);

  const fixed = new Assembly('bay fixtures');
  cradle(fixed, m);
  bench(fixed, m);
  group.add(fixed.finish());
  const distant = new Assembly('bay props');
  props(distant, m);
  group.add(distant.finish({castShadow: false}));
  structure(group, m);
  group.add(lightShafts());
  const lift = createLift(m);
  group.add(...lift.doors, lift.carriage);
  const umbilical = umbilicalLines();
  group.add(umbilical);
  return {group, lift, umbilical};
}

export function createLights(scene) {
  // Key from high front-left: lights the visible flank and throws the hull's
  // shadow back across the deck, which grounds the vessel on its cradle.
  const key = new THREE.SpotLight('#eef3f4', 2300, 34, 0.42, 0.75, 2);
  key.position.set(-8.5, 11, 8.5);
  key.target.position.set(-0.2, -1.2, 0.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 4;
  key.shadow.camera.near = 6;
  key.shadow.camera.far = 28;
  const fill = new THREE.DirectionalLight('#b9d0dc', 0.35);
  fill.position.set(6, 4, 10);
  const rim = new THREE.DirectionalLight('#8fbbd6', 2.6);
  rim.position.set(9, 5, -10);
  // Inspection spot over the bench: brought up when the view moves there.
  const bench = new THREE.SpotLight('#f3f1e8', 0, 16, 0.34, 0.7, 2);
  bench.position.set(-2.4, 7.6, 8.4);
  bench.target.position.copy(ANCHORS.stand);
  bench.castShadow = true;
  bench.shadow.mapSize.set(1024, 1024);
  bench.shadow.bias = -0.0005;
  bench.shadow.normalBias = 0.02;
  bench.shadow.radius = 3;
  const warm = new THREE.PointLight('#ffae5c', 10, 8, 2);
  warm.position.set(2.3, FLOOR_Y + 1.1, 5.0);
  const hemi = new THREE.HemisphereLight('#7d95a2', '#1b1f1d', 0.12);
  scene.add(key, key.target, bench, bench.target, fill, rim, warm, hemi);
  return {key, bench, fill, rim, warm, hemi};
}
