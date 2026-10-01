import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Hard-surface authoring kit. Every part is built with real bevels or fillets,
// normals are creased (smooth across bevels, sharp across true corners) and each
// vertex receives an `edge` value from local curvature. The wear shader uses it
// to chip paint on handled edges rather than painting noise over flat faces.

const PI = Math.PI;
const CREASE = THREE.MathUtils.degToRad(34);
export const vec = (a) => new THREE.Vector3(...a);

// Rounds every corner of a closed 2D polygon with a tangent arc.
export function filletPolygon(points, radius, segments = 3) {
  const out = [];
  const count = points.length;
  for (let i = 0; i < count; i++) {
    const p = new THREE.Vector2(...points[i]);
    const a = new THREE.Vector2(...points[(i - 1 + count) % count]);
    const b = new THREE.Vector2(...points[(i + 1) % count]);
    appendFillet(out, a, p, b, Array.isArray(radius) ? radius[i] : radius, segments);
  }
  return out;
}

// Rounds the interior corners of an open 2D polyline (lathe profiles).
export function filletPolyline(points, radius, segments = 2) {
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const r = Array.isArray(radius) ? radius[i] : radius;
    appendFillet(out, new THREE.Vector2(...points[i - 1]), new THREE.Vector2(...points[i]), new THREE.Vector2(...points[i + 1]), r, segments);
  }
  out.push(points[points.length - 1]);
  return out;
}

function appendFillet(out, a, p, b, radius, segments) {
  const u = a.clone().sub(p), v = b.clone().sub(p);
  const lu = u.length(), lv = v.length();
  u.normalize(); v.normalize();
  const angle = Math.acos(THREE.MathUtils.clamp(u.dot(v), -1, 1));
  if (!radius || angle > PI - 0.01 || angle < 0.01) { out.push([p.x, p.y]); return; }
  let t = radius / Math.tan(angle / 2);
  const limit = Math.min(lu, lv) * 0.48;
  const r = t > limit ? radius * limit / t : radius;
  t = Math.min(t, limit);
  const t1 = p.clone().addScaledVector(u, t), t2 = p.clone().addScaledVector(v, t);
  const center = p.clone().addScaledVector(u.clone().add(v).normalize(), r / Math.sin(angle / 2));
  let start = Math.atan2(t1.y - center.y, t1.x - center.x);
  let end = Math.atan2(t2.y - center.y, t2.x - center.x);
  let sweep = end - start;
  while (sweep > PI) sweep -= 2 * PI;
  while (sweep < -PI) sweep += 2 * PI;
  for (let s = 0; s <= segments; s++) {
    const angleAt = start + sweep * s / segments;
    out.push([center.x + Math.cos(angleAt) * r, center.y + Math.sin(angleAt) * r]);
  }
}

// Rounded / trapezoidal cross-section lofted along X. Stations:
// {x, w (width along Z), h, y, z, top (top width ratio), r (corner radius)}.
export function hullLoft(stations, {cornerSegments = 4, capStart = true, capEnd = true} = {}) {
  const rings = stations.map(({x, w, h, y = 0, z = 0, top = 1, bottom = 1, r = 0.12}) => {
    const hw = w / 2, hh = h / 2;
    const polygon = [[-hw * bottom, -hh], [hw * bottom, -hh], [hw * top, hh], [-hw * top, hh]];
    return filletPolygon(polygon, r, cornerSegments).map(([zz, yy]) => [x, yy + y, zz + z]);
  });
  const perimeter = rings[0].length;
  const positions = [];
  const index = [];
  rings.forEach(ring => ring.forEach(p => positions.push(...p)));
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < perimeter; i++) {
      const a = j * perimeter + i, b = j * perimeter + (i + 1) % perimeter;
      const c = (j + 1) * perimeter + (i + 1) % perimeter, d = (j + 1) * perimeter + i;
      index.push(a, d, b, b, d, c);
    }
  }
  const addCap = (ringIndex, flip) => {
    const center = positions.length / 3;
    const ring = rings[ringIndex];
    const c = ring.reduce((acc, p) => acc.map((v, k) => v + p[k] / ring.length), [0, 0, 0]);
    positions.push(...c);
    for (let i = 0; i < perimeter; i++) {
      const a = ringIndex * perimeter + i, b = ringIndex * perimeter + (i + 1) % perimeter;
      if (flip) index.push(center, b, a); else index.push(center, a, b);
    }
  };
  if (capStart) addCap(0, false);
  if (capEnd) addCap(rings.length - 1, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return crease(geometry);
}

// Closed profile extruded along Z with a rounded bevel, centred on depth.
export function extrude(points, depth, {fillet = 0.04, filletSegments = 3, bevel = 0.012, bevelSegments = 2} = {}) {
  const outline = fillet ? filletPolygon(points, fillet, filletSegments) : points;
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - bevel * 2, 0.001), bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelOffset: -bevel, bevelSegments, curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2 + bevel);
  return crease(geometry);
}

