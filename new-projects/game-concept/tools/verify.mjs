// End-to-end verification in Chromium. It starts a new game from the title
// screen and plays the whole loop through the interface (contract map, refit,
// launch, operation with decisions, docking and settlement, client reply,
// hold, log), then the side paths: blocked and confirm states, hints, the
// goal line, keyboard, language switching with preserved state, persistence,
// settings, reduced motion, abort, WebGL context loss and restore, and
// layouts at 1440/1280/1024/390 px.
//
//   node tools/verify.mjs --out <folder> [--port 4354] [--software] [--thumbnail]
//   node tools/verify.mjs --perf --out <folder>   (renderer figures and thumbnail only)
//
// --software runs WebGL on the CPU (SwiftShader) at the low tier: flows and
// layouts are checked, frame timings and the renderer tier are skipped, and
// the catalogue thumbnail is only rewritten with --thumbnail.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launch, PROJECT_ROOT, startServer, waitForReady} from './lib/browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[i + 1] === undefined || all[i + 1].startsWith('--') ? true : all[i + 1]]] : pairs, []));
const software = Boolean(args.software);
const out = path.resolve(args.out || path.join(os.tmpdir(), 'lacuna-verify'));
fs.mkdirSync(out, {recursive: true});
const results = [];
const check = (name, ok, detail = '') => { results.push({name, ok: Boolean(ok), detail}); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('lacuna-v5') || 'null'));
// Locale formatting uses no-break spaces; compare text with plain spaces.
const text = async (page, selector) => (await page.locator(selector).first().innerText()).replace(/\s+/g, ' ');
const screen = (page) => page.evaluate(() => document.body.dataset.screen);
const pause = (page, ms) => page.waitForTimeout(software ? ms * 1.6 : ms);
const shot = (page, name, options = {}) => page.screenshot({path: path.join(out, `${name}.png`), ...options});
// Shots can end within one slow software frame, so their start is recorded as it happens.
const watchCuts = (page) => page.evaluate(() => {
  window.cuts = [];
  new MutationObserver(() => { if (document.body.dataset.cut) window.cuts.push(document.body.dataset.cut); }).observe(document.body, {attributes: true, attributeFilter: ['data-cut']});
});
const sawCut = (page, type) => page.evaluate((t) => window.cuts.includes(t), type);
const onScreen = (page, name) => page.waitForFunction((n) => document.body.dataset.screen === n && !document.body.dataset.cut, name, {timeout: 20000}).then(() => true, () => false);

const server = await startServer(Number(args.port || 4354));
const browser = await launch({gpu: !software});

// A fresh game. By default it skips the title screen; {intro: true} keeps it.
// In software mode the renderer is pinned to the low tier.
async function open(viewport, {hash = 'sector', lang = 'ru', mobile = false, fresh = true, scale = 1, intro = false} = {}) {
  const context = await browser.newContext({viewport, deviceScaleFactor: scale, locale: lang === 'ru' ? 'ru-RU' : 'en-GB', isMobile: mobile, hasTouch: mobile});
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(`${server.url}#${hash}`);
  if (fresh) {
    await page.evaluate(({low, started}) => {
      localStorage.clear();
      localStorage.setItem('lacuna-v5', JSON.stringify({version: 5, started, prefs: low ? {quality: 'low'} : {}}));
    }, {low: software, started: !intro});
    await page.reload();
  }
  await waitForReady(page);
  await pause(page, 1200);
  return page;
}

// Plays the current operation step with the given option.
async function decide(page, optionId) {
  await page.click(`.option-card[data-id="${optionId}"]`);
  await page.click('[data-action="op-execute"]');
  await page.waitForFunction((id) => !document.querySelector('[data-action="op-execute"].is-busy') && !document.querySelector(`.option-card[data-id="${id}"]`), optionId, {timeout: 20000});
  await pause(page, 300);
}

async function noOverflow(page, label) {
  const {scroll, client} = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth}));
  check(`${label}: no horizontal overflow`, scroll <= client, `${scroll} / ${client}`);
}

const boxesOverlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function frameTiming(page) {
  await page.locator('#viewport').focus();
  return page.evaluate(async () => {
    const times = [];
    let last = performance.now();
    const keys = setInterval(() => document.getElementById('viewport').dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true})), 60);
    await new Promise(resolve => {
      const tick = (now) => { times.push(now - last); last = now; if (times.length < 150) requestAnimationFrame(tick); else resolve(); };
      requestAnimationFrame(tick);
    });
    clearInterval(keys);
    const sorted = times.slice(10).sort((a, b) => a - b);
    return {median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * 0.95)], diagnostics: window.lacunaDiagnostics?.()};
  });
}
const timing = (page) => software ? null : frameTiming(page);

// ---- Renderer figures only (--perf): a short GPU run -----------------------------------
// Frame timing while orbiting each world, then the thumbnail. Kept short so it
// does not hold the graphics card under load for long.
if (args.perf) {
  const page = await open({width: 1440, height: 900});
  const figures = {sector: await frameTiming(page)};
  await page.goto(`${server.url}#vessel`);
  await pause(page, 1800);
  figures.dock = await frameTiming(page);
  await page.goto(`${server.url}#vessel/bench`);
  await pause(page, 2400);
  figures.bench = await frameTiming(page);
  // An operation in progress, prepared through the game's own actions.
  await page.evaluate(async () => {
    const [{createStore}, {createGame}] = await Promise.all([import('/src/state.js'), import('/src/game.js')]);
    const game = createGame(createStore());
    game.accept('nacre');
    game.install('grapple');
    game.launch();
  });
  await page.goto(`${server.url}#operation`);
  await page.reload();
  await waitForReady(page);
  await pause(page, 2400);
  figures.operation = await frameTiming(page);
  for (const [view, f] of Object.entries(figures)) check(`${view}: frame timing measured`, f.median > 0, `median ${f.median.toFixed(1)} ms, p95 ${f.p95.toFixed(1)} ms, ${f.diagnostics?.quality}, ${f.diagnostics?.drawCalls} calls, ${Math.round(f.diagnostics?.triangles / 1000)} k tris`);
  check('No script errors during the timing run', page.errors.length === 0, page.errors.slice(0, 2).join(' | '));
  fs.writeFileSync(path.join(out, 'renderer.json'), JSON.stringify(figures, null, 2));
  await page.context().close();
}

