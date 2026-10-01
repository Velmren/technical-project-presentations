export type IconName = 'github' | 'play' | 'search' | 'layers' | 'calculator' | 'file' | 'core' | 'cube' | 'check' | 'arrow' | 'download';
const paths: Record<IconName, string> = {
  github: 'M9 19c-4 1-4-2-6-2m12 5v-4a3.5 3.5 0 0 0-1-3c3-.3 6-1.4 6-6a4.7 4.7 0 0 0-1.3-3.3A4.3 4.3 0 0 0 18.6 2S17.5 1.7 15 3a13.4 13.4 0 0 0-6 0C6.5 1.7 5.4 2 5.4 2a4.3 4.3 0 0 0-.1 3.7A4.7 4.7 0 0 0 4 9c0 4.6 3 5.7 6 6a3.5 3.5 0 0 0-1 3v4',
  play: 'm8 5 11 7-11 7Z', search: 'M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  layers: 'm12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5',
  calculator: 'M5 2h14v20H5ZM8 5h8M8 9h1m3 0h1m3 0h1M8 13h1m3 0h1m3 0h1M8 17h1m3 0h1m3 0h1',
  file: 'M14 2H5v20h14V7Zm0 0v5h5M8 12h8M8 16h6', core: 'M8 8h8v8H8ZM8 2v3m4-3v3m4-3v3M8 19v3m4-3v3m4-3v3M2 8h3m-3 4h3m-3 4h3M19 8h3m-3 4h3m-3 4h3',
  cube: 'm12 2 10 5v10l-10 5L2 17V7Zm0 10 10-5M12 12 2 7m10 5v10',
  check: 'm5 12 4 4L19 6', arrow: 'M4 12h16m-6-6 6 6-6 6', download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
};
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
