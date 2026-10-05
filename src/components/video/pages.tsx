// What the video routes render: the gallery, the page of one clip and a collection, each in Russian and English.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fontVariables } from '@/lib/fonts-c';
import { UI, type Locale } from '@/lib/i18n';
import { ORGANIZATION_ID, pageMetadata, SITE, SITE_NAME } from '@/lib/seo';
import { clipTrail, galleryData } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd';
import { collectionPath, galleryPath, SECTIONS, videoPath, type ShownVideo, type Video } from '@/lib/videos';
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

// Link previews are cut to one size for every clip.
const SHARE = { width: 1200, height: 630 };

// A collection is published once every clip in it is.
const collections = videoData.collections.filter(set => set.clips.every(slug => shown.some(video => video.slug === slug)));
const absolute = (address: string) => address.startsWith('https://') ? address : SITE + address;
const other = (locale: Locale): Locale => locale === 'ru' ? 'en' : 'ru';
// The title for search results says what kind of clip it is first; a clip without its own takes name and kind.
const searchTitle = (video: ShownVideo) => video.searchTitle ?? `${video.title}. ${video.kind}`;

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
export const shareImage = (item: Video, locale: Locale, alt: string) => {
  const cuts = localize(item, locale).cuts;
  const cut = cuts.find(one => one.width > one.height) ?? cuts[0];
  return cut.share ? { url: cut.share, ...SHARE, alt } : { url: cut.poster, width: cut.width, height: cut.height, alt };
};

function Frame({ locale, alternate, ask, children }: { locale: Locale; alternate: string; ask?: string; children: React.ReactNode }) {
  return <div className={fontVariables} lang={locale}>
    <div className="cc-page vg-page">
      <Header locale={locale} alternate={alternate}/>
      <main id="main">{children}</main>
      {/* A clip page keeps its content in the centred column; the gallery runs across the window. */}
      <Footer locale={locale} ask={ask} contained={Boolean(ask)}/>
    </div>
  </div>;
}

export function galleryMetadata(locale: Locale): Metadata {
  const t = VIDEO_UI[locale];
  return pageMetadata({ locale, path: galleryPath('ru'), title: t.galleryTitle, description: t.galleryAbout, image: shown.length ? shareImage(shown[0], locale, SITE_NAME) : undefined });
}

export function GalleryPage({ locale }: { locale: Locale }) {
  const t = VIDEO_UI[locale];
  const clips = shown.map(item => toClip(item, locale));
  const list = shown.map(item => ({ name: searchTitle(localize(item, locale)), path: videoPath('ru', item.slug) }));
  return <Frame locale={locale} alternate={galleryPath(other(locale))}>
    <JsonLd data={galleryData(locale, { name: t.gallery, description: t.galleryAbout, path: galleryPath('ru') }, list)}/>
    <Gallery clips={clips} options={filterOptions(clips, SECTIONS)} locale={locale}/>
  </Frame>;
}

export function videoMetadata(path: string[], locale: Locale): Metadata {
  const item = findClip(path);
  if (item) {
    const video = localize(item, locale);
    const cut = video.cuts[0];
    return pageMetadata({
      locale, path: videoPath('ru', video.slug), title: searchTitle(video), description: video.text, image: shareImage(item, locale, video.title),
      openGraph: { type: 'video.other', videos: [{ url: absolute(cut.src), secureUrl: absolute(cut.src), type: 'video/mp4', width: cut.width, height: cut.height }] },
    });
  }
  const set = findCollection(path);
  if (!set) return {};
  const first = shown.find(video => video.slug === set.clips[0])!;
  return pageMetadata({
    locale, path: collectionPath('ru', set.slug), title: set.title[locale], description: set.text[locale], image: shareImage(first, locale, set.title[locale]),
    // A collection is made for one client and opens only by its link.
    robots: { index: false },
  });
}

export function VideoRoute({ path, locale }: { path: string[]; locale: Locale }) {
  const item = findClip(path);
  if (item) {
    const video = localize(item, locale);
    const cut = video.cuts[0];
    const description = {
      '@context': 'https://schema.org', '@type': 'VideoObject', name: searchTitle(video), description: video.text,
      // Search engines ask for a time with its zone; the day is what is known, so it starts at midnight in Minsk.
      uploadDate: `${video.date}T00:00:00+03:00`,
      duration: `PT${Math.round(cut.duration)}S`, thumbnailUrl: SITE + shareImage(item, locale, video.title).url, contentUrl: absolute(cut.src),
      url: SITE + videoPath(locale, video.slug), inLanguage: locale, publisher: { '@type': 'Organization', '@id': ORGANIZATION_ID, name: SITE_NAME, url: SITE + '/' },
    };
    // The page of one clip: the film, its name, two lines about it and a link to copy. Nothing else around.
    return <Frame locale={locale} alternate={videoPath(other(locale), video.slug)} ask={UI[locale].askClip}>
      <JsonLd data={description}/>
      <JsonLd data={clipTrail(locale, { name: VIDEO_UI[locale].gallery, path: galleryPath('ru') }, { name: video.title, path: videoPath('ru', video.slug) })}/>
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
