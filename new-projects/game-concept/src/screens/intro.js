import {VESSEL} from '../data/equipment.js';
import {LANGUAGES, number, t, unit} from '../i18n.js';
import {icon} from '../ui/art.js';
import {makerLink} from './shared.js';
import en from '../locales/en.js';
import ru from '../locales/ru.js';

// Title screen for a new run: who the player is, the goal, how the work goes
// and one clear way in. It also covers the 3D view while the scene loads.

const names = {en: en.meta.name, ru: ru.meta.name};

export function renderIntro(state, {ready, lang}) {
  const pct = Math.min(100, state.credits / VESSEL.buyout * 100);
  const sound = state.prefs.sound;
  return `
    <div class="intro-card">
      <p class="intro-kicker">${t('intro.kicker')}</p>
      <h1 class="intro-title" id="intro-title" tabindex="-1">LACUNA</h1>
      <p class="intro-lead">${t('intro.lead')}</p>
      <ul class="intro-facts">
        <li>${icon('vessel')}<span><b>${t('intro.whoTitle')}</b>${t('intro.who')}</span></li>
        <li>${icon('check')}<span><b>${t('intro.goalTitle')}</b>${t('intro.goal', {cost: `${number(VESSEL.buyout)} ${unit('cr')}`})}</span></li>
        <li>${icon('sector')}<span><b>${t('intro.howTitle')}</b>${t('intro.how')}</span></li>
      </ul>
      <div class="intro-goal" aria-hidden="true">
        <span class="goal-bar"><i style="width:${pct.toFixed(1)}%"></i></span>
        <span class="tabular">${number(state.credits)} / ${number(VESSEL.buyout)} ${unit('cr')}</span>
      </div>
      <div class="intro-actions">
        <button type="button" class="btn btn-primary" data-action="start" data-focus-key="start"${ready ? '' : ' disabled aria-describedby="intro-loading"'}>
          <span>${t('intro.start')}</span>
        </button>
        ${ready ? '' : `<p class="note" id="intro-loading">${t('intro.loading')}</p>`}
      </div>
      <div class="intro-options">
        <div class="segmented" role="group" aria-label="${t('settings.language')}">
          ${LANGUAGES.map(code => `<button type="button" data-lang="${code}" lang="${code}" data-focus-key="intro-lang-${code}" aria-pressed="${code === lang}">${names[code]}</button>`).join('')}
        </div>
        <div class="segmented" role="group" aria-label="${t('settings.sound')}">
          <button type="button" data-action="intro-sound" data-value="on" data-focus-key="intro-sound-on" aria-pressed="${sound}">${t('intro.soundOn')}</button>
          <button type="button" data-action="intro-sound" data-value="off" data-focus-key="intro-sound-off" aria-pressed="${!sound}">${t('intro.soundOff')}</button>
        </div>
      </div>
      ${makerLink('intro-maker')}
    </div>`;
}
