// Captures the images and the clip that present this work in the portfolio (card and case page):
//   node tools/capture.mjs
// Output goes to public/assets/assembly/case/. Needs Playwright (see verify.mjs) and ffmpeg (FFMPEG or PATH).
import {execFileSync, spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, '../../public/assets/assembly/case');
const tmp = path.join(root, '.capture-tmp');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const port = Number(process.env.PORT || 4363);
const base = `http://127.0.0.1:${port}/projects/assembly/`;

async function loadPlaywright() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_CORE) candidates.push(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
  candidates.push('playwright', 'playwright-core');
  for (const specifier of candidates) {
    try {
      const module = await import(specifier);
      return module.chromium ? module : module.default;
    } catch {
      // try the next candidate
    }
  }
  throw new Error('Playwright not found. Run `npm i -D playwright` or set PLAYWRIGHT_CORE to a playwright-core directory.');
}

function startServer() {
  const child = spawn(process.execPath, ['serve.mjs'], {cwd: root, env: {...process.env, PORT: String(port)}, stdio: ['ignore', 'pipe', 'inherit']});
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('http://')) resolve(child);
    });
  });
}

const webp = (png, name, filter) => {
  const args = ['-v', 'error', '-y', '-i', png];
  if (filter) args.push('-vf', filter);
  args.push('-frames:v', '1', '-map_metadata', '-1', '-c:v', 'libwebp', '-quality', '86', '-compression_level', '6', path.join(out, name));
  execFileSync(ffmpeg, args);
};

// Scroll position for a share of the pinned first screen, with the sticky offset of the top bar.
const scrollTo = (page, p) => page.evaluate((v) => {
  const hero = document.querySelector('[data-hero]');
  const pin = hero.querySelector('.hero-pin');
  const top = parseFloat(getComputedStyle(pin).top) || 0;
  scrollTo({top: hero.offsetTop - top + (hero.offsetHeight - pin.clientHeight) * v, behavior: 'instant'});
}, p);

const toSection = (page, id) => page.evaluate((s) => scrollTo({top: document.getElementById(s).offsetTop, behavior: 'instant'}), id);

// Clip around page elements, in CSS pixels, padded and kept inside the viewport.
const clipAround = (page, selectors, pad) => page.evaluate(([list, p]) => {
  const rects = list.map((s) => document.querySelector(s).getBoundingClientRect());
  const x = Math.max(0, Math.min(...rects.map((r) => r.left)) - p);
  const y = Math.max(0, Math.min(...rects.map((r) => r.top)) - p);
  const right = Math.min(innerWidth, Math.max(...rects.map((r) => r.right)) + p);
  const bottom = Math.min(innerHeight, Math.max(...rects.map((r) => r.bottom)) + p);
  return {x: Math.round(x), y: Math.round(y), width: Math.round(right - x), height: Math.round(bottom - y)};
}, [selectors, pad]);

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('.stage').classList.contains('live'), null, {timeout: 30000});
  await page.waitForFunction(() => document.querySelector('[data-note]').textContent.indexOf('%') < 0, null, {timeout: 90000});
  await page.waitForTimeout(1800);
}

fs.mkdirSync(out, {recursive: true});
fs.rmSync(tmp, {recursive: true, force: true});
fs.mkdirSync(tmp, {recursive: true});
const server = await startServer();
const {chromium} = await loadPlaywright();
const browser = await chromium.launch({headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});

