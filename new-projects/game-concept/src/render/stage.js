import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createVessel, TOOL_MOUNT} from './vessel.js';
import {BENCH_SUPPORT, createTool} from './tools.js';
import {BENCH, createEnvironment, createHangar, createLights, createTurntable, FLOOR_Y, LIFT, restOnPads} from './hangar.js';
import {createSector, polar} from './sector.js';
import {createOperationWorld} from './operation.js';
import {createItemModel} from './items.js';

// Owns the WebGL renderer, both worlds (the service bay and the sector map),
// cameras, post-processing, adaptive quality and all object motion. The DOM
// layer drives it through a small API and receives projected anchor points.

const PI = Math.PI;
const QUALITY = {
  high: {pixelRatio: 1.75, shadow: 2048, ao: true, bloom: true, samples: 4},
  medium: {pixelRatio: 1.25, shadow: 1024, ao: false, bloom: true, samples: 4},
  low: {pixelRatio: 1.5, shadow: 1024, ao: false, bloom: false, samples: 0},
};
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const MAP_CENTER = polar({angle: -65, radius: 40, height: 0});

// Camera rigs: look-at target, spherical orbit (yaw, pitch, distance) and a
// horizontal/vertical view offset that keeps the subject clear of the panels.
const RIGS = {
  wide: {
    dock: {target: new THREE.Vector3(-0.4, -0.2, 0.3), yaw: -0.95, pitch: 0.16, distance: 13.4, offsetX: 0.13, offsetY: 0.03},
    bench: {target: new THREE.Vector3(-1.15, -0.7, 5.1), yaw: -0.55, pitch: 0.46, distance: 8.2, offsetX: 0.15, offsetY: -0.035},
    sector: {target: MAP_CENTER, yaw: 1.23, pitch: 0.92, distance: 118, offsetX: 0, offsetY: 0},
    // Title screen: the vessel to the right of the text column.
    intro: {target: new THREE.Vector3(-0.6, -0.1, 0.3), yaw: -0.72, pitch: 0.12, distance: 12.8, offsetX: -0.2, offsetY: 0.02},
  },
  compact: {
    dock: {target: new THREE.Vector3(-0.4, -0.3, 0.3), yaw: -0.95, pitch: 0.24, distance: 12.8, offsetX: 0, offsetY: 0.1},
    bench: {target: new THREE.Vector3(-1.15, -0.7, 5.1), yaw: -0.55, pitch: 0.5, distance: 6.6, offsetX: 0, offsetY: 0.02},
    sector: {target: MAP_CENTER, yaw: 1.23, pitch: 0.95, distance: 112, offsetX: 0, offsetY: 0},
    intro: {target: new THREE.Vector3(-0.4, -0.3, 0.3), yaw: -0.8, pitch: 0.2, distance: 13.5, offsetX: 0, offsetY: 0.18},
  },
};

