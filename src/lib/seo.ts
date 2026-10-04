// What search engines and link previews read on every page: its address in both languages, title, description
// and picture. One place, so the home, the work pages and the video pages describe themselves the same way.
import type { Metadata } from 'next';
import { languageAddresses, localePath, type Locale } from './i18n';
import { socialImage } from './social';

export const SITE = 'https://velmren.com';
export const SITE_NAME = 'VELMREN';
// One name for the practice in structured data, so every page refers to the same thing.
export const ORGANIZATION_ID = SITE + '/#organization';

const OG_LOCALE = { ru: 'ru_RU', en: 'en_GB' } as const;
const other = (locale: Locale): Locale => locale === 'ru' ? 'en' : 'ru';

type Picture = { url: string; width: number; height: number; alt: string };
type PageInfo = {
  locale: Locale;
  // The Russian address of the page; the English one lives under /en/.
  path: string;
  title: string;
  description: string;
  image?: Picture;
  // The home page carries the site name itself; every other title gets it from the layout template.
  absoluteTitle?: boolean;
  openGraph?: NonNullable<Metadata['openGraph']>;
  robots?: Metadata['robots'];
};

export function pageMetadata({ locale, path, title, description, image = socialImage, absoluteTitle, openGraph, robots }: PageInfo): Metadata {
  const address = localePath(locale, path);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    robots,
    alternates: { canonical: address, languages: languageAddresses(path) },
    openGraph: { title, description, url: address, siteName: SITE_NAME, locale: OG_LOCALE[locale], alternateLocale: [OG_LOCALE[other(locale)]], type: 'website', images: [image], ...openGraph },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  };
}

// The part of the metadata every page of one language shares; set by its root layout.
export function siteMetadata(description: string): Metadata {
  return {
    metadataBase: new URL(SITE),
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description,
    // New names, so browsers and the CDN drop the old icon; the ICO is marked 32x32 so browsers that read SVG
    // still pick the SVG, which follows the light or dark browser theme.
    icons: {
      icon: [{ url: '/favicon-v2.ico', sizes: '32x32' }, { url: '/favicon-v2.svg', type: 'image/svg+xml' }],
      apple: '/apple-touch-icon-v2.png',
    },
    openGraph: { siteName: SITE_NAME, type: 'website', images: [socialImage] },
    twitter: { card: 'summary_large_image' },
  };
}
