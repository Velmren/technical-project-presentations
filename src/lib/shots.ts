// Reduced copies of the screenshots shown on the pages of works and services: which widths a picture gets, what
// the copies are called and how wide the layout draws a screenshot. scripts/prepare-shots.mjs makes the files by
// the same rule, so this module imports nothing.

// Widths of the copies. A small picture (a phone screen, a fragment of an interface) is drawn narrow, a page
// screenshot up to 820 px wide, twice that on a dense screen.
const LADDER = { small: [360, 540], large: [480, 720, 960, 1280, 1600] };
const SMALL = 1000;
const WIDEST = 1600;

// A step close to the picture's own width is left out. The widest step is as much as any slot asks for; a
// narrower picture closes its list with its own width.
export function shotWidths(width: number) {
  const steps = (width <= SMALL ? LADDER.small : LADDER.large).filter(step => step < width * 0.85);
  return steps.at(-1) === WIDEST ? steps : [...steps, width];
}
export const shotCopy = (src: string, width: number) => src.replace(/\.[a-z]+$/, `-${width}.avif`);
// A poster of the gallery has copies of its own under names of the same kind (scripts/prepare-videos.mjs), by
// another list of widths: a work that shows such a poster gets no copies here, and none may be written over.
export const hasShotCopies = (src: string) => !src.startsWith('/assets/video/');
export const shotSet = (image: { src: string; width: number }) => hasShotCopies(image.src)
  ? shotWidths(image.width).map(width => `${shotCopy(image.src, width)} ${width}w`).join(', ') : '';

// How wide a screenshot is drawn, as the `sizes` of its picture. The numbers follow the layout in
// app/concepts/c/case.css: the page column is 91.2% of a window up to 1488 px and 1360 px beyond it.
const part = (share: number, value: number) => Math.round(share * value * 10) / 10;
export const SHOT_SIZES = {
  // The first screen of a page: the right column of the two, or the whole column on a narrow window.
  hero: '(max-width: 899px) 91vw, (max-width: 1100px) 820px, (max-width: 1487px) 51vw, 757px',
  // The same with a phone standing beside the screen, and the phone itself.
  heroBesidePhone: '(max-width: 899px) 72vw, (max-width: 1100px) 648px, (max-width: 1487px) 40vw, 598px',
  heroPhone: '(max-width: 899px) 18vw, (max-width: 1100px) 136px, (max-width: 1487px) 9vw, 124px',
  // A layer of a composition takes its share of a stage up to 720 px wide.
  layer: (share: number) => `(max-width: 789px) ${part(share, 91.2)}vw, (max-width: 1100px) ${part(share, 720)}px, `
    + `(max-width: 1352px) calc(${part(share, 85.8)}vw - ${part(share, 440)}px), ${part(share, 720)}px`,
  // A card of the examples on a service page, by the number of columns the row has on a wide window.
  example: (columns: number) => columns >= 3
    ? '(max-width: 860px) 91vw, (max-width: 1100px) 44vw, (max-width: 1487px) 28.4vw, 424px'
    : columns === 2 ? '(max-width: 860px) 91vw, (max-width: 1487px) 44vw, 657px' : '(max-width: 724px) 91vw, 660px',
};
