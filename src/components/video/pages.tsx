// What the video routes render: the gallery, the page of one clip and a collection, each in Russian and English.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fontVariables } from '@/lib/fonts-c';
import { LANG_KEY, type Locale } from '@/lib/i18n';
import { collectionPath, galleryPath, SECTIONS, videoPath, type Video } from '@/lib/videos';
import { Footer, Header } from '@/components/concepts/Chrome';
import { localize, shown, toClip } from './clips';
import { videoData } from './data';
import { Gallery } from './Gallery';
import { filterOptions, isTall } from './gallery-view';
import { Playlist } from './Playlist';
import { VIDEO_UI } from './strings';
import { Watch } from './Watch';
import '@/app/concepts/c/concept-c.css';
import './video.css';

const SITE = 'https://velmren.com';
// Link previews are cut to one size for every clip.
const SHARE = { width: 1200, height: 630 };

// A collection is published once every clip in it is.
const collections = videoData.collections.filter(set => set.clips.every(slug => shown.some(video => video.slug === slug)));
const absolute = (address: string) => address.startsWith('https://') ? address : SITE + address;
const other = (locale: Locale): Locale => locale === 'ru' ? 'en' : 'ru';
const ogLocale = (locale: Locale) => locale === 'ru' ? 'ru_RU' : 'en_GB';

// A few clips to go on with: the same shape of frame, the clip's own section first.
function moreFor(item: Video) {
  const alike = shown.filter(video => video.slug !== item.slug && isTall(video.cuts[0]) === isTall(item.cuts[0]));
  return [...alike.filter(video => video.sections[0] === item.sections[0]), ...alike.filter(video => video.sections[0] !== item.sections[0])].slice(0, 3);
}

// /video/<slug>/ is a clip, /video/c/<slug>/ a collection. Both live in one route, so the build always has pages to make
// even while there are no collections.
export const videoParams = () => [
  ...shown.map(video => ({ path: [video.slug] })),
  ...collections.map(set => ({ path: ['c', set.slug] })),
];
const findClip = (path: string[]) => path.length === 1 ? shown.find(video => video.slug === path[0]) : undefined;
const findCollection = (path: string[]) => path.length === 2 && path[0] === 'c' ? collections.find(set => set.slug === path[1]) : undefined;

// A link preview is a wide picture, so a clip that has a wide cut shows it there even when its square cut comes first.
const shareImage = (item: Video, locale: Locale, alt: string) => {
  const cuts = localize(item, locale).cuts;
  const cut = cuts.find(one => one.width > one.height) ?? cuts[0];
  return cut.share ? { url: cut.share, ...SHARE, alt } : { url: cut.poster, width: cut.width, height: cut.height, alt };
};

// The language choice of the site, kept through a link with a time mark: the query goes along to the other language.
const languageGate = (locale: Locale, alternate: string) =>
  `(function(){try{var s=localStorage.getItem('${LANG_KEY}');var b=((navigator.languages&&navigator.languages[0])||navigator.language||'').toLowerCase();var w=s||(b.indexOf('ru')===0?'ru':'en');${locale === 'en' ? "document.documentElement.lang='en';" : ''}if(w!=='${locale}')location.replace('${alternate}'+location.search+location.hash);}catch(e){}})();`;

function Frame({ locale, alternate, children }: { locale: Locale; alternate: string; children: React.ReactNode }) {
  return <div className={fontVariables} lang={locale}>
    <script dangerouslySetInnerHTML={{ __html: languageGate(locale, alternate) }}/>
    <div className="cc-page vg-page">
      <Header locale={locale} alternate={alternate}/>
      <main id="main">{children}</main>
      <Footer locale={locale}/>
    </div>
  </div>;
}

export function galleryMetadata(locale: Locale): Metadata {
  const t = VIDEO_UI[locale];
  const path = galleryPath(locale);
  const images = shown.length ? [shareImage(shown[0], locale, 'VELMREN')] : undefined;
  return {
    title: t.gallery, description: t.galleryAbout,
    alternates: { canonical: path, languages: { ru: galleryPath('ru'), en: galleryPath('en') } },
    openGraph: { title: `${t.gallery} · VELMREN`, description: t.galleryAbout, url: path, siteName: 'VELMREN', locale: ogLocale(locale), type: 'website', images },
  };
}

export function GalleryPage({ locale }: { locale: Locale }) {
  const clips = shown.map(item => toClip(item, locale));
  return <Frame locale={locale} alternate={galleryPath(other(locale))}>
    <Gallery clips={clips} options={filterOptions(clips, SECTIONS)} locale={locale}/>
  </Frame>;
}

export function videoMetadata(path: string[], locale: Locale): Metadata {
  const item = findClip(path);
  if (item) {
    const video = localize(item, locale);
    const cut = video.cuts[0];
    const address = videoPath(locale, video.slug);
    const title = `${video.title}. ${video.kind}`;
    const image = shareImage(item, locale, video.title);
    return {
      title, description: video.text,
      alternates: { canonical: address, languages: { ru: videoPath('ru', video.slug), en: videoPath('en', video.slug) } },
      openGraph: {
        title, description: video.text, url: address, siteName: 'VELMREN', locale: ogLocale(locale), type: 'video.other', images: [image],
        videos: [{ url: absolute(cut.src), secureUrl: absolute(cut.src), type: 'video/mp4', width: cut.width, height: cut.height }],
      },
      twitter: { card: 'summary_large_image', title, description: video.text, images: [image.url] },
    };
  }
  const set = findCollection(path);
  if (!set) return {};
  const address = collectionPath(locale, set.slug);
  const first = shown.find(video => video.slug === set.clips[0])!;
  return {
    title: set.title[locale], description: set.text[locale],
    // A collection is made for one client and opens only by its link.
    robots: { index: false },
    alternates: { canonical: address, languages: { ru: collectionPath('ru', set.slug), en: collectionPath('en', set.slug) } },
    openGraph: { title: set.title[locale], description: set.text[locale], url: address, siteName: 'VELMREN', locale: ogLocale(locale), type: 'website', images: [shareImage(first, locale, set.title[locale])] },
  };
}

export function VideoRoute({ path, locale }: { path: string[]; locale: Locale }) {
  const item = findClip(path);
  if (item) {
    const video = localize(item, locale);
    const cut = video.cuts[0];
    const description = {
      '@context': 'https://schema.org', '@type': 'VideoObject', name: video.title, description: video.text, uploadDate: video.date,
      duration: `PT${Math.round(cut.duration)}S`, thumbnailUrl: SITE + shareImage(item, locale, video.title).url, contentUrl: absolute(cut.src),
      url: SITE + videoPath(locale, video.slug), inLanguage: locale,
    };
    // The page of one clip: the film, its name, two lines about it and a link to copy. Nothing else around.
    return <Frame locale={locale} alternate={videoPath(other(locale), video.slug)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(description).replace(/</g, '\\u003c') }}/>
      <Watch video={video} more={moreFor(item).map(next => toClip(next, locale))} galleryHref={galleryPath(locale)} locale={locale}/>
    </Frame>;
  }
  const set = findCollection(path);
  if (!set) notFound();
  const clips = set.clips.map(slug => shown.find(video => video.slug === slug)!).map(clip => ({ ...localize(clip, locale), href: videoPath(locale, clip.slug) }));
  return <Frame locale={locale} alternate={collectionPath(other(locale), set.slug)}>
    <Playlist title={set.title[locale]} text={set.text[locale]} clips={clips} galleryHref={galleryPath(locale)} locale={locale}/>
  </Frame>;
}
