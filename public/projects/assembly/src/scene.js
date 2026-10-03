// The pinned first screen: frame loading, scroll to frame mapping, canvas drawing and the fallback,
// plus the parts that follow the scroll: the construction schedule and the house labels.
import {ANCHORS} from './anchors.js';
import {HOUSE_ORDER, HOUSES, SCHEDULE, houseStats, quarter} from './data.js';
import {price, quarterLabel, t} from './i18n.js';

const ASSETS = '../../assets/assembly/';
const BG = 'rgb(18, 21, 26)';
// Box around the finished quarter in the frames (the largest extent over the sequence), in frame pixels.
const OBJECT = {desktop: {x: 608, y: 188, w: 1196, h: 832}, mobile: {x: 44, y: 276, w: 618, h: 431}};
// Parts of the desktop box, as fractions of it, that stand tall: the tower from its left edge and the long
// house from its roof. The heading must stay clear of them.
const TALL = [{x: 0.66, y: 0}, {x: 0.33, y: 0.38}];
const MAX_SCALE = 1.25;

const hero = document.querySelector('[data-hero]');
const pin = hero.querySelector('.hero-pin');
const stage = hero.querySelector('.stage');
const canvas = hero.querySelector('[data-canvas]');
const poster = hero.querySelector('[data-poster]');
const video = hero.querySelector('[data-fallback]');
const note = hero.querySelector('[data-note]');
const intro = hero.querySelector('[data-intro]');
const finder = hero.querySelector('[data-find]');
const gantt = hero.querySelector('[data-gantt]');
const play = hero.querySelector('[data-play]');
const playLabel = hero.querySelector('[data-play-label]');
const tags = Object.fromEntries([...hero.querySelectorAll('[data-tag]')].map((el) => [el.dataset.tag, el]));
const bars = Object.fromEntries([...hero.querySelectorAll('[data-bar]')].map((el) => [el.dataset.bar, el]));
const statuses = Object.fromEntries([...hero.querySelectorAll('[data-status]')].map((el) => [el.dataset.status, el]));
const narrow = matchMedia('(max-width: 760px), (max-aspect-ratio: 1/1)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');

let set = null;        // frame set in use: {dir, count, width, height}
let frames = [];       // Image per frame, null until loaded
let loaded = 0;
let failed = 0;
let live = false;      // canvas has taken over from the poster
let current = 0;       // frame position being shown, fractional
let drawn = -1;
let introMove = null;  // {start, from} while the opening rewind plays
let lastTime = 0;
let raf = 0;
let scrolled = false;
let place = null;      // {s, dx, dy} in CSS pixels: where the frame goes on the canvas
let shownP = -1;
let pinTop = 0;        // sticky offset of the scene: the top bar on narrower screens

function progress() {
  const rect = hero.getBoundingClientRect();
  const span = rect.height - pin.clientHeight;
  return span > 0 ? Math.min(1, Math.max(0, (pinTop - rect.top) / span)) : 0;
}

const isMobile = () => (set ? set.mobile : narrow.matches);
const rel = (el) => {
  const a = el.getBoundingClientRect();
  const b = pin.getBoundingClientRect();
  return {left: a.left - b.left, top: a.top - b.top, right: a.right - b.left, bottom: a.bottom - b.top};
};

// Where the frame goes: the quarter fills the free area right of the search panel and above the schedule,
// resting on the schedule, and never runs under the heading.
function layout() {
  const W = pin.clientWidth;
  const H = pin.clientHeight;
  const pad = Math.max(20, parseFloat(getComputedStyle(hero.querySelector('.hero-copy')).left) || 32);
  const bottom = rel(gantt).top - 16;
  const text = rel(intro);
  if (isMobile()) {
    const obj = OBJECT.mobile;
    const top = text.bottom + 12;
    const s = Math.min((W - 24) / obj.w, (bottom - top) / obj.h);
    return {s, dx: (W - obj.w * s) / 2 - obj.x * s, dy: bottom - (obj.y + obj.h) * s, w: 720, h: 900};
  }
  const obj = OBJECT.desktop;
  const left = finder.offsetParent ? rel(finder).right + 32 : pad;
  const right = W - pad;
  let top = 24;
  let s = 0;
  let x = 0;
  let y = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    s = Math.min((right - left) / obj.w, (bottom - top) / obj.h, MAX_SCALE);
    x = right - obj.w * s;
    y = bottom - obj.h * s;
    const hit = TALL.some((zone) => text.right + 24 > x + zone.x * obj.w * s && text.bottom + 24 > y + zone.y * obj.h * s);
    if (!hit) break;
    top = text.bottom + 24;
  }
  return {s, dx: x - obj.x * s, dy: y - obj.y * s, w: 1920, h: 1080};
}

