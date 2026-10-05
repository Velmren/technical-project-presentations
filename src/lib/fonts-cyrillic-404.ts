import localFont from 'next/font/local';

// The Cyrillic faces again, for the page of missing addresses, without preloading: Next counts the fonts that
// global-not-found.tsx imports as used on every route, so importing fonts-cyrillic.ts there would make English
// pages preload the Cyrillic heading face too.
const tekturCyrillic = localFont({
  src: '../fonts/tektur-cyrillic.woff2', weight: '400 900', display: 'swap', preload: false, adjustFontFallback: false, variable: '--tektur-cyrillic',
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

export const missingPageFonts = [tekturCyrillic, sofiaCyrillic, golosCyrillic].map(font => font.variable).join(' ');
