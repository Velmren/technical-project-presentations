import { cp, readFile, readdir, rename, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
// Next 16.3 exports segment paths with platform separators on Windows.
// The browser requests dotted filenames on every OS. Normalize only these payloads.
async function normalizeSegments(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('__next.')) {
      async function flatten(current, prefix) {
        for (const child of await readdir(current, { withFileTypes: true })) {
          const source = path.join(current, child.name);
          if (child.isDirectory()) await flatten(source, `${prefix}.${child.name}`);
          else await rename(source, path.join(directory, `${prefix}.${child.name}`));
        }
        await rmdir(current);
      }
      await flatten(target, entry.name);
    } else await normalizeSegments(target);
  }
}
await normalizeSegments('out');

const projectFiles = await readdir('src/content/projects');
const projects = await Promise.all(projectFiles.filter(file => file.endsWith('.json'))
  .map(async file => JSON.parse(await readFile(path.join('src/content/projects', file), 'utf8'))));

// The FORMA demo ships only while its project page is published.
if (projects.some(project => project.slug === 'forma' && project.status !== 'draft')) await cp('demos/forma', 'out/forma/live', { recursive: true });

// Preserve draft sources/media locally, but exclude their exclusive media from export.
function assets(value) {
  if (typeof value === 'string') return value.startsWith('/assets/') ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(assets);
  if (value && typeof value === 'object') return Object.values(value).flatMap(assets);
  return [];
}
const publishedAssets = new Set(projects.filter(project => project.status !== 'draft').flatMap(assets));
const draftAssets = new Set(projects.filter(project => project.status === 'draft').flatMap(assets));
const exportRoot = path.resolve('out');
for (const asset of draftAssets) {
  if (publishedAssets.has(asset)) continue;
  const target = path.resolve(exportRoot, asset.slice(1));
  if (!target.startsWith(exportRoot + path.sep)) throw new Error(`Invalid draft asset path: ${asset}`);
  await unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
// Also omit unreferenced captures in asset folders owned exclusively by drafts.
const draftFolders = new Set([...draftAssets].map(asset => asset.split('/').slice(0, 3).join('/')));
for (const folder of draftFolders) {
  if ([...publishedAssets].some(asset => asset.startsWith(folder + '/'))) continue;
  const target = path.resolve(exportRoot, folder.slice(1));
  if (!target.startsWith(exportRoot + path.sep)) throw new Error(`Invalid draft folder: ${folder}`);
  const entries = await readdir(target, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  for (const entry of entries) {
    if (!entry.isFile()) throw new Error(`Unexpected nested draft asset: ${folder}/${entry.name}`);
    await unlink(path.join(target, entry.name));
  }
  await rmdir(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