function placeStatic() {
  // Poster and fallback video sit exactly where the canvas will draw the frame.
  pinTop = parseFloat(getComputedStyle(pin).top) || 0;
  place = layout();
  for (const el of [poster, video]) {
    el.style.left = `${place.dx}px`;
    el.style.top = `${place.dy}px`;
    el.style.width = `${place.w * place.s}px`;
    el.style.height = `${place.h * place.s}px`;
    el.classList.add('placed');
  }
  placeTags();
}

// Text is written only when it changes: the schedule follows every animation frame and must not cost a layout.
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

// Moves are written as transforms on elements with their own layers: no layout and no repaint of the screen.
function showSchedule(p) {
  if (Math.abs(p - shownP) < 0.002) return;
  shownP = p;
  const time = p * SCHEDULE.quarters;
  play.style.transform = `translateX(${(p * 100).toFixed(2)}%)`;
  playLabel.style.transform = `translateX(${(p * -100).toFixed(2)}%)`;
  setText(playLabel, quarterLabel(quarter(Math.min(SCHEDULE.quarters, Math.floor(time) + 1)), true));
  for (const id of HOUSE_ORDER) {
    const house = HOUSES[id];
    bars[id].firstElementChild.style.transform = `scaleX(${Math.min(1, time / house.due).toFixed(4)})`;
    const done = p >= house.lit;
    if (statuses[id].classList.contains('done') !== done || !statuses[id].textContent) {
      statuses[id].classList.toggle('done', done);
      statuses[id].textContent = done ? t('gantt.done') : t('gantt.due', {q: quarterLabel(quarter(house.due))});
    }
    tags[id].classList.toggle('on', done && !isMobile());
  }
}

const LINE = 68; // leader line plus the gap at the marker, CSS pixels
const SIDES = {tower: ['left', 'up'], clinker: ['left', 'up', 'right'], club: ['left', 'down', 'up']};
const anchor = (id, index) => [
  place.dx + (ANCHORS[id][index * 2] / 10000) * 1920 * place.s,
  place.dy + (ANCHORS[id][index * 2 + 1] / 10000) * 1080 * place.s,
];

function labelRect(side, x, y, w, h) {
  if (side === 'left') return {left: x - LINE - w, right: x - LINE, top: y - h / 2, bottom: y + h / 2};
  if (side === 'right') return {left: x + LINE, right: x + LINE + w, top: y - h / 2, bottom: y + h / 2};
  if (side === 'up') return {left: x - 24, right: x - 24 + w, top: y - LINE - h, bottom: y - LINE};
  return {left: x - 24, right: x - 24 + w, top: y + LINE, bottom: y + LINE + h};
}

// Overlap area of two rectangles, each grown by gap.
const clash = (a, b, gap) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left) + gap) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) + gap);

// Each label takes the side, at the finished quarter, that keeps it on screen and clear of the heading,
// the search panel, the schedule and the labels already placed; when none is clear, the least covered one.
function placeTags() {
  if (isMobile() || !place) return;
  const W = pin.clientWidth;
  const screen = {left: 8, top: 8, right: W - 8, bottom: pin.clientHeight};
  const blocked = [rel(intro), rel(gantt)];
  if (finder.offsetParent) blocked.push(rel(finder));
  for (const id of HOUSE_ORDER.slice().reverse()) {
    const box = tags[id].querySelector('.tag-box');
    const [x, y] = anchor(id, ANCHORS[id].length / 2 - 1);
    const score = (side) => {
      const r = labelRect(side, x, y, box.offsetWidth, box.offsetHeight);
      const outside = (r.right - r.left) * (r.bottom - r.top) - clash(r, screen, 0);
      return outside + blocked.reduce((sum, b) => sum + clash(r, b, 12), 0);
    };
    const side = SIDES[id].reduce((best, s) => (score(s) < score(best) ? s : best));
    tags[id].dataset.side = side;
    blocked.push(labelRect(side, x, y, box.offsetWidth, box.offsetHeight));
  }
}

