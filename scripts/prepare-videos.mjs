// Prepares the files of one gallery clip in public/assets/video/<slug>/ from a master outside the repository:
// the web video, its poster and the silent fragment played on hover. Prints the values for src/content/videos.json.
//
//   node scripts/prepare-videos.mjs <slug> [--src <master.mp4>] [--lang ru|en] [--name 1x1]
//        [--poster <seconds or image file>] [--hover <from>[,<length>]]
//
// --name marks another cut of the same clip (a square version next to the wide one).
// Without --src the film already in the folder is kept, and the poster or the fragment asked for is made from it.
// A fragment that shows words is made once per language: with --lang en it is named <slug>-hover-en.mp4, and the
// record lists both, "preview": { "ru": "…-hover.mp4", "en": "…-hover-en.mp4" }.
// ffmpeg with libx264 and libwebp is taken from the FFMPEG variable or from PATH.
//
// The films are not stored in Git. Before a release build:
//   node scripts/prepare-videos.mjs --check
// lists every file the accepted clips need and fails when one is missing from public/.
//
// The gallery draws a poster far smaller than the film, so it shows reduced AVIF copies of it. Once the record
// of a clip is in videos.json:
//   node scripts/prepare-videos.mjs --tiles [<slug> ...]
// makes the copies that are missing for the first cut of every clip (the cut the gallery shows) and writes their
// widths into the record as posterWidths. With slugs it makes the copies of those clips again.
// ffmpeg needs libaom-av1 for that.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// A file already at or under this video bitrate is only repacked for a fast start; a heavier one is encoded again.
const MAX_KBPS = 6200;
// Widths of the reduced copies of a poster, for a wide or square frame and for a vertical one. The full width
// closes the list for large and dense screens; a step close to it is left out.
const TILE_STEPS = { wide: [480, 720, 960, 1280], tall: [360, 540, 720] };
// Quality levels of the AV1 encoder for a copy, the lightest first. A copy takes the lightest level at which it
// cannot be told from the poster reduced without loss (TILE_CLOSE, as SSIM). A frame that does not get there, one
// full of fine detail or grain, takes the best level that keeps it within its allowance and under TILE_SHARE of
// the weight of the poster itself. The allowance is TILE_BITS bits per pixel for a copy of TILE_BITS_AT pixels
// (960x540) or more, and grows per pixel as the copy gets smaller: a small picture packs the same detail into
// fewer pixels, and at a flat rate the 480 px copy of a detailed frame came out visibly softer than the 1280 px one.
const TILE_LEVELS = [34, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10];
const TILE_CLOSE = 0.99;
const TILE_BITS = 1.22;
const TILE_BITS_AT = 960 * 540;
const TILE_BITS_SLOPE = 0.35;
const TILE_SHARE = 0.6;

const root = path.join(import.meta.dirname, '..');
const dataFile = path.join(root, 'src/content/videos.json');

