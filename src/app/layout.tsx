import type { Metadata } from 'next';
import { Golos_Text } from 'next/font/google';
import { SiteFrame } from '@/components/SiteFrame';
import { getProjects } from '@/lib/projects';
import { UI } from '@/lib/i18n';
import { socialImage } from '@/lib/social';
import './globals.css';
import './editorial.css';
const golos = Golos_Text({ subsets: ['latin', 'cyrillic'], display: 'swap', preload: false, variable: '--font-body' });
export const metadata: Metadata = {
  metadataBase: new URL('https://velmren.com'),
  title: { default: 'VELMREN', template: '%s · VELMREN' },
  description: UI.ru.heroLead,
  // New names, so browsers and the CDN drop the old icon; the ICO is marked 32x32 so browsers that read SVG
  // still pick the SVG, which follows the light or dark browser theme.
  icons: {
    icon: [{ url: '/favicon-v2.ico', sizes: '32x32' }, { url: '/favicon-v2.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon-v2.png',
  },
  openGraph: { siteName: 'VELMREN', type: 'website', images: [socialImage] },
  twitter: { card: 'summary_large_image' },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const classicPages = (await getProjects()).filter(project => project.presentation !== 'case').map(project => '/' + project.slug + '/');
  return <html lang="ru" data-scroll-behavior="smooth" className={golos.variable}><body><a className="skip-link" href="#main">К содержимому</a><SiteFrame framed={classicPages}>{children}</SiteFrame></body></html>;
}
