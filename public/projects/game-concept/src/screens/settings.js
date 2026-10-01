import {LANGUAGES, t} from '../i18n.js';
import en from '../locales/en.js';
import ru from '../locales/ru.js';
import {makerLink} from './shared.js';

// Settings: language, sound, controls, display and a new game.

const names = {en: en.meta.name, ru: ru.meta.name};

const toggle = (id, on, labelledby, disabled = false) =>
  `<button type="button" class="switch" role="switch" id="set-${id}" aria-checked="${on}" aria-labelledby="${labelledby}" data-setting="${id}" data-focus-key="set-${id}"${disabled ? ' disabled' : ''}></button>`;

const segmented = (id, options, current, labelledby) => `
  <div class="segmented" role="group" aria-labelledby="${labelledby}">
    ${options.map(([value, label, lang]) => `<button type="button" data-setting="${id}" data-value="${value}" data-focus-key="set-${id}-${value}"${lang ? ` lang="${lang}"` : ''} aria-pressed="${value === current}">${label}</button>`).join('')}
  </div>`;

const range = (id, value, min, max, step, labelledby) =>
  `<input type="range" class="range" id="set-${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-labelledby="${labelledby}" data-setting="${id}" data-focus-key="set-${id}">`;

export function renderSettings(state, {reduced, lang}) {
  const p = state.prefs;
  const needsSound = p.sound ? '' : `<small>${t('settings.needsSound')}</small>`;
  return `
    <div class="settings-page panel">
      <header class="page-head"><h1 class="title" id="settings-heading" tabindex="-1">${t('settings.title')}</h1></header>

      <section class="settings-group" aria-labelledby="g-language">
        <h2 class="h3" id="g-language">${t('settings.language')}</h2>
        <div class="setting"><span><b id="l-lang">${t('settings.language')}</b></span>${segmented('lang', LANGUAGES.map(code => [code, names[code], code]), lang, 'l-lang')}</div>
      </section>

      <section class="settings-group" aria-labelledby="g-sound">
        <h2 class="h3" id="g-sound">${t('settings.sound')}</h2>
        <div class="setting"><span><b id="l-sound">${t('settings.soundOn')}</b><small>${t('settings.soundNote')}</small></span>${toggle('sound', p.sound, 'l-sound')}</div>
        <div class="setting"><span><b id="l-volume">${t('settings.volume')}</b></span>${range('volume', p.volume, 0, 1, 0.05, 'l-volume')}</div>
        <div class="setting"><span><b id="l-ui">${t('settings.uiSounds')}</b>${needsSound}</span>${toggle('uiSounds', p.uiSounds, 'l-ui', !p.sound)}</div>
        <div class="setting"><span><b id="l-amb">${t('settings.ambience')}</b>${needsSound}</span>${toggle('ambience', p.ambience, 'l-amb', !p.sound)}</div>
      </section>

      <section class="settings-group" aria-labelledby="g-controls">
        <h2 class="h3" id="g-controls">${t('settings.controls')}</h2>
        <div class="setting"><span><b id="l-sens">${t('settings.sensitivity')}</b></span>${range('sensitivity', p.sensitivity, 0.4, 2, 0.1, 'l-sens')}</div>
        <div class="setting"><span><b id="l-inv">${t('settings.invertY')}</b></span>${toggle('invertY', p.invertY, 'l-inv')}</div>
        <dl class="keys">${t('settings.keys').map(([keys, what]) => `<dt>${keys}</dt><dd>${what}</dd>`).join('')}</dl>
      </section>

      <section class="settings-group" aria-labelledby="g-display">
        <h2 class="h3" id="g-display">${t('settings.display')}</h2>
        <div class="setting"><span><b id="l-quality">${t('settings.quality')}</b><small>${t('settings.qualityNote')}</small></span>${segmented('quality', ['auto', 'high', 'low'].map(v => [v, t(`settings.qualityOptions.${v}`)]), p.quality, 'l-quality')}</div>
        <div class="setting"><span><b id="l-motion">${t('settings.motion')}</b><small>${t('settings.motionNote')}</small></span>${toggle('reducedMotion', reduced, 'l-motion')}</div>
        <div class="setting"><span><b id="l-insp">${t('settings.inspection')}</b><small>${t('settings.inspectionNote')}</small></span>${toggle('inspection', p.inspection, 'l-insp')}</div>
      </section>

      <section class="settings-group" aria-labelledby="g-game">
        <h2 class="h3" id="g-game">${t('settings.game')}</h2>
        <div class="setting"><span><b>${t('settings.reset')}</b><small>${t('settings.resetNote')}</small></span><button type="button" class="btn btn-secondary btn-small" data-action="reset-game" data-focus-key="reset">${t('settings.reset')}</button></div>
      </section>
      <footer class="settings-foot">${makerLink('settings-maker')}</footer>
    </div>`;
}
