import localFont from 'next/font/local';

// The Cyrillic faces of the site fonts (see fonts-c.ts). Only the Russian layout imports this file, so English pages
// neither declare nor preload them; the page for missing addresses has its own copy (fonts-cyrillic-404.ts).
const tekturCyrillic = localFont({
  src: '../fonts/tektur-cyrillic.woff2', weight: '400 900', display: 'swap', preload: true, adjustFontFallback: false, variable: '--tektur-cyrillic',
  declarations: [{ prop: 'font-stretch', value: '75% 100%' }, { prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});
const sofiaCyrillic = localFont({
  src: '../fonts/sofia-cyrillic.woff2', weight: '400 600', display: 'swap', preload: false, adjustFontFallback: false, variable: '--sofia-cyrillic',
  declarations: [{ prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});
const golosCyrillic = localFont({
  src: '../fonts/golos-cyrillic.woff2', weight: '400 900', display: 'swap', preload: false, adjustFontFallback: false, variable: '--golos-cyrillic',
  declarations: [{ prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});

export const cyrillicFonts = [tekturCyrillic, sofiaCyrillic, golosCyrillic].map(font => font.variable).join(' ');