function showTags(index) {
  if (isMobile() || !place) return;
  for (const id of HOUSE_ORDER) {
    // A hidden label stays where it is; it is placed again on the frame that shows it.
    if (index / (set.count - 1) < HOUSES[id].lit - 0.02) continue;
    const [x, y] = anchor(id, index);
    tags[id].style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

function showNote() {
  if (set && loaded < set.count && !stage.classList.contains('static')) {
    note.textContent = t('hero.loading', {n: Math.round((loaded / set.count) * 100)});
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
  }
  placeStatic();
  drawn = -1;
}

// Edges of the frame that land inside the canvas fade into the page: the frame carries a trace of ground shadow there.
function feather(ctx, x, y, w, h, cw, ch) {
  const band = Math.min(w, h) * 0.06;
  const edges = [
    [x > 0, x, y, band, h, [x, 0, x + band, 0]],
    [x + w < cw, x + w - band, y, band, h, [x + w, 0, x + w - band, 0]],
    [y > 0, x, y, w, band, [0, y, 0, y + band]],
    [y + h < ch, x, y + h - band, w, band, [0, y + h, 0, y + h - band]],
  ];
  for (const [inside, rx, ry, rw, rh, g] of edges) {
    if (!inside) continue;
    const fade = ctx.createLinearGradient(...g);
    fade.addColorStop(0, BG);
    fade.addColorStop(1, 'rgba(18, 21, 26, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
  }
}

function draw(index) {
  const i = nearest(index);
  if (i < 0 || i === drawn) return;
  const img = frames[i];
  const ctx = canvas.getContext('2d');
  const dpr = canvas.width / pin.clientWidth;
  const scale = place.s * (place.w / img.naturalWidth) * dpr;
  const dx = place.dx * dpr;
  const dy = place.dy * dpr;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, w, h);
  feather(ctx, dx, dy, w, h, canvas.width, canvas.height);
  drawn = i;
  if (!set.mobile) showTags(i);
}

function tick(now) {
  raf = 0;
  const dt = Math.min(0.1, (now - lastTime) / 1000) || 0.016;
  lastTime = now;
  const p = progress();
  const target = p * (set.count - 1);
  if (introMove) {
    // Opening move: the finished quarter comes apart down to the first frame.
    const k = Math.min(1, (now - introMove.start) / 1200);
    const e = k * k * (3 - 2 * k);
    current = introMove.from + (target - introMove.from) * e;
    if (k >= 1) introMove = null;
  } else if (calm.matches) {
    current = target;
  } else {
    current += (target - current) * (1 - Math.exp(-dt / 0.11));
    if (Math.abs(target - current) < 0.02) current = target;
  }
  const before = drawn;
  draw(Math.round(current));
  // The schedule moves with the frames: between two frames there is nothing new to show.
  if (drawn !== before || introMove) showSchedule(introMove ? 0 : current / (set.count - 1));
  if (introMove || Math.abs(target - current) > 0.001) request();
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
    introMove = {start: performance.now(), from: current};
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
  showSchedule(1);
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
      if (live && !introMove) {
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

// Texts that depend on the language: the axis, the labels on the houses, the schedule statuses.
export function renderSceneText() {
  const axis = hero.querySelector('[data-axis]');
  axis.innerHTML = '';
  for (let i = 1; i <= SCHEDULE.quarters; i += 1) {
    const q = quarter(i);
    // "IV кв. 2026": the word for quarter drops out on narrow screens, the year shows where it changes.
    const [numeral, ...rest] = quarterLabel(q).replace(/\s?\d{4}$/, '').split(' ');
    const span = document.createElement('span');
    span.innerHTML = `${numeral}<em>${rest.length ? ` ${rest.join(' ')}` : ''}</em>${i === 1 || q.q === 1 ? ` ${q.year}` : ''}`;
    axis.append(span);
  }
  for (const id of HOUSE_ORDER) {
    hero.querySelector(`[data-tag-line="${id}"]`).textContent = t('tag.from', {floors: t(`gantt.floors.${id}`), price: price(houseStats(id).from)});
  }
  shownP = -1;
  showSchedule(live && set ? current / (set.count - 1) : 0);
  showNote();
  if (set) fit();
  else placeStatic();
  request();
}

export function initScene() {
  addEventListener('scroll', () => {
    if (!scrolled && scrollY > 8) {
      scrolled = true;
      showNote();
    }
    request();
  }, {passive: true});
  addEventListener('resize', () => {
    if (live) fit();
    else placeStatic();
    request();
  });
  document.fonts?.ready.then(() => (live ? fit() : placeStatic()));
  renderSceneText();
  // The frames wait for the page itself: text, fonts and the poster come first.
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, {once: true});
}
