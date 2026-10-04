import { Golos_Text } from 'next/font/google';
import type { Locale } from '@/lib/i18n';
import { ContactClicks } from './ContactClicks';
import '@/app/globals.css';
import '@/app/editorial.css';

const golos = Golos_Text({ subsets: ['latin', 'cyrillic'], display: 'swap', preload: false, variable: '--font-body' });
const SKIP = { ru: 'К содержимому', en: 'Skip to content' } as const;

// The document every page stands in. The Russian and the English routes each have their own root layout,
// so a page says its language in <html lang> without any script.
export function RootDocument({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <html lang={locale} data-scroll-behavior="smooth" className={golos.variable}>
    <body><a className="skip-link" href="#main">{SKIP[locale]}</a>{children}<ContactClicks/></body>
  </html>;
}
