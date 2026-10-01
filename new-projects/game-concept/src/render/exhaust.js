import * as THREE from 'three';
import {decalTexture} from './materials.js';
import {ENGINE_Y, ENGINES, jetOrigin, NOZZLE_EXIT, RCS} from './vessel.js';

// Engine plumes and reaction-control puffs for the vessel in flight. Kept
// restrained: a warm-white core fading to a pale grey-teal, added to the
// frame, with soft edges. The plumes are cones whose surface fades where it
// turns away from the eye, so they read as glowing gas rather than geometry.

function gasMaterial(core, edge) {
  return new THREE.ShaderMaterial({
    uniforms: {uPower: {value: 0}, uTime: {value: 0}, uCore: {value: new THREE.Color(core)}, uEdge: {value: new THREE.Color(edge)}},
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */`
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vAlong = position.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uPower;
      uniform float uTime;
      uniform vec3 uCore;
      uniform vec3 uEdge;
      varying float vAlong;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vView)));
        float body = smoothstep(0.05, 0.9, facing);
        float fade = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.05, vAlong);
        float flicker = 0.9 + 0.1 * sin(uTime * 41.0 + vAlong * 19.0) * sin(uTime * 23.0 + 1.7);
        float alpha = uPower * body * fade * flicker;
        vec3 color = mix(uCore, uEdge, smoothstep(0.0, 0.75, vAlong));
        gl_FragColor = vec4(color * alpha, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Open cone along +Y from y = 0 (base) to y = 1 (tip); scaled in y for length.
const cone = (base, tip) => new THREE.CylinderGeometry(tip, base, 1, 20, 8, true).translate(0, 0.5, 0);

let glowTexture;
function nozzleGlow(color) {
  glowTexture ??= decalTexture(128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
  return new THREE.MeshBasicMaterial({map: glowTexture, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false});
}

export function createExhaust(vesselGroup) {
  const group = new THREE.Group();
  group.name = 'Exhaust';
  vesselGroup.add(group);
  const up = new THREE.Vector3(0, 1, 0), aft = new THREE.Vector3(1, 0, 0);
  const plumes = ENGINES.map(({x, z, scale}) => {
    const exit = new THREE.Vector3(x + NOZZLE_EXIT, ENGINE_Y, z);
    const outer = new THREE.Mesh(cone(0.42 * scale, 0.1), gasMaterial('#f2dfc0', '#56838f'));
    const core = new THREE.Mesh(cone(0.2 * scale, 0.03), gasMaterial('#fff2dc', '#c9dade'));
    for (const mesh of [outer, core]) {
      mesh.position.copy(exit);
      mesh.quaternion.setFromUnitVectors(up, aft);
    }
    // Glow inside the bell, facing aft.
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.46 * scale, 28), nozzleGlow('#ffe6c2'));
    glow.position.copy(exit).x -= 0.14;
    glow.rotation.y = Math.PI / 2;
    group.add(outer, core, glow);
    return {outer, core, glow, scale};
  });
  const jets = RCS.flatMap(({at, jets: dirs}) => dirs.map(dir => {
    const mesh = new THREE.Mesh(cone(0.035, 0.22), gasMaterial('#f3f6f6', '#a3adb0'));
    mesh.position.fromArray(jetOrigin(at, dir));
    mesh.quaternion.setFromUnitVectors(up, new THREE.Vector3(...dir));
    group.add(mesh);
    return {mesh, dir, nose: at[0] < 0, power: 0};
  }));
  for (const mesh of [...plumes.flatMap(p => [p.outer, p.core, p.glow]), ...jets.map(j => j.mesh)]) mesh.visible = false;
  let main = 0;

  // demand: main (0..1 forward thrust), retro (0..1 braking), yaw (-1..1,
  // positive = swing the nose toward +Z), lateral (-1..1, positive = push
  // toward +Z). Returns whether anything is still burning.
  function update(demand, dt, now) {
    const time = now * 0.001;
    main += (demand.main - main) * (1 - Math.exp(-dt * (demand.main > main ? 9 : 3.5)));
    const burning = main > 0.01;
    for (const p of plumes) {
      p.outer.visible = p.core.visible = p.glow.visible = burning;
      if (!burning) continue;
      p.outer.scale.y = (0.6 + 3.2 * main) * p.scale;
      p.core.scale.y = (0.35 + 1.6 * main) * p.scale;
      p.outer.material.uniforms.uPower.value = 0.7 * main;
      p.core.material.uniforms.uPower.value = main;
      p.outer.material.uniforms.uTime.value = p.core.material.uniforms.uTime.value = time;
      p.glow.material.opacity = Math.min(1, 0.25 + main);
    }
    let puffing = false;
    for (const jet of jets) {
      // A side nozzle pushes opposite to where it fires. At the nose a jet
      // firing toward -Z swings the nose toward +Z; aft it is the other way.
      let want = 0;
      if (jet.dir[0]) want = demand.retro;
      else {
        const push = -jet.dir[2];
        const swing = jet.nose ? push : -push;
        want = Math.max(Math.max(0, demand.yaw * swing), Math.max(0, demand.lateral * push));
      }
      if (want < 0.12) want = 0;
      jet.power += (want - jet.power) * (1 - Math.exp(-dt * (want > jet.power ? 22 : 7)));
      const on = jet.power > 0.02;
      jet.mesh.visible = on;
      if (!on) continue;
      puffing = true;
      jet.mesh.scale.y = 0.3 + 0.8 * jet.power;
      jet.mesh.material.uniforms.uPower.value = 0.85 * jet.power;
      jet.mesh.material.uniforms.uTime.value = time;
    }
    return burning || puffing;
  }
  function off() {
    main = 0;
    for (const jet of jets) jet.power = 0;
    update({main: 0, retro: 0, yaw: 0, lateral: 0}, 1, 0);
  }
  return {update, off};
}
