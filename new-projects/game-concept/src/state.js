import {MODULE_ORDER, MODULES} from './data/equipment.js';
import {CONTRACTS} from './data/contracts.js';

// Persistent game state. Screen, bench preview and coupling progress are
// transient and live in main.js; everything here survives a reload.

const STORAGE_KEY = 'lacuna-v5';
const LEGACY_KEY = 'lacuna-v4';

export const defaults = () => ({
  version: 5,
  started: false,
  shipOwned: false,
  credits: 6200,
  hull: 96,
  fuel: 100,
  reactor: 'core82',
  installed: 'cutter',
  owned: [...MODULE_ORDER],
  contracts: Object.fromEntries(CONTRACTS.map(c => [c.id, c.hidden ? 'hidden' : 'available'])),
  accepted: {},
  active: null,
  focus: 'nacre',
  operation: null,
  lastResult: null,
  results: {},
  hold: [{id: 'coolant', qty: 1}, {id: 'alloy', qty: 2}],
  log: [],
  inbox: [{id: 'yardWelcome', at: 480, read: false, reply: null}],
  reputation: {halden: 0, orrin: 0, cassel: 0, traffic: 0, yard: 0},
  flags: {},
  clock: 480,
  prefs: {lang: null, reducedMotion: null, quality: 'auto', inspection: false, sound: false, volume: 0.6, uiSounds: true, ambience: true, sensitivity: 1, invertY: false},
});

function migrate(saved) {
  const base = defaults();
  if (saved?.version === 5) return saved;
  if (saved?.version === 4) {
    return {...base, credits: saved.credits, installed: saved.installed, active: saved.active, focus: saved.focus,
      contracts: {...base.contracts, ...saved.contracts}, prefs: {...base.prefs, ...saved.prefs}};
  }
  return base;
}

function load() {
  const base = defaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    const saved = migrate(JSON.parse(raw || 'null'));
    const state = {...base, ...saved, prefs: {...base.prefs, ...saved.prefs}, contracts: {...base.contracts, ...saved.contracts}, reputation: {...base.reputation, ...saved.reputation}};
    if (!MODULES[state.installed]) state.installed = base.installed;
    // Saves from before the title screen existed: a run in progress counts as started.
    if (saved.started === undefined && saved.log?.length) state.started = true;
    if (state.active && state.contracts[state.active] !== 'active') state.active = null;
    if (!state.contracts[state.focus] || state.contracts[state.focus] === 'hidden') state.focus = base.focus;
    return state;
  } catch {
    return base;
  }
}

export function createStore() {
  let state = load();
  const listeners = new Set();
  const persist = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} };
  return {
    get: () => state,
    update(mutate) {
      const next = structuredClone(state);
      mutate(next);
      state = next;
      persist();
      listeners.forEach(listener => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    // New game: keep the player's preferences, reset progress.
    reset() {
      const prefs = state.prefs;
      state = {...defaults(), prefs};
      persist();
      listeners.forEach(listener => listener(state));
    },
  };
}
