// How the gallery lays clips out and filters them. Kept free of the schema library, so the browser gets no validator.
import type { SectionId } from '@/lib/videos';

export type GalleryClip = {
  slug: string; href: string; title: string; kind: string; length: string; sections: SectionId[];
  width: number; height: number; poster: string; preview?: string;
};

export const VERTICAL = 'vertical';
export type GalleryFilter = 'all' | typeof VERTICAL | SectionId;

export const isTall = (clip: { width: number; height: number }) => clip.height > clip.width;

// Filter words in the order of the sections, only for what the gallery really has; vertical clips get their own word.
export function filterOptions(clips: GalleryClip[], order: readonly SectionId[]): GalleryFilter[] {
  const present = new Set(clips.flatMap(clip => clip.sections));
  return ['all', ...order.filter(section => present.has(section)), ...(clips.some(isTall) ? [VERTICAL] as const : [])];
}

// Wide and square clips go into rows, vertical ones into their own strip, never mixed.
export function splitClips(clips: GalleryClip[], filter: GalleryFilter) {
  const chosen = clips.filter(clip => filter === 'all' || (filter === VERTICAL ? isTall(clip) : clip.sections.includes(filter)));
  return { wide: chosen.filter(clip => !isTall(clip)), tall: chosen.filter(isTall) };
}

// Rows are cut by the proportions of the posters, in their order. Two wide frames make the ideal row
// (2 x 16:9 = 3.56). A row from MIN_ROW (a wide frame and a square one) to MAX_ROW (three wide frames) stretches
// to the full width; among all ways to cut the list the one closest to ideal rows wins. A row away from the ideal
// costs up to three times more at the top of the page than at its end, so a longer row of smaller posters goes
// down and the best clips stay the largest. A row short of MIN_ROW cannot be avoided for a lone clip or a pair of
// squares: it keeps the usual height and does not stretch.
export const IDEAL_ROW = 3.56;
export const MIN_ROW = 2.7;
const MAX_ROW = 5.4;
const SHORT_ROW = 100;
const EARLY = 2;
const ratio = (clip: { width: number; height: number }) => clip.width / clip.height;
export const rowSum = (row: { width: number; height: number }[]) => row.reduce((sum, clip) => sum + ratio(clip), 0);

export function intoRows<T extends { width: number; height: number }>(clips: T[]): T[][] {
  // best[end]: the cheapest way to cut the first `end` clips, as its cost and where its last row starts.
  const best: { cost: number; from: number }[] = [{ cost: 0, from: 0 }];
  for (let end = 1; end <= clips.length; end++) {
    best[end] = { cost: Infinity, from: end - 1 };
    for (let from = end - 1; from >= 0; from--) {
      const sum = rowSum(clips.slice(from, end));
      if (sum > MAX_ROW && end - from > 1) break;
      const early = 1 + EARLY * (clips.length - end) / clips.length;
      const cost = best[from].cost + (sum - IDEAL_ROW) ** 2 * early + (sum < MIN_ROW ? SHORT_ROW : 0);
      if (cost < best[end].cost) best[end] = { cost, from };
    }
  }
  const rows: T[][] = [];
  for (let end = clips.length; end > 0; end = best[end].from) rows.unshift(clips.slice(best[end].from, end));
  return rows;
}
