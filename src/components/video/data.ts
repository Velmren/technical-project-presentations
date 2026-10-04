// The gallery data, checked once at build time.
import { readFileSync } from 'node:fs';
import raw from '@/content/videos.json';
import { shownVideos, videoDataSchema } from '@/lib/videos';

// A local review build can add clips that are not in the site data yet: VIDEO_EXTRA names a JSON file of the
// same shape. VIDEO_REWORK=1 gives pages to clips still in rework. A release build sets neither.
const extra = process.env.VIDEO_EXTRA ? JSON.parse(readFileSync(process.env.VIDEO_EXTRA, 'utf8')) as { videos?: unknown[]; collections?: unknown[] } : {};

export const videoData = videoDataSchema.parse({
  ...raw,
  videos: [...raw.videos, ...(extra.videos ?? [])],
  collections: [...raw.collections, ...(extra.collections ?? [])],
});
export const videos = shownVideos(videoData, process.env.VIDEO_REWORK === '1');
