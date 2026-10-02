import {applyLang, initialLang, texts} from './i18n.js';

const ASSETS = '../../assets/assembly/';
// Scroll progress at which each stage label starts.
const STAGES = [0, 0.12, 0.39, 0.62, 0.82, 0.975];
// Share of the phone frame below the object that holds nothing but background.
const MOBILE_TRIM = 0.14;
const BG = 'rgb(18, 21, 26)';

const hero = document.querySelector('[data-hero]');
const pin = hero.querySelector('.hero-pin');
const stage = hero.querySelector('.stage');
const canvas = hero.querySelector('[data-canvas]');
const video = hero.querySelector('[data-fallback]');
const stageName = hero.querySelector('[data-stage]');
const bar = hero.querySelector('[data-bar]');
const note = hero.querySelector('[data-note]');
const top = document.querySelector('.top');
const narrow = matchMedia('(max-width: 760px), (max-aspect-ratio: 1/1)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');

let lang = initialLang();
let set = null;        // frame set in use: {dir, count, width, height}
let frames = [];       // Image per frame, null until loaded
let loaded = 0;
let failed = 0;
let live = false;      // canvas has taken over from the poster
let current = 0;       // frame position being shown, fractional
let drawn = -1;
let intro = null;      // {start, from} while the opening rewind plays
let lastTime = 0;
let raf = 0;
let scrolled = false;

const t = (key) => texts[lang][key];

function progress() {
  const rect = hero.getBoundingClientRect();
  const span = rect.height - innerHeight;
  return span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
}

function showStage(p) {
  let i = 0;
  while (i < STAGES.length - 1 && p >= STAGES[i + 1]) i += 1;
  stageName.textContent = t(`stage.${i}`);
  bar.style.transform = `scaleX(${p.toFixed(4)})`;
}

function showNote() {
  if (set && loaded < set.count && !stage.classList.contains('static')) {
    note.textContent = t('hero.loading').replace('{n}', Math.round((loaded / set.count) * 100));
    note.hidden = false;
  } else {
    note.textContent = t('hero.note');
    note.hidden = scrolled;
  }
}

// Nearest frame that has arrived: lets the scrub work while the set is still loading.
function nearest(i) {
  if (frames[i]) return i;
  for (let d = 1; d < frames.length; d += 1) {
    if (frames[i - d]) return i - d;
    if (frames[i + d]) return i + d;
  }
  return -1;
}

function fit() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(pin.clientWidth * dpr);
  const h = Math.round(pin.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    drawn = -1;
  }
}

function draw(index) {
  const i = nearest(index);
  if (i < 0 || i === drawn) return;
  const img = frames[i];
  const ctx = canvas.getContext('2d');
  const cw = canvas.width;
  const ch = canvas.height;
  let scale;
  let dx;
  let dy;
  if (set.mobile) {
    // Full width, resting above the progress line; the empty lower margin of the frame goes below the fold.
    scale = Math.min(cw / img.naturalWidth, (ch * 0.7) / img.naturalHeight);
    dx = (cw - img.naturalWidth * scale) / 2;
    dy = ch - img.naturalHeight * scale * (1 - MOBILE_TRIM) - ch * 0.085;
  } else if (cw / ch >= img.naturalWidth / img.naturalHeight) {
    // Wider than the frame: cover the screen; the sides are cropped around the object, which sits right of centre.
    scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    dx = (cw - img.naturalWidth * scale) * 0.78;
    dy = (ch - img.naturalHeight * scale) * 0.5;
  } else {
    // Taller than the frame (16:10, 4:3): full width, resting on the bottom, so the object keeps clear of the text.
    scale = cw / img.naturalWidth;
    dx = 0;
    dy = ch - img.naturalHeight * scale;
  }
  ctx.clearRect(0, 0, cw, ch);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, img.naturalWidth * scale, img.naturalHeight * scale);
  if (dy > 0 && !set.mobile) {
    // The frame's top edge carries a trace of ground shadow: fade it into the page background.
    const h = img.naturalHeight * scale * 0.14;
    const fade = ctx.createLinearGradient(0, dy, 0, dy + h);
    fade.addColorStop(0, BG);
    fade.addColorStop(1, 'rgba(18, 21, 26, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, dy - 1, cw, h + 1);
  }
  drawn = i;
}

