import {CONTRACTS, contractById} from '../data/contracts.js';
import {MODULES} from '../data/equipment.js';
import {messageById} from '../data/comms.js';
import {moduleSuits, operationSteps} from '../rules.js';
import {clock, credits, number, t, unit} from '../i18n.js';
import {icon, kindIcon} from '../ui/art.js';
import {clientName, itemName} from './shared.js';

// Log: contract briefings with live objective progress, and the event
// history of everything the player has done.

const logged = (state) => CONTRACTS.filter(c => ['active', 'completed', 'failed'].includes(state.contracts[c.id]));

// Objective state from the game state: done, current, pending or missed.
export function objectiveStates(contract, state) {
  const status = state.contracts[contract.id];
  const operation = state.operation?.contract === contract.id ? state.operation : null;
  const steps = operationSteps(contract.id).map(s => s.id);
  const result = state.results?.[contract.id];
  let currentAssigned = false;
  const mark = (done) => {
    if (done) return 'done';
    if (status === 'failed') return 'missed';
    if (status === 'active' && !currentAssigned) { currentAssigned = true; return 'current'; }
    return 'pending';
  };
  const list = contract.objectives.map(id => {
    if (id === 'fit') return [id, mark(status === 'completed' || operation || moduleSuits(state.installed, contract))];
    if (id === 'deliver') return [id, mark(status === 'completed')];
    const index = steps.indexOf(id);
    return [id, mark(status === 'completed' || (operation && index >= 0 && operation.step > index))];
  });
  if (contract.bonusObjective) {
    const bonus = status === 'completed' ? (result?.intact ? 'done' : 'missed') : status === 'failed' ? 'missed' : 'pending';
    list.push([contract.bonusObjective, bonus]);
  }
  return list;
}

function contractRow(contract, state, ui) {
  const status = state.contracts[contract.id];
  return `
    <li><button type="button" class="contract-row" data-action="log-select" data-id="${contract.id}" data-focus-key="log-${contract.id}" aria-pressed="${ui.logContract === contract.id}">
      ${icon(kindIcon[contract.kind])}
      <span class="name">${t(`contracts.${contract.id}.title`)}</span>
      <span class="meta">${clientName(contract.client)}</span>
      <span class="chip chip-${status === 'completed' ? 'ok' : status === 'failed' ? 'blocked' : 'active'}">${t(`log.status.${status}`)}</span>
    </button></li>`;
}

function contractDetail(contract, state) {
  const status = state.contracts[contract.id];
  const result = state.results?.[contract.id];
  const glyph = {done: 'check', current: 'next', pending: 'clock', missed: 'block'};
  const goals = objectiveStates(contract, state).map(([id, s]) => `
    <li class="goal is-${s}">${icon(glyph[s])}<span><b>${t(`objectives.${id}`)}</b><small>${t(`log.goal.${s}`)}</small></span></li>`).join('');
  const since = state.accepted?.[contract.id];
  const left = status === 'active' && since !== undefined ? t('sector.left', {h: Math.max(0, contract.deadlineHours - Math.floor((state.clock - since) / 60))}) : `${contract.deadlineHours} ${unit('h')}`;
  const outcome = result ? `
    <section class="section">
      <h3 class="h3">${t('log.outcome')}</h3>
      <div class="kv"><span class="label">${t('results.total')}</span><span class="data-sm">${credits(result.payout)}</span></div>
      <div class="kv"><span class="label">${t('dock.hull')}</span><span class="data-sm">${result.hullBefore}% ${icon('next')} ${result.hull}%</span></div>
      <div class="kv"><span class="label">${t('results.time')}</span><span class="data-sm">${number(result.minutes)}<span class="unit">${unit('min')}</span></span></div>
      ${result.stowed.length ? `<p class="note">${t('results.hold')}: ${result.stowed.map(([id, qty]) => `${itemName(id)} ×${qty}`).join(', ')}</p>` : ''}
    </section>` : '';
  return `
    <div class="rail-back"><button type="button" class="back-link" data-action="log-close" data-focus-key="log-close">${t('common.back')}</button></div>
    <div class="rail-scroll">
      <header class="contract-title">
        <span class="kind">${icon(kindIcon[contract.kind])}${t(`log.status.${status}`)}</span>
        <h2 class="h2" id="log-title" tabindex="-1">${t(`contracts.${contract.id}.title`)}</h2>
        <p class="client">${t('sector.client')}: ${clientName(contract.client)}</p>
      </header>
      <p class="lead">${t(`contracts.${contract.id}.brief`)}</p>
      <section class="section"><h3 class="h3">${t('log.objectives')}</h3><ul class="goals">${goals}</ul></section>
      <section class="section">
        <h3 class="h3">${t('log.terms')}</h3>
        <div class="kv"><span class="label">${t('sector.reward')}</span><span class="data-sm">${credits(contract.reward)}</span></div>
        <div class="kv"><span class="label">${t('sector.deadline')}</span><span class="data-sm">${left}</span></div>
      </section>
      ${outcome}
    </div>
    ${status === 'active' ? `<div class="rail-foot">${state.operation ? `<a class="btn btn-primary btn-block" href="#/operation"><span>${t('sector.inFlight')}</span></a>` : `<a class="btn btn-primary btn-block" href="#/vessel"><span>${t('sector.prepare')}</span></a>`}</div>` : ''}`;
}

