import localFont from 'next/font/local';

// The Cyrillic faces again, for the page of missing addresses, without preloading: Next counts the fonts that
// global-not-found.tsx imports as used on every route, so importing fonts-cyrillic.ts there would make English
// pages preload the Cyrillic heading face too. Next names a family after its constant, so these have names of their
// own: with the same names Russian pages would get two faces of one family and load the file twice.
const tekturMissingPage = localFont({
  src: '../fonts/tektur-cyrillic.woff2', weight: '400 900', display: 'swap', preload: false, adjustFontFallback: false, variable: '--tektur-cyrillic',
  declarations: [{ prop: 'font-stretch', value: '75% 100%' }, { prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});
const sofiaMissingPage = localFont({
  src: '../fonts/sofia-cyrillic.woff2', weight: '400 600', display: 'swap', preload: false, adjustFontFallback: false, variable: '--sofia-cyrillic',
  declarations: [{ prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});
const golosMissingPage = localFont({
  src: '../fonts/golos-cyrillic.woff2', weight: '400 900', display: 'swap', preload: false, adjustFontFallback: false, variable: '--golos-cyrillic',
  declarations: [{ prop: 'unicode-range', value: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116' }],
});

export const missingPageFonts = [tekturMissingPage, sofiaMissingPage, golosMissingPage].map(font => font.variable).join(' ');
