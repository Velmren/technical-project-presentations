// Prepares the files of one gallery clip in public/assets/video/<slug>/ from a master outside the repository:
// the web video, its poster and the silent fragment played on hover. Prints the values for src/content/videos.json.
//
//   node scripts/prepare-videos.mjs <slug> --src <master.mp4> [--lang ru|en] [--name 1x1]
//        [--poster <seconds or image file>] [--hover <from>[,<length>]]
//
// --name marks another cut of the same clip (a square version next to the wide one).
// ffmpeg with libx264 and libwebp is taken from the FFMPEG variable or from PATH.
//
// The films are not stored in Git. Before a release build:
//   node scripts/prepare-videos.mjs --check
// lists every file the accepted clips need and fails when one is missing from public/.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// A file already at or under this video bitrate is only repacked for a fast start; a heavier one is encoded again.
const MAX_KBPS = 6200;

const root = path.join(import.meta.dirname, '..');

if (process.argv[2] === '--check') {
  const { videos } = JSON.parse(readFileSync(path.join(root, 'src/content/videos.json'), 'utf8'));
  let missing = 0, bytes = 0;
  for (const video of videos.filter(item => item.status === 'accepted')) for (const cut of video.cuts) {
    const files = [cut.src, cut.poster, cut.share, cut.captions].flatMap(pair => Object.values(pair ?? {})).concat(cut.preview ?? []);
    for (const file of new Set(files)) {
      const found = existsSync(path.join(root, 'public', file));
      if (found) bytes += statSync(path.join(root, 'public', file)).size; else { missing++; console.error(`${video.slug}: missing ${file}`); }
    }
  }
  console.log(missing ? `${missing} files are missing` : `All files of the accepted clips are in place, ${(bytes / 1e6).toFixed(1)} MB`);
  process.exit(missing ? 1 : 0);
}

const [slug, ...rest] = process.argv.slice(2);
const options = {};
for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, '')] = rest[i + 1];
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !options.src) {
  console.error('Usage: node scripts/prepare-videos.mjs <slug> --src <master.mp4> [--lang ru|en] [--name 1x1] [--poster <seconds|image>] [--hover <from>[,<length>]]');
  process.exit(1);
}
if (!existsSync(options.src)) { console.error('No such file: ' + options.src); process.exit(1); }

const run = (args, capture = false) => {
  const result = spawnSync(FFMPEG, ['-hide_banner', '-y', ...args], { encoding: capture ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  return result;
};

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

const source = probe(options.src);
const video = withLang(base) + '.mp4';
const light = source.codec === 'h264' && source.kbps <= MAX_KBPS;
const audio = source.audio ? ['-c:a', 'aac', '-b:a', '160k'] : ['-an'];
const encode = light
  ? ['-c', 'copy']
  : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '6M', '-bufsize', '12M', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    // A key frame every two seconds keeps seeking quick.
    '-g', String(source.fps * 2), '-keyint_min', String(source.fps * 2), ...audio];
const made = run(['-i', options.src, ...encode, '-movflags', '+faststart', path.join(folder, video)]);
if (made.status !== 0) { console.error(made.stderr); process.exit(1); }
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
  const hover = base + '-hover.mp4';
  // A short silent fragment at a quarter of the frame area: it loads only when the pointer comes to a poster.
  const scale = result.width >= result.height ? 'scale=-2:540' : 'scale=540:-2';
  const cut = run(['-ss', from, '-t', length, '-i', path.join(folder, video), '-an', '-vf', `${scale},fps=30`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '27',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(folder, hover)]);
  if (cut.status !== 0) { console.error(cut.stderr); process.exit(1); }
  report.files.preview = url(hover);
  report.previewKilobytes = Math.round(statSync(path.join(folder, hover)).size / 1000);
}

console.log(JSON.stringify(report, null, 2));
