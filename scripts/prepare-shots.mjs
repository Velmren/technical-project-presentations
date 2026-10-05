// Makes the reduced copies of the screenshots shown on the pages of works and services, so a phone does not load
// a 2400 px picture to draw it 380 px wide. The copies are AVIF files beside the screenshot, named by their width
// (hero.webp -> hero-720.avif); which widths a picture gets is decided in src/lib/shots.ts, which the pages use too.
//   FFMPEG=<path to ffmpeg with libaom-av1> node scripts/prepare-shots.mjs    makes the copies that are missing
//   ... --all       makes every copy again
//   ... <words>     only the pictures whose address holds one of the words (tilda-dental, hero)
//   ... --check     only verifies that every copy is in place (ffmpeg is not needed)
//
// A copy is encoded the way the gallery posters are (scripts/prepare-videos.mjs): tuned for still pictures, colour
// at full resolution, and at the lightest quality level at which it cannot be told from the screenshot reduced
// without loss. A picture full of fine detail that does not get there takes the best level within its allowance.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { hasShotCopies, shotCopy, shotWidths } from '../src/lib/shots.ts';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const LEVELS = [34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10];
const CLOSE = 0.99;
// The allowance: bits per pixel for a copy of 960x540 pixels or more, growing per pixel as the copy gets smaller,
// and never more than this share of the weight of the screenshot itself.
const BITS = 1.22, BITS_AT = 960 * 540, BITS_SLOPE = 0.35, SHARE = 0.6;

const root = path.join(import.meta.dirname, '..');
const check = process.argv.includes('--check'), all = process.argv.includes('--all');
const words = process.argv.slice(2).filter(word => !word.startsWith('--'));

// Every picture a case page draws in a screenshot frame, in both languages. The same pictures stand on the
// service pages.
const pictures = new Map();
for (const file of readdirSync(path.join(root, 'src/content/projects')).filter(name => name.endsWith('.json'))) {
  const project = JSON.parse(readFileSync(path.join(root, 'src/content/projects', file), 'utf8'));
  if (project.status === 'draft' || project.presentation !== 'case') continue;
  const layers = project.sections.flatMap(section => section.kind === 'benefit' ? section.layers.map(layer => layer.image) : []);
  for (const image of [project.showcase?.image, project.showcase?.phone, ...layers]) {
    if (!image) continue;
    for (const src of [image.src, project.en?.media?.[image.src]]) if (src && hasShotCopies(src)) pictures.set(src, image.width);
  }
}
const wanted = [...pictures].flatMap(([src, width]) => shotWidths(width).map(copy => ({ src, declared: width, width: copy, file: path.join(root, 'public', shotCopy(src, copy)) })));

if (check) {
  const missing = wanted.filter(item => !existsSync(item.file));
  if (missing.length) { console.error(`Missing reduced screenshots (${missing.length}), run scripts/prepare-shots.mjs:\n  ` + missing.slice(0, 20).map(item => shotCopy(item.src, item.width)).join('\n  ')); process.exit(1); }
  console.log(`All ${wanted.length} reduced copies of ${pictures.size} screenshots are in place`);
  process.exit(0);
}

const run = args => new Promise((resolve, reject) => {
  const child = spawn(FFMPEG, ['-hide_banner', '-y', ...args]);
  let output = '';
  child.stderr.on('data', chunk => { output += chunk; });
  child.on('error', reject);
  child.on('close', status => status === 0 ? resolve(output) : reject(new Error(output.slice(-600))));
});

// One copy; returns its quality level. Closeness and weight both only grow from one level to the next, so the
// level is found by halving. The copy takes its name only when the search is over: a run that was cut short
// leaves no half-chosen file behind, and the next run makes that copy from the start.
async function makeCopy({ src, declared, width, file }) {
  const source = path.join(root, 'public', src);
  const real = await sharp(source).metadata();
  if (real.width !== declared) throw new Error(`${src}: the record says ${declared} px wide, the file is ${real.width}`);
  // The height is given outright: rounding it to an even number would change the shape of the copy.
  const height = Math.round(width * real.height / real.width);
  const reduce = `scale=${width}:${height}:flags=lanczos`;
  const pixels = width * height;
  const limit = Math.min(BITS * pixels / 8 * Math.max(1, (BITS_AT / pixels) ** BITS_SLOPE), SHARE * statSync(source).size);
  const trial = level => file.replace(/\.avif$/, `.trial${level}.avif`);
  const made = new Map();
  const weight = async level => {
    if (!made.has(level)) {
      await run(['-loglevel', 'error', '-nostats', '-i', source, '-frames:v', '1', '-vf', reduce, '-c:v', 'libaom-av1', '-still-picture', '1',
        '-usage', 'allintra', '-aom-params', 'tune=iq', '-crf', String(level), '-b:v', '0', '-cpu-used', '4', '-pix_fmt', 'yuv444p', trial(level)]);
      made.set(level, { size: statSync(trial(level)).size });
    }
    return made.get(level).size;
  };
  const close = async level => {
    await weight(level);
    const copy = made.get(level);
    if (copy.close === undefined) {
      const compared = await run(['-nostats', '-i', trial(level), '-i', source, '-lavfi', `[1:v]${reduce},format=gbrp[full];[0:v]format=gbrp[copy];[copy][full]ssim`, '-f', 'null', '-']);
      copy.close = Number(compared.match(/All:([\d.]+)/)?.[1] ?? 0) >= CLOSE;
    }
    return copy.close;
  };
  // The lightest level that is close enough, or the heaviest one when none is. Most screenshots are flat colour
  // and text and pass at the lightest level, so that one is tried first.
  let low = await close(LEVELS[0]) ? 0 : 1, high = low ? LEVELS.length - 1 : 0;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (await close(LEVELS[middle])) high = middle; else low = middle + 1;
  }
  let chosen = low;
  // When that copy is over its allowance: the best level within it. The lightest level is always allowed.
  if (chosen > 0 && await weight(LEVELS[chosen]) > limit) {
    let within = 0, over = chosen;
    while (over - within > 1) {
      const middle = (within + over) >> 1;
      if (await weight(LEVELS[middle]) <= limit) within = middle; else over = middle;
    }
    chosen = within;
  }
  // The lightest level may have been reached without ever being made.
  await weight(LEVELS[chosen]);
  renameSync(trial(LEVELS[chosen]), file);
  for (const level of LEVELS) rmSync(trial(level), { force: true });
  return LEVELS[chosen];
}

const queue = wanted.filter(item => (all || !existsSync(item.file)) && (!words.length || words.some(word => item.src.includes(word))));
console.log(`${pictures.size} screenshots, ${wanted.length} copies, ${queue.length} to make`);
let done = 0, weight = 0;
// The encoder is single-threaded on a still picture: one copy per processor core at a time.
await Promise.all(Array.from({ length: Math.max(1, os.availableParallelism() - 2) }, async () => {
  for (let item = queue.shift(); item; item = queue.shift()) {
    await makeCopy(item);
    weight += statSync(item.file).size;
    if (++done % 50 === 0) console.log(`${done} made, ${(weight / 1048576).toFixed(1)} MB`);
  }
}));
console.log(`Made ${done} copies, ${(weight / 1048576).toFixed(1)} MB`);
