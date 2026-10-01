// Geometry audit of the vessel, the three modules, the bench and the bay
// fixtures (see tools/lib/geometry-audit.js). Needs no graphics card: the
// checks run on the authored geometry, not on rendered pixels.
//
//   node tools/audit-geometry.mjs [--json <file>]
// Exit code 1 when a mesh is open, a cable passes through a part, a part of
// the vessel or a module floats, or a module does not rest on both pads.
import fs from 'node:fs';
import {launch, startServer} from './lib/browser.mjs';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const server = await startServer(4357);
const browser = await launch({gpu: false});
let failed = true;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/__audit.html', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"three":"./vendor/three/three.module.min.js","three/addons/":"./vendor/three/addons/"}}</script><script type="module" src="./tools/lib/geometry-audit.js"></script>'}));
  await page.goto(server.url + '__audit.html');
  await page.waitForFunction(() => window.auditReady, null, {timeout: 30000});
  const report = await page.evaluate(() => window.runAudit());
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 1));
  const problems = [];
  for (const [name, r] of Object.entries(report)) {
    if (name === 'bench') continue;
    for (const [label, edges] of Object.entries(r.open)) problems.push(`${name}: open mesh ${label} (${edges} edges)`);
    for (const c of r.cables) problems.push(`${name}: cable ${c.cable} passes through ${c.through.join(', ')}`);
    for (const island of r.floating) problems.push(`${name}: floating ${island.join(', ')}`);
  }
  for (const b of report.bench) if (!b.ok) problems.push(`bench: ${b.kind} pad contacts ${b.contacts.join('/')}, clearance over the table ${b.clearance} m`);
  for (const e of errors) problems.push(`page error: ${e}`);
  const assemblies = Object.keys(report).filter(k => k !== 'bench');
  console.log(`assemblies ${assemblies.length}, parts ${assemblies.reduce((n, k) => n + report[k].parts, 0)}, bench ${report.bench.map(b => `${b.kind} pads ${b.contacts.join('/')} clearance ${b.clearance} m`).join(', ')}`);
  console.log(problems.length ? problems.join('\n') : 'no open meshes, no cable clashes, no floating parts, all modules seated');
  failed = problems.length > 0;
} finally {
  await browser.close();
  server.stop();
}
process.exitCode = failed ? 1 : 0;
