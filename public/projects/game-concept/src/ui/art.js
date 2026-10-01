// Icons come from the inline sprite in index.html; module drawings are line
// elevations of the actual 3D modules (coupling on the right, tool facing left).

export const icon = (name, className = 'icon') => `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const DRAWINGS = {
  cutter: `
    <path d="M86 20h14v16H86z"/><path d="M100 17h6v22h-6z"/>
    <path d="M44 14h42v28H44z"/><path d="M50 10h30v4M50 42h30"/>
    <path d="M18 18h26v7H18zM18 31h26v7H18z"/>
    <path d="M22 18v7m5-7v7m5-7v7m5-7v7M22 31v7m5-7v7m5-7v7m5-7v7"/>
    <path d="M18 19.5 10 20.5v3l8 1M18 32.5l-8 1v3l8 1"/>
    <path d="M56 22h6v12h-6zM66 22h6v12h-6"/>`,
  grapple: `
    <path d="M88 20h12v16H88z"/><path d="M100 17h6v22h-6z"/>
    <path d="M62 16h26v24H62z"/><path d="M66 16v24m4-24v24m4-24v24m4-24v24"/>
    <path d="M62 20 44 10 30 9 20 16l2 3 9-5 11 1 20 13"/>
    <path d="M62 36 44 46 30 47 20 40l2-3 9 5 11-1 20-13"/>
    <path d="M62 28H24"/><circle cx="20" cy="28" r="4"/>
    <circle cx="44" cy="11" r="1.6"/><circle cx="44" cy="45" r="1.6"/>
    <path d="M78 17 50 13M78 39 50 43"/>`,
  arc: `
    <path d="M88 18h12v20H88z"/><path d="M100 15h6v26h-6z"/>
    <path d="M58 12h30v32H58z"/><path d="M62 8h22v4M62 44h22"/>
    <path d="M24 20h34v16H24z"/>
    <path d="M28 14v28m8-28v28m8-28v28m8-28v28"/>
    <path d="M24 22 14 24v8l10 2M14 26l-4 1v2l4 1"/>`,
};

export const moduleArt = (id) => `<svg viewBox="0 0 112 56" aria-hidden="true">${DRAWINGS[id]}</svg>`;

export const kindIcon = {recovery: 'recovery', salvage: 'salvage', breach: 'breach', service: 'service'};
export const riskIcon = {debris: 'debris', tumble: 'tumble', radiation: 'radiation'};
