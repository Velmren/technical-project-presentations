import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { projectSchema } from '../src/lib/schema.ts';
import { hasShotCopies, SHOT_SIZES, shotCopy, shotSet, shotWidths } from '../src/lib/shots.ts';

const projects = readdirSync('src/content/projects').filter(file => file.endsWith('.json'))
  .map(file => projectSchema.parse(JSON.parse(readFileSync(`src/content/projects/${file}`, 'utf8'))))
  .filter(project => project.status !== 'draft' && project.presentation === 'case');

test('a screenshot gets copies narrower than itself and closes a short list with its own width', () => {
  assert.deepEqual(shotWidths(2400), [480, 720, 960, 1280, 1600]);
  assert.deepEqual(shotWidths(1920), [480, 720, 960, 1280, 1600]);
  // 1600 would be too close to the picture itself.
  assert.deepEqual(shotWidths(1688), [480, 720, 960, 1280, 1688]);
  assert.deepEqual(shotWidths(1280), [480, 720, 960, 1280]);
  // Phone screens and fragments of an interface are drawn narrow.
  assert.deepEqual(shotWidths(780), [360, 540, 780]);
  assert.deepEqual(shotWidths(560), [360, 560]);
  assert.equal(shotCopy('/assets/sono/case/hero-ru.webp', 720), '/assets/sono/case/hero-ru-720.avif');
  assert.equal(shotSet({ src: '/assets/a/b.webp', width: 560 }), '/assets/a/b-360.avif 360w, /assets/a/b-560.avif 560w');
  // A gallery poster keeps the copies the gallery made for it.
  assert.equal(shotSet({ src: '/assets/video/clip/clip-poster.webp', width: 768 }), '');
});

test('every screenshot of a case page has its reduced copies, in both languages', () => {
  let pictures = 0;
  for (const project of projects) {
    const layers = project.sections.flatMap(section => section.kind === 'benefit' ? section.layers.map(layer => layer.image) : []);
    for (const image of [project.showcase?.image, project.showcase?.phone, ...layers]) {
      if (!image) continue;
      for (const src of [image.src, project.en?.media?.[image.src]]) {
        if (!src || !hasShotCopies(src)) continue;
        pictures++;
        for (const width of shotWidths(image.width)) assert.ok(existsSync('public' + shotCopy(src, width)), `${shotCopy(src, width)}: run node scripts/prepare-shots.mjs`);
      }
    }
  }
  assert.ok(pictures > 100, 'the screenshots were not found: the search of this test is out of date');
});

test('the widths the layout draws a screenshot at are written as valid sizes', () => {
  const lists = [SHOT_SIZES.hero, SHOT_SIZES.heroBesidePhone, SHOT_SIZES.heroPhone, SHOT_SIZES.layer(0.58), SHOT_SIZES.layer(0.3), SHOT_SIZES.example(1), SHOT_SIZES.example(2), SHOT_SIZES.example(3)];
  for (const list of lists) {
    const parts = list.split(', ');
    // Every part but the last is a window width and a length; the last is the length for a wide window.
    for (const part of parts.slice(0, -1)) assert.match(part, /^\(max-width: \d+px\) (\d+(\.\d+)?(vw|px)|calc\(\d+(\.\d+)?vw - \d+(\.\d+)?px\))$/, list);
    assert.match(parts.at(-1)!, /^\d+(\.\d+)?px$/, list);
    const limits = parts.slice(0, -1).map(part => Number(part.match(/max-width: (\d+)px/)![1]));
    assert.deepEqual(limits, [...limits].sort((a, b) => a - b), list);
  }
});