export function eventText(entry) {
  const contract = entry.contract ? contractById(entry.contract) : null;
  const params = {
    contract: contract ? contract.name : '',
    module: entry.module ? MODULES[entry.module].name : '',
    item: entry.item ? itemName(entry.item) : '',
    qty: entry.qty, value: entry.value ? credits(entry.value) : '', payout: entry.payout ? credits(entry.payout) : '', cost: entry.cost ? credits(entry.cost) : '',
    option: entry.option ? (t(`ops.options.${entry.step}.${entry.option}`)?.[0] ?? entry.option) : '',
    client: entry.message ? clientName(messageById(entry.message)?.from) : '',
    choice: entry.choice ? (t(`comms.messages.${entry.message}.choices.${entry.choice}`)?.[0] ?? entry.choice) : '',
  };
  return t(`log.types.${entry.type}`, params);
}

export function renderLog(state, ui) {
  const contracts = logged(state);
  const tab = ui.logTab ?? 'contracts';
  const selected = contractById(ui.logContract) ?? contracts[0];
  const events = [...state.log].reverse();
  const tabs = `
    <div class="tabs" role="tablist" aria-label="${t('log.title')}">
      <button type="button" role="tab" id="tab-contracts" aria-selected="${tab === 'contracts'}" aria-controls="log-panel" data-action="log-tab" data-id="contracts" data-focus-key="tab-contracts">${t('log.contracts')}</button>
      <button type="button" role="tab" id="tab-events" aria-selected="${tab === 'events'}" aria-controls="log-panel" data-action="log-tab" data-id="events" data-focus-key="tab-events">${t('log.events')}</button>
    </div>`;
  const body = tab === 'events'
    ? (events.length ? `<ol class="events">${events.map(e => `<li><time>${clock(e.at)}</time><span>${eventText(e)}</span></li>`).join('')}</ol>` : `<p class="empty-line">${t('log.noEvents')}</p>`)
    : (contracts.length ? `<ol class="contract-list">${contracts.map(c => contractRow(c, state, {...ui, logContract: selected?.id})).join('')}</ol>` : `
        <div class="empty-state">${icon('route', 'icon icon-large')}<h2 class="h2">${t('log.empty')}</h2><p class="lead">${t('log.emptyNote')}</p><a class="btn btn-secondary" href="#/sector">${t('dock.openMap')}</a></div>`);
  return `
    <div class="page-main">
      <header class="page-head"><h1 class="title" id="log-heading" tabindex="-1">${t('log.title')}</h1><p class="lead">${clock(state.clock)}</p></header>
      ${tabs}
      <div id="log-panel" role="tabpanel" aria-labelledby="tab-${tab}">${body}</div>
    </div>
    ${tab === 'contracts' && selected ? `<aside class="rail panel" aria-labelledby="log-title">${contractDetail(selected, state)}</aside>` : ''}`;
}