const run = (args, capture = false) => {
  const result = spawnSync(FFMPEG, ['-hide_banner', '-y', ...args], { encoding: capture ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  return result;
};

const tileWidths = (width, height) => [...TILE_STEPS[height > width ? 'tall' : 'wide'].filter(step => step < width * 0.85), width];
const tileName = (poster, width) => poster.replace(/\.webp$/, `-${width}.avif`);
// One reduced copy of a poster; shape is the height of the frame over its width. Returns its quality level.
// The encoder is tuned for still pictures and keeps colour at full resolution: a copy is drawn close to its own
// size, where halved colour shows as soft edges, while the poster itself is drawn at half its size or less.
function makeTile(poster, width, shape) {
  const file = tileName(poster, width);
  const trial = file.replace(/\.avif$/, '.trial.avif');
  // The height is given outright: rounding it to an even number would change the shape of a 720x405 copy.
  const reduce = `scale=${width}:${Math.round(width * shape)}:flags=lanczos`;
  const pixels = width * Math.round(width * shape);
  const limit = Math.min(TILE_BITS * pixels / 8 * Math.max(1, (TILE_BITS_AT / pixels) ** TILE_BITS_SLOPE), TILE_SHARE * statSync(poster).size);
  let chosen;
  // From the lightest level up: stop at the first copy that is close enough, or before the one that is too heavy.
  for (const level of TILE_LEVELS) {
    const made = run(['-i', poster, '-frames:v', '1', '-vf', reduce, '-c:v', 'libaom-av1', '-still-picture', '1',
      '-usage', 'allintra', '-aom-params', 'tune=iq', '-crf', String(level), '-b:v', '0', '-cpu-used', '4', '-pix_fmt', 'yuv444p', trial]);
    if (made.status !== 0) { console.error(made.stderr); process.exit(1); }
    if (chosen !== undefined && statSync(trial).size > limit) break;
    renameSync(trial, file);
    chosen = level;
    const compared = run(['-i', file, '-i', poster, '-lavfi', `[1:v]${reduce},format=gbrp[full];[0:v]format=gbrp[copy];[copy][full]ssim`, '-f', 'null', '-']);
    if (Number(compared.stderr.match(/All:([\d.]+)/)?.[1] ?? 0) >= TILE_CLOSE) break;
  }
  rmSync(trial, { force: true });
  return chosen;
}

if (process.argv[2] === '--tiles') {
  const text = readFileSync(dataFile, 'utf8');
  const data = JSON.parse(text);
  const again = new Set(process.argv.slice(3));
  for (const slug of again) if (!data.videos.some(item => item.slug === slug)) { console.error('No such clip in videos.json: ' + slug); process.exit(1); }
  let made = 0, bytes = 0;
  for (const video of data.videos) {
    const cut = video.cuts[0];
    const widths = tileWidths(cut.width, cut.height);
    for (const poster of new Set(Object.values(cut.poster))) for (const width of widths) {
      const file = path.join(root, 'public', tileName(poster, width));
      if (again.has(video.slug) || !existsSync(file)) {
        const level = makeTile(path.join(root, 'public', poster), width, cut.height / cut.width);
        console.log(`${path.basename(file)}: ${(statSync(file).size / 1000).toFixed(1)} KB, level ${level}`);
        made++;
      }
      bytes += statSync(file).size;
    }
    // posterWidths stands right after poster in the record.
    video.cuts[0] = Object.fromEntries(Object.entries(cut).flatMap(([key, value]) =>
      key === 'posterWidths' ? [] : key === 'poster' ? [[key, value], ['posterWidths', widths]] : [[key, value]]));
  }
  const next = JSON.stringify(data, null, 2) + '\n';
  if (next !== text) writeFileSync(dataFile, next);
  console.log(`${made} reduced posters made, ${(bytes / 1e6).toFixed(1)} MB of them in public/${next !== text ? ', videos.json updated' : ''}`);
  process.exit(0);
}

if (process.argv[2] === '--check') {
  const { videos, mediaBase = '' } = JSON.parse(readFileSync(dataFile, 'utf8'));
  let missing = 0, bytes = 0;
  const local = (slug, file) => {
    const found = existsSync(path.join(root, 'public', file));
    if (found) bytes += statSync(path.join(root, 'public', file)).size; else { missing++; console.error(`${slug}: missing ${file}`); }
  };
  // With mediaBase set the films live in their own storage and are asked for there; pictures and subtitles stay in public/.
  const remote = async (slug, file) => {
    const answer = await fetch(mediaBase + file, { method: 'HEAD' }).catch(() => null);
    if (answer?.ok) bytes += Number(answer.headers.get('content-length') ?? 0); else { missing++; console.error(`${slug}: ${mediaBase + file} answers ${answer?.status ?? 'nothing'}`); }
  };
  for (const video of videos.filter(item => item.status === 'accepted')) for (const cut of video.cuts) {
    // The hover fragment is one file, or one per language.
    const fragments = typeof cut.preview === 'string' ? [cut.preview] : Object.values(cut.preview ?? {});
    const films = new Set([...Object.values(cut.src), ...fragments]);
    const pictures = new Set([cut.poster, cut.share, cut.captions].flatMap(pair => Object.values(pair ?? {})));
    for (const poster of Object.values(cut.poster)) for (const width of cut.posterWidths ?? []) pictures.add(tileName(poster, width));
    if (cut === video.cuts[0] && !cut.posterWidths) { missing++; console.error(`${video.slug}: no reduced posters for the gallery, run --tiles`); }
    for (const file of pictures) local(video.slug, file);
    for (const file of films) if (mediaBase) await remote(video.slug, file); else local(video.slug, file);
  }
  console.log(missing ? `${missing} files are missing` : `All files of the accepted clips are in place, ${(bytes / 1e6).toFixed(1)} MB${mediaBase ? `, films at ${mediaBase}` : ''}`);
  process.exit(missing ? 1 : 0);
}

const [slug, ...rest] = process.argv.slice(2);
const options = {};
for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, '')] = rest[i + 1];
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !(options.src || options.poster || options.hover)) {
  console.error('Usage: node scripts/prepare-videos.mjs <slug> [--src <master.mp4>] [--lang ru|en] [--name 1x1] [--poster <seconds|image>] [--hover <from>[,<length>]]');
  process.exit(1);
}
if (options.src && !existsSync(options.src)) { console.error('No such file: ' + options.src); process.exit(1); }

// ffmpeg prints the stream description to stderr when asked for a file without an output.
function probe(file) {
  const text = String(run(['-i', file]).stderr);
  const duration = text.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const line = text.split('\n').find(row => /Stream.*Video:/.test(row)) ?? '';
  const size = line.match(/, (\d{2,5})x(\d{2,5})/);
  const fps = line.match(/, ([\d.]+) fps/);
  if (!duration || !size || !fps) throw new Error('Cannot read the video stream of ' + file);
  return {
    seconds: +duration[1] * 3600 + +duration[2] * 60 + +duration[3],
    codec: line.match(/Video: (\w+)/)?.[1], width: +size[1], height: +size[2], fps: Math.round(+fps[1]),
    kbps: +(line.match(/, (\d+) kb\/s/)?.[1] ?? Infinity),
    audio: /Stream.*Audio:/.test(text),
  };
}

