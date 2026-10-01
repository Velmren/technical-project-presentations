// Browser side of tools/audit-geometry.mjs. Records every part added to an
// Assembly together with the source line that added it, then reports:
//  - open meshes: edges used by one triangle only (seen from behind they are holes);
//  - cables whose centre line or surface passes through another part;
//  - parts of the vessel or a module that touch nothing else (floating);
//  - modules on the bench that do not rest on both table pads.
import * as THREE from 'three';
import {Assembly} from '../../src/render/kit.js';

const parts = [];
const originalAdd = Assembly.prototype.add;
Assembly.prototype.add = function (geometry, material, options = {}) {
  const {position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]} = options;
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
  const caller = new Error().stack.split('\n').find(line => line.includes('/src/render/') && !line.includes('/kit.js')) || '?';
  const label = caller.replace(/^.*\/src\/render\//, '').replace(/\)$/, '').replace(/:\d+$/, '') + ' ' + (material.name || material.type);
  const position3 = geometry.attributes.position, index = geometry.index;
  const count = index ? index.count : position3.count;
  const tris = new Float32Array(count * 3), v = new THREE.Vector3(), box = new THREE.Box3();
  for (let i = 0; i < count; i++) {
    v.fromBufferAttribute(position3, index ? index.getX(i) : i).applyMatrix4(matrix).toArray(tris, i * 3);
    box.expandByPoint(v);
  }
  const part = {assembly: this.name, label, tris, box, decal: geometry.type === 'PlaneGeometry' || count <= 6};
  if (geometry.userData.curve) Object.assign(part, {curve: geometry.userData.curve, radius: geometry.userData.radius, matrix});
  parts.push(part);
  return originalAdd.call(this, geometry, material, options);
};

function openEdges(part) {
  const t = part.tris, key = (i) => `${Math.round(t[i] * 1e4)},${Math.round(t[i + 1] * 1e4)},${Math.round(t[i + 2] * 1e4)}`;
  const edges = new Map();
  for (let i = 0; i < t.length; i += 9) {
    const k = [key(i), key(i + 3), key(i + 6)];
    if (k[0] === k[1] || k[1] === k[2] || k[0] === k[2]) continue;
    for (let e = 0; e < 3; e++) {
      const a = k[e], b = k[(e + 1) % 3], id = a < b ? a + '|' + b : b + '|' + a;
      edges.set(id, (edges.get(id) || 0) + 1);
    }
  }
  let open = 0;
  for (const n of edges.values()) if (n === 1) open++;
  return open;
}

// Point-in-mesh by ray parity, majority of three skewed directions.
const DIRECTIONS = [new THREE.Vector3(1, 0.137, 0.271), new THREE.Vector3(-0.21, 1, 0.113), new THREE.Vector3(0.173, -0.19, 1)].map(d => d.normalize());
const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), qv = new THREE.Vector3(), sv = new THREE.Vector3();
function crossings(t, origin, direction) {
  let hits = 0;
  for (let i = 0; i < t.length; i += 9) {
    e1.set(t[i + 3] - t[i], t[i + 4] - t[i + 1], t[i + 5] - t[i + 2]);
    e2.set(t[i + 6] - t[i], t[i + 7] - t[i + 1], t[i + 8] - t[i + 2]);
    pv.crossVectors(direction, e2);
    const det = e1.dot(pv);
    if (Math.abs(det) < 1e-12) continue;
    sv.set(origin.x - t[i], origin.y - t[i + 1], origin.z - t[i + 2]);
    const u = sv.dot(pv) / det;
    if (u < 0 || u > 1) continue;
    qv.crossVectors(sv, e1);
    const w = direction.dot(qv) / det;
    if (w < 0 || u + w > 1) continue;
    if (e2.dot(qv) / det > 1e-6) hits++;
  }
  return hits;
}
const inside = (part, point) => part.box.containsPoint(point) && DIRECTIONS.filter(d => crossings(part.tris, point, d) % 2 === 1).length >= 2;

function cableClashes(group) {
  const clashes = [];
  const p = new THREE.Vector3(), tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  for (const cable of group.filter(part => part.curve)) {
    const length = cable.curve.getLength();
    const steps = Math.max(8, Math.round(length / 0.02));
    // The ends sit in their glands by design.
    const margin = Math.min(0.06, length * 0.2) / length;
    const hits = new Set();
    for (let s = 0; s <= steps; s++) {
      const u = margin + (1 - 2 * margin) * s / steps;
      cable.curve.getPointAt(u, p);
      cable.curve.getTangentAt(u, tangent);
      side.set(0, 1, 0).cross(tangent);
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0).cross(tangent);
      side.normalize();
      up.crossVectors(tangent, side).normalize();
      const samples = [p.clone(), ...[0, 1, 2, 3, 4, 5].map(k => p.clone().addScaledVector(side, Math.cos(k * Math.PI / 3) * cable.radius * 0.8).addScaledVector(up, Math.sin(k * Math.PI / 3) * cable.radius * 0.8))].map(q => q.applyMatrix4(cable.matrix));
      for (const other of group) {
        // The cable's own glands come from the same call.
        if (other === cable || other.decal || other.label.split(' ')[0] === cable.label.split(' ')[0] || !other.box.clone().expandByScalar(cable.radius).containsPoint(samples[0])) continue;
        if (samples.some(q => inside(other, q))) hits.add(other.label);
      }
    }
    if (hits.size) clashes.push({cable: cable.label, through: [...hits]});
  }
  return clashes;
}

