// Apartment search: one filter state shared by the panel on the first screen and the full filter below,
// a list or tiles of the matching apartments and the card of the chosen one.
import {FLATS, HOUSE_ORDER, HOUSES, payment, quarter, range} from './data.js';
import {FLAT_FORMS, lang, num, plural, price, quarterLabel, t} from './i18n.js';
import {planSvg} from './plan.js';

const PAGE = 12;
const ROOMS = [1, 2, 3, 4];
const span = (key) => {
  const [lo, hi] = range(FLATS, key);
  return [Math.floor(lo), Math.ceil(hi)];
};
const BOUNDS = {area: span('area'), price: span('price'), floor: span('floor')};
const fresh = () => ({rooms: new Set(), houses: new Set(), area: [...BOUNDS.area], price: [...BOUNDS.price], floor: [...BOUNDS.floor]});

const state = {...fresh(), sort: 'priceUp', view: 'list', shown: PAGE, selected: null};
const small = matchMedia('(max-width: 1439px)');
const root = document.querySelector('#flats');
const finder = document.querySelector('[data-find]');
const rowsEl = root.querySelector('[data-rows]');
const tilesEl = root.querySelector('[data-tiles]');
const aside = root.querySelector('[data-flat]');
const dialog = root.querySelector('[data-dialog]');
const dialogBody = root.querySelector('[data-dialog-body]');
const thumbs = new Map();
let hooks = {};

const house = (flat) => HOUSES[flat.house];
const title = (flat) => t('flat.title', {rooms: flat.rooms, area: num(flat.area)});
const due = (flat) => quarterLabel(quarter(house(flat).due));

function matches(flat) {
  if (state.rooms.size && !state.rooms.has(Math.min(flat.rooms, 4))) return false;
  if (state.houses.size && !state.houses.has(flat.house)) return false;
  return flat.area >= state.area[0] && flat.area <= state.area[1]
    && flat.price >= state.price[0] && flat.price <= state.price[1]
    && flat.floor >= state.floor[0] && flat.floor <= state.floor[1];
}

function list() {
  const out = FLATS.filter(matches);
  if (state.sort === 'priceDown') out.sort((a, b) => b.price - a.price);
  if (state.sort === 'areaDown') out.sort((a, b) => b.area - a.area || a.price - b.price);
  return out;
}

function thumb(type) {
  if (!thumbs.has(type)) thumbs.set(type, planSvg(type));
  return thumbs.get(type);
}

const monthly = (flat) => payment(flat.price, 30, 360, 'family').monthly;

function card(flat) {
  const h = house(flat);
  return `
    <div class="id"><span>${t('flat.id', {id: flat.id})} · ${t('flat.house', {house: t(`house.${flat.house}`)})}</span><span>${t('flat.due', {q: due(flat)})}</span></div>
    <h3>${title(flat)}</h3>
    <div class="drawing">${planSvg(flat.type, {labels: (k) => t(`room.${k}`), width: 470, decimal: lang() === 'ru' ? ',' : '.', title: t('flat.plan', {id: flat.id})})}</div>
    <dl class="spec">
      <div><dt>${t('th.floor')}</dt><dd>${t('flat.of', {floor: flat.floor, floors: h.floors})}</dd></div>
      <div><dt>${t('th.finish')}</dt><dd>${t(`finish.${flat.finish}`)}</dd></div>
      <div><dt>${t('flat.windows')}</dt><dd>${t(`window.${flat.view}`)}</dd></div>
      <div><dt>${t('flat.ceiling')}</dt><dd>${t('unit.m', {v: num(h.ceiling)})}</dd></div>
      <div><dt>${t('flat.ppm')}</dt><dd>${t('flat.perM', {v: flat.ppm})}</dd></div>
    </dl>
    <div class="buy"><strong>${price(flat.price)}</strong><span>${t('flat.mortgage', {v: Math.round(monthly(flat))})}</span></div>
    <div class="acts"><button class="btn" type="button" data-book="${flat.id}">${t('flat.book')}</button><button class="btn ghost" type="button" data-calc="${flat.id}">${t('flat.calc')}</button></div>`;
}

function row(flat) {
  const selected = flat.id === state.selected;
  return `<tr tabindex="0" data-id="${flat.id}" aria-selected="${selected}">
    <td class="plan-col">${thumb(flat.type)}</td>
    <td class="what"><b>${title(flat)}</b><span>${t('flat.id', {id: flat.id})}</span></td>
    <td>${t(`house.${flat.house}`)}</td>
    <td>${t('flat.of', {floor: flat.floor, floors: house(flat).floors})}</td>
    <td>${t(`finish.${flat.finish}`)}</td>
    <td>${t(`window.${flat.view}`)}</td>
    <td>${due(flat)}</td>
    <td class="sum"><b>${price(flat.price)}</b><span>${t('flat.perM', {v: flat.ppm})}</span></td></tr>`;
}

