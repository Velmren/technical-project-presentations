import {createStore} from './state.js';
import {createGame} from './game.js';
import {createAudio} from './audio.js';
import {applyStatic, credits, detectLanguage, language, setLanguage, t} from './i18n.js';
import {CONTRACTS, HOME, contractById} from './data/contracts.js';
import {MODULE_ORDER, MODULES, REACTORS, VESSEL} from './data/equipment.js';
import {messageById} from './data/comms.js';
import {operationSteps, optionAvailability, powerReserve, visibleContracts} from './rules.js';
import {assess, itemList, itemName} from './screens/shared.js';
import {renderMarkers, renderSector} from './screens/sector.js';
import {renderDock, renderHardpoint} from './screens/dock.js';
import {renderBench} from './screens/bench.js';
import {renderOpAnchor, renderOperation} from './screens/operation.js';
import {goalMeter, hintFor, renderHint, renderObjective} from './screens/guide.js';
import {renderIntro} from './screens/intro.js';
import {renderResults} from './screens/results.js';
import {renderHold} from './screens/hold.js';
import {renderLog} from './screens/log.js';
import {renderComms} from './screens/comms.js';
import {renderSettings} from './screens/settings.js';
import {renderConfirm} from './ui/dialogs.js';

// Application shell: routing, rendering from state, actions, keyboard, sound
// and the bridge to the WebGL stage. Screens are pure functions of state.

const $ = (selector, root = document) => root.querySelector(selector);
const store = createStore();
const game = createGame(store);
const audio = createAudio();
const compactQuery = matchMedia('(max-width: 760px)');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const anchorsRoot = $('#anchors');
const canvas = $('#viewport');

// view: which 3D world/camera (none for document screens, which pause the
// 3D view); nav: highlighted section; sub: hides the phone tab bar.
const SCREENS = {
  sector: {render: renderSector, view: 'sector', nav: 'sector', hash: '#/sector'},
  dock: {render: renderDock, view: 'dock', nav: 'vessel', hash: '#/vessel'},
  bench: {render: renderBench, view: 'bench', nav: 'vessel', hash: '#/vessel/bench', sub: true},
  operation: {render: renderOperation, view: 'op', nav: null, hash: '#/operation', sub: true},
  results: {render: renderResults, view: null, nav: null, hash: '#/results', page: true, sub: true},
  hold: {render: renderHold, view: null, nav: 'hold', hash: '#/hold', page: true},
  log: {render: renderLog, view: null, nav: 'log', hash: '#/log', page: true},
  comms: {render: renderComms, view: null, nav: 'comms', hash: '#/comms', page: true},
  settings: {render: (state) => renderSettings(state, {reduced: reducedMotion(), lang: language()}), view: null, nav: 'settings', hash: '#/settings', page: true},
};
const sections = Object.fromEntries(Object.keys(SCREENS).map(name => {
  const section = document.createElement('section');
  section.className = `screen screen-${name}`;
  section.hidden = true;
  $('#main').append(section);
  return [name, section];
}));

const ui = {
  screen: null, selected: store.get().installed, installing: false, detail: false, animateDetail: false, pendingSelect: null,
  opChoice: null, opBusy: false, item: null, logTab: 'contracts', logContract: null, message: null, reply: null, thumbs: {}, modulePictures: null, countUp: false,
  cut: null, radio: '', stageReady: false,
};
let stage = null, installTimer = 0, opTimer = 0, toastTimer = 0, radioTimer = 0, lastPoints = {}, confirmHandler = null, lastOpKey = null;

const reducedMotion = () => store.get().prefs.reducedMotion ?? motionQuery.matches;
const isCompact = () => compactQuery.matches;

