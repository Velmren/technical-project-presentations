import {contractById} from '../data/contracts.js';
import {CAPABILITY_UNITS, MODULES} from '../data/equipment.js';
import {INTACT_THRESHOLD, RADIATION_WINDOW} from '../data/operations.js';
import {capability, operationSteps, optionAvailability, settle} from '../rules.js';
import {credits, number, t, unit} from '../i18n.js';
import {icon, kindIcon} from '../ui/art.js';
import {clientName, itemList} from './shared.js';

// Recovery operation, laid out like a game HUD: the target's frame at the top
// centre, MULE-06's frame at the bottom left, the decision at the bottom
// centre and the scene itself in between. A chosen option previews its cost
// as a pale segment on the bars before anything is committed.

const optionText = (stepId, optionId) => t(`ops.options.${stepId}.${optionId}`) || [optionId, ''];

// Stats after an option, without committing it.
function projected(stats, option) {
  if (!option) return stats;
  return {
    ...stats,
    minutes: stats.minutes + (option.minutes ?? 0),
    fuel: Math.max(0, stats.fuel - (option.fuel ?? 0)),
    hull: Math.max(0, stats.hull + (option.hull ?? 0)),
    integrity: Math.max(0, stats.integrity + (option.integrity ?? 0)),
    onSite: stats.onSite + (option.onSite ?? 0),
  };
}

// A bar with the current value and, when an option is chosen, the part it
// would cost drawn pale beyond the new end.
function bar(label, value, next, {max = 100, danger = 0, suffix = '%'} = {}) {
  const pct = (v) => Math.max(0, Math.min(100, v / max * 100));
  const now = pct(value), after = pct(next);
  const loss = Math.max(0, now - after);
  const low = next < danger;
  return `
    <div class="hud-bar${low ? ' is-danger' : ''}">
      <div class="hud-bar-row"><span class="label">${label}</span><span class="value tabular">${number(next)}<span class="unit">${suffix}</span>${loss ? `<s class="was">${number(value)}</s>` : ''}</span></div>
      <div class="hud-track"><i class="fill" style="width:${after}%"></i>${loss ? `<i class="ghost" style="left:${after}%;width:${loss}%"></i>` : ''}</div>
    </div>`;
}

function targetStatus(contract, steps, operation) {
  const done = (id) => { const i = steps.findIndex(s => s.id === id); return i >= 0 && operation.step > i; };
  if (contract.id === 'nacre') return done('stabilize') ? t('ops.status.stable') : t('ops.status.tumbling');
  if (contract.id === 'brine') return t('ops.status.radiation', {n: operation.stats.onSite, max: RADIATION_WINDOW});
  if (contract.id === 'tallow') return operation.stats.tonnage ? t('ops.status.tonnage', {t: number(operation.stats.tonnage)}) : t('ops.status.plating');
  return t(`ops.status.${contract.kind}`);
}

function targetFrame(contract, steps, operation, choice) {
  const s = operation.stats, next = projected(s, choice);
  return `
    <section class="hud-frame target-frame" aria-label="${t('ops.targetLabel')}">
      <div class="frame-head">
        <span class="frame-badge">${icon(kindIcon[contract.kind])}</span>
        <span class="frame-name"><b>${contract.name}</b><small>${t(`sector.kinds.${contract.kind}`)} · ${clientName(contract.client)}</small></span>
      </div>
      ${contract.bonus ? bar(t('ops.integrity'), s.integrity, next.integrity, {danger: INTACT_THRESHOLD}) : ''}
      ${contract.id === 'brine' ? bar(t('ops.onSite'), s.onSite, next.onSite, {max: RADIATION_WINDOW, suffix: ` ${unit('min')}`}) : ''}
      <p class="frame-status">${targetStatus(contract, steps, operation)}</p>
      <ol class="step-dots" aria-label="${t('ops.progress')}">
        ${steps.map((step, i) => `<li class="${i < operation.step ? 'is-done' : i === operation.step ? 'is-current' : ''}"><span class="visually-hidden">${t(`ops.steps.${step.id}`)}</span></li>`).join('')}
        <li class="${operation.step >= steps.length ? 'is-current' : ''}"><span class="visually-hidden">${t('sector.home')}</span></li>
      </ol>
    </section>`;
}

function playerFrame(state, operation, choice, done, busy) {
  const s = operation.stats, next = projected(s, choice);
  return `
    <section class="hud-frame player-frame" aria-label="MULE–06">
      <div class="frame-head">
        <span class="frame-name"><b>MULE–06</b><small>${MODULES[state.installed].name}</small></span>
        <span class="frame-clock tabular">${icon('clock')}${number(next.minutes)} ${unit('min')}</span>
      </div>
      ${bar(t('ops.hull'), s.hull, next.hull, {danger: 50})}
      ${bar(t('ops.fuel'), s.fuel, next.fuel, {danger: 15})}
      <button type="button" class="btn btn-ghost frame-abort" data-action="op-abort" data-focus-key="abort"${done || busy ? ' disabled' : ''}>${t('ops.abort')}</button>
    </section>`;
}