export function createStage(canvas, {onFailure = () => {}, onProject = () => {}, onFirstFrame = () => {}, onContextLost = () => {}, onContextRestored = () => {}, installed = 'cutter', initialView = 'dock', sectorData, compact = () => innerWidth <= 760} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;

  // ---- Service bay ------------------------------------------------------------
  const bay = new THREE.Scene();
  bay.background = new THREE.Color('#131c21');
  bay.fog = new THREE.FogExp2('#18232a', 0.03);
  let environment = createEnvironment(renderer);
  bay.environment = environment.texture;
  bay.environmentIntensity = 0.38;
  const lights = createLights(bay);
  const hangar = createHangar();
  bay.add(hangar.group);
  const vessel = createVessel();
  bay.add(vessel.group);
  const vesselHome = vessel.group.position.clone();
  const turntable = createTurntable();
  bay.add(turntable);
  const bayCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 140);

  const modules = new Map();
  for (const id of ['cutter', 'grapple', 'arc']) {
    const object = createTool(id);
    object.visible = false;
    bay.add(object);
    // How far the module's underside is below its origin (it stands on the lift
    // carriage), and where the origin sits in table space resting on the pads.
    const bottom = new THREE.Box3().setFromObject(object).min.y;
    const seat = new THREE.Vector3(-BENCH_SUPPORT[id], BENCH.padTop - restOnPads(object, BENCH_SUPPORT[id]), 0);
    modules.set(id, {id, object, location: 'storage', path: null, bottom, seat});
  }
  const mountWorld = () => vessel.group.localToWorld(TOOL_MOUNT.clone());
  const liftX = (LIFT.x[0] + LIFT.x[1]) / 2, liftZ = (LIFT.z[0] + LIFT.z[1]) / 2;
  const benchPose = new THREE.Euler();
  // In the shaft a module stands on the carriage deck (at the landing, or flush
  // with the floor at the top); on the bench it rests on the table pads.
  function anchor(name, module) {
    if (name === 'mount') return mountWorld();
    if (name === 'storage') return new THREE.Vector3(liftX, LIFT.landing + 0.08 - module.bottom, liftZ);
    if (name === 'liftTop') return new THREE.Vector3(liftX, FLOOR_Y - module.bottom, liftZ);
    return module.seat.clone().applyEuler(benchPose.set(0, spin, benchTilt)).add(BENCH.pivot);
  }
  // Modules turn lengthwise to fit the 1.6 x 3.2 m shaft.
  const yawAt = (name) => name === 'storage' || name === 'liftTop' ? PI / 2 : name === 'stand' ? spin : 0;

  // ---- Sector -----------------------------------------------------------------
  const sector = createSector(sectorData);
  const mapCamera = new THREE.PerspectiveCamera(30, 1, 1, 1200);
  let insets = {left: 0, right: 0, top: 0, bottom: 0}, mapFit = null;

  // ---- Operation vignette ------------------------------------------------------
  const op = createOperationWorld(environment.texture);
  const opCamera = new THREE.PerspectiveCamera(34, 1, 0.1, 600);
  let opContract = null, opTool = null;

  // ---- Shared state -----------------------------------------------------------
  let quality = 'high', qualityMode = 'auto', composer = null, renderPass = null, aoPass = null;
  const worldOf = (name) => name === 'sector' ? 'map' : name === 'op' ? 'op' : 'bay';
  let view = initialView, world = worldOf(initialView), reduced = false, installing = false, alive = true, raf = 0, last = 0, width = 1, height = 1;
  let activeFrames = 120, installedId = installed, selectedId = installed;
  let orbitYaw = 0, orbitPitch = 0, orbitYawTarget = 0, orbitPitchTarget = 0;
  let spin = 0, spinTarget = 0, tilt = 0, tiltTarget = 0, focus = 0, benchTilt = 0;
  let rigFrom = null, rigStart = 0, rigDuration = 1, currentRoute = null, shadowFrames = 3;
  let sensitivity = 1, invertY = 1;
  const frameTimes = [];
  const wake = (frames = 2) => { activeFrames = Math.max(activeFrames, frames); };
  const scene = () => ({map: sector.scene, op: op.scene})[world] ?? bay;
  const camera = () => ({map: mapCamera, op: opCamera})[world] ?? bayCamera;

  // A 2D copy of the last frame covers a change of world while the new world
  // draws its first frame, then dissolves: a scene change never shows black.
  const snapshot = document.createElement('canvas');
  snapshot.className = 'stage-snapshot';
  snapshot.setAttribute('aria-hidden', 'true');
  canvas.after(snapshot);
  let paused = false, contextLost = false, firstFrame = false, restoreTimer = 0, cut = null;

  // After a context restore the old targets belong to the lost context and are
  // dropped rather than disposed.
  function buildPipeline({afterRestore = false} = {}) {
    if (!afterRestore) { composer?.dispose(); aoPass?.dispose?.(); }
    composer = renderPass = aoPass = null;
    const q = QUALITY[quality];
    renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
    for (const light of [lights.key, lights.bench]) {
      const size = light === lights.key ? q.shadow : Math.min(q.shadow, 1024);
      light.shadow.mapSize.set(size, size);
      if (!afterRestore) light.shadow.map?.dispose();
      light.shadow.map = null;
    }
    if (q.samples) {
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType, samples: q.samples}));
      renderPass = new RenderPass(scene(), camera());
      composer.addPass(renderPass);
      if (q.ao) {
        aoPass = new GTAOPass(bay, bayCamera, width, height);
        aoPass.updateGtaoMaterial({radius: 0.55, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 12});
        aoPass.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12});
        aoPass.blendIntensity = 0.85;
        composer.addPass(aoPass);
      }
      if (q.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.24, 0.35, 1.3));
      composer.addPass(new OutputPass());
    }
    syncWorld();
    shadowFrames = 3;
    resize();
  }

  function syncWorld() {
    if (renderPass) { renderPass.scene = scene(); renderPass.camera = camera(); }
    if (aoPass) aoPass.enabled = world === 'bay';
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    for (const cam of [bayCamera, mapCamera, opCamera]) { cam.aspect = width / height; cam.updateProjectionMatrix(); }
    sector.setResolution(width, height);
    mapFit = null;
    wake();
    // setSize clears the canvas; draw now rather than on the next animation
    // frame, or every resize step and quality change flashes the background.
    if (drawable()) renderFrame();
  }

  function drawable() { return alive && firstFrame && !paused && !contextLost; }

  // Frames every map marker inside the area left free by the panels: solve the
  // distance from the projected bounds, then offset the view onto their centre.
  const probe = new THREE.PerspectiveCamera(30, 1, 0.1, 1200);
  function frame(rig, points, free, fov, [minScale, maxScale]) {
    probe.fov = fov;
    probe.aspect = width / height;
    probe.updateProjectionMatrix();
    const place = (distance) => {
      probe.position.set(
        rig.target.x + Math.sin(rig.yaw) * Math.cos(rig.pitch) * distance,
        rig.target.y + Math.sin(rig.pitch) * distance,
        rig.target.z + Math.cos(rig.yaw) * Math.cos(rig.pitch) * distance,
      );
      probe.lookAt(rig.target);
      probe.updateMatrixWorld();
      const box = {x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity};
      for (const point of points) {
        const p = point.clone().project(probe);
        const x = (p.x * 0.5 + 0.5) * width, y = (1 - (p.y * 0.5 + 0.5)) * height;
        box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
        box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
      }
      return box;
    };
    // Projected size is roughly inverse to distance; a second pass corrects
    // the perspective error of the first estimate.
    let distance = rig.distance;
    for (let pass = 0; pass < 2; pass++) {
      const box = place(distance);
      const scale = Math.max((box.x1 - box.x0) / Math.max(free.x1 - free.x0, 80), (box.y1 - box.y0) / Math.max(free.y1 - free.y0, 60));
      distance = THREE.MathUtils.clamp(distance * scale, rig.distance * minScale, rig.distance * maxScale);
    }
    const box = place(distance);
    return {
      distance,
      offsetX: ((box.x0 + box.x1) / 2 - (free.x0 + free.x1) / 2) / width,
      offsetY: ((box.y0 + box.y1) / 2 - (free.y0 + free.y1) / 2) / height,
    };
  }

  function fitMap() {
    const free = {x0: insets.left + 20, x1: width - insets.right - (compact() ? 100 : 170), y0: insets.top + (compact() ? 16 : 30), y1: height - insets.bottom - (compact() ? 16 : 30)};
    mapFit = frame(rigFor('sector'), sector.visiblePoints(), free, mapCamera.fov, [0.55, 3]);
  }

  const rigFor = (name) => RIGS[compact() ? 'compact' : 'wide'][name];

  function liveRig() {
    if (view === 'op') {
      // The vessel and its target are refitted every frame into the space the
      // decision cards and telemetry leave free, so moves never slide under UI.
      const base = op.cameraRig();
      const rig = {...base, yaw: base.yaw + orbitYaw, pitch: base.pitch + orbitPitch};
      const free = {x0: insets.left + 24, x1: width - insets.right - 24, y0: insets.top + 12, y1: height - insets.bottom - 12};
      return {...rig, ...frame(rig, op.framePoints(), free, opCamera.fov, [0.4, 3])};
    }
    const rig = rigFor(view);
    if (view === 'sector') {
      if (!mapFit) fitMap();
      return {...rig, ...mapFit, target: rig.target.clone(), yaw: rig.yaw + orbitYaw, pitch: rig.pitch + orbitPitch};
    }
    // During a launch or docking shot the interface is hidden: frame the bay centrally.
    if (view === 'dock' && cut) return {...rig, target: rig.target.clone().add(new THREE.Vector3(-1.5, 0.4, -2)), yaw: rig.yaw - 0.15, pitch: rig.pitch + 0.06, distance: rig.distance * 1.25, offsetX: 0, offsetY: 0};
    if (view === 'dock') return {...rig, target: rig.target.clone(), yaw: rig.yaw + orbitYaw, pitch: rig.pitch + orbitPitch};
    return {...rig, target: rig.target.clone()};
  }

  function applyCamera(now) {
    let rig = liveRig();
    if (rigFrom) {
      const t = Math.min((now - rigStart) / rigDuration, 1), k = ease(t);
      rig = {
        target: rigFrom.target.clone().lerp(rig.target, k),
        yaw: THREE.MathUtils.lerp(rigFrom.yaw, rig.yaw, k),
        pitch: THREE.MathUtils.lerp(rigFrom.pitch, rig.pitch, k),
        distance: THREE.MathUtils.lerp(rigFrom.distance, rig.distance, k),
        offsetX: THREE.MathUtils.lerp(rigFrom.offsetX, rig.offsetX, k),
        offsetY: THREE.MathUtils.lerp(rigFrom.offsetY, rig.offsetY, k),
      };
      if (t >= 1) rigFrom = null;
      wake();
    }
    const cam = camera();
    const pitch = THREE.MathUtils.clamp(rig.pitch, 0.06, 1.2);
    const distance = rig.distance * (compact() && world === 'bay' ? Math.max(1, 1.2 / cam.aspect) ** 0.6 : 1);
    cam.position.set(
      rig.target.x + Math.sin(rig.yaw) * Math.cos(pitch) * distance,
      rig.target.y + Math.sin(pitch) * distance,
      rig.target.z + Math.cos(rig.yaw) * Math.cos(pitch) * distance,
    );
    cam.lookAt(rig.target);
    cam.setViewOffset(width, height, width * rig.offsetX, height * rig.offsetY, width, height);
  }

  // ---- Module choreography -----------------------------------------------------
  function wantedLocations() {
    const want = new Map([...modules.keys()].map(id => [id, 'storage']));
    if (view === 'bench') {
      if (installedId !== selectedId) want.set(installedId, 'mount');
      want.set(selectedId, 'stand');
    } else want.set(installedId, 'mount');
    return want;
  }

  // Legs between named anchors. The lift is a vertical shaft; the arc height
  // keeps a travelling module clear of the turntable and the cradle.
  function route(from, to) {
    if (from === to) return [];
    const leg = (a, b, lift, duration) => ({from: a, to: b, lift, duration});
    if (from === 'storage') return [leg('storage', 'liftTop', 0, 340), ...(to === 'liftTop' ? [] : [leg('liftTop', to, 0.7, 560)])];
    if (to === 'storage') return [leg(from, 'liftTop', 0.7, 560), leg('liftTop', 'storage', 0, 340)];
    return [leg(from, to, 0.9, 820)];
  }

  function placeAt(module, name) {
    module.object.visible = name !== 'storage';
    module.object.position.copy(anchor(name, module));
    module.object.rotation.set(0, yawAt(name), name === 'stand' ? benchTilt : 0);
  }

  function schedule(module, from, to, start) {
    const legs = route(from, to);
    if (reduced || !legs.length || world !== 'bay') {
      module.path = null;
      module.location = to;
      placeAt(module, to);
      return start;
    }
    // A module leaving storage waits for the lift doors to open.
    let t = start + (legs[0].from === 'storage' ? DOOR_MS * (1 - doorOpen) : 0);
    const segments = legs.map((leg, i) => {
      const free = i === 0 && module.path;
      const segment = {fromName: free ? 'free' : leg.from, toName: leg.to, from: free ? module.object.position.clone() : null, fromYaw: free ? module.object.rotation.y : null, lift: leg.lift, start: t, duration: leg.duration};
      t += leg.duration;
      return segment;
    });
    module.path = {segments, destination: to};
    return t;
  }

  // Modules leaving go first; one arriving from storage waits for the lift.
  function plan(now) {
    const want = wantedLocations();
    let liftFreeAt = now;
    const arriving = [];
    for (const module of modules.values()) {
      const target = want.get(module.id);
      const current = module.path ? module.path.destination : module.location;
      if (current === target) continue;
      if (target === 'stand') { arriving.push([module, current]); continue; }
      const end = schedule(module, current, target, now);
      if (target === 'storage') liftFreeAt = Math.max(liftFreeAt, end);
    }
    for (const [module, current] of arriving) schedule(module, current, 'stand', current === 'storage' ? liftFreeAt : now + 120);
    wake();
  }

  function stepModules(now) {
    let moving = false;
    for (const module of modules.values()) {
      if (!module.path) {
        if (module.location === 'stand') {
          module.object.position.copy(anchor('stand', module));
          module.object.rotation.set(0, spin, benchTilt);
        }
        continue;
      }
      moving = true;
      const segments = module.path.segments;
      if (now < segments[0].start) {
        if (segments[0].fromName === 'storage') module.object.visible = false;
        continue;
      }
      const segment = segments.find(s => now < s.start + s.duration) || segments.at(-1);
      const k = ease(THREE.MathUtils.clamp((now - segment.start) / segment.duration, 0, 1));
      const position = (segment.from || anchor(segment.fromName, module)).clone().lerp(anchor(segment.toName, module), k);
      position.y += Math.sin(k * PI) * segment.lift;
      module.object.position.copy(position);
      const fromYaw = segment.fromYaw ?? yawAt(segment.fromName);
      module.object.rotation.set(0, THREE.MathUtils.lerp(fromYaw, yawAt(segment.toName), k), segment.fromName === 'stand' ? benchTilt * (1 - k) : segment.toName === 'stand' ? benchTilt * k : 0);
      module.object.visible = !(segment.toName === 'storage' && k >= 1);
      const end = segments.at(-1);
      if (now >= end.start + end.duration) {
        module.location = module.path.destination;
        module.path = null;
        placeAt(module, module.location);
      }
    }
    return moving;
  }

  // ---- Storage lift ------------------------------------------------------------------
  // The doors open while a module's route passes through the shaft and stay
  // open until the carriage is back on the landing. The carriage carries the
  // module in the shaft and waits flush with the floor while it lifts off.
  const DOOR_MS = 320;
  const carriageRest = LIFT.landing + 0.04, carriageTop = FLOOR_Y - 0.04;
  let doorOpen = 0;
  function stepLift(now, dt) {
    let busy = false, riding = null;
    for (const module of modules.values()) {
      if (!module.path) continue;
      const segments = module.path.segments;
      if (!segments.some(s => s.fromName === 'storage' || s.toName === 'storage')) continue;
      busy = true;
      const segment = segments.find(s => now < s.start + s.duration) || segments.at(-1);
      const inShaft = [segment.fromName, segment.toName].sort().join() === 'liftTop,storage';
      if (inShaft && now >= segment.start) riding = module;
    }
    const {carriage, doors} = hangar.lift;
    const before = carriage.position.y, beforeDoor = doorOpen;
    if (riding) carriage.position.y = riding.object.position.y + riding.bottom - 0.04;
    else carriage.position.y += ((busy ? carriageTop : carriageRest) - carriage.position.y) * (reduced ? 1 : 1 - Math.exp(-dt * 9));
    const open = busy || carriage.position.y > carriageRest + 0.02 ? 1 : 0;
    doorOpen = reduced ? open : THREE.MathUtils.clamp(doorOpen + Math.sign(open - doorOpen) * dt * 1000 / DOOR_MS, 0, 1);
    for (const door of doors) door.rotation.z = door.userData.side * ease(doorOpen) * PI / 2;
    return Math.abs(carriage.position.y - before) > 1e-4 || doorOpen !== beforeDoor;
  }

  // ---- Launch and docking shots ----------------------------------------------------
  // The vessel lifts off the cradle, turns to the bay door and leaves (launch),
  // or the same path in reverse (docking). The mounted module rides along.
  const DOOR = new THREE.Vector3(-6, 2.6, -21);
  const CUT_MS = 1500;
  const clamp01 = (v) => THREE.MathUtils.clamp(v, 0, 1);
  function carryMounted() {
    for (const module of modules.values()) {
      if (module.location !== 'mount' || module.path) continue;
      module.object.position.copy(mountWorld());
      module.object.rotation.copy(vessel.group.rotation);
    }
  }
  function poseCut(k) {
    const lift = ease(clamp01(k / 0.3)) * 0.7;
    const turn = ease(clamp01((k - 0.12) / 0.45));
    const travel = Math.pow(clamp01((k - 0.3) / 0.7), 2.2);
    vessel.group.position.copy(vesselHome).lerp(DOOR, travel);
    vessel.group.position.y += lift * (1 - travel);
    vessel.group.rotation.set(0, -PI / 2 * turn, 0);
    // The boom's drop lines retract into its head as the vessel lifts off.
    const retract = ease(clamp01(k / 0.2));
    hangar.umbilical.scale.y = Math.max(1 - retract, 1e-3);
    hangar.umbilical.visible = retract < 1;
    carryMounted();
  }
  function resetVessel() {
    vessel.group.position.copy(vesselHome);
    vessel.group.rotation.set(0, 0, 0);
    hangar.umbilical.scale.y = 1;
    hangar.umbilical.visible = true;
    carryMounted();
  }
  function stepCut(now) {
    if (!cut) return false;
    const k = clamp01((now - cut.start) / CUT_MS);
    poseCut(cut.type === 'launch' ? k : 1 - k);
    if (k >= 1) finishCut();
    return true;
  }
  function finishCut() {
    if (!cut) return;
    const done = cut;
    cut = null;
    poseCut(done.type === 'launch' ? 1 : 0);
    if (done.type === 'dock') resetVessel();
    done.onDone?.();
  }

  // ---- Studio renders for the interface ----------------------------------------
  // Each object on a transparent studio backdrop with the bay's light probe,
  // read back to a WebP data URL.
  function studioShots(entries, {width, height, view, fitBox = false}) {
    const studio = new THREE.Scene();
    studio.environment = environment.texture;
    studio.environmentIntensity = 0.9;
    const key = new THREE.DirectionalLight('#fff6ea', 3);
    key.position.set(-3, 5, 4);
    const rim = new THREE.DirectionalLight('#9cc4dc', 2.2);
    rim.position.set(4, 2, -4);
    studio.add(key, rim, new THREE.HemisphereLight('#8fa6b0', '#1c1f1d', 0.6));
    const cam = new THREE.PerspectiveCamera(28, width / height, 0.01, 100);
    const scenePass = new THREE.WebGLRenderTarget(width, height, {type: THREE.HalfFloatType, samples: 4});
    const outputTarget = new THREE.WebGLRenderTarget(width, height);
    const output = new OutputPass();
    const pixels = new Uint8Array(width * height * 4);
    const canvas2d = document.createElement('canvas');
    canvas2d.width = width;
    canvas2d.height = height;
    const ctx = canvas2d.getContext('2d');
    const direction = view.clone().normalize();
    const result = {};
    const clear = renderer.getClearAlpha();
    renderer.setClearAlpha(0);
    for (const [name, make] of entries) {
      const object = make();
      studio.add(object);
      const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere());
      const aim = sphere.center.clone();
      let distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(14)) * 1.02;
      const place = () => { cam.position.copy(aim).addScaledVector(direction, distance); cam.lookAt(aim); cam.updateMatrixWorld(); };
      place();
      // A long module sits small in a sphere fit: frame its actual outline
      // (a sample of its vertices) instead, centred and filling the frame.
      const outline = fitBox ? silhouettePoints(object) : [];
      for (let pass = 0; fitBox && pass < 4; pass++) {
        const lo = new THREE.Vector2(Infinity, Infinity), hi = new THREE.Vector2(-Infinity, -Infinity);
        for (const point of outline) {
          const p = point.clone().project(cam);
          lo.min(p); hi.max(p);
        }
        const halfHeight = distance * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), halfWidth = halfHeight * cam.aspect;
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        aim.addScaledVector(right, (lo.x + hi.x) / 2 * halfWidth).addScaledVector(up, (lo.y + hi.y) / 2 * halfHeight);
        distance *= Math.max(hi.x - lo.x, hi.y - lo.y) / 2 / 0.9;
        place();
      }
      renderer.setRenderTarget(scenePass);
      renderer.clear();
      renderer.render(studio, cam);
      output.render(renderer, outputTarget, scenePass);
      renderer.readRenderTargetPixels(outputTarget, 0, 0, width, height, pixels);
      const image = ctx.createImageData(width, height);
      for (let y = 0; y < height; y++) image.data.set(pixels.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4);
      ctx.putImageData(image, 0, 0);
      result[name] = canvas2d.toDataURL('image/webp', 0.9);
      studio.remove(object);
    }
    renderer.setRenderTarget(null);
    renderer.setClearAlpha(clear);
    scenePass.dispose();
    outputTarget.dispose();
    output.dispose();
    wake();
    return result;
  }

  // Up to about 4000 world-space vertices of an object, for framing.
  function silhouettePoints(object) {
    object.updateMatrixWorld(true);
    const points = [];
    object.traverse(mesh => {
      if (!mesh.isMesh) return;
      const position = mesh.geometry.attributes.position;
      const step = Math.max(1, Math.floor(position.count / 800));
      for (let i = 0; i < position.count; i += step) points.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
    });
    return points;
  }

  // ---- Projection for DOM overlays -------------------------------------------
  const projected = new THREE.Vector3();
  function screenPoint(position, cam) {
    projected.copy(position).project(cam);
    return {x: (projected.x * 0.5 + 0.5) * width, y: (1 - (projected.y * 0.5 + 0.5)) * height, onScreen: projected.z < 1 && Math.abs(projected.x) <= 1.02 && Math.abs(projected.y) <= 1.02};
  }

  const ray = new THREE.Ray();
  function project() {
    const points = {};
    if (world === 'op') {
      const target = op.targetAnchor();
      if (target) {
        const p = screenPoint(target.center, opCamera);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(opCamera.quaternion).multiplyScalar(target.radius * 0.8);
        const edge = screenPoint(target.center.clone().add(right), opCamera);
        points.target = {...p, visible: p.onScreen, size: Math.round(Math.hypot(edge.x - p.x, edge.y - p.y) * 2)};
      }
      onProject(points, view);
      return;
    }
    if (world === 'bay') {
      const mount = mountWorld();
      const facing = bayCamera.position.clone().sub(mount).normalize().dot(new THREE.Vector3(0, 0, 1));
      const p = screenPoint(mount.add(new THREE.Vector3(-0.9, 0.35, 0.2)), bayCamera);
      points.hardpoint = {...p, visible: view === 'dock' && !rigFrom && facing > 0.2 && p.onScreen};
    } else {
      for (const [id, position] of sector.points) {
        if (!sector.isVisible(id)) continue;
        const p = screenPoint(position, mapCamera);
        ray.origin.copy(mapCamera.position);
        ray.direction.copy(position).sub(mapCamera.position);
        const distance = ray.direction.length();
        ray.direction.normalize();
        const hit = ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 24), new THREE.Vector3());
        const hidden = hit && hit.distanceTo(mapCamera.position) < distance;
        points[id] = {...p, visible: p.onScreen && !hidden && !rigFrom};
      }
    }
    onProject(points, view);
  }

  // ---- Frame loop ----------------------------------------------------------------
  function loop(now) {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    const previous = last;
    last = now;
    if (paused || contextLost) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9);
    orbitYaw += (orbitYawTarget - orbitYaw) * k;
    orbitPitch += (orbitPitchTarget - orbitPitch) * k;
    spin += (spinTarget - spin) * k;
    tilt += (tiltTarget - tilt) * k;
    benchTilt = tilt + (installing && !reduced ? Math.sin(now * 0.012) * 0.012 : 0);
    turntable.userData.spin.rotation.y = spin;
    turntable.userData.table.rotation.z = benchTilt;
    const benchWeight = view === 'bench' ? 1 : 0;
    focus += (benchWeight - focus) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
    lights.key.intensity = 2300 * (1 - focus * 0.74);
    lights.bench.intensity = 520 * focus;
    const settling = Math.abs(benchWeight - focus) > 0.002 ||
      Math.abs(orbitYawTarget - orbitYaw) + Math.abs(orbitPitchTarget - orbitPitch) + Math.abs(spinTarget - spin) + Math.abs(tiltTarget - tilt) > 0.0005;
    const moving = (world === 'bay' && [stepCut(now), stepModules(now), stepLift(now, dt)].some(Boolean)) || (world === 'op' && op.update(dt, now, reduced));
    // Shadow maps re-render only while something in the bay moves; orbiting
    // the camera does not change light-space shadows.
    const spinning = Math.abs(spinTarget - spin) + Math.abs(tiltTarget - tilt) > 0.0005;
    const shadowsLive = moving || spinning || installing || shadowFrames > 0;
    lights.key.shadow.autoUpdate = shadowsLive;
    lights.bench.shadow.autoUpdate = shadowsLive && focus > 0.01;
    if (shadowFrames > 0) shadowFrames--;
    if (world === 'map') sector.animate(dt, reduced);
    if (settling || moving || installing || rigFrom || (world === 'map' && sector.hasMotion(reduced))) wake();
    if (activeFrames <= 0) return;
    activeFrames--;
    renderFrame(now);
    sampleFrame(now - previous);
  }

  function renderFrame(now = performance.now()) {
    applyCamera(now);
    renderer.info.reset();
    if (composer) composer.render(); else renderer.render(scene(), camera());
    if (!firstFrame) { firstFrame = true; onFirstFrame(); }
    project();
  }

  function takeSnapshot() {
    renderFrame();
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
    snapshot.className = 'stage-snapshot is-shown';
  }

  function dissolveSnapshot() {
    void snapshot.offsetWidth;
    requestAnimationFrame(() => { snapshot.className = 'stage-snapshot is-clearing'; });
  }

  // Adaptive quality: frame intervals are sampled only while rendering, and
  // not in the first second after a pipeline or view change. Four very slow
  // frames in a row step down at once; otherwise the median of 40 frames must
  // stay under ~24 ms (about 40 fps) or the tier drops.
  let sampleAfter = performance.now() + 1500, slowRun = 0;
  function sampleFrame(delta) {
    if (qualityMode !== 'auto' || quality === 'low' || delta <= 0 || delta > 5000) return;
    if (performance.now() < sampleAfter) return;
    slowRun = delta > 100 ? slowRun + 1 : 0;
    frameTimes.push(delta);
    if (slowRun < 4 && frameTimes.length < 40) return;
    const median = [...frameTimes].sort((a, b) => a - b)[Math.floor(frameTimes.length / 2)];
    const stepDown = slowRun >= 4 || median > 24;
    frameTimes.length = 0;
    slowRun = 0;
    if (stepDown) {
      quality = quality === 'high' ? 'medium' : 'low';
      sampleAfter = performance.now() + 1000;
      buildPipeline();
    }
  }

  // ---- Input ------------------------------------------------------------------------
  // How far the player may look around. In the operation it is a small head
  // turn: a wide orbit swung the planet in behind the vessel as a large dark
  // disc and pushed the vessel under the decision panel.
  function orbitLimits() {
    if (view === 'sector') return [0.7, -0.3, 0.4];
    if (view === 'op') return [0.3, -0.06, 0.16];
    return [Infinity, -0.1, 0.45];
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // No text selection or native drag may start from a look-around gesture.
    e.preventDefault();
    canvas.focus({preventScroll: true});
    drag = {x: e.clientX, y: e.clientY, yaw: orbitYawTarget, pitch: orbitPitchTarget, spin: spinTarget, tilt: tiltTarget};
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) * sensitivity, dy = (e.clientY - drag.y) * sensitivity * invertY;
    if (view === 'bench') {
      spinTarget = drag.spin + dx * 0.008;
      tiltTarget = THREE.MathUtils.clamp(drag.tilt + dy * 0.004, -0.35, 0.35);
    } else {
      const [yawLimit, pitchMin, pitchMax] = orbitLimits();
      orbitYawTarget = THREE.MathUtils.clamp(drag.yaw - dx * (view === 'sector' ? 0.004 : 0.006), -yawLimit, yawLimit);
      orbitPitchTarget = THREE.MathUtils.clamp(drag.pitch + dy * 0.004, pitchMin, pitchMax);
    }
    wake();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', (e) => {
    const step = {ArrowLeft: [-0.2, 0], ArrowRight: [0.2, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08]}[e.key];
    if (!step) return;
    e.preventDefault();
    api.rotate(step[0], step[1]);
  });
  // A lost context (driver reset, GPU switch) is waited out: three.js
  // re-creates its GL state on restore, and the render targets and the
  // prefiltered environment that lived on the old context are rebuilt here.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    onContextLost();
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      if (!contextLost) return;
      alive = false;
      cancelAnimationFrame(raf);
      onFailure();
    }, 8000);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (!alive) return;
    clearTimeout(restoreTimer);
    environment = createEnvironment(renderer);
    bay.environment = environment.texture;
    op.scene.environment = environment.texture;
    contextLost = false;
    buildPipeline({afterRestore: true});
    renderFrame();
    wake(3);
    onContextRestored();
  });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement);

  function beginRig(duration) {
    rigFrom = liveRig();
    rigStart = performance.now();
    rigDuration = duration;
    if (reduced) rigFrom = null;
  }

  const api = {
    setView(next) {
      if (next === view) return;
      const nextWorld = worldOf(next);
      orbitYawTarget = orbitPitchTarget = spinTarget = tiltTarget = 0;
      if (nextWorld !== world) {
        // Different worlds: cover with the last frame, draw the new world at
        // once, then dissolve the cover. Reduced motion switches directly.
        const cover = drawable() && !reduced;
        if (cover) takeSnapshot();
        view = next;
        world = nextWorld;
        rigFrom = null;
        orbitYaw = orbitPitch = 0;
        if (world === 'bay' && !cut) resetVessel();
        syncWorld();
        plan(performance.now());
        shadowFrames = 3;
        if (drawable()) renderFrame();
        if (cover) dissolveSnapshot();
        wake(3);
        return;
      }
      beginRig(950);
      view = next;
      shadowFrames = 3;
      sampleAfter = performance.now() + 1000;
      plan(performance.now());
    },
    setModules({installed: nextInstalled, selected: nextSelected}) {
      const changed = nextInstalled !== installedId || nextSelected !== selectedId;
      installedId = nextInstalled;
      selectedId = nextSelected;
      if (changed) { spinTarget = tiltTarget = 0; plan(performance.now()); }
    },
    setSector({route: routeId}) {
      if (routeId === currentRoute) return;
      currentRoute = routeId;
      sector.setRoute(routeId);
      wake(3);
    },
    setVisibleContracts(ids) {
      if (sector.setVisible(ids)) { mapFit = null; wake(); }
    },
    setInsets(next) {
      if (['left', 'right', 'top', 'bottom'].every(k => Math.abs((next[k] || 0) - insets[k]) < 1)) return;
      insets = {left: 0, right: 0, top: 0, bottom: 0, ...next};
      mapFit = null;
      wake();
    },
    setInstalling(value) { installing = value; wake(); },
    setReduced(value) {
      reduced = value;
      if (value) {
        rigFrom = null;
        for (const m of modules.values()) if (m.path) { m.location = m.path.destination; m.path = null; placeAt(m, m.location); }
      }
      wake();
    },
    setQuality(mode) {
      qualityMode = mode;
      const next = mode === 'auto' ? (compact() || matchMedia('(pointer: coarse)').matches ? 'low' : 'high') : mode;
      if (next !== quality || (!composer && QUALITY[next].samples)) { quality = next; buildPipeline(); }
      wake();
    },
    setInspection(value) {
      lights.fill.intensity = value ? 2.0 : 0.4;
      bay.environmentIntensity = value ? 0.8 : 0.38;
      wake();
    },
    rotate(dx, dy = 0) {
      if (view === 'bench') {
        spinTarget += dx;
        tiltTarget = THREE.MathUtils.clamp(tiltTarget + dy, -0.35, 0.35);
      } else {
        const [yawLimit, pitchMin, pitchMax] = orbitLimits();
        orbitYawTarget = THREE.MathUtils.clamp(orbitYawTarget - dx, -yawLimit, yawLimit);
        orbitPitchTarget = THREE.MathUtils.clamp(orbitPitchTarget - dy, pitchMin, pitchMax);
      }
      wake();
    },
    reset() { orbitYawTarget = orbitPitchTarget = spinTarget = tiltTarget = 0; wake(); },
    invalidate: () => wake(),
    // Document screens hide the 3D view; nothing is drawn meanwhile.
    setPaused(value) {
      if (value === paused) return;
      paused = value;
      if (!paused && drawable()) renderFrame();
      wake(3);
    },
    playCut(type, onDone) {
      if (reduced) { onDone?.(); return 0; }
      cut = {type, start: performance.now(), onDone};
      poseCut(type === 'launch' ? 0 : 1);
      wake(3);
      return CUT_MS;
    },
    skipCut() { finishCut(); wake(3); },
    previewStep(stepId, optionId, steps, operation) { op.preview(stepId, optionId, steps, operation); wake(2); },
    setControls(next) { sensitivity = next.sensitivity ?? 1; invertY = next.invertY ? -1 : 1; },
    setOperation({contract, wreck, steps, operation}) {
      if (!operation) return;
      if (opContract !== contract || opTool !== installedId) { op.setContract(contract, wreck, installedId); opContract = contract; opTool = installedId; }
      op.applyState(steps, operation);
      wake(3);
    },
    playStep(stepId, optionId, steps, operation) {
      const duration = op.play(stepId, optionId, steps, operation);
      wake(3);
      return reduced ? 0 : duration;
    },
    // Hold items as square three-quarter views. Done once, off screen.
    thumbnails(models, size = 256) {
      return studioShots(models.map(model => [model, () => createItemModel(model)]), {width: size, height: size, view: new THREE.Vector3(-0.55, 0.62, 0.9)});
    },
    // Modules as wide side views, tool to the left and coupling to the right as
    // on the stand, framed to their own outline. Done once, off screen.
    moduleThumbnails(ids) {
      return studioShots(ids.map(id => [id, () => createTool(id)]), {width: 448, height: 204, view: new THREE.Vector3(-0.3, 0.4, 1), fitBox: true});
    },
    diagnostics() {
      const info = renderer.info;
      return {
        view, world, quality, qualityMode, pixelRatio: renderer.getPixelRatio(),
        drawCalls: info.render.calls, triangles: info.render.triangles,
        geometries: info.memory.geometries, textures: info.memory.textures,
        modules: Object.fromEntries([...modules.values()].map(m => [m.id, m.path ? `to ${m.path.destination}` : m.location])),
      };
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      composer?.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };

  buildPipeline();
  api.setQuality('auto');
  // The first frame of a world compiles its shaders and uploads its geometry,
  // textures and shadow maps, which can take seconds on a slower GPU. Shortly
  // after start-up, draw the world that is not on screen through the same
  // pipeline, then redraw the current one in the same task: nothing flashes,
  // and the later switch finds every program and buffer ready.
  function warmUp() {
    if (!alive) return;
    const saved = {view, world};
    const draw = () => {
      syncWorld();
      applyCamera(performance.now());
      if (composer) composer.render(); else renderer.render(scene(), camera());
    };
    lights.key.shadow.needsUpdate = lights.bench.shadow.needsUpdate = true;
    op.showAll(true);
    for (const [w, v] of [['bay', 'dock'], ['map', 'sector'], ['op', 'op']]) {
      if (w === saved.world && w !== 'op') continue;
      world = w;
      view = v;
      draw();
    }
    op.showAll(false);
    ({view, world} = saved);
    draw();
  }
  // Operation targets are built one per idle slice, then every world is drawn once.
  const idle = (fn) => (window.requestIdleCallback || setTimeout)(fn);
  const prepare = () => { if (!alive) return; if (op.prepareNext()) idle(prepare); else warmUp(); };
  setTimeout(() => idle(prepare), 900);
  const initial = wantedLocations();
  for (const module of modules.values()) {
    module.location = initial.get(module.id);
    placeAt(module, module.location);
  }
  raf = requestAnimationFrame(loop);
  return api;
}