// ---- Routing -------------------------------------------------------------------
function routeFromHash() {
  const [head, second] = location.hash.replace(/^#\/?/, '').split('/');
  if (head === 'vessel') return second === 'bench' ? ['bench'] : ['dock'];
  if (SCREENS[head]) return [head, second];
  return ['sector'];
}

function navigate(screen, param) {
  const hash = SCREENS[screen].hash + (param ? `/${param}` : '');
  if (location.hash === hash) applyRoute(); else location.hash = hash;
}

function guard(screen) {
  const state = store.get();
  if (ui.cut === 'dock' && screen === 'operation') return 'dock';
  if (screen === 'operation' && !state.operation) return state.lastResult ? 'results' : 'dock';
  if (screen === 'results' && !state.lastResult) return 'sector';
  return screen;
}

function applyRoute() {
  const [wanted, param] = routeFromHash();
  const next = guard(wanted);
  if (next !== wanted) { navigate(next); return; }
  if (next === 'comms' && param && messageById(param)) { ui.message = param; game.read(param); }
  if (next === ui.screen) { render(); return; }
  cancelInstall(false);
  const previous = ui.screen;
  ui.screen = next;
  if (next === 'bench' && previous !== 'bench') ui.selected = ui.pendingSelect ?? store.get().installed;
  ui.pendingSelect = null;
  ui.detail = next === 'comms' && Boolean(param) && isCompact();
  render({enter: previous !== null});
  if (previous !== null) {
    sections[next].querySelector('h1')?.focus({preventScroll: true});
    window.scrollTo({top: 0});
  }
}

// ---- Rendering ---------------------------------------------------------------------
function render({enter = false} = {}) {
  const state = store.get();
  // A state change can leave the current screen without data (an operation
  // just settled or was aborted); hand over to the screen that owns it now.
  const allowed = guard(ui.screen);
  if (allowed !== ui.screen) { navigate(allowed); return; }
  const screen = SCREENS[ui.screen];
  const body = document.body;
  body.dataset.screen = ui.screen;
  body.dataset.page = String(Boolean(screen.page));
  body.dataset.sub = String(Boolean(screen.sub) || (ui.detail && isCompact()));
  body.dataset.sheet = String(ui.detail && isCompact());
  body.dataset.reduced = String(reducedMotion());
  body.dataset.intro = String(!state.started);
  body.dataset.cut = ui.cut || '';
  const focusKey = document.activeElement?.dataset?.focusKey;
  for (const [name, section] of Object.entries(sections)) section.hidden = name !== ui.screen;
  const section = sections[ui.screen];
  section.innerHTML = screen.render(state, ui);
  section.classList.toggle('show-detail', ui.detail);
  if (enter) [...section.children].forEach((child, i) => { child.classList.add('enter'); child.style.animationDelay = `${i * 40}ms`; });
  ui.animateDetail = false;
  renderTopbar(state);
  renderGuide(state);
  renderAnchors(state);
  applyStatic();
  syncStage(state);
  positionHint();
  audio.setPrefs({sound: state.prefs.sound, volume: state.prefs.volume, uiSounds: state.prefs.uiSounds, ambience: state.prefs.ambience});
  audio.setScene(screen.view === 'sector' || screen.view === 'op' ? 'map' : 'bay');
  if (!state.started && !document.querySelector('#intro')?.contains(document.activeElement)) $('#intro-title')?.focus({preventScroll: true});
  if (focusKey) document.querySelector(`[data-focus-key="${focusKey}"]`)?.focus({preventScroll: true});
  if (ui.countUp) runCountUp();
}

function renderTopbar(state) {
  const goal = $('#goal');
  const changed = goal.dataset.credits !== undefined && goal.dataset.credits !== String(state.credits);
  goal.innerHTML = goalMeter(state);
  goal.setAttribute('aria-label', t('goal.aria', {have: credits(state.credits), need: credits(VESSEL.buyout)}));
  if (changed && !reducedMotion()) { goal.classList.remove('is-changed'); void goal.offsetWidth; goal.classList.add('is-changed'); }
  goal.dataset.credits = String(state.credits);
  const section = SCREENS[ui.screen].nav;
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === language())));
  const unread = state.inbox.filter(m => !m.read).length;
  const badge = $('#unread');
  badge.hidden = !unread;
  badge.textContent = unread;
  badge.setAttribute('aria-label', t('nav.unread', {n: unread}));
}

function renderAnchors(state) {
  const html = ui.screen === 'sector' ? renderMarkers(state) : ui.screen === 'dock' ? renderHardpoint(state) : ui.screen === 'operation' ? renderOpAnchor(state) : '';
  anchorsRoot.innerHTML = html;
  positionAnchors();
}

