// Player icons, drawn on a 24 px grid in the line weight of the site.
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export type PlayerIconName = 'play' | 'pause' | 'replay' | 'sound' | 'muted' | 'fullscreen' | 'exit' | 'link';

export function PlayerIcon({ name }: { name: PlayerIconName }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {name === 'play' && <path fill="currentColor" d="M7 4.5v15l13-7.5Z"/>}
    {name === 'pause' && <path fill="currentColor" d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z"/>}
    {name === 'replay' && <g {...line}><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/></g>}
    {(name === 'sound' || name === 'muted') && <g {...line}>
      <path d="M11 4 6 8H3v8h3l5 4Z"/>
      {name === 'sound' ? <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/> : <path d="m16 9 6 6m0-6-6 6"/>}
    </g>}
    {name === 'fullscreen' && <path {...line} d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/>}
    {name === 'exit' && <path {...line} d="M3 9h6V3m6 0v6h6M9 21v-6H3m18 0h-6v6"/>}
    {name === 'link' && <g {...line} strokeWidth={2}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></g>}
  </svg>;
}
