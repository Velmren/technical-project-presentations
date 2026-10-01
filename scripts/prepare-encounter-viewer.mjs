import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/prepare-encounter-viewer.mjs <extracted source ZIP> [commit]');
// Without a commit the viewer links to the repository itself.
const commit = process.argv[3] ?? null;
const repository = 'https://github.com/Velmren/minecraft-encounter-state-demo';
const destination = 'public/assets/java';
function collect(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = `${prefix}${entry.name}`;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(absolute, `${relative}/`);
    const bytes = fs.readFileSync(absolute);
    const text = bytes.toString('utf8');
    if (!Buffer.from(text).equals(bytes)) throw new Error(`Not a UTF-8 source file: ${relative}`);
    return [{ path: relative, text, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }];
  });
}
const files = collect(source).sort((a, b) => a.path.localeCompare(b.path, 'en'));
const viewer = path.join(destination, 'encounter-source-viewer.html');
let html = fs.readFileSync(viewer, 'utf8');
html = html.replace(/(<script[^>]*id="source-data"[^>]*>)[\s\S]*?(<\/script>)/,
  (_, start, end) => start + JSON.stringify(files).replaceAll('<', '\\u003c') + end);
html = html.replace(/Browse \d+ files/, `Browse ${files.length} files`);
const link = commit ? `${repository}/tree/${commit}` : repository;
const label = commit ? `public repository at ${commit.slice(0, 7)}` : 'public repository';
html = html.replace(/The ZIP matches the <a href="[^"]*">[^<]*<\/a>\./, `The ZIP matches the <a href="${link}">${label}</a>.`);
fs.writeFileSync(viewer, html);
fs.writeFileSync(path.join(destination, 'source-manifest.json'), JSON.stringify({
  repository, commit, version: '0.2.0', archive: 'encounter-state-demo-0.2.0-source.zip',
  files: files.map(({ text, ...metadata }) => metadata),
}, null, 2) + '\n');
console.log(`Embedded ${files.length} exact source files${commit ? ` at ${commit}` : ''}`);