// Title screen, the goal's "now" line and the first-job hint.
function renderGuide(state) {
  const intro = $('#intro');
  intro.hidden = state.started;
  if (!state.started) intro.innerHTML = renderIntro(state, {ready: ui.stageReady, lang: language()});
  const objective = $('#objective');
  objective.hidden = !state.started || Boolean(ui.cut);
  objective.innerHTML = state.started ? renderObjective(state) : '';
  const cut = $('#cut');
  cut.hidden = !ui.cut;
  if (ui.cut) {
    const name = contractById(state.active ?? state.lastResult?.contract)?.name ?? '';
    cut.innerHTML = `<b>${t(`cut.${ui.cut}`, {name})}</b><span>${t('cut.skip')}</span>`;
  }
  const hint = hintFor(state, ui, isCompact());
  const box = $('#hint');
  box.hidden = !hint;
  box.dataset.target = hint?.target ?? '';
  if (hint) box.innerHTML = renderHint(hint);
}

// The hint sits beside the control it explains, kept inside the viewport.
function positionHint() {
  const box = $('#hint');
  if (box.hidden) return;
  const target = box.dataset.target && document.querySelector(box.dataset.target);
  if (!target || !target.offsetParent) { box.classList.add('is-hidden'); return; }
  box.classList.remove('is-hidden');
  const r = target.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, gap = 14;
  // Near the bottom of the screen the hint goes above its control, so it does
  // not sit on the cards and trays laid out beside it.
  const low = r.bottom > innerHeight - 220;
  let x = r.left - w - gap, y = r.top + r.height / 2 - h / 2, side = 'left';
  if (low || x < 12) { x = Math.min(innerWidth - w - 12, Math.max(12, r.right - w)); y = r.top - h - gap; side = 'top'; }
  if (y < 72) { y = r.bottom + gap; side = 'bottom'; }
  box.dataset.side = side;
  box.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.min(innerHeight - h - 12, y))}px)`;
}

// Positions come from the stage every rendered frame. Map labels flip to the
// left when they would run into a neighbour or the edge of the free area.
function positionAnchors() {
  const offset = canvas.getBoundingClientRect().top - anchorsRoot.getBoundingClientRect().top;
  const placed = [];
  const items = [...anchorsRoot.querySelectorAll('.anchor')].map(el => ({el, point: lastPoints[el.dataset.anchor]})).sort((a, b) => (a.point?.x ?? 0) - (b.point?.x ?? 0));
  const railLeft = $('.screen-sector:not([hidden]) .rail')?.getBoundingClientRect().left;
  const listRight = $('.screen-sector:not([hidden]) .sector-list')?.getBoundingClientRect().right;
  const limit = isCompact() || !railLeft ? innerWidth - 8 : railLeft - 12;
  const floor = isCompact() || !listRight ? 8 : listRight + 12;
  for (const {el, point} of items) {
    if (!point) { el.classList.add('is-hidden'); continue; }
    el.classList.toggle('is-hidden', !point.visible);
    if (el.classList.contains('op-reticle')) {
      const size = Math.max(96, Math.min(420, point.size || 132));
      el.style.width = el.style.height = size + 'px';
      el.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y + offset)}px) translate(-50%, -50%)`;
      continue;
    }
    const pin = el.classList.contains('hardpoint-callout') ? 6 : 9;
    const width = el.offsetWidth;
    let flip;
    if (el.classList.contains('hardpoint-callout')) flip = point.x + width > innerWidth - 12;
    else {
      // Prefer the label on the right; flip left only if that side is clear.
      const right = {x0: point.x, x1: point.x + width, y: point.y};
      const left = {x0: point.x - width, x1: point.x, y: point.y};
      const clear = (box) => !placed.some(p => Math.abs(p.y - box.y) < 44 && box.x0 < p.x1 && box.x1 > p.x0);
      const rightOk = right.x1 <= limit && clear(right);
      flip = !rightOk && left.x0 >= floor && clear(left);
      if (point.visible) placed.push(flip ? left : right);
    }
    el.classList.toggle('flip', flip);
    const shift = flip ? `calc(-100% + ${pin}px)` : `-${pin}px`;
    el.style.transform = `translate(${Math.round(point.x)}px, ${Math.round(point.y + offset)}px) translate(${shift}, -50%)`;
  }
  drawLeader();
}

