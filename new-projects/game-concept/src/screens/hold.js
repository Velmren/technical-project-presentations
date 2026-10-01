import {ITEMS, ITEM_ORDER} from '../data/items.js';
import {VESSEL} from '../data/equipment.js';
import {holdMass, holdValue, itemValue} from '../rules.js';
import {credits, number, t, unit} from '../i18n.js';
import {icon} from '../ui/art.js';
import {itemList, itemName, itemThumb} from './shared.js';

// Hold: salvage that differs in look and purpose. Sell it, or strip what can
// be stripped into lighter components.

const sorted = (state) => [...state.hold].sort((a, b) => ITEM_ORDER.indexOf(a.id) - ITEM_ORDER.indexOf(b.id));

function card(entry, state, ui) {
  const item = ITEMS[entry.id];
  return `
    <li>
      <button type="button" class="item-card" data-action="item-select" data-id="${entry.id}" data-focus-key="item-${entry.id}" aria-pressed="${ui.item === entry.id}">
        <span class="thumb">${itemThumb(entry.id, ui.thumbs)}</span>
        <span class="name">${itemName(entry.id)}</span>
        <span class="qty">×${entry.qty}</span>
        <span class="meta">${number(item.mass * entry.qty, item.mass < 0.1 ? 2 : 1)} ${unit('t')} · ${credits(itemValue(entry.id, state) * entry.qty)}</span>
        <span class="chip chip-${item.kind === 'hazard' ? 'blocked' : item.kind === 'salvage' ? 'ok' : ''}">${t(`hold.kinds.${item.kind}`)}</span>
      </button>
    </li>`;
}

function detail(entry, state, ui) {
  if (!entry) return '';
  const item = ITEMS[entry.id];
  const each = itemValue(entry.id, state);
  const deal = state.flags?.orrinDeal && (entry.id === 'courierPlate' || entry.id === 'scrapPlate');
  const stripNote = item.strip
    ? `<p class="note">${t('hold.stripTo', {list: itemList(item.strip)})}</p>`
    : `<p class="note is-muted">${t(item.kind === 'hazard' ? 'hold.noStripHazard' : 'hold.noStripMaterial')}</p>`;
  return `
    <div class="rail-back"><button type="button" class="back-link" data-action="item-close" data-focus-key="item-close">${t('common.back')}</button></div>
    <div class="rail-scroll ${ui.animateDetail ? 'swap' : ''}">
      <div class="item-hero">${itemThumb(entry.id, ui.thumbs)}</div>
      <header class="contract-title">
        <span class="kind">${t(`hold.kinds.${item.kind}`)}</span>
        <h2 class="h2" id="item-title" tabindex="-1">${itemName(entry.id)}</h2>
      </header>
      <p class="lead">${t(`hold.describe.${entry.id}`)}</p>
      <section class="section">
        <div class="kv"><span class="label">${t('hold.quantity')}</span><span class="data-sm">${entry.qty}</span></div>
        <div class="kv"><span class="label">${t('hold.mass')}</span><span class="data-sm">${number(item.mass, item.mass < 0.1 ? 2 : 1)}<span class="unit">${unit('t')}</span></span></div>
        <div class="kv"><span class="label">${t('hold.unitValue')}</span><span class="data-sm">${credits(each)}</span></div>
        ${deal ? `<p class="note is-good">${t('hold.dealNote')}</p>` : ''}
      </section>
    </div>
    <div class="rail-foot">
      <button type="button" class="btn btn-primary btn-block" data-action="sell" data-id="${entry.id}" data-qty="1" data-focus-key="sell"><span>${t('hold.sell', {value: credits(each)})}</span></button>
      ${entry.qty > 1 ? `<button type="button" class="btn btn-secondary btn-block" data-action="sell" data-id="${entry.id}" data-qty="${entry.qty}" data-focus-key="sell-all"><span>${t('hold.sellAll', {value: credits(each * entry.qty)})}</span></button>` : ''}
      <button type="button" class="btn btn-secondary btn-block" data-action="strip" data-id="${entry.id}" data-focus-key="strip"${item.strip ? '' : ' disabled'}><span>${t('hold.strip')}</span></button>
      ${stripNote}
    </div>`;
}

export function renderHold(state, ui) {
  const entries = sorted(state);
  const used = holdMass(state);
  const selected = entries.find(e => e.id === ui.item) ?? entries[0];
  const pct = Math.round(used / VESSEL.cargoCapacity * 100);
  return `
    <div class="page-main">
      <header class="page-head">
        <h1 class="title" id="hold-title" tabindex="-1">${t('hold.title')}</h1>
        <div class="capacity">
          <div class="kv"><span class="label">${t('hold.capacity', {used: number(used, 1), total: number(VESSEL.cargoCapacity)})}</span><span class="label">${t('hold.value')}: <b>${credits(holdValue(state))}</b></span></div>
          <div class="meter-bar"><i style="width:${pct}%"></i></div>
        </div>
      </header>
      ${entries.length ? `<ul class="item-grid" aria-label="${t('hold.listLabel')}">${entries.map(e => card(e, state, {...ui, item: selected.id})).join('')}</ul>` : `
        <div class="empty-state">${icon('cargo', 'icon icon-large')}<h2 class="h2">${t('hold.empty')}</h2><p class="lead">${t('hold.emptyNote')}</p>
          <a class="btn btn-secondary" href="#/sector">${t('dock.openMap')}</a></div>`}
    </div>
    ${selected ? `<aside class="rail panel" aria-labelledby="item-title">${detail(selected, state, ui)}</aside>` : ''}`;
}
