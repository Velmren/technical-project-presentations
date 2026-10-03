// Checks the page in a real browser and captures screenshots:
//   node tools/verify.mjs [output dir]
// For each screen size and several scroll positions: no element of the first screen covers another,
// no text sits on the rendered quarter, nothing overflows sideways; along the whole scroll the label of the
// current quarter leaves the quarter names and the schedule title readable. Then the sections at 1920 and 390,
// the English version, scroll smoothness (frame intervals during a scripted scroll), the fallback when
// frames are unavailable and the Russian text in the markup against the dictionary.
// Playwright is a development-only dependency: install `playwright` locally or point PLAYWRIGHT_CORE
// at an existing playwright-core directory.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {texts} from '../src/i18n.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'verify-output'));
const port = Number(process.env.PORT || 4362);
const base = `http://127.0.0.1:${port}/projects/assembly/`;
const SIZES = [[1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1024, 768]];
const SECTIONS = ['about', 'flats', 'houses', 'plan', 'progress', 'mortgage', 'location', 'office'];

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

// Scroll position for a share of the pinned first screen; the sticky offset of the top bar is taken into account.
const scrollTo = (page, p) => page.evaluate((v) => {
  const hero = document.querySelector('[data-hero]');
  const pin = hero.querySelector('.hero-pin');
  const top = parseFloat(getComputedStyle(pin).top) || 0;
  scrollTo({top: hero.offsetTop - top + (hero.offsetHeight - pin.clientHeight) * v, behavior: 'instant'});
}, p);

const toSection = (page, id) => page.evaluate((s) => {
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top')) || 0;
  scrollTo({top: document.getElementById(s).offsetTop - top, behavior: 'instant'});
}, id);

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('.stage').classList.contains('live'), null, {timeout: 30000});
  await page.waitForFunction(() => document.querySelector('[data-note]').textContent.indexOf('%') < 0, null, {timeout: 90000});
  await page.waitForTimeout(1600);
}

// What covers what on the first screen. Text over the rendered quarter is measured on the canvas itself:
// the share of pixels under a text box that differ from the background.
const inspect = (page) => page.evaluate(() => {
  const box = (el) => {
    if (!el || !el.offsetParent || getComputedStyle(el).visibility === 'hidden' || Number(getComputedStyle(el).opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    return r.width && r.height ? {left: r.left, top: r.top, right: r.right, bottom: r.bottom} : null;
  };
  const named = {
    heading: box(document.querySelector('.hero h1')),
    lead: box(document.querySelector('.hero .lead')),
    button: box(document.querySelector('.intro-cta')),
    search: box(document.querySelector('[data-find]')),
    schedule: box(document.querySelector('[data-gantt]')),
    logo: box(document.querySelector('.rail .logo')),
    nav: box(document.querySelector('.rail .nav')),
    contact: box(document.querySelector('.rail .contact')),
    phone: box(document.querySelector('.top-tel')),
    menu: box(document.querySelector('.burger')),
  };
  for (const tag of document.querySelectorAll('[data-tag].on')) named[`label ${tag.dataset.tag}`] = box(tag.querySelector('.tag-box'));
  const overlaps = [];
  const entries = Object.entries(named).filter(([, r]) => r);
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const [a, ra] = entries[i];
      const [b, rb] = entries[j];
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 1 && h > 1) overlaps.push(`${a} / ${b}`);
    }
  }
  const canvas = document.querySelector('[data-canvas]');
  const ctx = canvas.getContext('2d');
  const cr = canvas.getBoundingClientRect();
  const k = canvas.width / cr.width;
  const onScene = {};
  for (const name of ['heading', 'lead', 'button', 'search']) {
    const r = named[name];
    if (!r) continue;
    const x = Math.max(0, Math.round((r.left - cr.left) * k));
    const y = Math.max(0, Math.round((r.top - cr.top) * k));
    const w = Math.min(canvas.width - x, Math.round((r.right - r.left) * k));
    const h = Math.min(canvas.height - y, Math.round((r.bottom - r.top) * k));
    if (w <= 0 || h <= 0) continue;
    const data = ctx.getImageData(x, y, w, h).data;
    let hit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && Math.abs(data[i] - 18) + Math.abs(data[i + 1] - 21) + Math.abs(data[i + 2] - 26) > 36) hit += 1;
    }
    onScene[name] = Number(((hit / (w * h)) * 100).toFixed(2));
  }
  return {overlaps, onScene, overflow: document.documentElement.scrollWidth - innerWidth};
});