// Ties the chosen map marker to its card with a thin line.
function drawLeader() {
  const leader = anchorsRoot.querySelector('.leader');
  if (!leader) return;
  const marker = anchorsRoot.querySelector('.map-marker[aria-pressed="true"]');
  const head = $('.screen-sector:not([hidden]) .contract-card .card-head');
  if (!marker || marker.classList.contains('is-hidden') || !head || isCompact()) { leader.classList.add('is-hidden'); return; }
  const box = anchorsRoot.getBoundingClientRect(), tag = marker.querySelector('.tag').getBoundingClientRect(), card = head.getBoundingClientRect();
  const line = leader.querySelector('line');
  const x1 = (marker.classList.contains('flip') ? tag.left : tag.right) - box.left, y1 = tag.top + tag.height / 2 - box.top;
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', card.left - 20 - box.left); line.setAttribute('y2', card.top + 18 - box.top);
  leader.classList.remove('is-hidden');
}

// Space the map must leave free for the contract list, the detail rail and
// the title, measured in canvas pixels.
function mapInsets() {
  const frame = canvas.getBoundingClientRect();
  if (isCompact()) return {left: 8, right: 8, top: 52, bottom: 8};
  const list = $('.screen-sector .sector-list')?.getBoundingClientRect();
  const rail = $('.screen-sector .rail')?.getBoundingClientRect();
  return {
    left: list ? list.right - frame.left : 0,
    right: rail ? frame.right - rail.left : 0,
    top: ($('#objective:not([hidden])') ?? $('.topbar')).getBoundingClientRect().bottom - frame.top,
    bottom: 40,
  };
}

// Operation shot: keep the vessel and target in the band between the
// target frame at the top and the decision and vessel frame at the bottom.
function opInsets() {
  const frame = canvas.getBoundingClientRect();
  if (isCompact()) return {left: 0, right: 0, top: 0, bottom: 0};
  const target = $('.screen-operation .target-frame')?.getBoundingClientRect();
  const lowest = Math.min(...['.decision', '.player-frame'].map(sel => $(`.screen-operation ${sel}`)?.getBoundingClientRect().top ?? frame.bottom));
  return {left: 0, right: 0, top: target ? target.bottom - frame.top + 8 : 0, bottom: frame.bottom - lowest + 8};
}

function stageInsets() {
  return ui.screen === 'sector' ? mapInsets() : ui.screen === 'operation' ? opInsets() : null;
}

function syncStage(state) {
  // Before the first shift the title screen sits over the drydock.
  const view = state.started ? SCREENS[ui.screen].view : 'intro';
  if (view) canvas.setAttribute('aria-label', t({sector: 'sector.mapLabel', dock: 'dock.viewLabel', intro: 'dock.viewLabel', bench: 'bench.viewLabel', op: 'ops.title'}[view]));
  if (!stage) return;
  stage.setReduced(reducedMotion());
  stage.setQuality(state.prefs.quality);
  stage.setInspection(state.prefs.inspection);
  stage.setControls({sensitivity: state.prefs.sensitivity, invertY: state.prefs.invertY});
  if (state.operation) {
    const key = `${state.operation.contract}:${state.operation.step}:${state.installed}`;
    if (key !== lastOpKey && !ui.opBusy) {
      lastOpKey = key;
      const contract = contractById(state.operation.contract);
      stage.setOperation({contract: contract.id, wreck: contract.wreck, steps: operationSteps(contract.id), operation: state.operation});
    }
  } else lastOpKey = null;
  if (view) { stage.setView(view); stage.setPaused(false); } else stage.setPaused(true);
  stage.setModules({installed: state.installed, selected: ui.screen === 'bench' ? ui.selected : state.installed});
  stage.setVisibleContracts(visibleContracts(CONTRACTS, state).map(c => c.id));
  stage.setSector({route: state.contracts[state.focus] === 'completed' ? null : state.focus});
  stage.setInstalling(ui.installing);
  const insets = stageInsets();
  if (insets) stage.setInsets(insets);
}

function runCountUp() {
  ui.countUp = false;
  const el = $('.count-up');
  if (!el) return;
  const target = Number(el.dataset.count);
  const unitSpan = el.querySelector('.unit')?.outerHTML ?? '';
  const format = (v) => new Intl.NumberFormat(language() === 'ru' ? 'ru-RU' : 'en-GB').format(v);
  if (reducedMotion()) { el.innerHTML = format(target) + unitSpan; return; }
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / 900);
    el.innerHTML = format(Math.round(target * (1 - Math.pow(1 - k, 3)))) + unitSpan;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---- Feedback --------------------------------------------------------------------
