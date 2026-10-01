// Copies the Three.js runtime and the example modules the renderer imports
// (with their relative dependencies) from the portfolio's node_modules into
// vendor/three. Run from the project root: node tools/vendor-three.mjs
import fs from 'node:fs';
import path from 'node:path';
import {PROJECT_ROOT} from './lib/browser.mjs';

const three = path.resolve(PROJECT_ROOT, '../../node_modules/three');
const dest = path.join(PROJECT_ROOT, 'vendor/three');
const addons = [
  'postprocessing/EffectComposer.js',
  'postprocessing/RenderPass.js',
  'postprocessing/OutputPass.js',
  'postprocessing/GTAOPass.js',
  'postprocessing/UnrealBloomPass.js',
  'geometries/RoundedBoxGeometry.js',
  'utils/BufferGeometryUtils.js',
  'lines/Line2.js',
];

const version = JSON.parse(fs.readFileSync(path.join(three, 'package.json'), 'utf8')).version;
fs.rmSync(dest, {recursive: true, force: true});
fs.mkdirSync(dest, {recursive: true});
for (const file of ['three.module.min.js', 'three.core.min.js']) fs.copyFileSync(path.join(three, 'build', file), path.join(dest, file));
fs.copyFileSync(path.join(three, 'LICENSE'), path.join(dest, 'LICENSE'));

const copied = new Set();
function copy(relative) {
  if (copied.has(relative)) return;
  copied.add(relative);
  const source = fs.readFileSync(path.join(three, 'examples/jsm', relative), 'utf8');
  const target = path.join(dest, 'addons', relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, source);
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (match[1].startsWith('.')) copy(path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1])));
  }
}
addons.forEach(copy);
console.log(`Three.js ${version}: runtime and ${copied.size} addon modules copied to vendor/three.`);