// Texts of the schedule that the label of the current quarter covers. Measured on the text itself, not on its cell.
const underMarker = (page) => page.evaluate(() => {
  const label = document.querySelector('[data-play-label]').getBoundingClientRect();
  const texts = [...document.querySelectorAll('[data-axis] span')].map((el) => [`axis "${el.textContent}"`, el]);
  texts.push(['schedule title', document.querySelector('.gantt-head > span')], ['note', document.querySelector('[data-note]')]);
  const covered = [];
  for (const [name, el] of texts) {
    if (el.hidden || !el.offsetParent) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const w = Math.min(label.right, r.right) - Math.max(label.left, r.left);
    const h = Math.min(label.bottom, r.bottom) - Math.max(label.top, r.top);
    if (w > 0 && h > 0) covered.push(name);
  }
  return covered;
});

// The label moves with the scroll, so it is checked along the whole first screen, not only at the stops.
async function sweepMarker(page, name) {
  for (let k = 0; k <= 32; k += 1) {
    await scrollTo(page, k / 32);
    await page.waitForTimeout(200);
    const covered = await underMarker(page);
    if (covered.length) fail(`${name}: the label of the current quarter covers ${covered.join(', ')} at ${k}/32 of the scroll`);
  }
}

const report = {checked: new Date().toISOString(), screens: {}, problems: []};
const fail = (text) => report.problems.push(text);

fs.mkdirSync(outDir, {recursive: true});
const server = await startServer();
const {chromium} = await loadPlaywright();
const browser = await chromium.launch({headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});