function toast(message, tone = '') {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast is-visible ${tone ? `is-${tone}` : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3800);
}

function openConfirm(copy, onConfirm) {
  const dialog = $('#confirm');
  dialog.innerHTML = renderConfirm(copy);
  confirmHandler = onConfirm;
  dialog.showModal();
  dialog.querySelector('[value="cancel"]').focus();
}
$('#confirm').addEventListener('close', (e) => {
  const handler = confirmHandler;
  confirmHandler = null;
  if (e.target.returnValue === 'confirm') handler?.();
});

// ---- Actions ------------------------------------------------------------------------
function accept(id) {
  const state = store.get();
  const contract = contractById(id);
  if (!contract || assess(contract, state).status === 'blocked') { audio.play('deny'); return; }
  const commit = () => {
    const unread = store.get().inbox.filter(m => !m.read).length;
    game.accept(id);
    audio.play(store.get().inbox.filter(m => !m.read).length > unread ? 'message' : 'confirm');
    toast(t('sector.acceptedToast', {name: contract.name}));
  };
  if (state.active && state.active !== id) {
    const active = contractById(state.active).name;
    openConfirm({title: t('sector.confirmSwitch.title'), body: t('sector.confirmSwitch.body', {active}),
      confirm: t('sector.confirmSwitch.confirm', {next: contract.name}), cancel: t('sector.confirmSwitch.cancel', {active})}, commit);
  } else commit();
}

function withdraw(id) {
  const contract = contractById(id);
  openConfirm({title: t('sector.confirmWithdraw.title', {name: contract.name}), body: t('sector.confirmWithdraw.body'),
    confirm: t('sector.confirmWithdraw.confirm'), cancel: t('sector.confirmWithdraw.cancel')}, () => {
    game.withdraw(id);
    toast(t('sector.withdrawnToast', {name: contract.name}));
  });
}

function select(id) {
  if (!MODULES[id] || ui.selected === id) return;
  cancelInstall(false);
  ui.selected = id;
  ui.animateDetail = true;
  audio.play('select');
  render();
}

function install() {
  const state = store.get();
  if (ui.installing) { cancelInstall(true); return; }
  if (ui.selected === state.installed) { navigate('dock'); return; }
  if (powerReserve(ui.selected, state) < 0 || state.operation) { audio.play('deny'); return; }
  const pending = ui.selected;
  ui.installing = true;
  audio.play('couple');
  render();
  installTimer = setTimeout(() => {
    if (!ui.installing || ui.selected !== pending) return;
    ui.installing = false;
    game.install(pending);
    toast(t('bench.installedToast', {module: MODULES[pending].name, n: powerReserve(pending, store.get())}), 'ok');
  }, reducedMotion() ? 0 : 1000);
}

function cancelInstall(announce) {
  if (!ui.installing) return;
  clearTimeout(installTimer);
  ui.installing = false;
  render();
  if (announce) { audio.play('deny'); toast(t('bench.cancelledToast')); }
}

function opExecute() {
  const state = store.get();
  const operation = state.operation;
  if (!operation || ui.opBusy || !ui.opChoice) return;
  const steps = operationSteps(operation.contract);
  const step = steps[operation.step];
  const option = step?.options.find(o => o.id === ui.opChoice);
  if (!option || !optionAvailability(option, operation, state).ok) { audio.play('deny'); return; }
  ui.opBusy = true;
  audio.play('move');
  render();
  const duration = stage ? stage.playStep(step.id, option.id, steps, operation) : 0;
  opTimer = setTimeout(() => {
    ui.opBusy = false;
    ui.opChoice = null;
    lastOpKey = `${operation.contract}:${operation.step + 1}:${state.installed}`;
    showRadio(t(`ops.radio.${step.id}.${option.id}`));
    game.choose(option.id);
    audio.play('confirm');
  }, reducedMotion() ? 0 : duration);
}

// The client's short reaction over the radio after each step.
function showRadio(text) {
  clearTimeout(radioTimer);
  ui.radio = typeof text === 'string' && !text.startsWith('ops.') ? text : '';
  radioTimer = setTimeout(() => { ui.radio = ''; if (ui.screen === 'operation') render(); }, 7000);
}

