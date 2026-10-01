import {contractById} from '../data/contracts.js';
import {MODULES, REACTORS, VESSEL} from '../data/equipment.js';
import {dryMass, holdMass, powerDraw, powerReserve, reactorOutput, refuelCost, repairCost} from '../rules.js';
import {credits, measure, number, t} from '../i18n.js';
import {icon} from '../ui/art.js';
import {assess, checklist, modulePicture, readinessChip} from './shared.js';

// Drydock: the vessel as it is now, the contract it is preparing for, yard
// services, and the systems whose numbers decide whether it can go.

export function powerBar(used, total) {
  const on = Math.min(24, Math.round(Math.min(used, total) / total * 24));
  return `<div class="bar ${used > total ? 'is-over' : ''}" aria-hidden="true">${Array.from({length: 24}, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div>`;
}

function primaryFor(contract, state, assessment) {
  if (state.operation) return `<a class="btn btn-primary" href="#/operation" data-focus-key="to-op"><span>${t('sector.inFlight')}</span></a>`;
  if (assessment.status === 'refit') {
    return `<button type="button" class="btn btn-primary" data-action="fit" data-id="${assessment.refitModule}" data-focus-key="fit"><span>${t('dock.fit', {module: MODULES[assessment.refitModule].name})}</span></button>`;
  }
  if (assessment.status === 'service') {
    if (!assessment.fuelCheck.ok) return `<button type="button" class="btn btn-primary" data-action="refuel" data-focus-key="svc"${refuelCost(state) > state.credits ? ' disabled' : ''}><span>${t('dock.refuelAction', {cost: credits(refuelCost(state))})}</span>${icon('fuel')}</button>`;
    if (!assessment.hullCheck.ok) return `<button type="button" class="btn btn-primary" data-action="repair" data-focus-key="svc"${repairCost(state) > state.credits ? ' disabled' : ''}><span>${t('dock.repairAction', {cost: credits(repairCost(state))})}</span></button>`;
    return `<a class="btn btn-primary" href="#/hold" data-focus-key="svc"><span>${t('nav.hold')}</span>${icon('cargo')}</a>`;
  }
  if (assessment.status === 'ready') {
    return `<button type="button" class="btn btn-primary" data-action="launch" data-focus-key="launch"><span>${t('dock.launch')}</span></button>`;
  }
  return '';
}

function contractPanel(state) {
  const contract = contractById(state.active);
  if (!contract) {
    return `
      <section class="dock-contract panel is-empty" aria-labelledby="dock-contract-title">
        <header><span class="label">${t('dock.contract')}</span></header>
        <h2 class="h2" id="dock-contract-title">${t('dock.noContract')}</h2>
        <p class="lead">${t('dock.noContractNote')}</p>
        <div class="actions"><button type="button" class="btn btn-primary" data-action="go-sector" data-focus-key="open-map"><span>${t('dock.openMap')}</span></button></div>
      </section>`;
  }
  const assessment = assess(contract, state);
  const note = assessment.status === 'ready' ? `<p class="note">${t('dock.launchNote', {km: number(contract.distance), min: assessment.minutes})}</p>` : '';
  return `
    <section class="dock-contract panel" aria-labelledby="dock-contract-title">
      <header><span class="label">${t('dock.contract')}</span>${readinessChip(assessment)}</header>
      <h2 class="h2" id="dock-contract-title">${t(`contracts.${contract.id}.title`)}</h2>
      ${checklist(contract, state, assessment)}
      <div class="actions">${primaryFor(contract, state, assessment)}<button type="button" class="btn btn-secondary" data-action="go-sector" data-id="${contract.id}" data-focus-key="review">${t('dock.review')}</button></div>
      ${note}
    </section>`;
}

function stats(state) {
  return `
    <div><span class="label">${t('dock.hull')}</span><span class="data ${state.hull < 60 ? 'is-low' : ''}">${measure(state.hull, 'pct')}</span></div>
    <div><span class="label">${t('dock.fuel')}</span><span class="data ${state.fuel < 30 ? 'is-low' : ''}">${measure(state.fuel, 'pct')}</span></div>
    <div><span class="label">${t('dock.dryMass')}</span><span class="data">${measure(dryMass(state.installed), 't', 1)}</span></div>
    <div><span class="label">${t('dock.cargo')}</span><span class="data">${measure(holdMass(state), 't', 1)}<span class="unit"> / ${number(VESSEL.cargoCapacity)}</span></span></div>`;
}

