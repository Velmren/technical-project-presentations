// How the gallery lays clips out and filters them. Kept free of the schema library, so the browser gets no validator.
import type { SectionId } from '@/lib/videos';

export type GalleryClip = {
  slug: string; href: string; title: string; kind: string; length: string; sections: SectionId[];
  width: number; height: number; poster: string; preview?: string;
  // Reduced AVIF copies of the poster as a srcset; without them the poster itself is shown.
  posterSet?: string;
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

// How wide a poster is drawn, for the sizes attribute: the browser then takes the smallest copy that is enough.
// The page gutter is clamp(18px, 4.4vw, 64px): 64 px from a 1455 px window up, 4.4vw below it, 18 px on a phone,
// where posters stand one to a row. gap is the 12 px between posters.
const GAP = 12;
const PHONE = '(max-width: 860px)';
const part = (vw: number, px: number) => `calc(${vw.toFixed(2)}vw - ${Math.round(px)}px)`;

// A poster in a row: its share of the row by proportions. contained: the row lives in the 1360 px column of a clip page.
export function rowTileSizes(clip: { width: number; height: number }, row: { width: number; height: number }[], share = 1, contained = false) {
  const fraction = ratio(clip) / rowSum(row);
  const gaps = (row.length - 1) * GAP * fraction;
  const fluid = `(max-width: 1455px) ${part(91.2 * share * fraction, gaps)}`;
  const wide = part(100 * share * fraction, 128 * share * fraction + gaps);
  return contained
    ? `${PHONE} calc(100vw - 36px), ${fluid}, (max-width: 1488px) ${wide}, ${Math.round((1360 * share - (row.length - 1) * GAP) * fraction)}px`
    : `${PHONE} calc(100vw - 36px), ${fluid}, ${wide}`;
}

// A poster in the strip of vertical clips: two columns on a phone, then three, four and five. Every poster there
// fills one 9:16 frame, so a clip of another vertical shape (3:5) is drawn wider than its column by that much.
const STRIP_FRAME = 9 / 16;
const STRIP_COLUMNS: [string, string][] = [[PHONE, '50vw - 24px'], ['(max-width: 1300px)', '30.4vw - 8px'], ['(max-width: 1455px)', '22.8vw - 9px'], ['(max-width: 1600px)', '25vw - 41px'], ['', '20vw - 35px']];
export function stripTileSizes(clip: { width: number; height: number }) {
  const cover = Math.max(1, ratio(clip) / STRIP_FRAME);
  return STRIP_COLUMNS.map(([media, column]) => `${media} calc(${cover === 1 ? column : `${cover.toFixed(3)} * (${column})`})`.trim()).join(', ');
}