function floating(group) {
  const solid = group.filter(part => !part.decal);
  const parent = solid.map((_, i) => i);
  const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const boxes = solid.map(part => part.box.clone().expandByScalar(0.004));
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) if (boxes[i].intersectsBox(boxes[j])) parent[find(i)] = find(j);
  const islands = new Map();
  solid.forEach((part, i) => { const root = find(i); if (!islands.has(root)) islands.set(root, new Set()); islands.get(root).add(part.label); });
  return [...islands.values()].sort((a, b) => b.size - a.size).slice(1).map(set => [...set]);
}

function audit(group, {checkFloating}) {
  const open = {};
  for (const part of group) {
    if (part.decal) continue;
    const n = openEdges(part);
    if (n) open[part.label] = (open[part.label] || 0) + n;
  }
  return {parts: group.length, open, cables: cableClashes(group), floating: checkFloating ? floating(group) : []};
}

// Each module placed as the stand places it (restOnPads, support point over
// the table centre) must touch both pads, and nothing within the table's
// radius may reach below the table top (the plate is 0.03 m under the pad top).
function benchSupport(createTool, BENCH, BENCH_SUPPORT, restOnPads) {
  const {pads, padSize: [w, d]} = BENCH;
  return Object.keys(BENCH_SUPPORT).map(kind => {
    const object = createTool(kind);
    const bottom = restOnPads(object, BENCH_SUPPORT[kind]);
    const contacts = pads.map(() => 0);
    let lowestOverTable = Infinity;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
      const at = (i, v) => v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
      const count = index ? index.count : position.count;
      for (let i = 0; i < count; i += 3) {
        at(i, a); at(i + 1, b); at(i + 2, c);
        for (const v of [a, b, c]) if (Math.hypot(v.x - BENCH_SUPPORT[kind], v.z) <= 0.56) lowestOverTable = Math.min(lowestOverTable, v.y);
        // Within 8 mm of the resting height: a round body meets a flat pad along a line.
        if (Math.min(a.y, b.y, c.y) > bottom + 0.008 || Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y) > 0.05) continue;
        const x0 = Math.min(a.x, b.x, c.x) - BENCH_SUPPORT[kind], x1 = Math.max(a.x, b.x, c.x) - BENCH_SUPPORT[kind];
        const z0 = Math.min(a.z, b.z, c.z), z1 = Math.max(a.z, b.z, c.z);
        pads.forEach((pad, k) => { if (x1 >= pad - w / 2 && x0 <= pad + w / 2 && z1 >= -d / 2 && z0 <= d / 2) contacts[k]++; });
      }
    });
    // Clearance above the table plate, which lies 0.03 m below the pad top.
    const clearance = +(lowestOverTable - bottom + 0.03).toFixed(3);
    return {kind, contacts, clearance, ok: contacts.every(n => n > 0) && clearance >= 0};
  });
}

window.runAudit = async function () {
  const [{createVessel}, tools, hangar] = await Promise.all([import('../../src/render/vessel.js'), import('../../src/render/tools.js'), import('../../src/render/hangar.js')]);
  const report = {};
  const take = () => { const taken = parts.splice(0); const groups = new Map(); for (const part of taken) { if (!groups.has(part.assembly)) groups.set(part.assembly, []); groups.get(part.assembly).push(part); } return groups; };
  createVessel();
  for (const [name, group] of take()) report[name] = audit(group, {checkFloating: true});
  for (const kind of Object.keys(tools.BENCH_SUPPORT)) {
    tools.createTool(kind);
    for (const [name, group] of take()) report[name] = audit(group, {checkFloating: true});
  }
  hangar.createHangar();
  hangar.createTurntable();
  // Bay structure hangs on wall and ceiling planes that are not assemblies,
  // so only the fixtures, bench and lift are checked for floating parts.
  const grounded = new Set(['bay fixtures', 'bay props', 'wall lights', 'ceiling lights', 'catwalk', 'crane', 'bay door']);
  for (const [name, group] of take()) report[name] = audit(group, {checkFloating: !grounded.has(name)});
  report.bench = benchSupport(tools.createTool, hangar.BENCH, tools.BENCH_SUPPORT, hangar.restOnPads);
  return report;
};
window.auditReady = true;
