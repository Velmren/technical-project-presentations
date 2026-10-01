// Plays every combination of operation options for every contract through the
// game actions (no browser), with the module each contract calls for, and
// checks that accept, launch, each decision and settlement succeed.
//
//   node tools/check-paths.mjs
import {createStore} from '../src/state.js';
import {createGame} from '../src/game.js';
import {operationSteps} from '../src/rules.js';

const PLANS = {
  nacre: {install: 'grapple'},
  tallow: {install: 'cutter'},
  beacon: {install: 'cutter'},
  brine: {install: 'arc', prepare: (s) => { s.reactor = 'core96'; }},
  seraph: {install: 'grapple', prepare: (s) => { s.contracts.seraph = 'available'; }},
};

let total = 0, passed = 0;
for (const [id, plan] of Object.entries(PLANS)) {
  const combos = operationSteps(id).reduce((paths, step) => paths.flatMap(path => step.options.map(option => [...path, option.id])), [[]]);
  for (const combo of combos) {
    total++;
    const store = createStore();
    const game = createGame(store);
    if (plan.prepare) store.update(plan.prepare);
    if (store.get().installed !== plan.install) game.install(plan.install);
    const results = [game.accept(id), game.launch(), ...combo.map(option => game.choose(option)), game.finish()];
    if (results.every(r => r.ok)) passed++;
    else console.log(`FAIL  ${id}: ${combo.join(' / ')}`);
  }
}
console.log(`${passed}/${total} operation paths complete.`);
process.exit(passed === total ? 0 : 1);