function serviceRow(label, value, action, cost, state, key) {
  const enough = cost <= state.credits;
  const button = !cost
    ? `<span class="label">${t('dock.full')}</span>`
    : `<button type="button" class="btn btn-secondary btn-small" data-action="${action}" data-focus-key="${key}"${enough ? '' : ' disabled'}>${t(`dock.${action}Action`, {cost: credits(cost)})}</button>`;
  return `<div class="service-row"><span><b>${label}</b><span class="data-sm">${value}</span></span>${button}${cost && !enough ? `<small class="short">${t('dock.shortOf', {n: credits(cost - state.credits)})}</small>` : ''}</div>`;
}

function reactorRow(state) {
  const current = REACTORS[state.reactor];
  const next = REACTORS.core96;
  const upgrade = state.reactor === next.id ? '' : `
    <div class="upgrade">
      <span><b>${t('dock.upgrade', {kw: next.output})}</b><small>${t('dock.upgradeNote')}</small></span>
      <button type="button" class="btn btn-secondary btn-small" data-action="upgrade" data-focus-key="upgrade"${state.credits >= next.price ? '' : ' disabled'}>${t('dock.upgradeAction', {cost: credits(next.price)})}</button>
      ${state.credits < next.price ? `<small class="short">${t('dock.shortOf', {n: credits(next.price - state.credits)})}</small>` : ''}
    </div>`;
  return `
    <div class="system-row"><b>${t('dock.reactor')}</b><span class="label">${current.name}</span><span class="data-sm">${measure(current.output, 'kW')}</span></div>
    ${upgrade}`;
}

export function renderDock(state, ui) {
  const module = MODULES[state.installed];
  const output = reactorOutput(state);
  const used = powerDraw(state.installed);
  const reserve = powerReserve(state.installed, state);
  return `
    <div class="dock-intro">
      <p class="lead">${t('dock.class')}</p>
      <h1 class="display" id="dock-title" tabindex="-1">${t('dock.title')}</h1>
      <div class="dock-stats">${stats(state)}</div>
    </div>
    ${contractPanel(state)}
    <div class="view-controls">
      <button type="button" class="icon-button" data-action="rotate" data-dx="-0.5" data-focus-key="rot-l" aria-label="${t('dock.rotateLeft')}" title="${t('dock.rotateLeft')}">${icon('left')}</button>
      <button type="button" class="icon-button" data-action="reset-view" data-focus-key="rot-0" aria-label="${t('dock.resetView')}" title="${t('dock.resetView')}">${icon('reset')}</button>
      <button type="button" class="icon-button" data-action="rotate" data-dx="0.5" data-focus-key="rot-r" aria-label="${t('dock.rotateRight')}" title="${t('dock.rotateRight')}">${icon('right')}</button>
    </div>
    <aside class="rail panel" aria-labelledby="systems-title">
      <div class="rail-scroll">
        <h2 class="h3" id="systems-title">${t('dock.systems')}</h2>
        <div class="hardpoint-card">
          <span class="label">${t('dock.hardpoint')}</span>
          <span class="art">${modulePicture(module.id, ui.modulePictures)}</span>
          <h3 class="h2">${module.name}</h3>
          <div class="kv"><span class="label">${t(`modules.types.${module.type}`)}</span><span class="data-sm">${measure(module.mass, 't', 1)}</span></div>
          <button type="button" class="btn btn-secondary btn-block" data-action="open-bench" data-focus-key="change"${state.operation ? ' disabled' : ''}><span>${t('dock.change')}</span></button>
        </div>
        <div>
          <div class="system-row"><b>${t('dock.drive')}</b><span class="label">${t('dock.driveNote')}</span><span class="data-sm">${measure(VESSEL.driveThrust, 'kN')}</span></div>
          ${reactorRow(state)}
        </div>
        <div class="power">
          <div class="kv"><span class="label">${t('dock.power')}</span><span class="data-sm">${t('dock.powerUsed', {used: number(used), total: number(output)})}</span></div>
          ${powerBar(used, output)}
          <p class="${reserve < 0 ? 'is-over' : ''}">${reserve < 0 ? t('dock.over', {n: -reserve}) : t('dock.reserve', {n: reserve})}</p>
        </div>
        <div class="services">
          <h3 class="h3">${t('dock.service')}</h3>
          ${serviceRow(t('dock.repair'), `${state.hull}%`, 'repair', repairCost(state), state, 'repair')}
          ${serviceRow(t('dock.refuel'), `${state.fuel}%`, 'refuel', refuelCost(state), state, 'refuel')}
        </div>
      </div>
    </aside>`;
}

export function renderHardpoint(state) {
  const module = MODULES[state.installed];
  return `<button type="button" class="anchor hardpoint-callout" data-anchor="hardpoint" data-action="open-bench" data-focus-key="hardpoint" aria-label="${t('dock.hardpoint')}: ${module.name}. ${t('dock.change')}">
    <span class="pin"></span><span class="tag"><b>${module.name}</b><span>${t('dock.marker')}</span></span></button>`;
}
