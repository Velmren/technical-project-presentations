// Checks the page in a real browser and captures screenshots:
//   node tools/verify.mjs [output dir]
// Desktop sizes at several scroll positions, a phone, the English version, the fallback when frames
// are unavailable, scroll smoothness (frame intervals during a scripted scroll) and the transferred weight.
// Playwright is a development-only dependency: install `playwright` locally or point PLAYWRIGHT_CORE
// at an existing playwright-core directory.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'verify-output'));
const port = Number(process.env.PORT || 4362);
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

const scrollTo = (page, p) => page.evaluate((v) => {
  const hero = document.querySelector('[data-hero]');
  scrollTo({top: (hero.offsetHeight - innerHeight) * v, behavior: 'instant'});
}, p);

async function ready(page) {
  await page.waitForFunction(() => document.querySelector('.stage').classList.contains('live'), null, {timeout: 30000});
  await page.waitForFunction(() => document.querySelector('[data-note]').textContent.indexOf('%') < 0, null, {timeout: 60000});
  await page.waitForTimeout(1600);
}

// Everything the page has loaded so far, from the browser's own resource timing.
const weight = (page) => page.evaluate(() => {
  const entries = [performance.getEntriesByType('navigation')[0], ...performance.getEntriesByType('resource')];
  const sum = (list) => Number((list.reduce((s, e) => s + e.encodedBodySize, 0) / 1e6).toFixed(2));
  return {requests: entries.length, megabytes: sum(entries), framesMegabytes: sum(entries.filter((e) => e.name.includes('/frames/')))};
});

const report = {checked: new Date().toISOString(), sizes: {}, problems: []};
const fail = (text) => report.problems.push(text);

fs.mkdirSync(outDir, {recursive: true});
const server = await startServer();
const {chromium} = await loadPlaywright();
const browser = await chromium.launch({headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']});

try {
  // Desktop sizes: first frame, three scroll positions, the content below.
  for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 768]]) {
    const context = await browser.newContext({viewport: {width: w, height: h}, deviceScaleFactor: 1, locale: 'ru-RU'});
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?lang=ru`);
    await ready(page);
    for (const p of [0, 0.25, 0.5, 1]) {
      await scrollTo(page, p);
      await page.waitForTimeout(900);
      await page.screenshot({path: path.join(outDir, `d${w}-p${String(Math.round(p * 100)).padStart(3, '0')}.png`)});
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) fail(`${w}: horizontal overflow ${overflow}px`);
    const state = await page.evaluate(() => ({
      stage: document.querySelector('[data-stage]').textContent,
      title: document.querySelector('h1').getBoundingClientRect().toJSON(),
      canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height],
    }));
    if (w === 1920) {
      await page.evaluate(() => document.querySelector('#about').scrollIntoView({behavior: 'instant'}));
      await page.waitForTimeout(500);
      await page.screenshot({path: path.join(outDir, 'd1920-about.png')});
      await page.evaluate(() => document.querySelector('#homes').scrollIntoView({behavior: 'instant'}));
      await page.waitForTimeout(700);
      await page.screenshot({path: path.join(outDir, 'd1920-homes.png')});
      await page.evaluate(() => document.querySelector('#quay').scrollIntoView({behavior: 'instant'}));
      await page.waitForTimeout(700);
      await page.screenshot({path: path.join(outDir, 'd1920-quay.png')});
      await page.evaluate(() => document.querySelector('#visit').scrollIntoView({behavior: 'instant'}));
      await page.waitForTimeout(500);
      await page.screenshot({path: path.join(outDir, 'd1920-visit.png')});
    }
    report.sizes[w] = {...(await weight(page)), lastStage: state.stage, canvas: state.canvas};
    if (errors.length) fail(`${w}: ${errors.join(' | ')}`);
    await context.close();
  }

  // Scroll smoothness: wheel through the hero and back, measure the intervals between animation frames.
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
    const span = await page.evaluate(() => document.querySelector('[data-hero]').offsetHeight - innerHeight);
    const steps = Math.ceil(span / wheel);
    for (let i = 0; i < steps; i += 1) {
      await page.mouse.wheel(0, wheel);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(500);
    for (let i = 0; i < steps; i += 1) {
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

  // Phone, Russian and English.
  {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?lang=ru`);
    await ready(page);
    for (const p of [0, 0.5, 1]) {
      await scrollTo(page, p);
      await page.waitForTimeout(900);
      await page.screenshot({path: path.join(outDir, `m390-p${String(Math.round(p * 100)).padStart(3, '0')}.png`)});
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) fail(`390: horizontal overflow ${overflow}px`);
    await page.evaluate(() => document.querySelector('#homes').scrollIntoView({behavior: 'instant'}));
    await page.waitForTimeout(700);
    await page.screenshot({path: path.join(outDir, 'm390-homes.png')});
    report.sizes[390] = await weight(page);
    await page.goto(`${base}?lang=en`);
    await ready(page);
    await scrollTo(page, 1);
    await page.waitForTimeout(900);
    await page.screenshot({path: path.join(outDir, 'm390-en-p100.png')});
    if (errors.length) fail(`390: ${errors.join(' | ')}`);
    await context.close();
  }

  // English desktop.
  {
    const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
    const page = await context.newPage();
    await page.goto(`${base}?lang=en`);
    await ready(page);
    await scrollTo(page, 1);
    await page.waitForTimeout(900);
    await page.screenshot({path: path.join(outDir, 'd1920-en-p100.png')});
    const lang = await page.evaluate(() => document.documentElement.lang);
    if (lang !== 'en') fail('English version did not switch the document language');
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
} finally {
  await browser.close();
  server.kill();
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.problems.length ? 1 : 0);
