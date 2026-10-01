import en from './locales/en.js';
import ru from './locales/ru.js';

// Dictionary lookup, interpolation and locale-aware number formatting. Screens
// re-render from state on a language change, so nothing is lost when switching.

const LOCALES = {en, ru};
let current = 'ru';
const formatters = new Map();

export const LANGUAGES = Object.keys(LOCALES);

export function detectLanguage() {
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  return preferred.some(code => code.toLowerCase().startsWith('ru')) ? 'ru' : 'en';
}

export function setLanguage(code) {
  current = LOCALES[code] ? code : 'en';
  document.documentElement.lang = current;
  document.title = LOCALES[current].meta.title;
}

export const language = () => current;

function lookup(dictionary, key) {
  return key.split('.').reduce((node, part) => node?.[part], dictionary);
}

export function t(key, params = {}) {
  const value = lookup(LOCALES[current], key) ?? lookup(LOCALES.en, key);
  if (typeof value !== 'string') return value ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
}

export function number(value, digits = 0) {
  const key = `${current}:${digits}`;
  if (!formatters.has(key)) {
    formatters.set(key, new Intl.NumberFormat(LOCALES[current].meta.locale, {minimumFractionDigits: digits, maximumFractionDigits: digits}));
  }
  return formatters.get(key).format(value);
}

export const unit = (name) => t(`units.${name}`);

// "14 500 кр" / "14,500 cr"
export const credits = (value) => `${number(value)} ${unit('cr')}`;

// Game clock: minutes since the start of day 1.
export function clock(minutes) {
  const day = Math.floor(minutes / 1440) + 1;
  const m = minutes % 1440;
  const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return t('common.clock', {day, time});
}

// Value and unit as separate spans so the number can carry the visual weight.
export function measure(value, unitName, digits = 0) {
  return `<span class="value">${number(value, digits)}</span><span class="unit">${unit(unitName)}</span>`;
}

// Static markup: data-i18n sets text, data-i18n-attr sets attributes
// ("aria-label:dock.rotateLeft;title:dock.rotateLeft").
export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attribute, key] = pair.split(':');
      el.setAttribute(attribute.trim(), t(key.trim()));
    }
  });
}