// ---- Desktop: the whole loop --------------------------------------------------------
if (!args.perf) {
  const page = await open({width: 1440, height: 900}, {intro: true});

  // Title screen: who, goal, how, one way in.
  check('A new game opens on the title screen', await page.locator('#intro:not([hidden])').count() === 1 && (await text(page, '#intro')).includes('50 000'));
  await page.waitForSelector('#intro [data-action="start"]:not([disabled])', {timeout: 20000});
  await shot(page, '01-intro-1440-ru');
  await page.click('#intro [data-action="start"]');
  await pause(page, 900);
  const started = await saved(page);
  check('Starting the shift opens the sector with the goal and the next step', started.started && await screen(page) === 'sector' && await page.locator('#objective:not([hidden])').count() === 1 && (await text(page, '#goal')).includes('50 000'));

  // The map is the list: every contract is a marker with name and pay.
  check('Four contracts on the map, each with name and pay', await page.locator('.map-marker[data-id]').count() === 4 && (await text(page, '.map-marker[data-id="nacre"]')).includes('14 500'));
  const tabOrder = await page.evaluate(() => {
    const first = document.querySelector('.map-marker[data-id]');
    first.focus();
    const nav = document.querySelector('.primary-nav a');
    return Boolean(first.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_PRECEDING) && first.tabIndex === 0;
  });
  await page.keyboard.press('Tab');
  const tabbed = await page.evaluate(() => document.activeElement?.classList.contains('map-marker'));
  check('Tab walks the contract markers after the top bar', tabOrder && tabbed);
  check('The chosen marker is tied to its card by a leader line', await page.locator('.map-marker[data-id="nacre"][aria-pressed="true"]').count() === 1 && await page.locator('.leader:not(.is-hidden)').count() === 1);
  check('NACRE–9 says which module it needs', (await text(page, '.contract-card .readiness')).includes('LATCH G–2'));
  check('A first-job hint points at the next control', await page.locator('#hint:not([hidden])').count() === 1 && (await text(page, '#hint')).length > 20);
  await shot(page, '02-sector-1440-ru');
  const sectorFrames = await timing(page);

  await page.click('.map-marker[data-id="brine"]');
  await pause(page, 300);
  check('BRINE HOLLOW cannot be accepted and says why', await page.locator('.screen-sector .rail-foot button[disabled]').count() === 1 && (await text(page, '#accept-note')).includes('92'));

  await page.click('.map-marker[data-id="nacre"]');
  await page.click('[data-action="accept"]');
  await pause(page, 300);
  const accepted = await saved(page);
  check('Accepting NACRE–9 makes it active and confirms', accepted.active === 'nacre' && (await text(page, '#toast')).includes('NACRE'));
  check('The client briefing arrives in comms', accepted.inbox.some(m => m.id === 'haldenBrief') && await page.locator('#unread:not([hidden])').count() === 1);
  check('The next step now names the module to fit', (await text(page, '#objective')).includes('LATCH G–2'));

  await page.click('.map-marker[data-id="tallow"]');
  await page.click('[data-action="accept"]');
  check('Switching contracts asks first', await page.locator('#confirm[open]').count() === 1);
  await page.click('#confirm [value="cancel"]');
  await pause(page, 250);
  check('Keeping the active contract leaves it unchanged', (await saved(page)).active === 'nacre');
  await page.click('[data-action="accept"]');
  await page.click('#confirm [value="confirm"]');
  await pause(page, 250);
  check('Confirming the switch activates the new contract', (await saved(page)).active === 'tallow');
  await page.click('.map-marker[data-id="nacre"]');
  await page.click('[data-action="accept"]');
  await page.click('#confirm [value="confirm"]');
  await pause(page, 200);

  await page.click('.screen-sector [data-action="go-dock"]');
  await pause(page, 1600);
  check('Drydock reports the refit for the active contract', (await text(page, '.dock-contract')).includes('LATCH G–2'));
  check('Hardpoint callout is anchored on the vessel', await page.locator('.hardpoint-callout:not(.is-hidden)').count() === 1);
  await shot(page, '03-dock-refit-1440-ru');
  const dockFrames = await timing(page);

  await page.click('.dock-contract [data-action="fit"]');
  await pause(page, 2600);
  check('Fit opens the bench with LATCH G–2 previewed', await page.locator('.module-card[data-id="grapple"][aria-pressed="true"]').count() === 1);
  check('Preview shows the power reserve after refit', (await text(page, '.impact')).includes('34'));
  const benchFrames = await timing(page);

  await page.keyboard.press('3');
  await pause(page, 1600);
  check('Key 3 selects HELIOS A–9; install is blocked with the reason', await page.locator('.screen-bench .rail-foot button[disabled]').count() === 1 && (await text(page, '#install-note')).includes('92'));

  await page.keyboard.press('2');
  await pause(page, 1400);
  // Software WebGL can block the main thread past the one-second coupling, so
  // there the click and Escape are dispatched in one task; on a GPU they are real input.
  await page.evaluate(() => {
    window.sawCoupling = false;
    // Added nodes are kept in the records even if a later render removed them.
    new MutationObserver((records) => {
      if (records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches('.is-busy') || n.querySelector('.is-busy'))))) window.sawCoupling = true;
    }).observe(document.body, {subtree: true, childList: true});
  });
  if (software) {
    await page.evaluate(() => { document.querySelector('[data-action="install"]').click(); document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); });
  } else {
    await page.click('[data-action="install"]');
    await pause(page, 200);
    await page.keyboard.press('Escape');
  }
  await pause(page, 300);
  check('Install starts a visible coupling state', await page.evaluate(() => window.sawCoupling));
  check('Escape cancels coupling without changing equipment', (await saved(page)).installed === 'cutter' && (await text(page, '#toast')).includes('отменена'));
  await page.click('[data-action="install"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('lacuna-v5')).installed === 'grapple', null, {timeout: 8000}).catch(() => {});
  check('Completed coupling installs LATCH G–2', (await saved(page)).installed === 'grapple');

  await page.click('.bench-intro [data-action="go-dock"]');
  await pause(page, 1800);
  check('Drydock now reports the vessel ready', (await text(page, '.dock-contract')).includes('Готов к вылету'));
  check('Dry mass follows the installed module', (await text(page, '.dock-stats')).includes('15,4'));
  await page.keyboard.press('b');
  await pause(page, 900);
  const viaKey = await screen(page);
  await page.keyboard.press('Escape');
  await pause(page, 900);
  check('B opens the bench and Escape returns to the drydock', viaKey === 'bench' && await screen(page) === 'dock');

  // Launch shot, then the operation.
  await watchCuts(page);
  await page.click('.dock-contract [data-action="launch"]');
  const landed = await onScreen(page, 'operation');
  check('Launching plays the departure shot and lands on the operation', await sawCut(page, 'launch') && landed);
  await pause(page, 1200);
  check('The operation shows the target frame, the vessel frame and two options', await page.locator('.target-frame').count() === 1 && await page.locator('.player-frame').count() === 1 && await page.locator('.option-card').count() === 2);
  check('Execute stays disabled until an option is chosen', await page.locator('[data-action="op-execute"][disabled]').count() === 1);
  await page.keyboard.press('1');
  await pause(page, 300);
  check('Choosing the direct route previews its hull cost on the vessel frame', await page.locator('.option-card[data-id="direct"][aria-pressed="true"]').count() === 1 && await page.locator('.player-frame .ghost').count() >= 1);
  await page.keyboard.press('2');
  await pause(page, 200);
  check('Key 2 selects the second option', await page.locator('.option-card[data-id="around"][aria-pressed="true"]').count() === 1);
  await shot(page, '05-op-approach-1440-ru');
  const opFrames = await timing(page);
  await page.click('[data-action="op-execute"]');
  await pause(page, 300);
  check('Executing shows a busy state and locks the options', await page.locator('[data-action="op-execute"].is-busy').count() === 1 && await page.locator('.option-card:not([disabled])').count() === 0);
  await page.waitForFunction(() => !document.querySelector('[data-action="op-execute"].is-busy'), null, {timeout: 20000});
  await pause(page, 400);
  const afterApproach = (await saved(page)).operation;
  check('The step is applied: fuel spent, progress advanced', afterApproach.step === 1 && afterApproach.stats.fuel === 89 && await page.locator('.step-dots .is-done').count() === 1);
  check('The client reacts over the radio', await page.locator('.radio').count() === 1);
  check('The option that needs the winch names the module that allows it', (await text(page, '.option-card[data-id="winch"]')).includes('LATCH G–2'));
  await shot(page, '06-op-stabilize-1440-ru');
  await decide(page, 'winch');
  await decide(page, 'nose');
  await decide(page, 'standard');
  check('The docking panel shows what will be settled', (await text(page, '.decision')).includes('16 500'));
  await shot(page, '07-op-docking-1440-ru');

  await page.click('[data-action="op-finish"]');
  const onResults = await onScreen(page, 'results');
  const sawDock = await sawCut(page, 'dock');
  await pause(page, 800);
  const settled = await saved(page);
  check('Docking plays its shot, settles the contract and opens results', sawDock && onResults && settled.contracts.nacre === 'completed' && settled.credits === 6200 + 16500);
  check('The goal meter moves with the pay', (await text(page, '#goal')).includes('22 700'));
  check('Results list the salvage stowed in the hold', await page.locator('.loot-list .loot').count() === 2);
  check('Document screens hide the 3D view', await page.evaluate(() => getComputedStyle(document.querySelector('.stage')).visibility === 'hidden'));
  await shot(page, '08-results-1440-ru');

  // Client reply with a consequence on the map.
  await page.click('a[href="#/comms/haldenAfter"]');
  await pause(page, 900);
  check('The client message opens with reply choices', await page.locator('[data-action="reply-select"]').count() === 3 && await page.locator('[data-action="reply-send"][disabled]').count() === 1);
  await page.keyboard.press('2');
  await page.click('[data-action="reply-send"]');
  await pause(page, 500);
  check('Replying reveals the SERAPH–2 contract', (await saved(page)).contracts.seraph === 'available' && (await text(page, '#toast')).includes('SERAPH'));

  // Hold: strip, sell, a hazard that cannot be stripped.
  await page.keyboard.press('h');
  await pause(page, 1200);
  check('The hold lists four kinds of cargo', await page.locator('.item-card').count() === 4);
  await page.click('.item-card[data-id="coolant"]');
  await pause(page, 300);
  check('Hazardous cargo cannot be stripped and says why', await page.locator('[data-action="strip"][disabled]').count() === 1);
  await page.click('.item-card[data-id="avionics"]');
  await page.click('[data-action="strip"]');
  await pause(page, 400);
  const stripped = await saved(page);
  check('Stripping the avionics rack yields boards', stripped.hold.some(e => e.id === 'boards' && e.qty === 4) && !stripped.hold.some(e => e.id === 'avionics'));
  await page.click('.item-card[data-id="boards"]');
  await page.click('[data-action="sell"][data-focus-key="sell-all"]');
  await pause(page, 400);
  check('Selling all boards credits the balance', (await saved(page)).credits === stripped.credits + 1000);

  // Log: objectives and history.
  await page.keyboard.press('l');
  await pause(page, 800);
  check('The log shows every NACRE–9 objective done', await page.locator('.goal.is-done').count() === 5);
  await page.click('[data-action="log-tab"][data-id="events"]');
  await pause(page, 300);
  check('The event history records the run', await page.locator('.events li').count() >= 12);

  await page.keyboard.press('m');
  await pause(page, 1600);
  check('The sector map now includes SERAPH–2', await page.locator('.map-marker[data-id="seraph"]').count() === 1);
  check('The hints end after the first contract', (await saved(page)).flags.tutorialDone === true && await page.locator('#hint:not([hidden])').count() === 0);

  await page.click('[data-lang="en"]');
  await pause(page, 600);
  check('English switch translates the interface', await page.evaluate(() => document.documentElement.lang) === 'en' && (await text(page, '.primary-nav')).toLowerCase().includes('vessel'));
  check('Language switch keeps screen and game state', await screen(page) === 'sector' && (await saved(page)).contracts.nacre === 'completed');
  await shot(page, '09-sector-after-1440-en');

  // Count audio contexts from here on, to prove sound never starts on its own.
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.audioContexts = [];
    window.AudioContext = class extends Native { constructor(...args) { super(...args); window.audioContexts.push(this); } };
  });
  await page.reload();
  await waitForReady(page);
  await pause(page, 800);
  const after = await saved(page);
  check('Reload keeps language and progress, without the title screen', after.prefs.lang === 'en' && after.contracts.seraph === 'available' && after.installed === 'grapple' && await page.locator('#intro[hidden]').count() === 1);

  // Settings: sound off by default with explained dependencies, reduced motion.
  await page.click('[data-nav="settings"]');
  await pause(page, 600);
  check('Settings open from the top bar', await screen(page) === 'settings');
  check('Sound is off by default and dependent switches explain why', after.prefs.sound === false && await page.locator('#set-uiSounds[disabled]').count() === 1 && (await text(page, '.settings-page')).includes('Turn sound on first'));
  await shot(page, '10-settings-1440-en');
  const silentSoFar = await page.evaluate(() => window.audioContexts.length === 0);
  await page.click('[data-setting="sound"]');
  await pause(page, 400);
  const audio = await page.evaluate(() => ({count: window.audioContexts.length, state: window.audioContexts[0]?.state}));
  check('No audio starts until sound is switched on; then it runs', silentSoFar && audio.count === 1 && audio.state === 'running' && await page.locator('#set-uiSounds:not([disabled])').count() === 1, JSON.stringify(audio));
  await page.click('[data-setting="reducedMotion"]');
  check('Reduced motion can be switched on', await page.evaluate(() => document.body.dataset.reduced) === 'true');
  await page.goto(`${server.url}#vessel/bench`);
  await pause(page, 900);
  await page.keyboard.press('1');
  await page.click('[data-action="install"]');
  await pause(page, 80);
  check('With reduced motion, installation completes immediately', (await saved(page)).installed === 'cutter');

  // Abort: the beacon job needs nothing; with reduced motion there is no launch shot.
  await page.keyboard.press('m');
  await pause(page, 900);
  await page.click('.map-marker[data-id="beacon"]');
  await page.click('[data-action="accept"]');
  await page.click('.screen-sector [data-action="go-dock"]');
  await pause(page, 900);
  await page.click('.dock-contract [data-action="launch"]');
  check('With reduced motion the launch goes straight to the operation', await onScreen(page, 'operation'));
  await pause(page, 600);
  await decide(page, 'lane');
  await page.click('[data-action="op-abort"]');
  check('Aborting asks first', await page.locator('#confirm[open]').count() === 1);
  await page.click('#confirm [value="confirm"]');
  await pause(page, 900);
  const aborted = await saved(page);
  check('Abort fails the contract and returns to the drydock', aborted.contracts.beacon === 'failed' && !aborted.operation && await screen(page) === 'dock');

  // A lost WebGL context is waited out and the scene comes back.
  await page.evaluate(() => { window.loseExt = document.getElementById('viewport').getContext('webgl2')?.getExtension('WEBGL_lose_context'); window.loseExt?.loseContext(); });
  await pause(page, 400);
  const notice = await page.locator('#gfx:not([hidden])').count() === 1;
  await page.evaluate(() => window.loseExt?.restoreContext());
  const restored = await page.waitForFunction(() => document.getElementById('gfx').hidden, null, {timeout: 15000}).then(() => true, () => false);
  await pause(page, 800);
  check('A lost WebGL context shows a notice and the scene is restored', notice && restored && await page.locator('#fallback[hidden]').count() === 1);
  await shot(page, '11-dock-after-restore-1440-en');
  check('No script errors during the desktop run', page.errors.length === 0, page.errors.slice(0, 3).join(' | '));
  if (!software) {
    check('Renderer runs at the high tier on this machine', dockFrames.diagnostics?.quality === 'high', JSON.stringify(dockFrames.diagnostics?.quality));
    fs.writeFileSync(path.join(out, 'renderer.json'), JSON.stringify({sector: sectorFrames, dock: dockFrames, bench: benchFrames, operation: opFrames}, null, 2));
  }
  await page.context().close();
}