// Launch and docking shots; a click or key skips them.
function playCut(type, then) {
  if (!stage || reducedMotion()) { then(); return; }
  ui.cut = type;
  render();
  stage.playCut(type, () => { ui.cut = null; then(); });
}

function opFinish() {
  const operation = store.get().operation;
  if (!operation || operation.step < operationSteps(operation.contract).length) return;
  const settleAndShow = () => {
    ui.countUp = true;
    audio.play('reward');
    if (ui.screen === 'results') render(); else navigate('results');
  };
  const docking = Boolean(stage) && !reducedMotion();
  if (docking) { ui.cut = 'dock'; stage.playCut('dock', () => { ui.cut = null; settleAndShow(); }); }
  const {ok, result} = game.finish();
  if (!ok) { ui.cut = null; return; }
  if (docking) navigate('dock'); else settleAndShow();
  toast(t('results.title') + ': +' + credits(result.payout), 'ok');
}

function opAbort() {
  const contract = contractById(store.get().operation.contract);
  openConfirm({title: t('ops.confirmAbort.title'), body: t('ops.confirmAbort.body'), confirm: t('ops.confirmAbort.confirm'), cancel: t('ops.confirmAbort.cancel')}, () => {
    clearTimeout(opTimer);
    ui.opBusy = false;
    ui.opChoice = null;
    game.abort();
    navigate('dock');
    toast(t('ops.abortedToast', {name: contract.name}));
  });
}

function setLanguagePreference(code) {
  // A toast written in the old language would outlive the switch.
  $('#toast').classList.remove('is-visible');
  store.update(s => { s.prefs.lang = code; });
}

const openDetail = () => { ui.detail = isCompact(); ui.animateDetail = true; };

const actions = {
  'focus-contract': ({id}) => {
    ui.animateDetail = store.get().focus !== id;
    ui.detail = isCompact();
    audio.play('click');
    store.update(s => { s.focus = id; });
    if (isCompact()) $('#contract-title')?.focus({preventScroll: true});
  },
  'close-detail': () => { const id = store.get().focus; ui.detail = false; render(); $(`[data-focus-key="row-${id}"]`)?.focus(); },
  accept: ({id}) => accept(id),
  withdraw: ({id}) => withdraw(id),
  'go-dock': () => navigate('dock'),
  'go-sector': ({id}) => { if (id) store.update(s => { s.focus = id; }); navigate('sector'); },
  'open-bench': () => navigate('bench'),
  fit: ({id}) => { ui.pendingSelect = id; navigate('bench'); },
  'select-module': ({id}) => select(id),
  install: () => install(),
  launch: () => {
    if (!game.launch().ok) { audio.play('deny'); return; }
    audio.play('move');
    playCut('launch', () => navigate('operation'));
  },
  start: () => {
    game.start();
    audio.play('confirm');
    navigate('sector');
    $('#main')?.focus({preventScroll: true});
  },
  'intro-sound': ({value}) => store.update(s => { s.prefs.sound = value === 'on'; }),
  buyout: () => openConfirm({title: t('goal.confirm.title'), body: t('goal.confirm.body', {cost: credits(VESSEL.buyout)}),
    confirm: t('goal.confirm.confirm'), cancel: t('goal.confirm.cancel')}, () => {
    if (game.buyout().ok) { audio.play('reward'); toast(t('goal.boughtToast'), 'ok'); }
  }),
  'hide-hints': () => game.endTutorial(),
  repair: () => { if (game.repair().ok) { audio.play('confirm'); toast(t('dock.repairedToast'), 'ok'); } },
  refuel: () => { if (game.refuel().ok) { audio.play('confirm'); toast(t('dock.refuelledToast'), 'ok'); } },
  upgrade: () => openConfirm({title: t('dock.confirmUpgrade.title'), body: t('dock.confirmUpgrade.body', {cost: credits(REACTORS.core96.price)}),
    confirm: t('dock.confirmUpgrade.confirm'), cancel: t('dock.confirmUpgrade.cancel')}, () => {
    if (game.upgradeReactor().ok) { audio.play('reward'); toast(t('dock.upgradedToast'), 'ok'); }
  }),
  'op-select': ({id}) => {
    if (ui.opBusy) return;
    ui.opChoice = id;
    audio.play('select');
    render();
    const operation = store.get().operation;
    const step = operation && operationSteps(operation.contract)[operation.step];
    if (step) stage?.previewStep(step.id, id, operationSteps(operation.contract), operation);
  },
  'op-execute': () => opExecute(),
  'op-finish': () => opFinish(),
  'op-abort': () => opAbort(),
  'item-select': ({id}) => { ui.item = id; openDetail(); audio.play('click'); render(); if (isCompact()) $('#item-title')?.focus({preventScroll: true}); },
  'item-close': () => { ui.detail = false; render(); },
  sell: ({id, qty}) => {
    const {ok, value} = game.sell(id, Number(qty));
    if (!ok) return;
    audio.play('reward');
    toast(t('hold.soldToast', {item: Number(qty) > 1 ? `${itemName(id)} ×${qty}` : itemName(id), value: credits(value)}), 'ok');
    if (!store.get().hold.some(e => e.id === id)) { ui.item = null; ui.detail = false; render(); }
  },
  strip: ({id}) => {
    const {ok, parts} = game.strip(id);
    if (!ok) return;
    audio.play('couple');
    toast(t('hold.strippedToast', {item: itemName(id), list: itemList(parts)}), 'ok');
    if (!store.get().hold.some(e => e.id === id)) { ui.item = parts[0][0]; render(); }
  },
  'log-tab': ({id}) => { ui.logTab = id; ui.detail = false; render(); },
  'log-select': ({id}) => { ui.logContract = id; openDetail(); audio.play('click'); render(); },
  'log-close': () => { ui.detail = false; render(); },
  'comms-select': ({id}) => { ui.message = id; ui.reply = null; openDetail(); audio.play('click'); game.read(id); },
  'comms-close': () => { ui.detail = false; render(); },
  'reply-select': ({id}) => { ui.reply = id; audio.play('select'); render(); },
  'reply-send': ({id}) => {
    const choice = ui.reply;
    const {ok} = game.reply(id, choice);
    if (!ok) return;
    ui.reply = null;
    audio.play('confirm');
    toast(`${t('comms.sentToast')} ${t(`comms.messages.${id}.choices.${choice}`)[2]}`, 'ok');
  },
  'reset-game': () => openConfirm({title: t('settings.confirmReset.title'), body: t('settings.confirmReset.body'),
    confirm: t('settings.confirmReset.confirm'), cancel: t('settings.confirmReset.cancel')}, () => {
    Object.assign(ui, {selected: 'cutter', item: null, logContract: null, message: null, reply: null, opChoice: null, detail: false});
    store.reset();
    navigate('sector');
    toast(t('settings.resetToast'));
  }),
  rotate: ({dx}) => stage?.rotate(Number(dx)),
  'reset-view': () => stage?.reset(),
  reload: () => location.reload(),
};

