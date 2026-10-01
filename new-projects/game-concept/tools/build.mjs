// Copies the runtime into the portfolio's public folder. The app has no build
// step, so this is a filtered copy plus the catalogue thumbnail. Files from a
// previous build are removed only if they are listed in its manifest.
import fs from 'node:fs';
import path from 'node:path';
import {PROJECT_ROOT} from './lib/browser.mjs';

const out = path.resolve(PROJECT_ROOT, '../../public/projects/game-concept');
const include = ['index.html', 'metadata.json', 'thumbnail.webp', 'src', 'styles', 'assets', 'vendor'];
const manifestPath = path.join(out, 'build-manifest.json');

if (!fs.existsSync(path.join(PROJECT_ROOT, 'thumbnail.webp'))) {
  console.error('thumbnail.webp is missing: run `npm run verify` first, it captures the thumbnail.');
  process.exit(1);
}

fs.mkdirSync(out, {recursive: true});
const existing = fs.readdirSync(out);
if (existing.length && !fs.existsSync(manifestPath)) {
  console.error(`${out} contains files that were not produced by this build; move them away first.`);
  process.exit(1);
}
if (fs.existsSync(manifestPath)) {
  for (const file of JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files) fs.rmSync(path.join(out, file), {force: true});
}

const files = [];
function copy(relative) {
  const source = path.join(PROJECT_ROOT, relative);
  if (fs.statSync(source).isDirectory()) {
    for (const entry of fs.readdirSync(source)) copy(path.join(relative, entry));
    return;
  }
  const target = path.join(out, relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(source, target);
  files.push(relative.split(path.sep).join('/'));
}
include.forEach(copy);

// Remove directories emptied by the cleanup above.
(function prune(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    prune(full);
    if (!fs.readdirSync(full).length) fs.rmdirSync(full);
  }
})(out);

const {version} = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
fs.writeFileSync(manifestPath, JSON.stringify({version, built: new Date().toISOString(), files: [...files, 'build-manifest.json']}, null, 2));
console.log(`LACUNA ${version}: ${files.length} files copied to ${path.relative(process.cwd(), out) || out}`);