// ---- Thumbnail and close-ups (GPU runs, or on request) ------------------------------
if (!software || args.thumbnail) {
  const page = await open({width: 1440, height: 900}, {hash: 'vessel', scale: 2});
  await page.screenshot({path: path.join(out, 'closeup-source.png')});
  const png = fs.readFileSync(path.join(out, 'closeup-source.png')).toString('base64');
  const crops = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const encode = (sx, sy, sw, sh, dw, dh, type) => { const c = document.createElement('canvas'); c.width = dw; c.height = dh; c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh); return c.toDataURL(type, 0.86).split(',')[1]; };
    return {thumbnail: encode(0, 0, 2880, 1800, 1200, 750, 'image/webp'), ship: encode(360, 380, 1600, 1000, 1600, 1000, 'image/png')};
  }, png);
  fs.writeFileSync(path.join(PROJECT_ROOT, 'thumbnail.webp'), Buffer.from(crops.thumbnail, 'base64'));
  fs.writeFileSync(path.join(out, '30-closeup-ship-2x.png'), Buffer.from(crops.ship, 'base64'));
  fs.rmSync(path.join(out, 'closeup-source.png'));
  check('Thumbnail written', fs.existsSync(path.join(PROJECT_ROOT, 'thumbnail.webp')));
  await page.context().close();
}

