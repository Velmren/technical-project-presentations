import {CONTRACTS, HOME, contractById} from '../data/contracts.js';
import {MODULES} from '../data/equipment.js';
import {powerDraw, reactorOutput, visibleContracts} from '../rules.js';
import {credits, number, t, unit} from '../i18n.js';
import {icon, kindIcon, riskIcon} from '../ui/art.js';
import {assess, checklist, clientName, statusChip} from './shared.js';

// Sector: on a desktop the orbital map is the contract list (each marker
// shows name and pay, Tab walks them); the card on the right explains the
// chosen one. On a phone the list stays under the map band.

function row(contract, state) {
  return `
    <li>
      <button type="button" class="contract-row" data-action="focus-contract" data-id="${contract.id}" data-focus-key="row-${contract.id}" aria-pressed="${contract.id === state.focus}">
        ${icon(kindIcon[contract.kind])}
        <span class="name">${t(`contracts.${contract.id}.title`)}</span>
        <span class="reward">${number(contract.reward)}<span class="unit">${unit('cr')}</span></span>
        <span class="meta">${t(`sector.kinds.${contract.kind}`)} · ${number(contract.distance)} ${unit('km')}</span>
        ${statusChip(contract, state)}
      </button>
    </li>`;
}

// One line that says whether MULE-06 can take the job as fitted now.
function readiness(contract, state, a) {
  const status = state.contracts[contract.id];
  if (status === 'completed') return ['good', 'check', t('sector.completed')];
  if (status === 'failed') return ['bad', 'block', t('sector.failed')];
  if (state.active === contract.id && state.operation) return ['neutral', 'route', t('sector.inFlight')];
  if (a.status === 'blocked') {
    const check = a.blockedBy;
    return ['bad', 'lock', check?.reason === 'power' ? t('sector.blockedPower', {need: powerDraw(check.module), have: reactorOutput(state)}) : t('sector.blockedNone')];
  }
  if (a.status === 'refit') return ['neutral', 'refit', t('sector.needsModule', {module: MODULES[a.refitModule].name})];
  if (a.status === 'service') return ['neutral', 'service', t(a.fuelCheck.ok ? 'sector.needsRepair' : 'sector.needsFuel')];
  return ['good', 'check', t('sector.readyToGo')];
}

const deadlineLeft = (contract, state) => {
  const since = state.accepted?.[contract.id];
  if (state.active !== contract.id || since === undefined) return `${contract.deadlineHours} ${unit('h')}`;
  return t('sector.left', {h: Math.max(0, contract.deadlineHours - Math.floor((state.clock - since) / 60))});
};

function actions(contract, state, a) {
  const status = state.contracts[contract.id];
  if (status === 'completed' || status === 'failed') {
    return `<a class="btn btn-secondary btn-block" href="#/log" data-focus-key="to-log"><span>${t('nav.log')}</span></a>`;
  }
  if (state.active === contract.id && state.operation) {
    return `<a class="btn btn-primary btn-block" href="#/operation" data-focus-key="to-op"><span>${t('sector.inFlight')}</span></a>`;
  }
  if (state.active === contract.id) {
    return `
      <button type="button" class="btn btn-primary btn-block" data-action="go-dock" data-focus-key="prepare"><span>${t('sector.prepare')}</span></button>
      <button type="button" class="btn btn-ghost" data-action="withdraw" data-id="${contract.id}" data-focus-key="withdraw">${t('sector.withdraw')}</button>`;
  }
  if (a.status === 'blocked') {
    return `<button type="button" class="btn btn-primary btn-block" disabled aria-describedby="accept-note"><span>${t('sector.cannot')}</span>${icon('lock')}</button>`;
  }
  return `<button type="button" class="btn btn-primary btn-block" data-action="accept" data-id="${contract.id}" data-focus-key="accept"><span>${t('sector.accept')}</span></button>`;
}

