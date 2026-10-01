import {contractById} from '../data/contracts.js';
import {CAPABILITY_UNITS, MODULE_ORDER, MODULES} from '../data/equipment.js';
import {capability, dryMass, fitsReactor, powerDraw, powerReserve, reactorOutput} from '../rules.js';
import {number, t, unit} from '../i18n.js';
import {icon} from '../ui/art.js';
import {modulePicture} from './shared.js';

// Hardpoint bench: preview a module on the turntable, see what it does for the
// active contract and to the vessel, then install it (cancellable coupling).

function card(id, index, state, ui) {
  const module = MODULES[id];
  const chip = id === state.installed
    ? `<span class="chip chip-ok">${icon('check')}${t('bench.installed')}</span>`
    : fitsReactor(id, state) ? `<span class="chip">${icon('cargo')}${t('bench.stored')}</span>`
      : `<span class="chip chip-blocked">${icon('lock')}${t('bench.tooMuch', {n: powerDraw(id)})}</span>`;
  return `
    <button type="button" class="module-card" data-action="select-module" data-id="${id}" data-focus-key="card-${id}" aria-pressed="${id === ui.selected}">
      <span class="art">${modulePicture(id, ui.modulePictures)}</span>
      <span class="name">${module.name}</span>
      <kbd aria-hidden="true">${index + 1}</kbd>
      <span class="type">${t(`modules.types.${module.type}`)}</span>
      ${chip}
    </button>`;
}

function contractFit(state, id) {
  const contract = contractById(state.active);
  if (!contract) return `<div class="fit-box">${icon('route')}<b>${t('bench.noContract')}</b></div>`;
  const title = t('bench.forContract', {contract: contract.name});
  if (!contract.requires.length) return `<div class="fit-box is-met">${icon('check')}<b>${title}</b><p>${t('bench.noRequirement')}</p></div>`;
  const requirement = contract.requires[0];
  const value = capability(id, requirement.capability);
  if (value >= requirement.min) {
    const message = t('bench.suits', {capability: t(`modules.capabilities.${requirement.capability}`).toLowerCase(), value: number(value), unit: unit(CAPABILITY_UNITS[requirement.capability])});
    return `<div class="fit-box is-met">${icon('check')}<b>${title}</b><p>${message}</p></div>`;
  }
  const needed = t(`requirement.${requirement.capability}`, {min: number(requirement.min)}).toLowerCase();
  return `<div class="fit-box is-unmet">${icon('block')}<b>${title}</b><p>${t('bench.unsuited', {requirement: needed})}</p></div>`;
}

function impactRow(label, now, after, unitName, digits, lowerIsBetter) {
  const same = now === after;
  let tone = '';
  if (!same) tone = (after < now) === lowerIsBetter ? 'better' : 'worse';
  if (unitName === 'kW' && after < 0) tone = 'fail';
  const cell = (v) => `${number(v, digits)}<span class="unit">${unit(unitName)}</span>`;
  return `<tr><td>${label}</td><td>${cell(now)}</td><td class="${tone}">${cell(after)}</td></tr>`;
}

function footer(state, ui) {
  const id = ui.selected;
  if (ui.installing) {
    return `<button type="button" class="btn btn-primary btn-block is-busy" data-action="install" data-focus-key="install" aria-label="${t('bench.cancel')}"><span>${t('bench.installing')}</span>${icon('close')}</button>
      <p class="note">${t('bench.cancelNote')}</p>`;
  }
  if (state.operation) return `<a class="btn btn-secondary btn-block" href="#/operation" data-focus-key="install"><span>${t('sector.inFlight')}</span></a>`;
  if (id === state.installed) {
    return `<button type="button" class="btn btn-secondary btn-block" data-action="go-dock" data-focus-key="install"><span>${t('bench.current')}</span></button>
      <p class="note">${t('bench.seated')}</p>`;
  }
  if (!fitsReactor(id, state)) {
    return `<button type="button" class="btn btn-primary btn-block" disabled data-focus-key="install" aria-describedby="install-note"><span>${t('bench.blocked')}</span>${icon('lock')}</button>
      <p class="note is-blocked" id="install-note">${t('bench.blockedNote', {need: powerDraw(id), have: reactorOutput(state)})}</p>`;
  }
  return `<button type="button" class="btn btn-primary btn-block" data-action="install" data-focus-key="install"><span>${t('bench.install')}</span></button>
    <p class="note">${t('bench.fromHold')}</p>`;
}

export function renderBench(state, ui) {
  const module = MODULES[ui.selected];
  const from = state.installed, to = ui.selected;
  return `
    <div class="bench-intro">
      <button type="button" class="back-link" data-action="go-dock" data-focus-key="back">${t('bench.back')}</button>
      <h1 class="title" id="bench-title" tabindex="-1">${t('bench.title')}</h1>
      <p class="lead">${t('bench.lead')}</p>
    </div>
    <div class="view-controls">
      <button type="button" class="icon-button" data-action="rotate" data-dx="-0.6" data-focus-key="turn-l" aria-label="${t('bench.turnLeft')}" title="${t('bench.turnLeft')}">${icon('left')}</button>
      <button type="button" class="icon-button" data-action="rotate" data-dx="0.6" data-focus-key="turn-r" aria-label="${t('bench.turnRight')}" title="${t('bench.turnRight')}">${icon('right')}</button>
    </div>
    <section class="bench-tray" aria-labelledby="tray-title">
      <header><h2 class="h3" id="tray-title">${t('bench.hold')}</h2></header>
      <div class="module-cards" role="group" aria-labelledby="tray-title">${MODULE_ORDER.map((id, i) => card(id, i, state, ui)).join('')}</div>
    </section>
    <aside class="rail panel" aria-labelledby="module-title">
      <div class="rail-scroll ${ui.animateDetail ? 'swap' : ''}">
        <header class="contract-title">
          <span class="kind">${t(`modules.types.${module.type}`)}</span>
          <h2 class="h2" id="module-title">${module.name}</h2>
        </header>
        <p class="lead">${t(`modules.describe.${module.id}`)}</p>
        ${contractFit(state, to)}
        <section class="section">
          <h3 class="h3">${t('bench.capability')}</h3>
          ${Object.entries(module.capabilities).map(([key, value]) => `
            <div class="kv"><span class="label">${t(`modules.capabilities.${key}`)}</span><span class="data-sm">${number(value, value % 1 ? 1 : 0)}<span class="unit">${unit(CAPABILITY_UNITS[key])}</span></span></div>`).join('')}
        </section>
        <section class="section">
          <h3 class="h3">${t('bench.impact')}</h3>
          <table class="impact">
            <thead><tr><th scope="col"><span class="visually-hidden">${t('bench.impact')}</span></th><th scope="col">${t('bench.now')}</th><th scope="col">${t('bench.after')}</th></tr></thead>
            <tbody>
              ${impactRow(t('bench.reserve'), powerReserve(from, state), powerReserve(to, state), 'kW', 0, false)}
              ${impactRow(t('bench.mass'), dryMass(from), dryMass(to), 't', 1, true)}
              ${impactRow(t('bench.heat'), MODULES[from].heat, MODULES[to].heat, 'pct', 0, true)}
            </tbody>
          </table>
        </section>
      </div>
      <div class="rail-foot">${footer(state, ui)}</div>
    </aside>`;
}