// Consequences as plain items; colour only where the choice gains or loses
// something that matters (salvage, the intact bonus, pay).
function consequences(option, operation, contract) {
  const items = [];
  if (option.minutes) items.push(['neutral', 'clock', t('ops.costs.minutes', {n: option.minutes})]);
  if (option.fuel) items.push(['neutral', 'fuel', t('ops.costs.fuel', {n: option.fuel})]);
  if (option.hull) items.push(['neutral', 'breach', t('ops.costs.hull', {n: -option.hull})]);
  if (option.integrity) {
    const losesBonus = contract.bonus && operation.stats.integrity >= INTACT_THRESHOLD && operation.stats.integrity + option.integrity < INTACT_THRESHOLD;
    items.push([losesBonus ? 'bad' : 'neutral', 'cargo', losesBonus ? t('ops.costs.bonusLost', {n: -option.integrity, bonus: credits(contract.bonus)}) : t('ops.costs.integrity', {n: -option.integrity})]);
  }
  if (option.rewardFactor) items.push(['bad', 'block', t('ops.costs.factor', {pct: Math.round(option.rewardFactor * 100)})]);
  if (option.tonnage) items.push(['neutral', 'salvage', t('ops.costs.tonnage', {t: number(option.tonnage), rate: credits(option.rate)})]);
  if (option.items?.length) items.push(['good', 'cargo', t('ops.costs.items', {list: itemList(option.items)})]);
  if (!items.length) items.push(['good', 'check', t('ops.noCost')]);
  return `<ul class="consequences">${items.map(([tone, glyph, text]) => `<li class="is-${tone}">${icon(glyph)}${text}</li>`).join('')}</ul>`;
}

function card(step, option, index, operation, state, ui, contract) {
  const [title, text] = optionText(step.id, option.id);
  const availability = optionAvailability(option, operation, state);
  let note = '';
  if (availability.reason === 'tool') {
    const {capability: key, min} = availability.requires;
    note = `<span class="why" id="why-${option.id}">${icon('lock')}${t('ops.needTool', {capability: t(`modules.capabilities.${key}`).toLowerCase(), min: number(min), unit: unit(CAPABILITY_UNITS[key])})}</span>`;
  } else if (availability.reason === 'fuel') {
    note = `<span class="why" id="why-${option.id}">${icon('lock')}${t('ops.needFuel', {need: availability.need, have: availability.have})}</span>`;
  } else if (option.requires) {
    // Like an equipment option in an event: say which module makes it possible.
    const value = capability(state.installed, option.requires.capability);
    note = `<span class="by-module">${icon('refit')}${t('ops.byModule', {module: MODULES[state.installed].name, value: number(value), unit: unit(CAPABILITY_UNITS[option.requires.capability])})}</span>`;
  }
  const disabled = !availability.ok || ui.opBusy;
  return `
    <button type="button" class="option-card" data-action="op-select" data-id="${option.id}" data-focus-key="opt-${option.id}"
      aria-pressed="${ui.opChoice === option.id}" ${disabled ? 'disabled' : ''} ${note && !availability.ok ? `aria-describedby="why-${option.id}"` : ''}>
      <kbd aria-hidden="true">${index + 1}</kbd>
      <b>${title}</b>
      <span class="text">${text}</span>
      ${consequences(option, operation, contract)}
      ${note}
    </button>`;
}

function dueNote(contract, operation, state) {
  const result = settle(contract, operation, state);
  const sum = credits(result.payout);
  return result.stowed.length ? t('ops.dueItems', {sum, list: itemList(result.stowed)}) : t('ops.due', {sum});
}

function radio(ui, contract) {
  if (!ui.radio) return '';
  return `<p class="radio" role="status">${icon('comms')}<span><b>${contract.client ? clientName(contract.client) : ''}</b>${ui.radio}</span></p>`;
}

export function renderOperation(state, ui) {
  const operation = state.operation;
  const contract = contractById(operation.contract);
  const steps = operationSteps(contract.id);
  const step = steps[operation.step];
  const done = !step;
  const choice = step?.options.find(o => o.id === ui.opChoice);
  const decision = done ? `
      <header class="decision-head">
        <p class="step-label">${t('ops.stepDone')}</p>
        <h1 class="title" id="op-title" tabindex="-1">${t('ops.steps.return')}</h1>
        <p class="lead">${t('ops.arrived')} ${dueNote(contract, operation, state)}</p>
      </header>
      <div class="op-actions"><button type="button" class="btn btn-primary" data-action="op-finish" data-focus-key="finish"><span>${t('ops.finish')}</span></button></div>` : `
      <header class="decision-head">
        <p class="step-label">${t('ops.step', {n: operation.step + 1, total: steps.length})} · ${contract.name}</p>
        <h1 class="title" id="op-title" tabindex="-1">${t(`ops.steps.${step.id}`)}</h1>
        <p class="lead">${t(`ops.leads.${step.id}`, {km: number(contract.distance)})}</p>
      </header>
      <div class="option-cards" role="group" aria-labelledby="op-title">${step.options.map((o, i) => card(step, o, i, operation, state, ui, contract)).join('')}</div>
      <div class="op-actions">
        <button type="button" class="btn btn-primary ${ui.opBusy ? 'is-busy' : ''}" data-action="op-execute" data-focus-key="execute" ${choice && !ui.opBusy ? '' : 'disabled'}><span>${ui.opBusy ? t('ops.executing') : t('ops.execute')}</span></button>
      </div>`;
  return `
    ${targetFrame(contract, steps, operation, choice)}
    ${radio(ui, contract)}
    ${playerFrame(state, operation, choice, done, ui.opBusy)}
    <section class="decision${done ? ' is-done' : ''}">${decision}</section>`;
}

// Targeting brackets over the wreck in the scene.
export function renderOpAnchor(state) {
  const contract = contractById(state.operation?.contract);
  if (!contract) return '';
  return `<div class="anchor op-reticle" data-anchor="target" aria-hidden="true"><span class="corners"></span><span class="tag">${contract.name}</span></div>`;
}