function tick(now) {
  raf = 0;
  const dt = Math.min(0.1, (now - lastTime) / 1000) || 0.016;
  lastTime = now;
  const p = progress();
  const target = p * (set.count - 1);
  if (intro) {
    // Opening move: the finished quarter comes apart down to the first frame.
    const k = Math.min(1, (now - intro.start) / 1200);
    const e = k * k * (3 - 2 * k);
    current = intro.from + (target - intro.from) * e;
    if (k >= 1) intro = null;
  } else if (calm.matches) {
    current = target;
  } else {
    current += (target - current) * (1 - Math.exp(-dt / 0.11));
    if (Math.abs(target - current) < 0.02) current = target;
  }
  draw(Math.round(current));
  showStage(intro ? 0 : current / (set.count - 1));
  if (intro || Math.abs(target - current) > 0.001) request();
}

function request() {
  if (!raf && live) raf = requestAnimationFrame(tick);
}

function goLive() {
  if (live) return;
  live = true;
  fit();
  stage.classList.add('live');
  const p = progress();
  if (p === 0 && !calm.matches) {
    current = set.count - 1;
    intro = {start: performance.now(), from: current};
  } else {
    current = p * (set.count - 1);
  }
  lastTime = performance.now();
  request();
}

function useFallback() {
  // No frames: a looping video of the assembly, or just the poster if the video fails too.
  stage.classList.add('static');
  video.poster = ASSETS + (narrow.matches ? 'poster-mobile.webp' : 'poster-desktop.webp');
  video.src = ASSETS + (narrow.matches ? 'assembly-mobile.mp4' : 'assembly.mp4');
  video.hidden = false;
  video.play().catch(() => {});
  showNote();
}

function loadOrder(count) {
  // Poster frame, first frame, then coarse to fine so that any scroll position has something close.
  const order = [count - 1, 0];
  const seen = new Set(order);
  for (let step = 16; step >= 1; step /= 2) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  return order;
}

function loadFrames() {
  const order = loadOrder(set.count);
  const coarse = Math.ceil(set.count / 8) + 2;
  let next = 0;
  const pump = () => {
    if (next >= order.length) return;
    const i = order[next];
    next += 1;
    const img = new Image();
    img.decoding = 'async';
    const done = (ok) => {
      if (ok) {
        frames[i] = img;
        loaded += 1;
      } else {
        failed += 1;
      }
      if (failed > set.count * 0.2 && !live) {
        useFallback();
        return;
      }
      if (!live && loaded >= coarse && frames[0] && frames[set.count - 1]) goLive();
      if (live && !intro) {
        drawn = -1;
        request();
      }
      showNote();
      pump();
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = `${set.dir}${String(i).padStart(3, '0')}.webp`;
  };
  for (let k = 0; k < 6; k += 1) pump();
}

async function start() {
  if (!canvas.getContext || !canvas.getContext('2d')) {
    useFallback();
    return;
  }
  try {
    const manifest = await (await fetch(`${ASSETS}frames/manifest.json`)).json();
    const key = narrow.matches ? 'mobile' : 'desktop';
    set = {...manifest[key], dir: `${ASSETS}frames/${key}/`, mobile: key === 'mobile'};
    frames = new Array(set.count).fill(null);
    showNote();
    loadFrames();
  } catch {
    useFallback();
  }
}

addEventListener('scroll', () => {
  if (!scrolled && scrollY > 8) {
    scrolled = true;
    showNote();
  }
  top.classList.toggle('solid', hero.getBoundingClientRect().bottom < 90);
  request();
}, {passive: true});

addEventListener('resize', () => {
  if (!live) return;
  fit();
  request();
});

document.querySelector('[data-lang-switch]').addEventListener('click', () => {
  lang = lang === 'ru' ? 'en' : 'ru';
  applyLang(lang);
  showNote();
  showStage(set && live ? current / (set.count - 1) : 0);
});

const form = document.querySelector('[data-form]');
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const filled = [...form.querySelectorAll('input')].every((input) => input.value.trim());
  form.querySelector('[data-form-note]').textContent = t(filled ? 'visit.done' : 'visit.empty');
  if (filled) form.reset();
});

applyLang(lang);
showStage(0);
showNote();
// The frames wait for the page itself: text, fonts and the poster come first.
if (document.readyState === 'complete') start();
else addEventListener('load', start, {once: true});