function tile(flat) {
  return `<button class="tile" type="button" data-id="${flat.id}">
    <span class="top"><span>${t('flat.id', {id: flat.id})}</span><span>${due(flat)}</span></span>
    ${thumb(flat.type)}
    <b>${title(flat)}</b>
    <span class="meta">${t(`house.${flat.house}`)}, ${t('flat.of', {floor: flat.floor, floors: house(flat).floors})} · ${t(`finish.${flat.finish}`)}</span>
    <span class="sum"><strong>${price(flat.price)}</strong><span>${t('flat.perM', {v: flat.ppm})}</span></span></button>`;
}

function chips(container, items, pressed, onToggle) {
  container.innerHTML = items.map(([value, label]) => `<button class="chip" type="button" data-value="${value}" aria-pressed="${pressed(value)}">${label}</button>`).join('');
  container.onclick = (event) => {
    const button = event.target.closest('[data-value]');
    if (button) onToggle(button.dataset.value);
  };
}

function toggle(setOf, value) {
  if (value === 'all') setOf.clear();
  else if (setOf.has(value)) setOf.delete(value);
  else setOf.add(value);
}

function renderChips() {
  const roomItems = [['all', t('find.all')], ...ROOMS.map((n) => [String(n), n === 4 ? '4+' : String(n)])];
  for (const box of document.querySelectorAll('[data-rooms]')) {
    chips(box, roomItems, (v) => (v === 'all' ? state.rooms.size === 0 : state.rooms.has(Number(v))), (v) => {
      toggle(state.rooms, v === 'all' ? v : Number(v));
      update();
    });
  }
  const houseItems = [['all', t('find.all')], ...HOUSE_ORDER.map((id) => [id, t(`house.${id}`)])];
  chips(root.querySelector('[data-houses]'), houseItems, (v) => (v === 'all' ? state.houses.size === 0 : state.houses.has(v)), (v) => {
    toggle(state.houses, v);
    update();
  });
}

const fmt = (key, v) => (key === 'price' ? num(v, 1) : String(Math.round(v)));
const fill = (input) => {
  const k = (input.value - input.min) / (input.max - input.min || 1);
  input.style.setProperty('--fill', `${(k * 100).toFixed(1)}%`);
};

function syncControls() {
  for (const box of root.querySelectorAll('[data-dual]')) {
    const key = box.dataset.dual;
    const [lo, hi] = state[key];
    const inputs = box.querySelectorAll('input');
    inputs[0].value = lo;
    inputs[1].value = hi;
    const [b0, b1] = BOUNDS[key];
    box.querySelector('.dual-track').style.cssText = `--a: ${((lo - b0) / (b1 - b0)) * 100}%; --b: ${((hi - b0) / (b1 - b0)) * 100}%`;
    const shownLo = key === 'price' ? Math.max(lo, FLATS[0].price) : lo;
    box.querySelector('[data-low]').textContent = t(key === 'floor' ? 'filter.floorFrom' : 'filter.from', {v: fmt(key, shownLo)});
    box.querySelector('[data-high]').textContent = t(key === 'floor' ? 'filter.floorTo' : 'filter.to', {v: fmt(key, hi)});
  }
  const priceMax = finder.querySelector('[data-find-range="priceMax"]');
  priceMax.value = state.price[1];
  finder.querySelector('[data-out="priceMax"]').textContent = fmt('price', state.price[1]);
  fill(priceMax);
  const areaMin = finder.querySelector('[data-find-range="areaMin"]');
  areaMin.value = state.area[0];
  finder.querySelector('[data-out="areaMin"]').textContent = fmt('area', state.area[0]);
  fill(areaMin);
  for (const box of document.querySelectorAll('[data-rooms] [data-value], [data-houses] [data-value]')) {
    const v = box.dataset.value;
    const group = box.parentElement.matches('[data-rooms]') ? state.rooms : state.houses;
    const key = box.parentElement.matches('[data-rooms]') && v !== 'all' ? Number(v) : v;
    box.setAttribute('aria-pressed', String(v === 'all' ? group.size === 0 : group.has(key)));
  }
  root.querySelector('[data-sort]').value = state.sort;
}

function showFlat(flat, host) {
  host.innerHTML = flat ? card(flat) : '';
}