// ---- Laptop and tablet layouts --------------------------------------------------------
for (const [width, height] of args.perf ? [] : [[1280, 720], [1024, 768]]) {
  const page = await open({width, height}, {hash: 'sector'});
  await noOverflow(page, `${width}px sector`);
  const rail = await page.locator('.screen-sector .rail').boundingBox();
  const markers = await page.$$eval('.map-marker[data-id]:not(.is-hidden)', els => els.map(el => el.getBoundingClientRect().right));
  check(`${width}px: map markers stay clear of the contract card`, markers.length >= 3 && markers.every(right => right <= rail.x), `${markers.length} markers`);
  await shot(page, `20-sector-${width}-ru`);
  await page.click('[data-action="accept"]');
  await page.goto(`${server.url}#vessel/bench`);
  await pause(page, 2600);
  await noOverflow(page, `${width}px bench`);
  const [tray, benchRail] = await Promise.all(['.bench-tray', '.screen-bench .rail'].map(s => page.locator(s).boundingBox()));
  check(`${width}px: module tray clears the detail rail`, tray.x + tray.width <= benchRail.x);
  await page.keyboard.press('2');
  await page.click('[data-action="install"]');
  await pause(page, 1500);
  await page.goto(`${server.url}#vessel`);
  await pause(page, 1200);
  await page.click('.dock-contract [data-action="launch"]');
  await onScreen(page, 'operation');
  await pause(page, 1200);
  await noOverflow(page, `${width}px operation`);
  const [target, player, decision] = await Promise.all(['.target-frame', '.player-frame', '.decision'].map(s => page.locator(s).boundingBox()));
  check(`${width}px: target frame, vessel frame and decision do not overlap`, !boxesOverlap(target, decision) && !boxesOverlap(player, decision) && decision.x + decision.width <= width);
  await shot(page, `22-op-${width}-ru`);
  check(`${width}px: no script errors`, page.errors.length === 0, page.errors.slice(0, 2).join(' | '));
  await page.context().close();
}

