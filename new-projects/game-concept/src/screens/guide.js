import {contractById} from '../data/contracts.js';
import {MODULES, VESSEL} from '../data/equipment.js';
import {messageById} from '../data/comms.js';
import {operationSteps} from '../rules.js';
import {credits, number, t, unit} from '../i18n.js';
import {icon} from '../ui/art.js';
import {assess, clientName} from './shared.js';

// The player's goal and the next step toward it: the buyout meter in the top
// bar, the "now" line under it, and one-at-a-time hints for the first job.

export function goalMeter(state) {
  const pct = state.shipOwned ? 100 : Math.min(100, state.credits / VESSEL.buyout * 100);
  const value = state.shipOwned ? t('goal.owned') : `${number(state.credits)} / ${number(VESSEL.buyout)}<span class="unit">${unit('cr')}</span>`;
  return `
    <span class="goal-row"><span class="goal-label">${t('goal.label')}</span><span class="goal-value tabular">${value}</span></span>
    <span class="goal-bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>`;
}

// What to do now, derived from the state so it can never go stale.
export function objective(state) {
  if (state.shipOwned) return {text: t('objective.owned')};
  if (state.credits >= VESSEL.buyout) return {text: t('objective.buyout', {cost: credits(VESSEL.buyout)}), action: 'buyout'};
  const active = contractById(state.active);
  if (state.operation && active) {
    const steps = operationSteps(active.id);
    const done = state.operation.step >= steps.length;
    return {text: done ? t('objective.dock', {name: active.name}) : t('objective.operation', {name: active.name, n: state.operation.step + 1, total: steps.length}), href: '#/operation'};
  }
  if (active) {
    const a = assess(active, state);
    if (a.status === 'refit') return {text: t('objective.fit', {module: MODULES[a.refitModule].name, name: active.name}), href: '#/vessel'};
    if (a.status === 'service') return {text: t(a.fuelCheck.ok ? 'objective.repair' : 'objective.refuel', {name: active.name}), href: '#/vessel'};
    return {text: t('objective.launch', {name: active.name}), href: '#/vessel'};
  }
  const pending = [...state.inbox].reverse().find(m => !m.reply && messageById(m.id)?.choices);
  if (pending) return {text: t('objective.reply', {client: clientName(messageById(pending.id).from)}), href: `#/comms/${pending.id}`};
  return {text: t('objective.pick'), href: '#/sector'};
}

export function renderObjective(state) {
  const {text, action, href} = objective(state);
  const body = `<span class="objective-label">${t('objective.now')}</span><span class="objective-text">${text}</span>`;
  if (action) return `<button type="button" class="objective-link is-action" data-action="${action}">${icon('check')}${body}</button>`;
  return `<a class="objective-link" href="${href || '#/sector'}">${body}</a>`;
}

// First-contract hints, one at a time, anchored to the control they explain.
export function hintFor(state, ui, compact) {
  if (state.flags?.tutorialDone || !state.started || ui.cut) return null;
  const nacre = contractById('nacre');
  const status = state.contracts.nacre;
  if (status !== 'available' && status !== 'active') return null;
  if (ui.screen === 'sector' && !state.active) {
    if (state.focus !== 'nacre') return {id: 'pick', target: compact ? '.contract-row[data-id="nacre"]' : '.map-marker[data-id="nacre"]', text: t('hints.pick')};
    if (compact && !ui.detail) return {id: 'pick', target: '.contract-row[data-id="nacre"]', text: t('hints.pick')};
    return {id: 'accept', target: '.screen-sector [data-action="accept"]', text: t('hints.accept', {reward: credits(nacre.reward)})};
  }
  if (state.active !== 'nacre') return null;
  const a = assess(nacre, state);
  if (ui.screen === 'sector' && !state.operation) return {id: 'prepare', target: '.screen-sector [data-action="go-dock"]', text: t('hints.prepare')};
  if (ui.screen === 'dock' && a.status === 'refit') return {id: 'fit', target: '.dock-contract [data-action="fit"]', text: t('hints.fit', {module: MODULES[a.refitModule].name})};
  if (ui.screen === 'bench' && ui.selected !== state.installed && !ui.installing) return {id: 'install', target: '.screen-bench [data-action="install"]', text: t('hints.install')};
  if (ui.screen === 'dock' && a.status === 'ready' && !state.operation) return {id: 'launch', target: '.dock-contract [data-action="launch"]', text: t('hints.launch')};
  if (ui.screen === 'operation' && state.operation?.step === 0 && !ui.opBusy) {
    return ui.opChoice
      ? {id: 'execute', target: '[data-action="op-execute"]', text: t('hints.execute')}
      : {id: 'decide', target: '.option-cards', text: t('hints.decide')};
  }
  return null;
}

export function renderHint(hint) {
  return `
    <p>${hint.text}</p>
    <button type="button" class="hint-close" data-action="hide-hints">${t('hints.hide')}</button>`;
}
