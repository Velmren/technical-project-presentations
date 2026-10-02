// Copies the page into the portfolio's public folder. There is no build step, so this is a filtered copy.
// Files from a previous build are removed only if they are listed in its manifest.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, '../../public/projects/assembly');
const include = ['index.html', 'metadata.json', 'src', 'styles', 'fonts'];
const manifestPath = path.join(out, 'build-manifest.json');

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
  const source = path.join(root, relative);
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

const {version} = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(manifestPath, JSON.stringify({version, built: new Date().toISOString(), files: [...files, 'build-manifest.json']}, null, 2));
console.log(`Veresta ${version}: ${files.length} files copied to ${out}`);