try {
  for (const lang of ['ru', 'en']) {
    // Browser-window screens, 2400x1500.
    const context = await browser.newContext({viewport: {width: 1600, height: 1000}, deviceScaleFactor: 1.5});
    const page = await context.newPage();
    await page.goto(`${base}?lang=${lang}`);
    await ready(page);
    for (const [name, p] of [['final', 1], ['frame', 0.27], ['mid', 0.45]]) {
      await scrollTo(page, p);
      await page.waitForTimeout(1000);
      const png = path.join(tmp, `${name}-${lang}.png`);
      await page.screenshot({path: png});
      webp(png, `${name}-${lang}.webp`);
    }
    for (const id of ['flats', 'plan']) {
      await toSection(page, id);
      await page.waitForTimeout(900);
      // On the site plan one building is lit, as under the pointer.
      if (id === 'plan') {
        await page.hover('.gp-tag[data-key="tower"]');
        await page.waitForTimeout(400);
      }
      const png = path.join(tmp, `${id}-${lang}.png`);
      await page.screenshot({path: png});
      webp(png, `${id}-${lang}.webp`);
    }
    // Details at 1:1 of the device pixels: the search panel, the schedule under the scene.
    await scrollTo(page, 1);
    await page.waitForTimeout(900);
    const copy = path.join(tmp, `copy-${lang}.png`);
    await page.screenshot({path: copy, clip: await clipAround(page, ['[data-find]'], 0)});
    webp(copy, `copy-${lang}.webp`);
    await scrollTo(page, 0.45);
    await page.waitForTimeout(900);
    const stage = path.join(tmp, `stage-${lang}.png`);
    const clip = await clipAround(page, ['[data-gantt]'], 0);
    await page.screenshot({path: stage, clip: {...clip, y: clip.y - 300, height: clip.height + 300}});
    webp(stage, `stage-${lang}.webp`);
    await context.close();

    // Card for the portfolio home page, 1440x655, and its phone overlay, 390x408.
    const card = await browser.newContext({viewport: {width: 1440, height: 655}, deviceScaleFactor: 1});
    const cardPage = await card.newPage();
    await cardPage.goto(`${base}?lang=${lang}`);
    await ready(cardPage);
    await scrollTo(cardPage, 1);
    await cardPage.waitForTimeout(1000);
    const cardPng = path.join(tmp, `card-${lang}.png`);
    await cardPage.screenshot({path: cardPng});
    webp(cardPng, `card-${lang}.webp`);
    await card.close();

    // Phone, 780x1688.
    const phone = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    const mobile = await phone.newPage();
    await mobile.goto(`${base}?lang=${lang}`);
    await ready(mobile);
    await scrollTo(mobile, 1);
    await mobile.waitForTimeout(1000);
    const png = path.join(tmp, `phone-${lang}.png`);
    await mobile.screenshot({path: png});
    webp(png, `phone-${lang}.webp`);
    webp(png, `card-mobile-${lang}.webp`, 'crop=724:758:28:590,scale=390:408:flags=lanczos');
    await phone.close();
  }

  // Clip of the real page being scrolled: 16:10, about 9 seconds.
  const videoDir = path.join(tmp, 'video');
  const context = await browser.newContext({viewport: {width: 1280, height: 800}, recordVideo: {dir: videoDir, size: {width: 1280, height: 800}}});
  const page = await context.newPage();
  await page.goto(`${base}?lang=ru`);
  await ready(page);
  const started = await page.evaluate(() => performance.now());
  await page.evaluate(() => new Promise((resolve) => {
    const hero = document.querySelector('[data-hero]');
    const span = hero.offsetHeight - hero.querySelector('.hero-pin').clientHeight;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 7500);
      scrollTo(0, span * k);
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  }));
  await page.waitForTimeout(1600);
  const video = page.video();
  await context.close();
  const webm = await video.path();
  // Cut everything before the scripted scroll started.
  const lead = (started / 1000 + 0.15).toFixed(2);
  execFileSync(ffmpeg, ['-v', 'error', '-y', '-ss', lead, '-i', webm, '-an', '-map_metadata', '-1', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'scroll.mp4')]);
} finally {
  await browser.close();
  server.kill();
  fs.rmSync(tmp, {recursive: true, force: true});
}

for (const file of fs.readdirSync(out).sort()) console.log(file, fs.statSync(path.join(out, file)).size);
