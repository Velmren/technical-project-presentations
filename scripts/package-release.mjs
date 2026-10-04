import { existsSync } from 'node:fs';
import { cp, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import path from 'node:path';
// RELEASE_COMMIT lets a clean export of a commit (no .git) be packaged under that commit.
const commit = process.env.RELEASE_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const version = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z') + '-' + commit.slice(0, 7);
const release = path.resolve('output/deploy', version);
const bundle = path.join(release, 'bundle');
await mkdir(bundle, { recursive: true });

async function walk(directory, visit) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file, visit);
    else await visit(file);
  }
}

// Live builds in out/projects ship only when a published page links to them, so works
// that are still in review (hidden from the home page) never reach the server.
const linkedBuilds = new Set();
await walk('out', async file => {
  if (file.startsWith(path.join('out', 'projects') + path.sep) || !/\.(html|txt)$/.test(file)) return;
  for (const match of (await readFile(file, 'utf8')).matchAll(/\/projects\/([a-z0-9-]+)\//g)) linkedBuilds.add(match[1]);
});
const excludedBuilds = (await readdir('out/projects')).filter(name => !linkedBuilds.has(name)).sort();
const excluded = new Set([path.resolve('out/forma/live'), ...excludedBuilds.map(name => path.resolve('out/projects', name))]);
// The video gallery's media ships only once its routes are public: while they sit in the private folder
// src/app/_video, posters and clips in public/assets/video stay out of the release.
const galleryPrivate = existsSync('src/app/_video') && !existsSync('src/app/video');
const excludedPaths = galleryPrivate ? ['assets/video'] : [];
for (const rel of excludedPaths) excluded.add(path.resolve('out', rel));
// Dot files (.gitignore, .DS_Store) are housekeeping, not part of the site; the server's deploy check rejects them.
const visible = source => !path.basename(source).startsWith('.');
await cp('out', path.join(bundle, 'portfolio'), { recursive: true, filter: source => visible(source) && !excluded.has(path.resolve(source)) });
await cp('demos/forma', path.join(bundle, 'demos/forma'), { recursive: true, filter: visible });

// Large compressible files get .br/.gz siblings that Caddy serves as they are
// (file_server precompressed), so the 40 MB Godot wasm is not recompressed per request.
const compressible = /\.(wasm|js|mjs|css|json|html|svg|txt|xml)$/i;
const precompressFrom = 100 * 1024;
let precompressed = 0;
await walk(bundle, async file => {
  if (!compressible.test(file) || (await stat(file)).size < precompressFrom) return;
  const bytes = await readFile(file);
  const variants = [
    ['.br', brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: bytes.length > 4e6 ? 9 : 11, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } })],
    ['.gz', gzipSync(bytes, { level: 9 })],
  ];
  const useful = variants.filter(([, packed]) => packed.length < bytes.length * 0.9);
  for (const [suffix, packed] of useful) await writeFile(file + suffix, packed);
  if (useful.length) precompressed++;
});

const files = [];
await walk(bundle, async file => {
  const bytes = await readFile(file);
  files.push({ path: path.relative(bundle, file).replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
});
await writeFile(path.join(release, 'manifest.json'), JSON.stringify({ version, commit, framework: 'Next.js 16.3.6 static export', excludedBuilds, excludedPaths, precompressed, files: files.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2) + '\n');
const archive = path.join(release, 'public-bundle.tar.gz');
// Relative paths: GNU tar from Git Bash treats "C:" in an absolute path as a remote host.
execFileSync('tar', ['-czf', '../public-bundle.tar.gz', 'portfolio', 'demos'], { cwd: bundle });
const archiveSha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile('output/deploy/latest.json', JSON.stringify({ version, release, base: release, archive, archiveSha256 }, null, 2));
console.log(JSON.stringify({ version, files: files.length, excludedBuilds, excludedPaths, precompressed, archive, archiveSha256 }));
