import type { Locale } from '@/lib/i18n';
import { latinFonts } from '@/lib/fonts-c';
import { ContactClicks } from './ContactClicks';
import '@/app/globals.css';
import '@/app/editorial.css';
import '@/app/fonts.css';

const SKIP = { ru: 'К содержимому', en: 'Skip to content' } as const;

// The document every page stands in. The Russian and the English routes each have their own root layout,
// so a page says its language in <html lang> without any script. fonts: the faces a layout adds (Cyrillic ones).
export function RootDocument({ locale, fonts = '', children }: { locale: Locale; fonts?: string; children: React.ReactNode }) {
  return <html lang={locale} data-scroll-behavior="smooth" className={`${latinFonts} ${fonts}`.trim()}>
    <body><a className="skip-link" href="#main">{SKIP[locale]}</a>{children}<ContactClicks/></body>
  </html>;
}