try {
  // First screen at each size, Russian and English.
  for (const lang of ['ru', 'en']) {
    for (const [w, h] of SIZES) {
      const context = await browser.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 1});
      const page = await context.newPage();
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${base}?lang=${lang}`);
      await ready(page);
      for (const p of [0, 0.5, 0.8, 1]) {
        await scrollTo(page, p);
        await page.waitForTimeout(900);
        const name = `${lang}-${w}x${h}-p${String(Math.round(p * 100)).padStart(3, '0')}`;
        if (lang === 'ru' || p === 1) await page.screenshot({path: path.join(outDir, `${name}.png`)});
        const state = await inspect(page);
        state.underMarker = await underMarker(page);
        report.screens[name] = state;
        if (state.overlaps.length) fail(`${name}: overlaps ${state.overlaps.join(', ')}`);
        if (state.underMarker.length) fail(`${name}: the label of the current quarter covers ${state.underMarker.join(', ')}`);
        for (const [what, share] of Object.entries(state.onScene)) if (share > 1) fail(`${name}: ${what} lies on the scene (${share}% of its box)`);
        if (state.overflow > 0) fail(`${name}: horizontal overflow ${state.overflow}px`);
      }
      await sweepMarker(page, `${lang}-${w}x${h}`);
      if (w === 1920) {
        for (const id of SECTIONS) {
          await toSection(page, id);
          await page.waitForTimeout(600);
          await page.screenshot({path: path.join(outDir, `${lang}-1920-${id}.png`)});
        }
      }
      if (errors.length) fail(`${lang} ${w}: ${errors.join(' | ')}`);
      await context.close();
    }
  }

  // Phone: first screen, sections, no sideways overflow.
  for (const lang of ['ru', 'en']) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?lang=${lang}`);
    await ready(page);
    for (const p of [0, 0.5, 1]) {
      await scrollTo(page, p);
      await page.waitForTimeout(900);
      const name = `${lang}-390-p${String(Math.round(p * 100)).padStart(3, '0')}`;
      await page.screenshot({path: path.join(outDir, `${name}.png`)});
      const state = await inspect(page);
      state.underMarker = await underMarker(page);
      report.screens[name] = state;
      if (state.overlaps.length) fail(`${name}: overlaps ${state.overlaps.join(', ')}`);
      if (state.underMarker.length) fail(`${name}: the label of the current quarter covers ${state.underMarker.join(', ')}`);
      for (const [what, share] of Object.entries(state.onScene)) if (share > 1) fail(`${name}: ${what} lies on the scene (${share}% of its box)`);
    }
    await sweepMarker(page, `${lang}-390`);
    if (lang === 'ru') {
      for (const id of SECTIONS) {
        await toSection(page, id);
        await page.waitForTimeout(500);
        await page.screenshot({path: path.join(outDir, `ru-390-${id}.png`)});
      }
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) fail(`390 ${lang}: horizontal overflow ${overflow}px`);
    if (errors.length) fail(`390 ${lang}: ${errors.join(' | ')}`);
    await context.close();
  }

  // Scroll smoothness: wheel through the first screen and back, measure the intervals between animation frames.
  for (const [name, viewport, wheel] of [['desktop', {width: 1920, height: 1080}, 90], ['phone', {width: 390, height: 844}, 70]]) {
    const context = await browser.newContext({viewport, deviceScaleFactor: name === 'phone' ? 3 : 1, isMobile: name === 'phone', hasTouch: name === 'phone'});
    const page = await context.newPage();
    await page.goto(`${base}?lang=ru`);
    await ready(page);
    await page.evaluate(() => {
      window.__gaps = [];
      window.__frames = new Set();
      let last = performance.now();
      const ctx = CanvasRenderingContext2D.prototype;
      const original = ctx.drawImage;
      ctx.drawImage = function (img, ...rest) {
        window.__frames.add(img.src);
        return original.call(this, img, ...rest);
      };
      const loop = (now) => {
        window.__gaps.push(now - last);
        last = now;
        window.__raf = requestAnimationFrame(loop);
      };
      window.__raf = requestAnimationFrame(loop);
    });
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    const span = await page.evaluate(() => document.querySelector('[data-hero]').offsetHeight - document.querySelector('.hero-pin').clientHeight);
    const steps = Math.ceil(span / wheel);
    for (let i = 0; i < steps; i += 1) {
      await page.mouse.wheel(0, wheel);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(500);
    for (let i = 0; i < steps + 4; i += 1) {
      await page.mouse.wheel(0, -wheel);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      cancelAnimationFrame(window.__raf);
      const gaps = window.__gaps.slice(5).sort((a, b) => a - b);
      const at = (q) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * q))];
      return {
        frames: gaps.length,
        medianMs: Number(at(0.5).toFixed(1)),
        p95Ms: Number(at(0.95).toFixed(1)),
        maxMs: Number(gaps[gaps.length - 1].toFixed(1)),
        over34ms: gaps.filter((g) => g > 34).length,
        distinctFramesDrawn: window.__frames.size,
        backAtStart: scrollY === 0,
      };
    });
    report[`scroll-${name}`] = result;
    if (!result.backAtStart) fail(`${name}: did not return to the top`);
    await context.close();
  }

  // Fallback: frames blocked, the video takes over; video blocked too, the poster stays.
  for (const [name, patterns] of [['video', ['**/frames/**']], ['poster', ['**/frames/**', '**/*.mp4']]]) {
    const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
    const page = await context.newPage();
    for (const pattern of patterns) await page.route(pattern, (route) => route.abort());
    await page.goto(`${base}?lang=ru`);
    await page.waitForTimeout(2500);
    const state = await page.evaluate(() => {
      const video = document.querySelector('[data-fallback]');
      return {fallbackShown: !video.hidden, playing: !video.paused && video.readyState >= 2, posterVisible: getComputedStyle(document.querySelector('[data-poster]')).visibility === 'visible'};
    });
    report[`fallback-${name}`] = state;
    if (!state.fallbackShown) fail(`fallback ${name}: video element was not shown`);
    if (name === 'video' && !state.playing) fail('fallback video does not play');
    await page.screenshot({path: path.join(outDir, `fallback-${name}.png`)});
    await context.close();
  }

  // The Russian text in the markup is the same as in the dictionary, so the page reads the same without scripts.
  {
    const context = await browser.newContext({javaScriptEnabled: false});
    const page = await context.newPage();
    await page.goto(base);
    const marked = await page.evaluate(() => [...document.querySelectorAll('[data-i18n], [data-i18n-html]')].map((el) => [el.dataset.i18n || el.dataset.i18nHtml, el.dataset.i18n ? el.textContent : el.innerHTML]));
    const clean = (s) => s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const differ = marked.filter(([key, text]) => texts.ru[key] === undefined || clean(texts.ru[key]) !== clean(text)).map(([key]) => key);
    const missing = Object.keys(texts.ru).filter((key) => !(key in texts.en));
    if (differ.length) fail(`markup differs from the dictionary: ${[...new Set(differ)].join(', ')}`);
    if (missing.length) fail(`no English for: ${missing.join(', ')}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.kill();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({problems: report.problems, scrollDesktop: report['scroll-desktop'], scrollPhone: report['scroll-phone']}, null, 2));
process.exit(report.problems.length ? 1 : 0);
