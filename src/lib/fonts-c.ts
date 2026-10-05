import localFont from 'next/font/local';

// The site fonts: Tektur for headings, Sofia Sans Condensed for figures and captions, Golos Text for body text.
// The files are Google Fonts' own script files cut down to the characters the site shows (scripts/subset-fonts.py),
// so a page downloads only the scripts it draws. The Cyrillic faces live in fonts-cyrillic.ts, which only Russian
// pages load. src/app/fonts.css puts each family together and ends it with a fallback of matching metrics, so the
// text keeps its place when the web font arrives. Only the heading face of the first screen is preloaded.
const tekturLatin = localFont({
  src: '../fonts/tektur-latin.woff2', weight: '400 900', display: 'swap', preload: true, adjustFontFallback: false, variable: '--tektur-latin',
  declarations: [{ prop: 'font-stretch', value: '75% 100%' }, { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});
const tekturRouble = localFont({
  src: '../fonts/tektur-latin-ext.woff2', weight: '400 900', display: 'swap', preload: false, adjustFontFallback: false, variable: '--tektur-rouble',
  declarations: [{ prop: 'font-stretch', value: '75% 100%' }, { prop: 'unicode-range', value: 'U+20BD' }],
});
const sofiaLatin = localFont({
  src: '../fonts/sofia-latin.woff2', weight: '400 600', display: 'swap', preload: false, adjustFontFallback: false, variable: '--sofia-latin',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});
const golosLatin = localFont({
  src: '../fonts/golos-latin.woff2', weight: '400 900', display: 'swap', preload: false, adjustFontFallback: false, variable: '--golos-latin',
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' }],
});
const golosRouble = localFont({
  src: '../fonts/golos-latin-ext.woff2', weight: '400 900', display: 'swap', preload: false, adjustFontFallback: false, variable: '--golos-rouble',
  declarations: [{ prop: 'unicode-range', value: 'U+20BD' }],
});

// Set on <html>: the faces every page may draw.
export const latinFonts = [tekturLatin, tekturRouble, sofiaLatin, golosLatin, golosRouble].map(font => font.variable).join(' ');
// The wrapper of a concept C page: gives it the heading and figure families (src/app/fonts.css).
export const fontVariables = 'cc-fonts';
