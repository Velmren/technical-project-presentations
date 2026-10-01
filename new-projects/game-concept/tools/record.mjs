// Records the whole loop as a real browser session (no edited frames):
// title screen -> contract map -> accept -> drydock -> bench (blocked preview,
// install) -> launch shot -> four operation decisions -> docking shot and
// results -> client reply -> hold
// (strip and sell) -> sector with the new contract -> language switch ->
// settings. The input sequence below is exactly what is performed.
//
//   node tools/record.mjs --out <file.webm> [--width 1440 --height 900] [--mobile]
//   node tools/record.mjs --dry-run [--mobile]   (software WebGL, no video: checks the sequence)
import fs from 'node:fs';
import path from 'node:path';
import {launch, startServer, waitForReady} from './lib/browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[i + 1] === undefined || all[i + 1].startsWith('--') ? true : all[i + 1]]] : pairs, []));
const mobile = Boolean(args.mobile), dryRun = Boolean(args['dry-run']);
const width = Number(args.width || (mobile ? 390 : 1440)), height = Number(args.height || (mobile ? 844 : 900));
const outFile = path.resolve(args.out || 'lacuna-flow.webm');
// A folder per run, so a video left by an interrupted run is never picked up.
const videoDir = path.join(path.dirname(outFile), `.video-tmp-${process.pid}`);

const server = await startServer(Number(args.port || 4355));
const browser = await launch({gpu: !dryRun});
const context = await browser.newContext({viewport: {width, height}, locale: 'ru-RU', isMobile: mobile, hasTouch: mobile, ...(dryRun ? {} : {recordVideo: {dir: videoDir, size: {width, height}}})});
const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const press = async (selector) => { if (mobile) await page.tap(selector); else await page.click(selector); };
const settled = () => page.waitForFunction(() => !document.querySelector('[data-action="op-execute"].is-busy'), null, {timeout: 15000});

async function drag(x, y, dx, dy = 0, steps = 40) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, {steps});
  await page.mouse.up();
}

async function decide(optionId, look = 1200) {
  await press(`.option-card[data-id="${optionId}"]`);
  await wait(look);
  await press('[data-action="op-execute"]');
  await settled();
  await wait(900);
}

await page.goto(`${server.url}#sector`);
// A fresh game; a dry run pins the low tier so software WebGL keeps up.
await page.evaluate((low) => { localStorage.clear(); if (low) localStorage.setItem('lacuna-v5', JSON.stringify({version: 5, prefs: {quality: 'low'}})); }, dryRun);
await page.reload();
await waitForReady(page);
await page.waitForSelector('#intro [data-action="start"]:not([disabled])', {timeout: 30000});
await wait(2600);

// Title screen, then the contract map: a job the vessel cannot do, then the one it can.
await press('#intro [data-action="start"]');
await wait(2400);
const contract = (id) => mobile ? `.contract-row[data-id="${id}"]` : `.map-marker[data-id="${id}"]`;
if (!mobile) await drag(700, 450, 140, 20);
await wait(900);
await press(contract('brine'));
await wait(1600);
if (mobile) { await press('[data-action="close-detail"]'); await wait(700); }
await press(contract('nacre'));
await wait(1600);
await press('[data-action="accept"]');
await wait(1500);
await press('.screen-sector [data-action="go-dock"]');
await wait(2200);

// Drydock and bench.
if (!mobile) { await drag(620, 420, -220, 10); await wait(1200); await press('[data-action="reset-view"]'); await wait(1200); }
await press('.dock-contract [data-action="fit"]');
await wait(3000);
if (!mobile) { await drag(420, 420, 260, 0); await wait(1300); }
await press('.module-card[data-id="arc"]');
await wait(2600);
await press('.module-card[data-id="grapple"]');
await wait(2600);
await press('[data-action="install"]');
await wait(2600);
await press('.bench-intro [data-action="go-dock"]');
await wait(2400);

// Operation: four decisions with their costs in view.
await press('.dock-contract [data-action="launch"]');
await wait(3400);
await decide('around');
await decide('winch');
await decide('nose');
await decide('standard');
await wait(1200);
await press('[data-action="op-finish"]');
await wait(4200);
if (mobile) { await page.mouse.wheel(0, 700); await wait(1200); }

// Client reply with a consequence.
await press('a[href="#/comms/haldenAfter"]');
await wait(2200);
await press('[data-action="reply-select"][data-id="hatch"]');
await wait(1000);
await press('[data-action="reply-send"]');
await wait(2400);
if (mobile) { await press('[data-action="comms-close"]'); await wait(800); }

// Hold: strip the rack, sell the boards.
await press('[data-nav="hold"]');
await wait(1800);
await press('.item-card[data-id="avionics"]');
await wait(1400);
await press('[data-action="strip"]');
await wait(1600);
// Stripping leaves the parts selected; on a phone their sheet is already open.
if (!mobile) { await press('.item-card[data-id="boards"]'); await wait(1200); }
await press('[data-action="sell"][data-focus-key="sell-all"]');
await wait(1800);

// The map now shows the contract the reply opened; then English and settings.
// On a phone the language switch lives in settings rather than the top bar.
await press('[data-nav="sector"]');
await wait(2600);
if (mobile) {
  await press('[data-nav="settings"]');
  await wait(1600);
  await press('[data-setting="lang"][data-value="en"]');
  await wait(2200);
} else {
  await press('.topbar [data-lang="en"]');
  await wait(1800);
  await press('[data-nav="settings"]');
  await wait(2200);
}
await press('[data-nav="sector"]');
await wait(2000);

await context.close();
await browser.close();
server.stop();
if (dryRun) { console.log('Sequence completed (dry run, nothing recorded).'); process.exit(0); }
fs.renameSync(await page.video().path(), outFile);
fs.rmSync(videoDir, {recursive: true, force: true});
console.log(`Recorded ${outFile}`);