function update({keepShown = false} = {}) {
  if (!keepShown) state.shown = PAGE;
  const found = list();
  const n = found.length;
  if (!found.some((flat) => flat.id === state.selected)) state.selected = found[0]?.id || null;
  syncControls();
  finder.querySelector('[data-find-show]').textContent = n ? t('find.show', {n, flats: plural(n, FLAT_FORMS)}) : t('find.none');
  root.querySelector('[data-flats-count]').textContent = n === FLATS.length ? t('flats.count', {n}) : t('flats.found', {n, total: FLATS.length});
  const page = found.slice(0, state.shown);
  rowsEl.innerHTML = page.map(row).join('');
  tilesEl.innerHTML = page.map(tile).join('');
  root.querySelector('[data-empty]').hidden = n > 0;
  root.querySelector('[data-shown]').textContent = n ? t('flats.shown', {a: page.length, b: n}) : '';
  root.querySelector('[data-more]').hidden = page.length >= n;
  showFlat(FLATS.find((flat) => flat.id === state.selected), aside);
}

function choose(id) {
  state.selected = id;
  for (const tr of rowsEl.querySelectorAll('tr')) tr.setAttribute('aria-selected', String(tr.dataset.id === id));
  const flat = FLATS.find((item) => item.id === id);
  if (state.view === 'tiles' || small.matches) {
    showFlat(flat, dialogBody);
    if (!dialog.open) dialog.showModal();
  } else {
    showFlat(flat, aside);
  }
}

function setView(view) {
  state.view = view;
  root.classList.toggle('view-tiles', view === 'tiles');
  for (const button of root.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
}

export function showHouse(id) {
  Object.assign(state, fresh());
  state.houses.add(id);
  update();
  root.scrollIntoView({behavior: 'smooth'});
}

export const flatById = (id) => FLATS.find((flat) => flat.id === id);
export const flatTitle = title;

export function renderFlatsText() {
  thumbs.clear();
  renderChips();
  update({keepShown: true});
  if (dialog.open) showFlat(flatById(state.selected), dialogBody);
}

export function initFlats(options) {
  hooks = options;
  for (const box of root.querySelectorAll('[data-dual]')) {
    const key = box.dataset.dual;
    const inputs = [...box.querySelectorAll('input')];
    for (const input of inputs) {
      input.min = BOUNDS[key][0];
      input.max = BOUNDS[key][1];
      input.step = 1;
      input.addEventListener('input', () => {
        const end = Number(input.dataset.end);
        let value = Number(input.value);
        // The two ends cannot cross: each stops at the other.
        if (end === 0) value = Math.min(value, state[key][1]);
        else value = Math.max(value, state[key][0]);
        state[key][end] = value;
        update();
      });
    }
  }
  const priceMax = finder.querySelector('[data-find-range="priceMax"]');
  priceMax.min = Math.ceil(FLATS[0].price);
  priceMax.max = BOUNDS.price[1];
  priceMax.addEventListener('input', () => {
    state.price[1] = Math.max(Number(priceMax.value), state.price[0]);
    update();
  });
  const areaMin = finder.querySelector('[data-find-range="areaMin"]');
  areaMin.min = BOUNDS.area[0];
  areaMin.max = 120;
  areaMin.addEventListener('input', () => {
    state.area[0] = Math.min(Number(areaMin.value), state.area[1]);
    update();
  });
  finder.addEventListener('submit', (event) => event.preventDefault());
  root.querySelector('[data-filters]').addEventListener('submit', (event) => event.preventDefault());
  root.querySelector('[data-filters]').addEventListener('reset', (event) => {
    event.preventDefault();
    Object.assign(state, fresh());
    update();
  });
  root.querySelector('[data-sort]').addEventListener('change', (event) => {
    state.sort = event.target.value;
    update();
  });
  root.querySelector('[data-more]').addEventListener('click', () => {
    state.shown += PAGE;
    update({keepShown: true});
  });
  for (const button of root.querySelectorAll('[data-view]')) button.addEventListener('click', () => setView(button.dataset.view));
  const toggle = root.querySelector('[data-filters-toggle]');
  toggle.addEventListener('click', () => {
    const open = root.querySelector('[data-filters]').classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  rowsEl.addEventListener('click', (event) => {
    const tr = event.target.closest('tr[data-id]');
    if (tr) choose(tr.dataset.id);
  });
  rowsEl.addEventListener('keydown', (event) => {
    const tr = event.target.closest('tr[data-id]');
    if (tr && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      choose(tr.dataset.id);
    }
  });
  tilesEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-id]');
    if (button) choose(button.dataset.id);
  });
  const act = (event) => {
    const book = event.target.closest('[data-book]');
    const calc = event.target.closest('[data-calc]');
    if (!book && !calc) return;
    if (dialog.open) dialog.close();
    if (book) hooks.onBook(flatById(book.dataset.book));
    if (calc) hooks.onCalc(flatById(calc.dataset.calc));
  };
  aside.addEventListener('click', act);
  dialogBody.addEventListener('click', act);
  root.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  renderChips();
  update();
}
