import {CLIENTS} from '../data/contracts.js';
import {messageById} from '../data/comms.js';
import {clock, credits, t} from '../i18n.js';
import {icon} from '../ui/art.js';
import {clientName, effectChips} from './shared.js';

// Comms: client messages with replies that carry visible consequences.

const initials = (name) => name.split(/\s+/).filter(w => /^[A-ZА-ЯЁ]/.test(w)).slice(-2).map(w => w[0]).join('');

function avatar(from) {
  const contact = t(`comms.contacts.${from}`);
  return `<span class="avatar avatar-${from}" aria-hidden="true">${initials(contact)}</span>`;
}

export function replyEffects(effects) {
  const client = (id) => clientName(id);
  return effectChips([
    effects.credits ? ['good', t('comms.effects.credits', {n: credits(effects.credits)})] : null,
    effects.fuel ? ['good', t('comms.effects.fuel', {n: effects.fuel})] : null,
    ...Object.entries(effects.reputation ?? {}).map(([id, d]) => d > 0 ? ['good', t('comms.effects.repUp', {client: client(id), n: d})] : ['bad', t('comms.effects.repDown', {client: client(id), n: -d})]),
    effects.reveal ? ['good', t('comms.effects.reveal')] : null,
    effects.flag === 'haldenClosed' ? ['bad', t('comms.effects.closed', {client: client('halden')})] : null,
    effects.flag === 'orrinDeal' ? ['good', t('comms.effects.deal')] : null,
  ]);
}

function listItem(entry, ui) {
  const message = messageById(entry.id);
  return `
    <li><button type="button" class="message-row ${entry.read ? '' : 'is-unread'}" data-action="comms-select" data-id="${entry.id}" data-focus-key="msg-${entry.id}" aria-pressed="${ui.message === entry.id}">
      ${avatar(message.from)}
      <span class="from"><b>${t(`comms.contacts.${message.from}`)}</b><small>${CLIENTS[message.from].name}</small></span>
      <span class="subject">${t(`comms.messages.${entry.id}.subject`)}</span>
      <time>${clock(entry.at)}</time>
      ${entry.read ? '' : `<span class="unread-dot" aria-label="${t('nav.unread', {n: 1})}"></span>`}
    </button></li>`;
}

function conversation(entry, ui) {
  const message = messageById(entry.id);
  const copy = t(`comms.messages.${entry.id}`);
  const choices = message.choices ?? [];
  const replied = entry.reply ? copy.choices[entry.reply] : null;
  const picker = choices.length && !entry.reply ? `
    <section class="section" aria-labelledby="reply-title">
      <h3 class="h3" id="reply-title">${t('comms.choose')}</h3>
      <div class="reply-options" role="radiogroup" aria-labelledby="reply-title">
        ${choices.map((c, i) => `
          <button type="button" class="reply-option" role="radio" aria-checked="${ui.reply === c.id}" data-action="reply-select" data-id="${c.id}" data-focus-key="reply-${c.id}">
            <kbd aria-hidden="true">${i + 1}</kbd><b>${copy.choices[c.id][0]}</b><span class="text">${copy.choices[c.id][1]}</span>
            <span class="effects">${replyEffects(c.effects) || ''}</span>
          </button>`).join('')}
      </div>
    </section>` : '';
  return `
    <div class="rail-back"><button type="button" class="back-link" data-action="comms-close" data-focus-key="comms-close">${t('common.back')}</button></div>
    <div class="rail-scroll">
      <header class="conversation-head">
        ${avatar(message.from)}
        <span><b>${t(`comms.contacts.${message.from}`)}</b><small>${CLIENTS[message.from].name} · ${clock(entry.at)}</small></span>
      </header>
      <h2 class="h2" id="message-title" tabindex="-1">${copy.subject}</h2>
      <div class="bubble">${copy.body.map(p => `<p>${p}</p>`).join('')}</div>
      ${replied ? `
        <div class="bubble is-mine"><span class="label">${t('comms.replied')}</span><p>${replied[1]}</p></div>
        <p class="outcome">${icon('check')}${replied[2]}</p>` : ''}
      ${picker}
    </div>
    ${picker ? `<div class="rail-foot"><button type="button" class="btn btn-primary btn-block" data-action="reply-send" data-id="${entry.id}" data-focus-key="reply-send"${ui.reply ? '' : ' disabled'}><span>${t('comms.send')}</span></button></div>` : ''}`;
}

export function renderComms(state, ui) {
  const inbox = [...state.inbox].reverse();
  const selected = inbox.find(m => m.id === ui.message) ?? inbox[0];
  return `
    <div class="page-main">
      <header class="page-head"><h1 class="title" id="comms-heading" tabindex="-1">${t('comms.title')}</h1></header>
      ${inbox.length ? `<ol class="message-list" aria-label="${t('comms.listLabel')}">${inbox.map(e => listItem(e, {...ui, message: selected.id})).join('')}</ol>` : `<div class="empty-state">${icon('route', 'icon icon-large')}<h2 class="h2">${t('comms.empty')}</h2></div>`}
    </div>
    ${selected ? `<aside class="rail panel conversation" aria-labelledby="message-title">${conversation(selected, ui)}</aside>` : ''}`;
}
