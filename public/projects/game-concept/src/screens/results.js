import {contractById} from '../data/contracts.js';
import {messageById} from '../data/comms.js';
import {credits, number, t, unit} from '../i18n.js';
import {icon} from '../ui/art.js';
import {clientName, itemName, itemThumb} from './shared.js';

// Settlement after an operation: what was paid and why, what it cost the
// vessel, what went into the hold, and who wants a word.

function change(label, before, after, suffix = '%') {
  const delta = after - before;
  return `
    <div class="change">
      <span class="label">${label}</span>
      <span class="data-sm">${number(before)}<span class="unit">${suffix}</span> ${icon('next')} ${number(after)}<span class="unit">${suffix}</span></span>
      <span class="delta ${delta < 0 ? 'is-bad' : delta ? '' : 'is-flat'}">${delta ? `${delta > 0 ? '+' : '−'}${number(Math.abs(delta))}${suffix}` : t('results.unchanged')}</span>
      <div class="meter-bar"><i style="width:${after}%"></i><i class="lost" style="left:${after}%;width:${Math.max(0, before - after)}%"></i></div>
    </div>`;
}

export function renderResults(state, ui) {
  const r = state.lastResult;
  const contract = contractById(r.contract);
  const message = state.inbox.find(m => !m.read && messageById(m.id)?.trigger.completed === r.contract);
  const baseLine = contract.payout === 'tonnage'
    ? t('results.tonnage', {t: number(r.tonnage), rate: credits(r.base / Math.max(r.tonnage, 1))})
    : t('results.base');
  const lines = [
    `<div class="pay-row"><span>${baseLine}</span><b>${credits(r.base)}</b></div>`,
    contract.bonus ? `<div class="pay-row ${r.bonus ? 'is-good' : 'is-muted'}"><span>${r.bonus ? t('results.bonus') : t('results.noBonus', {pct: r.integrity})}</span><b>${r.bonus ? '+' + credits(r.bonus) : '0'}</b></div>` : '',
  ].join('');
  const stowed = r.stowed.length ? r.stowed.map(([id, qty]) => `
    <li class="loot">${itemThumb(id, ui.thumbs)}<span><b>${itemName(id)}</b><small>×${qty}</small></span></li>`).join('') : `<li class="empty-line">${t('results.nothing')}</li>`;
  const left = r.left.length ? `<p class="warning">${icon('lock')}${t('results.left')}: ${r.left.map(([id, qty]) => `${itemName(id)} ×${qty}`).join(', ')}</p>` : '';
  return `
    <div class="results panel">
      <header class="results-head">
        <span class="kind">${icon('check')}${t(`contracts.${contract.id}.title`)}</span>
        <h1 class="title" id="results-title" tabindex="-1">${t('results.title')}</h1>
      </header>
      <section class="results-pay">
        <h2 class="h3">${t('results.payment')}</h2>
        ${lines}
        <div class="pay-total"><span>${t('results.total')}</span><span class="data count-up" data-count="${r.payout}">${number(ui.countUp ? 0 : r.payout)}<span class="unit">${unit('cr')}</span></span></div>
        <p class="rep">${t('results.reputation', {client: clientName(contract.client)})}</p>
      </section>
      <section class="results-vessel">
        <h2 class="h3">${t('results.vessel')}</h2>
        ${change(t('dock.hull'), r.hullBefore, r.hull)}
        ${change(t('dock.fuel'), r.fuelBefore, r.fuel)}
        <div class="kv"><span class="label">${t('results.time')}</span><span class="data-sm">${number(r.minutes)}<span class="unit">${unit('min')}</span></span></div>
        ${r.radiation ? `<p class="warning">${icon('radiation')}${t('results.radiation')}: −${r.radiation}%</p>` : ''}
      </section>
      <section class="results-hold">
        <h2 class="h3">${t('results.hold')}</h2>
        <ul class="loot-list">${stowed}</ul>
        ${left}
      </section>
      <footer class="results-actions">
        ${message ? `<a class="btn btn-primary" href="#/comms/${message.id}" data-focus-key="to-comms"><span>${t('results.toComms')}</span></a>` : ''}
        <a class="btn ${message ? 'btn-secondary' : 'btn-primary'}" href="#/hold" data-focus-key="to-hold"><span>${t('results.toHold')}</span>${icon('cargo')}</a>
        <a class="btn btn-secondary" href="#/sector" data-focus-key="to-board">${t('results.toBoard')}</a>
        ${message ? `<p class="note">${icon('route')}${t('results.message', {client: clientName(messageById(message.id).from)})}</p>` : ''}
      </footer>
    </div>`;
}