// Lathe around +Y from [radius, height] points; optional profile fillets.
export function lathe(profile, {segments = 32, fillet = 0, filletSegments = 2, phiStart = 0, phiLength = 2 * PI} = {}) {
  const points = (fillet ? filletPolyline(profile, fillet, filletSegments) : profile).map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  return crease(new THREE.LatheGeometry(points, segments, phiStart, phiLength));
}

// Cylinder with chamfered/rounded rims, built as a lathe for clean shading.
export function cylinder(radius, length, {radiusTop = radius, bevel = Math.min(radius, length) * 0.12, segments = 28, open = false} = {}) {
  const h = length / 2;
  const profile = open
    ? [[radius, -h], [radiusTop, h]]
    : [[0, -h], [radius, -h], [radiusTop, h], [0, h]];
  return lathe(profile, {segments, fillet: open ? 0 : bevel, filletSegments: 2});
}

// Where the box is large enough, the outline fillet stays a little larger than
// the bevel: equal values collapse each cap corner and leave slivers in the cap.
export function roundedBox(w, h, d, r = 0.02, segments = 2) {
  const x = w / 2, y = h / 2;
  let bevel = Math.min(r, d * 0.3);
  const room = Math.min(x, y) * 0.9;
  let fillet = Math.min(r, room);
  if (fillet <= bevel && bevel * 1.2 <= room * 0.8) fillet = bevel * 1.2;
  else if (fillet <= bevel && bevel > 0.03) bevel = fillet / 1.2;
  return extrude([[-x, -y], [x, -y], [x, y], [-x, y]], d, {fillet, filletSegments: segments, bevel, bevelSegments: segments});
}

export function tube(points, radius, {radial = 10, closed = false, tension = 0.5} = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(vec), closed, 'catmullrom', tension);
  const tubular = Math.max(16, Math.round(curve.getLength() * 24));
  const tubeGeometry = new THREE.TubeGeometry(curve, tubular, radius, radial, closed);
  const geometry = closed ? tubeGeometry : capTube(tubeGeometry, curve, tubular, radial);
  geometry.userData.edge = 0;
  geometry.userData.curve = curve;
  geometry.userData.radius = radius;
  return geometry;
}

// TubeGeometry leaves both ends open; a flat disc on each end ring closes it.
function capTube(geometry, curve, tubular, radial) {
  const source = geometry.attributes.position.array;
  const position = [...source], normal = [...geometry.attributes.normal.array], uv = [...geometry.attributes.uv.array];
  const index = [...geometry.index.array];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), face = new THREE.Vector3();
  for (const [ring, t, sign] of [[0, 0, -1], [tubular, 1, 1]]) {
    const n = curve.getTangentAt(t).multiplyScalar(sign);
    const center = curve.getPointAt(t);
    const base = position.length / 3;
    position.push(center.x, center.y, center.z);
    for (let j = 0; j <= radial; j++) {
      const k = (ring * (radial + 1) + j) * 3;
      position.push(source[k], source[k + 1], source[k + 2]);
    }
    for (let j = 0; j <= radial + 1; j++) { normal.push(n.x, n.y, n.z); uv.push(0.5, 0.5); }
    a.fromArray(position, (base + 1) * 3).sub(center);
    b.fromArray(position, (base + 2) * 3).sub(center);
    const flip = face.crossVectors(a, b).dot(n) < 0;
    for (let j = 0; j < radial; j++) {
      if (flip) index.push(base, base + 2 + j, base + 1 + j); else index.push(base, base + 1 + j, base + 2 + j);
    }
  }
  const capped = new THREE.BufferGeometry();
  capped.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  capped.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  capped.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  capped.setIndex(index);
  geometry.dispose();
  return capped;
}

export function torus(radius, tube, {radial = 10, tubular = 48, arc = 2 * PI} = {}) {
  const geometry = new THREE.TorusGeometry(radius, tube, radial, tubular, arc);
  geometry.userData.edge = 0.15;
  return geometry;
}

// Axis helpers: builders produce Y-up parts; these rotate them onto X or Z.
export const AXIS = {x: [0, 0, -PI / 2], y: [0, 0, 0], z: [PI / 2, 0, 0]};

