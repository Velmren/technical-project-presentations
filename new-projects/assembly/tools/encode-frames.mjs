// Turns rendered PNG frames (transparent background) into the WebP sets the page loads.
// Each frame is laid over the page background colour, scaled, lightly sharpened and written without metadata.
//
//   node tools/encode-frames.mjs <desktop png dir> [--dw 1920] [--dq 86] [--mw 720] [--mq 86] [--mcount 90]
//
// The phone set is cut from the desktop frames: the camera path is the same, so a 4:5 frame is the part of
// the 16:9 frame that holds the object, with its edges faded into the background and empty background added
// above and below. Every second desktop frame is used.
//
// Output: public/assets/assembly/frames/{desktop,mobile}/NNN.webp, frames/manifest.json,
// poster-desktop.webp and poster-mobile.webp (the last frame of each set).
// FFMPEG may point to the ffmpeg binary; otherwise `ffmpeg` from PATH is used.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, '../../public/assets/assembly');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const BG = '12151A';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const [desktopDir] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!desktopDir) {
  console.error('usage: node tools/encode-frames.mjs <desktop png dir> [--dw 1920] [--dq 86] [--mw 720] [--mq 86] [--mcount 90]');
  process.exit(1);
}

// Phone window inside a 1920x1080 frame: x offset and width of the part with the object, the height of the
// 4:5 canvas it is placed on and the offset from its top. The shadow layer reaches the frame edges, so the
// window fades out over FADE pixels (left and right, top, bottom) to leave no seam against the page.
const WINDOW = {x: 520, w: 1400, canvasH: 1750, top: 352};
const FADE = {side: 60, top: 100, bottom: 35};

function size(file) {
  // PNG header: width and height are big-endian integers at bytes 16 and 20.
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, head, 0, 24, 0);
  fs.closeSync(fd);
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

function encode(dir, name, width, quality, count) {
  let files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  if (!files.length) throw new Error(`no PNG frames in ${dir}`);
  const target = path.join(out, 'frames', name);
  fs.rmSync(target, {recursive: true, force: true});
  fs.mkdirSync(target, {recursive: true});
  const [sw, sh] = size(path.join(dir, files[0]));
  const phone = name === 'mobile';
  if (phone && (sw !== 1920 || sh !== 1080)) throw new Error('the phone window is defined for 1920x1080 frames');
  if (phone) files = Array.from({length: count}, (_, i) => files[Math.round((i * (files.length - 1)) / (count - 1))]);
  const [cw, ch] = phone ? [WINDOW.w, WINDOW.canvasH] : [sw, sh];
  const height = Math.round((ch * width) / cw / 2) * 2;
  const fade = `clip(min(min(X/${FADE.side},(W-1-X)/${FADE.side}),min(Y/${FADE.top},(H-1-Y)/${FADE.bottom})),0,1)`;
  // The background must come out as the page colour exactly, so the frame is composed in RGB and converted
  // to the YUV that WebP stores (BT.601, limited range) in one explicit step.
  const layer = phone
    ? `[1:v]format=rgba,crop=${WINDOW.w}:${sh}:${WINDOW.x}:0,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*${fade}',format=gbrap[fg];[0:v][fg]overlay=0:${WINDOW.top}:format=gbrp`
    : '[1:v]format=gbrap[fg];[0:v][fg]overlay=format=gbrp';
  let bytes = 0;
  files.forEach((file, i) => {
    const dest = path.join(target, `${String(i).padStart(3, '0')}.webp`);
    execFileSync(ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x${BG}:s=${cw}x${ch},format=gbrp`, '-i', path.join(dir, file),
      // unsharp: 3x3 luma kernel at a low amount restores the crispness lost in compression, without halos
      '-filter_complex', `${layer},scale=${width}:${height}:flags=lanczos:out_color_matrix=bt601:out_range=tv,format=yuv420p,unsharp=3:3:0.4:3:3:0`,
      '-frames:v', '1', '-map_metadata', '-1', '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', '-preset', 'picture', dest]);
    bytes += fs.statSync(dest).size;
  });
  fs.copyFileSync(path.join(target, `${String(files.length - 1).padStart(3, '0')}.webp`), path.join(out, `poster-${name}.webp`));
  console.log(`${name}: ${files.length} frames ${width}x${height} q${quality}, ${(bytes / 1e6).toFixed(2)} MB`);
  return {count: files.length, width, height, bytes};
}

fs.mkdirSync(out, {recursive: true});
const manifest = {
  background: `#${BG.toLowerCase()}`,
  desktop: encode(desktopDir, 'desktop', opt('dw', 1920), opt('dq', 86)),
  mobile: encode(desktopDir, 'mobile', opt('mw', 720), opt('mq', 86), opt('mcount', 90)),
};
fs.writeFileSync(path.join(out, 'frames', 'manifest.json'), JSON.stringify(manifest, null, 2));