function card(contract, state) {
  const a = assess(contract, state);
  const [tone, glyph, text] = readiness(contract, state, a);
  const bonus = contract.bonus ? t(`contracts.${contract.id}.bonus`, {n: credits(contract.bonus)}) : contract.payout === 'tonnage' ? t('sector.perTonne') : '';
  const risk = Math.max(...contract.risks.map(r => r.level));
  const facts = [
    `${number(contract.distance)} ${unit('km')}`,
    t('sector.oneWay', {min: a.minutes}),
    t('sector.fuelShare', {pct: a.fuel}),
    t('sector.deadlineShort', {left: deadlineLeft(contract, state)}),
    t('sector.riskShort', {level: t(`sector.levels.${risk}`).toLowerCase()}),
  ];
  return `
    <div class="rail-back"><button type="button" class="back-link" data-action="close-detail" data-focus-key="close-detail">${t('common.back')}</button></div>
    <div class="rail-scroll">
      <header class="card-head">
        <p class="card-kicker">${icon(kindIcon[contract.kind])}${t(`sector.kinds.${contract.kind}`)} · ${clientName(contract.client)}</p>
        <h2 class="h2" id="contract-title" tabindex="-1">${t(`contracts.${contract.id}.title`)}</h2>
      </header>
      <div class="card-reward">
        <span class="data">${contract.payout === 'tonnage' ? '≈ ' : ''}${number(contract.reward)}<span class="unit">${unit('cr')}</span></span>
        ${bonus ? `<small>${bonus}</small>` : ''}
      </div>
      <p class="lead">${t(`contracts.${contract.id}.brief`)}</p>
      <p class="readiness is-${tone}" id="accept-note">${icon(glyph)}<span>${text}</span></p>
      <p class="facts-line">${facts.map(f => `<span>${f}</span>`).join(' · ')}</p>
      <details class="more">
        <summary>${t('sector.more')}</summary>
        <section class="section">
          <h3 class="h3">${t('sector.requirements')}</h3>
          ${checklist(contract, state, a)}
        </section>
        <section class="section">
          <h3 class="h3">${t('sector.risks')}</h3>
          ${contract.risks.map(r => `<div class="risk">${icon(riskIcon[r.id])}<p>${t(`sector.riskText.${r.id}.${r.level}`)}</p></div>`).join('')}
        </section>
      </details>
    </div>
    <div class="rail-foot">${actions(contract, state, a)}</div>`;
}

export function renderSector(state, ui) {
  const contracts = visibleContracts(CONTRACTS, state);
  const focus = contractById(state.focus) || contracts[0];
  return `
    <h1 class="visually-hidden" id="sector-title" tabindex="-1">${t('sector.title')}</h1>
    <div class="sector-list">
      <p class="sector-place">${t('sector.place')}</p>
      <ol class="contract-list" aria-label="${t('sector.listLabel')}">${contracts.map(c => row(c, state)).join('')}</ol>
    </div>
    <aside class="rail panel contract-card" id="contract-card" aria-labelledby="contract-title">${card(focus, state)}</aside>`;
}

// Map markers double as the contract list on wide screens: name and pay are
// always visible, the status is an icon and a word, and the chosen marker is
// tied to the card by its highlight and a leader line.
export function renderMarkers(state) {
  const home = `<div class="anchor map-marker is-home" data-anchor="${HOME.id}"><span class="pin"></span><span class="tag"><b>${t('sector.home')}</b><span class="tag-sub">${t('sector.homeNote')}</span></span></div>`;
  const markers = visibleContracts(CONTRACTS, state).map(contract => {
    const status = state.contracts[contract.id];
    const a = assess(contract, state);
    const closed = status === 'completed' || status === 'failed';
    const active = state.active === contract.id;
    const blocked = a.status === 'blocked' && !closed;
    const classes = ['anchor', 'map-marker', active ? 'is-active' : '', blocked ? 'is-blocked' : '', closed ? 'is-closed' : ''].join(' ');
    const sub = closed ? `${icon(status === 'completed' ? 'check' : 'block')}${t(`sector.${status}`)}`
      : `${blocked ? icon('lock') : a.status === 'ready' ? icon('check') : a.status === 'refit' ? icon('refit') : ''}${number(contract.reward)} ${unit('cr')}${active ? ` · ${t('sector.activeShort')}` : ''}`;
    const label = `${t(`contracts.${contract.id}.title`)}, ${closed ? t(`sector.${status}`) : credits(contract.reward)}${active ? `, ${t('sector.active')}` : ''}${blocked ? `, ${t('status.blocked')}` : ''}`;
    return `
      <button type="button" class="${classes}" data-anchor="${contract.id}" data-action="focus-contract" data-id="${contract.id}" data-focus-key="marker-${contract.id}" aria-pressed="${contract.id === state.focus}" aria-controls="contract-card" aria-label="${label}">
        <span class="pin"></span><span class="tag"><b>${contract.name}</b><span class="tag-sub">${sub}</span></span>
      </button>`;
  });
  return home + markers.join('') + '<svg class="leader" aria-hidden="true"><line/></svg>';
}
