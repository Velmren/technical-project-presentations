// The clips of the gallery in show order, as posters for a page. Other pages of the site take the best ones from here,
// for example the block on the home page: <TileRow clips={bestClips(locale, 2)}/>.
import type { Locale } from '@/lib/i18n';
import { byShowOrder, clock, localizeVideo, videoPath, type Video } from '@/lib/videos';
import { videoData, videos } from './data';
import type { GalleryClip } from './gallery-view';

export const shown = [...videos].sort(byShowOrder);
export const localize = (item: Video, locale: Locale) => localizeVideo(item, locale, videoData.mediaBase);

export function toClip(item: Video, locale: Locale): GalleryClip {
  const video = localize(item, locale);
  const cut = video.cuts[0];
  return { slug: video.slug, href: videoPath(locale, video.slug), title: video.title, kind: video.kind, length: clock(cut.duration),
    sections: video.sections, width: cut.width, height: cut.height, poster: cut.poster, posterSet: cut.posterSet, preview: cut.preview };
}

export const bestClips = (locale: Locale, count = 4) => shown.slice(0, count).map(item => toClip(item, locale));

// The clips of the block on the home page: those named in "home" of the data, or the best ones when none is named.
// A named clip that is not shown (in rework) is left out.
export function homeClips(locale: Locale, count: number) {
  const named = videoData.home.flatMap(slug => shown.filter(item => item.slug === slug));
  return (named.length ? named : shown).slice(0, count).map(item => toClip(item, locale));
}
