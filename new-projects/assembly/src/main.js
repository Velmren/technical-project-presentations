import {FLATS, HOUSE_ORDER, HOUSES, houseStats, quarter} from './data.js';
import {flatTitle, initFlats, renderFlatsText, showHouse} from './flats.js';
import {applyLang, initialLang, lang, num, price, quarterLabel, t} from './i18n.js';
import {calcFor, initMortgage, renderMortgageText} from './mortgage.js';
import {initScene, renderSceneText} from './scene.js';

const due = (id) => quarterLabel(quarter(HOUSES[id].due));
const keys = (id) => quarterLabel(quarter(HOUSES[id].due + 1));
const area = (a, b) => `${num(a)} – ${num(b)}`;

// Figures that come from the data: the tables of houses, the house cards, the site plan, the schedule.
function renderFigures() {
  for (const el of document.querySelectorAll('[data-on-sale]')) el.textContent = FLATS.length;
  document.querySelector('[data-find-total]').textContent = t('find.count', {n: FLATS.length});
  document.querySelector('[data-houses-table]').innerHTML = HOUSE_ORDER.map((id) => {
    const h = HOUSES[id];
    const s = houseStats(id);
    return `<tr><td>${t(`house.${id}`)}</td><td data-label="${t('th.floors')}">${h.floors}</td><td data-label="${t('th.flats')}">${h.total}</td><td data-label="${t('th.area')}">${area(s.areaMin, s.areaMax)}</td><td data-label="${t('th.due')}">${due(id)}</td><td class="from" data-label="${t('th.from')}">${t('price.from', {price: price(s.from)})}</td><td><button class="btn ghost" type="button" data-house-show="${id}">${t('nav.flats')}</button></td></tr>`;
  }).join('');
  for (const id of HOUSE_ORDER) {
    const h = HOUSES[id];
    const s = houseStats(id);
    document.querySelector(`[data-house-spec="${id}"]`).innerHTML = `
      <div><dt>${t('houses.flats')}</dt><dd>${h.total}, ${t('houses.onSale', {n: s.onSale})}</dd></div>
      <div><dt>${t('houses.area')}</dt><dd>${t('houses.areaV', {a: num(s.areaMin), b: num(s.areaMax)})}</dd></div>
      <div><dt>${t('houses.ceiling')}</dt><dd>${t('unit.m', {v: num(h.ceiling)})}</dd></div>
      <div><dt>${t('houses.due')}</dt><dd>${due(id)}</dd></div>
      <div><dt>${t('th.from')}</dt><dd>${t('price.from', {price: price(s.from)})}</dd></div>`;
    const line = t('plan.houseLine', {floors: h.floors, q: due(id)});
    document.querySelector(`[data-plan-sub="${id}"]`).textContent = line;
    document.querySelector(`[data-plan-line="${id}"]`).textContent = `${line}, ${t('price.from', {price: price(s.from)})}`;
  }
  document.querySelector('[data-progress-table]').innerHTML = HOUSE_ORDER.map((id) => {
    const ready = Math.round(HOUSES[id].ready * 100);
    return `<tr><td>${t(`house.${id}`)}</td><td data-label="${t('progress.now')}">${t(`progress.${id}.now`)}</td><td data-label="${t('progress.ready')}"><span class="ready"><span><i style="width: ${ready}%"></i></span>${ready}%</span></td><td data-label="${t('th.due')}">${due(id)}</td><td data-label="${t('progress.keys')}">${keys(id)}</td></tr>`;
  }).join('');
}

// Site plan: the map and the legend light each other up; a house opens its apartments.
function initPlan() {
  const map = document.querySelector('[data-genplan]');
  const legend = document.querySelector('[data-legend]');
  const light = (key, on) => {
    for (const el of map.querySelectorAll(`[data-key="${key}"]`)) el.classList.toggle('on', on);
    for (const el of legend.querySelectorAll(`[data-key="${key}"]`)) el.classList.toggle('on', on);
  };
  for (const root of [map, legend]) {
    for (const el of root.querySelectorAll('[data-key]')) {
      const key = el.dataset.key;
      el.addEventListener('mouseenter', () => light(key, true));
      el.addEventListener('mouseleave', () => light(key, false));
      el.addEventListener('focus', () => light(key, true));
      el.addEventListener('blur', () => light(key, false));
      if (HOUSES[key]) {
        el.addEventListener('click', () => showHouse(key));
        el.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            showHouse(key);
          }
        });
      }
    }
  }
}

// Menu on narrow screens and the section in view on wide ones.
function initNav() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const menu = document.querySelector('[data-menu]');
  const setOpen = (open) => {
    menu.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  const links = new Map([...document.querySelectorAll('[data-nav]')].map((a) => [a.getAttribute('href').slice(1), a]));
  const seen = new Map();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting);
    const active = [...links.keys()].find((id) => seen.get(id));
    for (const [id, a] of links) a.classList.toggle('on', id === active);
  }, {rootMargin: '-45% 0px -50% 0px'});
  for (const id of links.keys()) observer.observe(document.getElementById(id));
}

// Viewing request: checks the fields and says plainly that nothing is sent.
const form = document.querySelector('[data-form]');
let chosen = null;

function showChosen() {
  const box = form.querySelector('[data-chosen]');
  box.hidden = !chosen;
  if (chosen) box.querySelector('[data-chosen-flat]').textContent = t('office.flatV', {id: chosen.id, title: flatTitle(chosen)});
}

function initForm() {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const filled = form.name.value.trim() && form.phone.value.trim() && form.agree.checked;
    form.querySelector('[data-form-note]').textContent = t(filled ? 'office.done' : 'office.empty');
    if (filled) {
      form.reset();
      chosen = null;
      showChosen();
    }
  });
}

function book(flat) {
  chosen = flat;
  showChosen();
  document.querySelector('#office').scrollIntoView({behavior: 'smooth'});
  setTimeout(() => form.name.focus({preventScroll: true}), 600);
}

function setLang(next) {
  applyLang(next);
  renderFigures();
  renderFlatsText();
  renderMortgageText();
  renderSceneText();
  showChosen();
}

document.addEventListener('click', (event) => {
  const show = event.target.closest('[data-house-show]');
  if (show) showHouse(show.dataset.houseShow);
});
for (const button of document.querySelectorAll('[data-lang-switch]')) {
  button.addEventListener('click', () => setLang(lang() === 'ru' ? 'en' : 'ru'));
}

applyLang(initialLang());
renderFigures();
initFlats({onBook: book, onCalc: calcFor});
initMortgage();
initPlan();
initNav();
initForm();
initScene();