// Like BufferGeometryUtils.toCreasedNormals, but hashed at 0.1 mm: its 1 cm
// buckets would merge both sides of the small bevels used throughout the kit.
function crease(geometry, angle = CREASE) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  const pos = g.attributes.position;
  const triangles = pos.count / 3;
  const faceNormals = new Float32Array(triangles * 3);
  const buckets = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  for (let t = 0; t < triangles; t++) {
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    n.subVectors(c, b).cross(a.sub(b)).normalize();
    faceNormals.set([n.x, n.y, n.z], t * 3);
    for (let k = 0; k < 3; k++) {
      const id = key(t * 3 + k);
      if (!buckets.has(id)) buckets.set(id, []);
      buckets.get(id).push(t);
    }
  }
  const limit = Math.cos(angle);
  const normals = new Float32Array(pos.count * 3);
  const own = new THREE.Vector3(), other = new THREE.Vector3(), sum = new THREE.Vector3();
  for (let t = 0; t < triangles; t++) {
    own.fromArray(faceNormals, t * 3);
    for (let k = 0; k < 3; k++) {
      sum.set(0, 0, 0);
      for (const neighbour of buckets.get(key(t * 3 + k))) {
        other.fromArray(faceNormals, neighbour * 3);
        if (own.dot(other) > limit) sum.add(other);
      }
      if (sum.lengthSq() < 1e-12) sum.copy(own);
      sum.normalize().toArray(normals, (t * 3 + k) * 3);
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}

// Curvature per triangle: the largest angle between its vertex normals divided
// by the distance between them. Bevels and small radii read as edges; broad
// panels and large cylinders do not. Values are not shared across triangles:
// a flat cap fanned from a bevelled rim must stay flat.
function curvatureAttribute(geometry, scale = 1 / 900) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position, nor = g.attributes.normal;
  const values = new Float32Array(pos.count);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), na = new THREE.Vector3(), nb = new THREE.Vector3();
  for (let t = 0; t < pos.count / 3; t++) {
    let peak = 0;
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k, j = t * 3 + (k + 1) % 3;
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, j);
      na.fromBufferAttribute(nor, i); nb.fromBufferAttribute(nor, j);
      peak = Math.max(peak, THREE.MathUtils.radToDeg(na.angleTo(nb)) / Math.max(a.distanceTo(b), 0.002));
    }
    values.fill(Math.min(peak * scale, 1), t * 3, t * 3 + 3);
  }
  if (g !== geometry) {
    // Indexed input (tubes, tori): fall back to a per-vertex maximum.
    const out = new Float32Array(geometry.attributes.position.count);
    const index = geometry.index;
    for (let i = 0; i < index.count; i++) out[index.getX(i)] = Math.max(out[index.getX(i)], values[i]);
    g.dispose();
    return new THREE.BufferAttribute(out, 1);
  }
  return new THREE.BufferAttribute(values, 1);
}

// Collects parts by material and merges them into one mesh per material.
export class Assembly {
  constructor(name) {
    this.name = name;
    this.batches = new Map();
  }

  add(geometry, material, {position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], edge} = {}) {
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const count = geometry.attributes.position.count;
    const fixedEdge = edge ?? geometry.userData.edge;
    const clean = new THREE.BufferGeometry();
    // Cloned so one prototype part (a bolt, a clamp) can be placed many times.
    clean.setAttribute('position', geometry.attributes.position.clone());
    clean.setAttribute('normal', geometry.attributes.normal.clone());
    clean.setAttribute('uv', geometry.attributes.uv || new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    if (fixedEdge === undefined) geometry.userData.curvature ??= curvatureAttribute(geometry);
    clean.setAttribute('edge', fixedEdge === undefined
      ? geometry.userData.curvature.clone()
      : new THREE.BufferAttribute(new Float32Array(count).fill(fixedEdge), 1));
    clean.setIndex(geometry.index || [...Array(count).keys()]);
    clean.applyMatrix4(new THREE.Matrix4().compose(vec(position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), vec(scale)));
    if (!this.batches.has(material)) this.batches.set(material, []);
    this.batches.get(material).push(clean);
    return this;
  }

  // A cable or hose that ends in a gland collar at both ends. Endpoints are
  // placed on the surface the cable enters, so each collar sits half inside it.
  cable(points, radius, material, gland, options) {
    const geometry = tube(points, radius, options);
    this.add(geometry, material);
    const curve = geometry.userData.curve;
    const collar = cylinder(radius * 1.45, radius * 1.8, {segments: 16, bevel: radius * 0.3});
    const up = new THREE.Vector3(0, 1, 0);
    for (const t of [0, 1]) {
      const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, curve.getTangentAt(t)));
      this.add(collar, gland, {position: curve.getPointAt(t).toArray(), rotation: [rotation.x, rotation.y, rotation.z]});
    }
    return this;
  }

  // Convenience for parts defined between two points (struts, rods, pistons).
  between(from, to, radius, material, {bevel, segments = 12, radiusTop} = {}) {
    const start = vec(from), end = vec(to), delta = end.clone().sub(start);
    const geometry = cylinder(radius, delta.length(), {bevel: bevel ?? radius * 0.35, segments, radiusTop});
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()));
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
    return this.add(geometry, material);
  }

  finish({castShadow = true, receiveShadow = true} = {}) {
    const group = new THREE.Group();
    group.name = this.name;
    for (const [material, parts] of this.batches) {
      const merged = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow && !material.userData.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.name = `${this.name} / ${material.name || 'part'}`;
      group.add(mesh);
    }
    this.batches.clear();
    return group;
  }
}
