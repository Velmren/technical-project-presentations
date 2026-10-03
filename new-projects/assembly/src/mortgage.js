// Mortgage and instalment calculator.
import {FLATS, HOUSES, PROGRAMS, monthsUntil, payment} from './data.js';
import {YEAR_FORMS, lang, num, plural, price, t} from './i18n.js';

const form = document.querySelector('[data-calc]');
const input = (name) => form.querySelector(`[data-calc-in="${name}"]`);
const out = (name) => form.querySelector(`[data-calc-out="${name}"]`);
const state = {program: 'family', price: 28.4, down: 30, years: 20, due: HOUSES.tower.due};

const rate = (value) => `${num(value, 1)}%`;
const roubles = (thousands) => {
  const value = Math.round(thousands * 1000).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-US');
  return lang() === 'ru' ? `${value} ₽` : `₽${value}`;
};
const fill = (el) => el.style.setProperty('--fill', `${(((el.value - el.min) / (el.max - el.min)) * 100).toFixed(1)}%`);

function renderPrograms() {
  const box = form.querySelector('[data-programs]');
  box.innerHTML = PROGRAMS.map((p) => `<button class="chip" type="button" data-program="${p.id}" aria-pressed="${p.id === state.program}">${t(`mortgage.${p.id}`)}<small>${rate(p.rate)}</small></button>`).join('');
}

function render() {
  const program = PROGRAMS.find((p) => p.id === state.program);
  state.down = Math.max(state.down, program.minDown);
  const months = program.untilDue ? monthsUntil(state.due) : state.years * 12;
  const result = payment(state.price, state.down, months, program.id);
  input('price').value = state.price;
  input('down').min = program.minDown;
  input('down').value = state.down;
  input('term').value = state.years;
  for (const name of ['price', 'down', 'term']) fill(input(name));
  out('price').textContent = price(state.price);
  out('down').textContent = `${state.down}%`;
  out('term').textContent = program.untilDue ? t('mortgage.months', {n: months}) : t('mortgage.years', {n: state.years, years: plural(state.years, YEAR_FORMS)});
  input('term').disabled = Boolean(program.untilDue);
  form.querySelector('[data-term]').classList.toggle('fixed', Boolean(program.untilDue));
  form.querySelector('[data-calc-monthly]').textContent = roubles(result.monthly);
  form.querySelector('[data-calc-loan]').textContent = price(result.loan);
  form.querySelector('[data-calc-down]').textContent = price(state.price * state.down / 100);
  const base = PROGRAMS.find((p) => p.id === 'base').rate;
  form.querySelector('[data-calc-rate]').textContent = result.rest > 0 ? `${rate(program.rate)} / ${rate(base)}` : rate(program.rate);
  form.querySelector('[data-calc-note]').textContent = t(`mortgage.note.${program.id}`);
  for (const button of form.querySelectorAll('[data-program]')) button.setAttribute('aria-pressed', String(button.dataset.program === state.program));
}

export function calcFor(flat) {
  state.price = flat.price;
  state.due = HOUSES[flat.house].due;
  render();
  document.querySelector('#mortgage').scrollIntoView({behavior: 'smooth'});
}

export function renderMortgageText() {
  renderPrograms();
  render();
}

export function initMortgage() {
  input('price').min = FLATS[0].price;
  input('price').max = Math.ceil(FLATS.at(-1).price);
  form.addEventListener('submit', (event) => event.preventDefault());
  form.querySelector('[data-programs]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-program]');
    if (!button) return;
    state.program = button.dataset.program;
    render();
  });
  input('price').addEventListener('input', () => {
    state.price = Number(input('price').value);
    render();
  });
  input('down').addEventListener('input', () => {
    state.down = Number(input('down').value);
    render();
  });
  input('term').addEventListener('input', () => {
    state.years = Number(input('term').value);
    render();
  });
  renderMortgageText();
}
