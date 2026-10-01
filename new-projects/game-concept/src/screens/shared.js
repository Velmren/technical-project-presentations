import {CAPABILITY_UNITS, MODULES, VESSEL} from '../data/equipment.js';
import {CLIENTS} from '../data/contracts.js';
import {ITEMS} from '../data/items.js';
import {assessContract, powerDraw, reactorOutput} from '../rules.js';
import {credits, number, t, unit} from '../i18n.js';
import {icon, moduleArt} from '../ui/art.js';

// Pieces used by more than one screen: requirement checklist, status chips,
// client names, item lists and consequence chips.

export const assess = (contract, state) => assessContract(contract, state);
export const clientName = (id) => CLIENTS[id]?.name ?? id;
export const itemName = (id) => t(`hold.names.${id}`);
export const itemList = (pairs) => pairs.map(([id, qty]) => qty > 1 ? `${itemName(id)} ×${qty}` : itemName(id)).join(', ');
export const escape = (text) => String(text).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

export function statusChip(contract, state, assessment = assess(contract, state)) {
  const status = state.contracts[contract.id];
  if (status === 'completed') return `<span class="chip chip-ok">${icon('check')}${t('sector.completed')}</span>`;
  if (status === 'failed') return `<span class="chip chip-blocked">${icon('block')}${t('sector.failed')}</span>`;
  if (state.active === contract.id) return `<span class="chip chip-active">${t(state.operation ? 'sector.inFlight' : 'sector.active')}</span>`;
  return readinessChip(assessment);
}

export function readinessChip(assessment) {
  const kind = {ready: ['ok', 'check'], refit: ['refit', 'refit'], service: ['refit', 'fuel'], blocked: ['blocked', 'lock']}[assessment.status];
  return `<span class="chip chip-${kind[0]}">${icon(kind[1])}${t(`status.${assessment.status}`)}</span>`;
}

function checkDetail(check, state) {
  const name = check.module ? MODULES[check.module].name : '';
  if (check.state === 'met') {
    return t('requirement.met', {module: MODULES[state.installed].name, value: number(check.value), unit: unit(CAPABILITY_UNITS[check.requirement.capability])});
  }
  if (check.state === 'refit') return t('requirement.refit', {module: name});
  if (check.reason === 'power') return t('requirement.power', {module: name, need: powerDraw(check.module), have: reactorOutput(state)});
  return t('requirement.missing');
}

const row = (state, title, detail) => {
  const glyph = {met: 'check', refit: 'refit', blocked: 'lock'}[state];
  return `<li class="check is-${state}">${icon(glyph)}<span><b>${title}</b><small>${detail}</small></span></li>`;
};

export function checklist(contract, state, assessment = assess(contract, state)) {
  const items = assessment.checks.map(check => row(check.state,
    t(`requirement.${check.requirement.capability}`, {min: number(check.requirement.min)}), checkDetail(check, state)));
  if (!assessment.checks.length) items.push(`<li class="check is-met">${icon('check')}<span><b>${t('requirement.none')}</b></span></li>`);
  const {cargo, fuelCheck, hullCheck} = assessment;
  items.push(row(cargo.ok ? 'met' : 'refit', t('requirement.cargo', {cargo: number(contract.cargo, 1)}),
    t(cargo.ok ? 'requirement.cargoMet' : 'requirement.cargoShort', {free: number(cargo.free, 1), total: number(VESSEL.cargoCapacity)})));
  items.push(row(fuelCheck.ok ? 'met' : 'refit', t('requirement.fuel', {need: fuelCheck.need}),
    t(fuelCheck.ok ? 'requirement.fuelMet' : 'requirement.fuelShort', {have: fuelCheck.have})));
  if (!hullCheck.ok) items.push(row('refit', t('requirement.hull', {min: 40}), t('requirement.hullShort', {have: hullCheck.have})));
  return `<ul class="checklist">${items.join('')}</ul>`;
}

// Consequence chips for operation options and message replies.
export function effectChips(parts) {
  return parts.filter(Boolean).map(([tone, text]) => `<span class="effect effect-${tone}">${text}</span>`).join('');
}

export const itemThumb = (id, thumbs) => thumbs[ITEMS[id].model]
  ? `<img src="${thumbs[ITEMS[id].model]}" alt="" loading="lazy">`
  : `<span class="thumb-placeholder" aria-hidden="true"></span>`;

export const money = (value) => credits(value);

// A module as rendered from its 3D model. While the renders are pending the
// frame stays empty; without a 3D view the line drawing stands in.
export const modulePicture = (id, pictures) => pictures ? `<img src="${pictures[id]}" alt="">` : pictures === false ? moduleArt(id) : '';

// VELMREN, small and muted, linking to velmren.com (title screen and settings).
export const makerLink = (focusKey) => `<a class="maker-link" href="https://velmren.com/" target="_top" data-focus-key="${focusKey}">VELMREN</a>`;
