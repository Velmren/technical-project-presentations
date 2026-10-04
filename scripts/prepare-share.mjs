// Makes the link preview picture of every published work: a 1200x630 JPEG cut from the first screen shown on its
// page, one per language where the English page shows its own screenshot. Messengers and social networks do not
// all show WebP, and they crop anything that is not 1.91:1, so the previews are prepared once and committed.
//   node scripts/prepare-share.mjs          writes public/assets/share/<slug>.jpg and <slug>-en.jpg
//   node scripts/prepare-share.mjs --check  only verifies that every picture is in place
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const WIDTH = 1200, HEIGHT = 630;
const check = process.argv.includes('--check');
const folder = 'public/assets/share';

const files = (await readdir('src/content/projects')).filter(file => file.endsWith('.json'));
const projects = await Promise.all(files.map(async file => JSON.parse(await readFile(path.join('src/content/projects', file), 'utf8'))));
const wanted = projects.filter(project => project.status !== 'draft' && project.showcase).flatMap(project => {
  const source = project.showcase.image.src;
  const english = project.en?.media?.[source];
  return [{ source, target: `${folder}/${project.slug}.jpg` }, ...(english ? [{ source: english, target: `${folder}/${project.slug}-en.jpg` }] : [])];
});

if (check) {
  const missing = wanted.filter(item => !existsSync(item.target));
  if (missing.length) { console.error('Missing link previews:\n  ' + missing.map(item => item.target).join('\n  ')); process.exit(1); }
  console.log(`All ${wanted.length} link previews are in place`);
} else {
  await mkdir(folder, { recursive: true });
  for (const { source, target } of wanted) {
    const image = sharp(path.join('public', source));
    const { width, height } = await image.metadata();
    // A page screenshot keeps its top, where the heading is; a wide frame of a game or a film is cut evenly.
    const position = width / height < 1.7 ? 'top' : 'centre';
    await image.resize(WIDTH, HEIGHT, { fit: 'cover', position }).jpeg({ quality: 84, mozjpeg: true }).toFile(target);
  }
  console.log(`Wrote ${wanted.length} link previews to ${folder}`);
}
