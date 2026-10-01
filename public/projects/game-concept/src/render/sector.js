import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';

// Sector map: the gas giant Morrow, the broken station ring whose gap gives
// the Lacuna its name, Kepler Yard and the wrecks under contract. Map units
// are arbitrary; only relative distance and position carry meaning.

const PI = Math.PI;
export const SUN = new THREE.Vector3(-0.62, 0.28, -0.73).normalize();
const PLANET_RADIUS = 24;

export const polar = ({angle, radius, height = 0}) => {
  const a = THREE.MathUtils.degToRad(angle);
  return new THREE.Vector3(Math.cos(a) * radius, height, Math.sin(a) * radius);
};

const NOISE = /* glsl */`
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm3(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise3(p); p *= 2.03; a *= 0.5; } return v; }
`;

export function planetMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {sunDir: {value: SUN}},
    vertexShader: /* glsl */`
      varying vec3 vNormal; varying vec3 vObj; varying vec3 vView;
      void main() {
        vObj = position;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 sunDir;
      varying vec3 vNormal; varying vec3 vObj; varying vec3 vView;
      ${NOISE}
      void main() {
        vec3 p = normalize(vObj);
        float warp = fbm3(p * 3.2) * 0.9 + fbm3(p * 9.0) * 0.18;
        float lat = p.y * 7.5 + warp * 1.6;
        float band = 0.5 + 0.26 * sin(lat * 2.1) + 0.14 * sin(lat * 5.3 + warp * 3.0);
        vec3 deep = vec3(0.07, 0.11, 0.13), teal = vec3(0.15, 0.22, 0.23), sage = vec3(0.24, 0.26, 0.23), ochre = vec3(0.33, 0.27, 0.19);
        vec3 col = mix(deep, teal, smoothstep(0.1, 0.5, band));
        col = mix(col, sage, smoothstep(0.45, 0.75, band));
        col = mix(col, ochre, smoothstep(0.72, 0.95, band) * 0.8);
        float storm = smoothstep(0.84, 0.9, fbm3(p * 5.0 + vec3(3.1, 0.0, 1.7))) * smoothstep(0.35, 0.1, abs(p.y + 0.28));
        col = mix(col, vec3(0.78, 0.66, 0.46), storm * 0.7);
        float ndl = dot(normalize(vNormal), sunDir);
        float day = smoothstep(-0.08, 0.55, ndl);
        vec3 lit = col * (0.012 + day * 0.42);
        float rim = pow(clamp(1.0 - dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.0);
        lit += vec3(0.4, 0.66, 0.72) * rim * smoothstep(-0.2, 0.4, ndl) * 0.5;
        gl_FragColor = vec4(lit, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function atmosphere(radius = PLANET_RADIUS) {
  const material = new THREE.ShaderMaterial({
    uniforms: {sunDir: {value: SUN}},
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec3 vNormal; varying vec3 vView;
      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vView = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 sunDir; varying vec3 vNormal; varying vec3 vView;
      void main() {
        float edge = pow(clamp(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 0.0, 1.0), 2.2);
        float sun = smoothstep(-0.3, 0.5, dot(-normalize(vNormal), sunDir) * -1.0);
        gl_FragColor = vec4(vec3(0.42, 0.7, 0.78) * edge * (0.25 + sun * 0.9), edge);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.045, 64, 48), material);
}

// The original station ring: dust bands thinning out where it broke apart;
// that gap is the Lacuna.
function ringDust() {
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      varying vec3 vWorld;
      ${NOISE}
      void main() {
        float r = length(vWorld.xz);
        float a = atan(vWorld.z, vWorld.x);
        float bands = fbm3(vec3(r * 0.9, 0.0, 0.0)) * 0.8 + noise3(vec3(r * 4.0, 1.0, 0.0)) * 0.35;
        float density = smoothstep(33.0, 37.0, r) * (1.0 - smoothstep(49.0, 53.0, r)) * bands;
        float gap = smoothstep(0.0, 0.35, abs(a - radians(-62.0)) - 0.6);
        density *= mix(0.18, 1.0, gap);
        vec3 col = mix(vec3(0.42, 0.44, 0.4), vec3(0.7, 0.62, 0.48), noise3(vec3(r * 1.3, 0.0, 2.0)));
        gl_FragColor = vec4(col * 0.45, density * 0.5);
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.RingGeometry(32, 54, 256, 4);
  geometry.rotateX(-PI / 2);
  return new THREE.Mesh(geometry, material);
}

// Station debris: irregular chunks, denser inside the gap where the ring broke.
// Mostly rough, barely metallic: the map has no environment to reflect, so
// metal faces turned from the sun rendered as pure black specks over the ring.
function debris(count) {
  const geometry = new THREE.IcosahedronGeometry(1, 0);
  const material = new THREE.MeshStandardMaterial({color: '#8b8f86', roughness: 0.85, metalness: 0.08, flatShading: true, emissive: '#1a2023'});
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  let seed = 91;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const inGap = random() < 0.3;
    const angle = inGap ? -62 + (random() - 0.5) * 84 : random() * 360;
    const radius = 36 + random() * 14;
    const position = polar({angle, radius, height: (random() - 0.5) * (inGap ? 1.8 : 0.6)});
    const size = (inGap ? 0.06 + random() * 0.14 : 0.03 + random() * 0.07) * (random() < 0.03 ? 2.5 : 1);
    q.setFromEuler(new THREE.Euler(random() * 6, random() * 6, random() * 6));
    s.set(size, size * (0.4 + random()), size * (0.5 + random()));
    matrix.compose(position, q, s);
    mesh.setMatrixAt(i, matrix);
  }
  return mesh;
}

// A faint sky gradient that lifts toward one direction (the planet, or the
// space behind it), so empty space is never a flat black field.
export function sky(glowDirection, strength = 1) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {planetDir: {value: glowDirection.clone().normalize()}, strength: {value: strength}},
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 planetDir;
      uniform float strength;
      varying vec3 vDir;
      void main() {
        float toPlanet = max(dot(normalize(vDir), planetDir), 0.0);
        float up = vDir.y * 0.5 + 0.5;
        vec3 col = mix(vec3(0.016, 0.026, 0.034), vec3(0.008, 0.012, 0.018), up);
        col += vec3(0.05, 0.085, 0.1) * pow(toPlanet, 5.0) + vec3(0.018, 0.024, 0.028) * pow(toPlanet, 1.5);
        gl_FragColor = vec4(col * strength, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 24), material);
  mesh.renderOrder = -2;
  return mesh;
}

export function stars(count) {
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  let seed = 17;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize().multiplyScalar(420);
    positions.set([v.x, v.y, v.z], i * 3);
    const b = 0.35 + random() * 0.65;
    colors.set([b * 0.9, b * 0.95, b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({size: 1.4, sizeAttenuation: false, vertexColors: true, depthWrite: false}));
}

export function createSector({home, contracts}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060b0e');
  // Seen from the map camera the glow sits behind Morrow and fades outward.
  scene.add(sky(new THREE.Vector3(-0.57, -0.8, -0.2), 0.3));
  scene.add(stars(2200));
  const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS, 128, 96), planetMaterial());
  scene.add(planet, atmosphere(), ringDust(), debris(1500));
  const sun = new THREE.DirectionalLight('#fff4e2', 3.2);
  sun.position.copy(SUN).multiplyScalar(100);
  // Sky and ring bounce keep the sides turned from the sun readable.
  scene.add(sun, new THREE.AmbientLight('#51646c', 0.35), new THREE.HemisphereLight('#9fb3bc', '#4a4238', 1.1));

  // Marker stems: a line from the ring plane up to each target, plus a small
  // ground ring, so height above the plane stays readable.
  const points = new Map();
  const markers = new Map();
  const stemMaterial = new THREE.LineBasicMaterial({color: '#9fb6bd', transparent: true, opacity: 0.35});
  for (const item of [home, ...contracts]) {
    const position = polar(item.map || item);
    points.set(item.id, position);
    const base = position.clone().setY(0);
    const group = new THREE.Group();
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([base, position]), stemMaterial));
    group.visible = !item.hidden;
    markers.set(item.id, group);
    scene.add(group);
  }

  // Transfer route along the ring from the yard to the focused contract.
  const routeMaterial = new LineMaterial({color: 0xffb44f, linewidth: 2.2, dashed: true, dashSize: 1.1, gapSize: 0.7, transparent: true, opacity: 0.95, worldUnits: false});
  const route = new Line2(new LineGeometry(), routeMaterial);
  route.visible = false;
  scene.add(route);

  function setRoute(targetId) {
    const target = contracts.find(c => c.id === targetId);
    if (!target) { route.visible = false; return; }
    const from = home, to = target.map;
    const positions = [];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const lift = Math.sin(k * PI) * 2.2;
      const p = polar({angle: THREE.MathUtils.lerp(from.angle, to.angle, k), radius: THREE.MathUtils.lerp(from.radius, to.radius, k), height: THREE.MathUtils.lerp(from.height, to.height, k) + lift});
      positions.push(p.x, p.y, p.z);
    }
    route.geometry.dispose();
    route.geometry = new LineGeometry();
    route.geometry.setPositions(positions);
    route.computeLineDistances();
    route.visible = true;
  }

  return {
    scene,
    points,
    isVisible: (id) => markers.get(id)?.visible ?? false,
    visiblePoints: () => [...points].filter(([id]) => markers.get(id)?.visible).map(([, p]) => p),
    // Returns true when visibility changed (hidden contracts can be revealed).
    setVisible(ids) {
      let changed = false;
      for (const [id, group] of markers) {
        const visible = id === home.id || ids.includes(id);
        if (group.visible !== visible) { group.visible = visible; changed = true; }
      }
      return changed;
    },
    setRoute,
    setResolution(width, height) { routeMaterial.resolution.set(width, height); },
    animate(dt, reduced) { if (!reduced) routeMaterial.dashOffset -= dt * 1.6; planet.rotation.y += reduced ? 0 : dt * 0.004; },
    hasMotion: (reduced) => route.visible && !reduced,
  };
}