// Nothing in the interface is dragged; a stray drag of a link or picture would
// paint a ghost image over the scene.
document.addEventListener('dragstart', (e) => e.preventDefault());

document.addEventListener('click', (e) => {
  if (ui.cut) { e.preventDefault(); e.stopPropagation(); stage?.skipCut(); }
}, true);

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (target && !target.disabled) actions[target.dataset.action]?.({...target.dataset});
  const lang = e.target.closest('[data-lang]');
  if (lang) setLanguagePreference(lang.dataset.lang);
  const setting = e.target.closest('[data-setting]');
  if (setting && setting.tagName === 'BUTTON' && !setting.disabled) changeSetting(setting.dataset.setting, setting.dataset.value);
});

function changeSetting(setting, value) {
  if (setting === 'lang') { setLanguagePreference(value); audio.play('click'); return; }
  store.update(s => {
    const p = s.prefs;
    if (setting === 'quality') p.quality = value;
    if (setting === 'reducedMotion') p.reducedMotion = !reducedMotion();
    if (['inspection', 'sound', 'uiSounds', 'ambience', 'invertY'].includes(setting)) p[setting] = !p[setting];
  });
  audio.play('click');
}

// Ranges apply live while dragging and are saved on release.
document.addEventListener('input', (e) => {
  const range = e.target.closest('input[type="range"][data-setting]');
  if (!range) return;
  if (range.dataset.setting === 'volume') audio.setPrefs({volume: Number(range.value)});
  if (range.dataset.setting === 'sensitivity') stage?.setControls({sensitivity: Number(range.value), invertY: store.get().prefs.invertY});
});
document.addEventListener('change', (e) => {
  const range = e.target.closest('input[type="range"][data-setting]');
  if (range) store.update(s => { s.prefs[range.dataset.setting] = Number(range.value); });
});

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (ui.cut) { e.preventDefault(); stage?.skipCut(); return; }
  if (!store.get().started) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  const key = e.key.toLowerCase();
  const state = store.get();
  if (e.key === 'Escape') {
    if (ui.installing) cancelInstall(true);
    else if (ui.detail && isCompact()) { ui.detail = false; render(); }
    else if (ui.screen === 'bench') navigate('dock');
    else return;
    e.preventDefault();
    return;
  }
  const index = ['1', '2', '3'].indexOf(e.key);
  if (index >= 0) {
    if (ui.screen === 'bench') select(MODULE_ORDER[index]);
    if (ui.screen === 'operation' && state.operation) {
      const option = operationSteps(state.operation.contract)[state.operation.step]?.options[index];
      if (option && optionAvailability(option, state.operation, state).ok) actions['op-select']({id: option.id});
    }
    if (ui.screen === 'comms') {
      const entry = state.inbox.find(m => m.id === (ui.message ?? [...state.inbox].reverse()[0]?.id));
      const choice = messageById(entry?.id)?.choices?.[index];
      if (choice && !entry.reply) actions['reply-select']({id: choice.id});
    }
    return;
  }
  if (e.key === 'Enter' && ui.screen === 'operation' && ui.opChoice && e.target === document.body) { opExecute(); return; }
  const routes = {m: 'sector', v: 'dock', h: 'hold', l: 'log', c: 'comms'};
  if (key === 'r') stage?.reset();
  else if (routes[key] && !ui.opBusy) navigate(routes[key]);
  else if (key === 'b' && ui.screen === 'dock') navigate('bench');
});