// ---- Phone: its own scenario ------------------------------------------------------------
if (!args.perf) {
  const page = await open({width: 390, height: 844}, {mobile: true, intro: true});
  await page.waitForSelector('#intro [data-action="start"]:not([disabled])', {timeout: 20000});
  await noOverflow(page, '390px title screen');
  await shot(page, '40-intro-390-ru', {fullPage: true});
  await page.tap('#intro [data-action="start"]');
  await pause(page, 900);
  await noOverflow(page, '390px sector');
  check('390px: tab bar sits at the bottom', (await page.locator('.primary-nav').boundingBox()).y > 760);
  check('390px: the contract list stays under the map', await page.locator('.contract-row').count() === 4);
  await shot(page, '41-sector-390-ru');
  await page.tap('.contract-row[data-id="nacre"]');
  await pause(page, 400);
  const rail = await page.locator('.screen-sector .rail').boundingBox();
  check('390px: choosing a contract opens its detail view', rail && rail.width >= 380);
  await page.tap('[data-action="accept"]');
  await pause(page, 300);
  await page.tap('[data-action="close-detail"]');
  await page.goto(`${server.url}#vessel/bench`);
  await pause(page, 2600);
  await noOverflow(page, '390px bench');
  const bar = await page.locator('.screen-bench .rail-foot').boundingBox();
  check('390px: install action stays on screen', bar && bar.y + bar.height <= 844 && bar.y > 700);
  await page.tap('.module-card[data-id="grapple"]');
  await page.tap('[data-action="install"]');
  await pause(page, 1500);
  await page.goto(`${server.url}#vessel`);
  await pause(page, 1600);
  await noOverflow(page, '390px dock');
  await page.tap('.dock-contract [data-action="launch"]');
  await onScreen(page, 'operation');
  await pause(page, 1200);
  await noOverflow(page, '390px operation');
  await page.tap('.option-card[data-id="direct"]');
  const execute = await page.locator('.op-actions').boundingBox();
  check('390px: the execute bar is pinned to the bottom of the screen', execute && Math.abs(execute.y + execute.height - 844) < 2);
  await shot(page, '42-op-390-ru');
  for (const id of ['direct', 'winch', 'mount', 'fast']) {
    await page.tap(`.option-card[data-id="${id}"]`);
    await page.tap('[data-action="op-execute"]');
    await page.waitForFunction(() => !document.querySelector('[data-action="op-execute"].is-busy'), null, {timeout: 20000});
    await pause(page, 300);
  }
  await page.tap('[data-action="op-finish"]');
  await onScreen(page, 'results');
  await pause(page, 1000);
  await noOverflow(page, '390px results');
  check('390px: a rushed job pays without the intact bonus', (await saved(page)).lastResult?.bonus === 0);
  await page.goto(`${server.url}#hold`);
  await pause(page, 1000);
  await page.tap('.item-card >> nth=0');
  await pause(page, 400);
  const sheet = await page.locator('.screen-hold .rail').boundingBox();
  check('390px: an item opens as a full-screen sheet', sheet && sheet.width >= 380);
  await page.tap('[data-action="item-close"]');
  await page.goto(`${server.url}#settings`);
  await pause(page, 800);
  await noOverflow(page, '390px settings');
  check('390px: no script errors', page.errors.length === 0, page.errors.slice(0, 2).join(' | '));
  await page.context().close();
}

await browser.close();
server.stop();
const failedChecks = results.filter(r => !r.ok);
fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({date: new Date().toISOString(), mode: software ? 'software WebGL' : args.perf ? 'GPU, renderer figures only' : 'GPU', passed: results.length - failedChecks.length, failed: failedChecks.length, results}, null, 2));
console.log(`\n${results.length - failedChecks.length}/${results.length} checks passed (${software ? 'software WebGL' : 'GPU'}). Output: ${out}`);
process.exit(failedChecks.length ? 1 : 0);