// Paths are counted from the repository root, wherever the script is started from.
const folder = path.join(root, 'public/assets/video', slug);
mkdirSync(folder, { recursive: true });
const base = [slug, options.name].filter(Boolean).join('-');
const withLang = name => options.lang ? `${name}-${options.lang}` : name;
const url = file => '/' + path.posix.join('assets/video', slug, file);
const report = { files: {} };

const video = withLang(base) + '.mp4';
if (options.src) {
  const source = probe(options.src);
  const light = source.codec === 'h264' && source.kbps <= MAX_KBPS;
  const audio = source.audio ? ['-c:a', 'aac', '-b:a', '160k'] : ['-an'];
  const encode = light
    ? ['-c', 'copy']
    // aq-mode 3 gives dark areas their share of bits: at a plain CRF 21 a dark studio backdrop came out in steps.
    : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-maxrate', '6M', '-bufsize', '12M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-x264-params', 'aq-mode=3',
      // A key frame every two seconds keeps seeking quick.
      '-g', String(source.fps * 2), '-keyint_min', String(source.fps * 2), ...audio];
  const made = run(['-i', options.src, ...encode, '-movflags', '+faststart', path.join(folder, video)]);
  if (made.status !== 0) { console.error(made.stderr); process.exit(1); }
} else if (!existsSync(path.join(folder, video))) {
  console.error(`No film ${video} in ${folder}: give its master with --src`);
  process.exit(1);
}
const result = probe(path.join(folder, video));
Object.assign(report, { width: result.width, height: result.height, fps: result.fps, duration: Math.round(result.seconds * 10) / 10, sound: result.audio });
report.files.src = url(video);
report.megabytes = Math.round(statSync(path.join(folder, video)).size / 1e5) / 10;

if (options.poster) {
  const poster = withLang(base + '-poster') + '.webp';
  const from = /^[\d.]+$/.test(options.poster) ? ['-ss', options.poster, '-i', path.join(folder, video)] : ['-i', options.poster];
  const shot = run([...from, '-frames:v', '1', '-vf', `scale=${result.width}:${result.height}`, '-c:v', 'libwebp', '-quality', '84', path.join(folder, poster)]);
  if (shot.status !== 0) { console.error(shot.stderr); process.exit(1); }
  report.files.poster = url(poster);
  // Reduced copies of this poster already made for the gallery follow the new picture.
  for (const width of tileWidths(result.width, result.height)) if (existsSync(tileName(path.join(folder, poster), width))) makeTile(path.join(folder, poster), width, result.height / result.width);
  // Link preview for messengers, 1200x630 JPEG: a wide frame fills it, a vertical or square one stands in the middle on the site ground.
  const share = withLang(base + '-share') + '.jpg';
  const fit = result.width > result.height
    ? 'scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630'
    : 'scale=1200:630:force_original_aspect_ratio=decrease,pad=1200:630:(ow-iw)/2:(oh-ih)/2:color=0x111213';
  const card = run(['-i', path.join(folder, poster), '-frames:v', '1', '-vf', fit, '-q:v', '3', path.join(folder, share)]);
  if (card.status !== 0) { console.error(card.stderr); process.exit(1); }
  report.files.share = url(share);
  // The start button stands in the lower left corner of the poster and turns dark when that corner is light.
  const corner = run(['-i', path.join(folder, poster), '-vf', 'crop=iw*0.28:ih*0.16:0:ih*0.84,scale=1:1', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], true).stdout;
  report.lightPoster = corner.length >= 3 && 0.2126 * corner[0] + 0.7152 * corner[1] + 0.0722 * corner[2] > 150;
}

if (options.hover) {
  const [from, length = '4'] = options.hover.split(',');
  // The Russian fragment, or the only one, keeps the plain name; the English one is marked.
  const hover = base + (options.lang === 'en' ? '-hover-en.mp4' : '-hover.mp4');
  // A short silent fragment at a quarter of the frame area: it loads only when the pointer comes to a poster.
  const scale = result.width >= result.height ? 'scale=-2:540' : 'scale=540:-2';
  const cut = run(['-ss', from, '-t', length, '-i', path.join(folder, video), '-an', '-vf', `${scale},fps=30`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(folder, hover)]);
  if (cut.status !== 0) { console.error(cut.stderr); process.exit(1); }
  report.files.preview = url(hover);
  report.previewKilobytes = Math.round(statSync(path.join(folder, hover)).size / 1000);
}

console.log(JSON.stringify(report, null, 2));