// ---- Start-up ------------------------------------------------------------------------
store.subscribe((state) => {
  const code = state.prefs.lang ?? detectLanguage();
  if (code !== language() || document.documentElement.lang !== code) setLanguage(code);
  render();
});
compactQuery.addEventListener('change', () => { ui.detail = false; render(); });
motionQuery.addEventListener('change', () => render());
window.addEventListener('hashchange', applyRoute);
window.addEventListener('resize', () => { const insets = stage && stageInsets(); if (insets) stage.setInsets(insets); positionHint(); });

function showFallback() {
  $('#fallback').hidden = false;
  $('#gfx').hidden = true;
  document.body.dataset.ready = 'fallback';
  document.body.dataset.stage = 'failed';
  ui.stageReady = true;
  ui.modulePictures = false;
  render();
}

async function startStage() {
  try {
    await document.fonts.load('700 100px "Tektur"').catch(() => {});
    const [{createStage}, {ITEM_MODELS}] = await Promise.all([import('./render/stage.js'), import('./render/items.js')]);
    const state = store.get();
    stage = createStage(canvas, {
      installed: state.installed,
      initialView: state.started ? SCREENS[ui.screen].view ?? 'dock' : 'intro',
      sectorData: {home: HOME, contracts: CONTRACTS},
      compact: isCompact,
      onFailure: showFallback,
      onProject: (points) => { lastPoints = points; positionAnchors(); positionHint(); },
      onFirstFrame: () => { document.body.dataset.stage = 'live'; ui.stageReady = true; render(); },
      onContextLost: () => { $('#gfx').hidden = false; },
      onContextRestored: () => { $('#gfx').hidden = true; },
    });
    lastOpKey = null;
    syncStage(store.get());
    // A document screen draws no 3D, so there is no first frame to wait for.
    if (!document.body.dataset.stage && SCREENS[ui.screen].page && state.started) { document.body.dataset.stage = 'live'; ui.stageReady = true; }
    // Read-only renderer figures (draw calls, quality tier) for the verification scripts.
    window.lacunaDiagnostics = () => stage.diagnostics();
    document.body.dataset.ready = 'true';
    (window.requestIdleCallback || setTimeout)(() => {
      ui.thumbs = stage.thumbnails(ITEM_MODELS);
      ui.modulePictures = stage.moduleThumbnails(MODULE_ORDER);
      render();
    }, {timeout: 1500});
  } catch (error) {
    console.error('LACUNA 3D view:', error);
    showFallback();
  }
}

setLanguage(store.get().prefs.lang ?? detectLanguage());
applyRoute();
startStage();
