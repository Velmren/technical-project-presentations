import * as THREE from 'three';
import {Assembly, AXIS, cylinder, extrude, lathe, roundedBox, torus, tube} from './kit.js';
import {decalMaterial, decalTexture, getMaterials, wearMaterial} from './materials.js';

// Salvage items, modelled with the same kit as the vessel so the hold shows
// real objects: each one reads differently by shape, material and scale.

const PI = Math.PI;
let extra;
function materials() {
  extra ??= {
    pcb: wearMaterial('pcb', {color: '#1d3a36', roughness: 0.55, wear: 0.1, grime: 0.1}),
    gold: new THREE.MeshStandardMaterial({color: '#c9a44a', roughness: 0.28, metalness: 1}),
    alloy: wearMaterial('alloy', {color: '#9aa0a0', roughness: 0.34, metalness: 1, wear: 0.3, grime: 0.15, edgeColor: '#c8ccca'}),
    hazard: decalMaterial(decalTexture(512, 64, (ctx, w, h) => {
      ctx.fillStyle = '#c29a38'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1d1d1a';
      for (let x = -h; x < w + h; x += 40) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 20, h); ctx.lineTo(x + 20 + h, 0); ctx.lineTo(x + h, 0); ctx.fill(); }
    })),
    lens: new THREE.MeshStandardMaterial({color: '#3a0d08', emissive: '#ff5a3a', emissiveIntensity: 1.6, roughness: 0.2}),
  };
  return {...getMaterials(), ...extra};
}

const builders = {
  // Curved armour plate with a rebate, rivet rows and a torn edge.
  plate(a, m) {
    const outline = [[-0.9, -0.55], [0.85, -0.55], [0.95, -0.2], [0.8, 0.1], [0.92, 0.45], [-0.9, 0.55]];
    a.add(extrude(outline, 0.06, {fillet: 0.04, bevel: 0.01}), m.orange, {rotation: [-PI / 2 + 0.1, 0, 0.05]});
    a.add(extrude([[-0.8, -0.45], [0.7, -0.45], [0.7, 0.45], [-0.8, 0.45]], 0.02, {fillet: 0.03, bevel: 0.006}), m.panel, {position: [0, 0.04, 0], rotation: [-PI / 2 + 0.1, 0, 0.05]});
    const rivet = cylinder(0.018, 0.02, {segments: 8, bevel: 0.005});
    for (let i = 0; i < 9; i++) for (const z of [-0.42, 0.42]) a.add(rivet, m.steel, {position: [-0.75 + i * 0.18, 0.06 + z * -0.1, z], rotation: [0.1, 0, 0]});
  },
  plateBundle(a, m) {
    for (let i = 0; i < 4; i++) a.add(roundedBox(1.6, 0.05, 0.9, 0.012), i % 2 ? m.steel : m.gunmetal, {position: [(i % 2) * 0.05 - 0.02, i * 0.055, (i % 3) * 0.03], rotation: [0, i * 0.03, 0]});
    for (const x of [-0.5, 0.5]) a.add(roundedBox(0.06, 0.26, 0.96, 0.01), m.orange, {position: [x, 0.09, 0]});
  },
  rack(a, m) {
    a.add(roundedBox(0.9, 0.55, 0.6, 0.04), m.frame, {position: [0, 0.27, 0]});
    for (let i = 0; i < 4; i++) {
      a.add(roundedBox(0.16, 0.44, 0.04, 0.01), m.pcb, {position: [-0.3 + i * 0.2, 0.3, 0.31]});
      a.add(roundedBox(0.12, 0.03, 0.03, 0.005), m.gold, {position: [-0.3 + i * 0.2, 0.1, 0.33], edge: 0});
      a.add(cylinder(0.012, 0.02, {segments: 8, bevel: 0.003}), m.teal, {position: [-0.3 + i * 0.2, 0.48, 0.335], rotation: AXIS.z, edge: 0});
    }
    for (const x of [-0.5, 0.5]) a.between([x, 0.12, 0.2], [x, 0.44, 0.2], 0.02, m.steel);
    for (let i = 0; i < 6; i++) a.add(roundedBox(0.7, 0.012, 0.03, 0.004), m.dark, {position: [0, 0.56, -0.2 + i * 0.07], edge: 0});
  },
  core(a, m) {
    a.add(lathe([[0, 0], [0.32, 0], [0.34, 0.06], [0.22, 0.12], [0.2, 0.62], [0.26, 0.7], [0.16, 0.78], [0, 0.8]], {segments: 36, fillet: 0.02}), m.gunmetal);
    for (let i = 0; i < 8; i++) {
      const angle = i * PI / 4;
      a.add(roundedBox(0.02, 0.4, 0.14, 0.006), m.steel, {position: [Math.cos(angle) * 0.24, 0.38, Math.sin(angle) * 0.24], rotation: [0, -angle, 0]});
    }
    a.add(cylinder(0.1, 0.05, {bevel: 0.01}), m.lens, {position: [0, 0.82, 0], edge: 0});
    a.between([0, 0.84, 0], [0, 1.2, 0], 0.012, m.steel, {segments: 6});
  },
  canister(a, m) {
    a.add(lathe([[0, 0], [0.2, 0], [0.24, 0.05], [0.24, 0.8], [0.18, 0.88], [0.07, 0.9], [0.07, 0.98], [0, 0.98]], {segments: 32, fillet: 0.03}), m.ochre);
    for (const y of [0.18, 0.66]) a.add(torus(0.245, 0.018), m.frame, {position: [0, y, 0], rotation: [PI / 2, 0, 0]});
    a.add(new THREE.CylinderGeometry(0.2451, 0.2451, 0.12, 32, 1, true), m.hazard, {position: [0, 0.42, 0], edge: 0});
    a.add(cylinder(0.05, 0.08, {bevel: 0.01}), m.steel, {position: [0, 1.0, 0]});
    a.add(torus(0.07, 0.012), m.steel, {position: [0, 1.05, 0], rotation: [PI / 2, 0, 0]});
  },
  ingots(a, m) {
    const bar = extrude([[-0.28, 0], [0.28, 0], [0.24, 0.1], [-0.24, 0.1]], 0.14, {fillet: 0.015, bevel: 0.008});
    const spots = [[-0.15, 0, -0.1], [0.15, 0, -0.1], [-0.15, 0, 0.1], [0.15, 0, 0.1], [0, 0.1, -0.1], [0, 0.1, 0.1]];
    spots.forEach(([x, y, z], i) => a.add(bar, m.alloy, {position: [x, y, z], rotation: [0, PI / 2 + (i % 2) * 0.04, 0]}));
  },
  boards(a, m) {
    for (let i = 0; i < 3; i++) {
      a.add(roundedBox(0.9, 0.025, 0.55, 0.01), m.pcb, {position: [i * 0.04, i * 0.05, i * 0.03], rotation: [0, i * 0.12, 0]});
      for (let j = 0; j < 10; j++) a.add(roundedBox(0.03, 0.006, 0.05, 0.002), m.gold, {position: [-0.4 + j * 0.035 + i * 0.04, i * 0.05 + 0.015, 0.25 + i * 0.03], rotation: [0, i * 0.12, 0], edge: 0});
      a.add(roundedBox(0.18, 0.04, 0.18, 0.01), m.dark, {position: [0.1 + i * 0.04, i * 0.05 + 0.03, 0 + i * 0.03], rotation: [0, i * 0.12, 0]});
    }
  },
};

export function createItemModel(model) {
  const a = new Assembly(`item / ${model}`);
  builders[model](a, materials());
  return a.finish();
}

export const ITEM_MODELS = Object.keys(builders);
