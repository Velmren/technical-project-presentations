import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fontVariables } from '@/lib/fonts-c';
import { LANG_KEY, type Locale } from '@/lib/i18n';
import { localizeVideo, videoPath } from '@/lib/videos';
import { Footer, Header } from '@/components/concepts/Chrome';
import { videos } from './data';
import { Watch } from './Watch';
import '@/app/concepts/c/concept-c.css';
import './video.css';

const SITE = 'https://velmren.com';
// Link previews are cut to one size for every clip.
const SHARE = { width: 1200, height: 630 };

const find = (slug: string) => videos.find(video => video.slug === slug);
export const videoParams = () => videos.map(video => ({ slug: video.slug }));

// The language choice of the site, kept through a link with a time mark: the query goes along to the other language.
const languageGate = (locale: Locale, alternate: string) =>
  `(function(){try{var s=localStorage.getItem('${LANG_KEY}');var b=((navigator.languages&&navigator.languages[0])||navigator.language||'').toLowerCase();var w=s||(b.indexOf('ru')===0?'ru':'en');${locale === 'en' ? "document.documentElement.lang='en';" : ''}if(w!=='${locale}')location.replace('${alternate}'+location.search+location.hash);}catch(e){}})();`;

export function videoMetadata(slug: string, locale: Locale): Metadata {
  const item = find(slug);
  if (!item) return {};
  const video = localizeVideo(item, locale);
  const cut = video.cuts[0];
  const path = videoPath(locale, slug);
  const title = `${video.title}. ${video.kind}`;
  const image = cut.share ? { url: cut.share, ...SHARE, alt: video.title } : { url: cut.poster, width: cut.width, height: cut.height, alt: video.title };
  return {
    title, description: video.text,
    alternates: { canonical: path, languages: { ru: videoPath('ru', slug), en: videoPath('en', slug) } },
    openGraph: {
      title, description: video.text, url: path, siteName: 'VELMREN', locale: locale === 'ru' ? 'ru_RU' : 'en_GB', type: 'video.other',
      images: [image],
      videos: [{ url: SITE + cut.src, secureUrl: SITE + cut.src, type: 'video/mp4', width: cut.width, height: cut.height }],
    },
    twitter: { card: 'summary_large_image', title, description: video.text, images: [image.url] },
  };
}

// The page of one clip: the film, its name, two lines about it and a link to copy. Nothing else around.
export function VideoPage({ slug, locale }: { slug: string; locale: Locale }) {
  const item = find(slug);
  if (!item) notFound();
  const video = localizeVideo(item, locale);
  const cut = video.cuts[0];
  const alternate = videoPath(locale === 'ru' ? 'en' : 'ru', slug);
  const description = {
    '@context': 'https://schema.org', '@type': 'VideoObject', name: video.title, description: video.text, uploadDate: video.date,
    duration: `PT${Math.round(cut.duration)}S`, thumbnailUrl: SITE + (cut.share ?? cut.poster), contentUrl: SITE + cut.src,
    url: SITE + videoPath(locale, slug), inLanguage: locale,
  };
  return <div className={fontVariables} lang={locale}>
    <script dangerouslySetInnerHTML={{ __html: languageGate(locale, alternate) }}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(description).replace(/</g, '\\u003c') }}/>
    <div className="cc-page vg-page">
      <Header locale={locale} alternate={alternate}/>
      <main id="main"><Watch video={video} locale={locale}/></main>
      <Footer locale={locale}/>
    </div>
  </div>;
}
