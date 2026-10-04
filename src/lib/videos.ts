// Video gallery data: clips, their cuts and collections. One file, src/content/videos.json, feeds the gallery,
// the clip pages and the collections.
import { z } from 'zod';
import type { Locale } from './i18n';

export const SECTIONS = ['promo', 'games', 'motion', '3d', 'editing'] as const;
export type SectionId = typeof SECTIONS[number];

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const asset = z.string().startsWith('/assets/');
const both = z.object({ ru: z.string().min(1), en: z.string().min(1) });
// One file per language; a clip without words has a single file for both.
const perLanguage = <T extends z.ZodType<string>>(file: T) => z.object({ ru: file, en: file.optional() });
const page = z.string().refine(v => v.startsWith('/') || v.startsWith('https://'), 'Use a site path or HTTPS URL');

// A cut is one frame format of a clip: the wide film, its square or vertical version.
const cut = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  duration: z.number().positive(),
  src: perLanguage(asset.endsWith('.mp4')),
  poster: perLanguage(asset.endsWith('.webp')),
  // Widths of the reduced AVIF copies of the poster, made for the gallery posters by scripts/prepare-videos.mjs:
  // <poster name>-<width>.avif next to the poster. The clip page and the link preview keep the full poster.
  posterWidths: z.array(z.number().int().positive()).min(1).optional(),
  // Link preview picture for messengers, JPEG.
  share: perLanguage(asset.endsWith('.jpg')).optional(),
  // The lower left corner of the poster is light, so the start button there is dark.
  lightPoster: z.boolean().optional(),
  // Short silent fragment played in the gallery while the pointer is on the poster.
  preview: asset.endsWith('.mp4').optional(),
  captions: z.object({ ru: asset.endsWith('.vtt'), en: asset.endsWith('.vtt') }).partial().optional(),
});

// A clip stays in the data while it is being reworked; it gets pages only once accepted.
const video = z.object({
  slug: slug.refine(v => v !== 'c', 'The address /video/c/ belongs to collections'),
  status: z.enum(['accepted', 'rework']),
  title: both,
  // Short noun for what the clip is, e.g. "Промо игры".
  kind: both,
  text: both,
  // The first section is the home of the clip; a second one only makes the filter find it.
  sections: z.array(z.enum(SECTIONS)).min(1).max(2),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Place among the best clips on top of the gallery, 1 first.
  featured: z.number().int().positive().optional(),
  // Who made the sound and the music, as shown on the page; a silent clip has none.
  // A licensed track is named here with its licence, soundLink leads to its page.
  sound: both.optional(),
  soundLink: page.optional(),
  work: perLanguage(page).optional(),
  cuts: z.array(cut).min(1),
});

const collection = z.object({ slug, title: both, text: both, clips: z.array(slug).min(3).max(6) });

export const videoDataSchema = z.object({
  // Where the films are served from. Empty: from the site itself. When they move to their own storage, its address
  // goes here (https://media.example.com, no slash at the end) and every src and preview is read from there.
  // Posters, link previews and subtitles always stay on the site.
  mediaBase: z.string().refine(v => v === '' || (v.startsWith('https://') && !v.endsWith('/')), 'Use an HTTPS address without a trailing slash, or leave empty').default(''),
  videos: z.array(video),
  collections: z.array(collection),
}).superRefine((data, ctx) => {
  const slugs = data.videos.map(v => v.slug);
  if (new Set(slugs).size !== slugs.length) ctx.addIssue({ code: 'custom', message: 'Duplicate video slug' });
  if (new Set(data.collections.map(c => c.slug)).size !== data.collections.length) ctx.addIssue({ code: 'custom', message: 'Duplicate collection slug' });
  for (const item of data.videos) {
    const formats = item.cuts.map(c => aspect(c.width, c.height));
    if (new Set(formats).size !== formats.length) ctx.addIssue({ code: 'custom', message: `${item.slug}: two cuts share a format` });
  }
  for (const set of data.collections) for (const clip of set.clips) {
    if (!slugs.includes(clip)) ctx.addIssue({ code: 'custom', message: `${set.slug}: unknown clip ${clip}` });
  }
});

export type VideoData = z.infer<typeof videoDataSchema>;
export type Video = VideoData['videos'][number];
export type Collection = VideoData['collections'][number];

// Clips in rework are built only for a local review, with VIDEO_REWORK=1.
export const shownVideos = (data: VideoData, withRework = false) => data.videos.filter(v => withRework || v.status === 'accepted');

const divisor = (a: number, b: number): number => b ? divisor(b, a % b) : a;
// 1920x1080 reads as 16:9, 768x1280 as 3:5.
export function aspect(width: number, height: number) {
  const d = divisor(width, height);
  return `${width / d}:${height / d}`;
}

export function clock(seconds: number) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export const galleryPath = (locale: Locale) => (locale === 'en' ? '/en' : '') + '/video/';
export const videoPath = (locale: Locale, slugName: string) => galleryPath(locale) + `${slugName}/`;
export const collectionPath = (locale: Locale, slugName: string) => galleryPath(locale) + `c/${slugName}/`;

// The best clips first, in their given order; the rest from new to old.
export const byShowOrder = (a: Video, b: Video) =>
  (a.featured ?? Infinity) - (b.featured ?? Infinity) || b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug);

// The reduced copies of a poster as a srcset: /a/x-poster.webp and [480, 960] give "/a/x-poster-480.avif 480w, …".
export const posterTile = (poster: string, width: number) => poster.replace(/\.webp$/, `-${width}.avif`);
export const posterSet = (poster: string, widths: number[]) => widths.map(width => `${posterTile(poster, width)} ${width}w`).join(', ');

// A clip in one language, ready for the page: the English page takes the English file where there is one.
// Films are read from mediaBase when it is set.
export function localizeVideo(item: Video, locale: Locale, mediaBase = '') {
  const pick = <T,>(pair: { ru: T; en?: T }) => (locale === 'en' && pair.en) || pair.ru;
  return {
    slug: item.slug,
    title: item.title[locale],
    kind: item.kind[locale],
    text: item.text[locale],
    sections: item.sections,
    year: Number(item.date.slice(0, 4)),
    sound: item.sound?.[locale],
    soundLink: item.soundLink,
    date: item.date,
    work: item.work && pick(item.work),
    cuts: item.cuts.map(c => ({
      format: aspect(c.width, c.height),
      width: c.width,
      height: c.height,
      duration: c.duration,
      src: mediaBase + pick(c.src),
      poster: pick(c.poster),
      posterSet: c.posterWidths && posterSet(pick(c.poster), c.posterWidths),
      share: c.share && pick(c.share),
      lightPoster: c.lightPoster ?? false,
      preview: c.preview && mediaBase + c.preview,
      captions: c.captions?.[locale],
    })),
  };
}
export type ShownVideo = ReturnType<typeof localizeVideo>;
export type ShownCut = ShownVideo['cuts'][number];
