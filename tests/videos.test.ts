import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { aspect, byShowOrder, clock, collectionPath, galleryPath, localizeVideo, SECTIONS, shownVideos, videoDataSchema, videoPath, type VideoData } from '../src/lib/videos.ts';
import { filterOptions, intoRows, rowSum, splitClips, type GalleryClip } from '../src/components/video/gallery-view.ts';

const data = videoDataSchema.parse(JSON.parse(readFileSync('src/content/videos.json', 'utf8')));
const clone = (): VideoData => structuredClone(data);

test('video data is valid and every accepted clip has its pictures in the repository', () => {
  for (const video of shownVideos(data)) for (const cut of video.cuts) {
    // The films themselves are not stored in Git; posters, link previews and subtitles are.
    const files = [cut.poster.ru, cut.poster.en, cut.share?.ru, cut.share?.en, cut.captions?.ru, cut.captions?.en];
    for (const file of files) if (file) assert.ok(existsSync('public' + file), `${video.slug}: missing ${file}`);
    assert.match(cut.src.ru, new RegExp(`^/assets/video/${video.slug}/`), `${video.slug}: the film lives in its own folder`);
  }
});

test('a clip in rework gets no page until it is accepted', () => {
  const next = clone();
  next.videos[0].status = 'rework';
  const parsed = videoDataSchema.parse(next);
  assert.equal(shownVideos(parsed).some(video => video.slug === next.videos[0].slug), false);
  assert.equal(shownVideos(parsed, true).length, parsed.videos.length);
});

test('the schema refuses a clip named as the collections address, twin slugs, twin formats and unknown clips', () => {
  const named = clone();
  named.videos[0].slug = 'c';
  assert.throws(() => videoDataSchema.parse(named));
  const twins = clone();
  twins.videos.push(structuredClone(twins.videos[0]));
  assert.throws(() => videoDataSchema.parse(twins), /Duplicate video slug/);
  const formats = clone();
  formats.videos[0].cuts.push(structuredClone(formats.videos[0].cuts[0]));
  assert.throws(() => videoDataSchema.parse(formats), /share a format/);
  const lost = clone();
  lost.collections.push({ slug: 'for-a-studio', title: { ru: 'Подборка', en: 'Collection' }, text: { ru: 'Текст', en: 'Text' }, clips: [lost.videos[0].slug, 'no-such-clip', 'another'] });
  assert.throws(() => videoDataSchema.parse(lost), /unknown clip/);
});

test('formats, time and addresses read as on the page', () => {
  assert.equal(aspect(1920, 1080), '16:9');
  assert.equal(aspect(1080, 1920), '9:16');
  assert.equal(aspect(1080, 1080), '1:1');
  assert.equal(aspect(768, 1280), '3:5');
  assert.equal(clock(62), '1:02');
  assert.equal(clock(20.9), '0:21');
  assert.equal(videoPath('ru', 'lumi-promo'), '/video/lumi-promo/');
  assert.equal(videoPath('en', 'lumi-promo'), '/en/video/lumi-promo/');
  assert.equal(galleryPath('ru'), '/video/');
  assert.equal(collectionPath('en', 'for-a-shop'), '/en/video/c/for-a-shop/');
});

test('the English page takes English files where they exist and Russian ones otherwise', () => {
  const next = clone();
  const video = next.videos[0];
  video.cuts[0].src = { ru: '/assets/video/x/x-ru.mp4', en: '/assets/video/x/x-en.mp4' };
  video.cuts[0].poster = { ru: '/assets/video/x/x-poster.webp' };
  const english = localizeVideo(videoDataSchema.parse(next).videos[0], 'en');
  assert.equal(english.title, video.title.en);
  assert.equal(english.cuts[0].src, '/assets/video/x/x-en.mp4');
  assert.equal(english.cuts[0].poster, '/assets/video/x/x-poster.webp');
  assert.equal(localizeVideo(videoDataSchema.parse(next).videos[0], 'ru').cuts[0].src, '/assets/video/x/x-ru.mp4');
});

test('films move to their own storage by one setting, pictures stay on the site', () => {
  const item = data.videos[0];
  const home = localizeVideo(item, 'ru', data.mediaBase).cuts[0];
  assert.equal(data.mediaBase, '');
  assert.ok(home.src.startsWith('/assets/video/'));
  const moved = localizeVideo(item, 'ru', 'https://media.example.com').cuts[0];
  assert.equal(moved.src, 'https://media.example.com' + home.src);
  assert.equal(moved.preview, home.preview && 'https://media.example.com' + home.preview);
  assert.equal(moved.poster, home.poster);
  assert.throws(() => videoDataSchema.parse({ ...clone(), mediaBase: 'https://media.example.com/' }));
  assert.throws(() => videoDataSchema.parse({ ...clone(), mediaBase: 'http://media.example.com' }));
});

const clip = (slug: string, width: number, height: number, sections: GalleryClip['sections'] = ['promo']): GalleryClip =>
  ({ slug, href: '/video/' + slug + '/', title: slug, kind: '', length: '0:10', sections, width, height, poster: '/assets/video/x.webp' });
const wide = (slug: string) => clip(slug, 1920, 1080);
const square = (slug: string) => clip(slug, 1080, 1080);
const names = (rows: GalleryClip[][]) => rows.map(row => row.map(item => item.slug).join(' '));

test('the best clips come first and rows are cut without holes wherever that is possible', () => {
  const order = [...data.videos].sort(byShowOrder).map(video => video.featured ?? Infinity);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  // Two wide frames fill a row; a wide and a square one do too, as a taller row.
  assert.deepEqual(names(intoRows([wide('a'), wide('b'), wide('c'), wide('d')])), ['a b', 'c d']);
  assert.deepEqual(names(intoRows([wide('a'), square('b'), wide('c'), square('d')])), ['a b', 'c d']);
  // An odd count ends with a row of three: the first clips stay the largest and no poster is left alone.
  assert.deepEqual(names(intoRows([wide('a'), wide('b'), wide('c')])), ['a b c']);
  assert.deepEqual(names(intoRows([wide('a'), wide('b'), wide('c'), wide('d'), wide('e')])), ['a b', 'c d e']);
  // The order is kept and every clip is placed, whatever the mix; no row is longer than three wide frames.
  const mixed = [wide('a'), wide('b'), wide('c'), wide('d'), wide('e'), square('f'), wide('g'), square('h')];
  const rows = intoRows(mixed);
  assert.deepEqual(names(rows), ['a b', 'c d', 'e f', 'g h']);
  assert.deepEqual(rows.flat(), mixed);
  assert.ok(rows.every(row => rowSum(row) >= 2.7 && rowSum(row) <= 5.4));
  // Six wide frames and two squares: the long row of three goes to the end, the best two stay the largest.
  assert.deepEqual(names(intoRows([wide('a'), wide('b'), square('c'), square('d'), wide('e'), wide('f'), wide('g'), wide('h')])), ['a b', 'c d e', 'f g h']);
  // A lone clip cannot make a row; it stands alone and is not stretched.
  assert.deepEqual(names(intoRows([wide('a')])), ['a']);
  assert.deepEqual(intoRows([]), []);
});

test('vertical clips never mix with the others and the filter offers only what exists', () => {
  const clips = [wide('a'), clip('tall', 1080, 1920, ['motion']), clip('game', 1920, 1080, ['games', 'promo'])];
  assert.deepEqual(filterOptions(clips, SECTIONS), ['all', 'promo', 'games', 'motion', 'vertical']);
  assert.deepEqual(filterOptions([wide('a')], SECTIONS), ['all', 'promo']);
  const all = splitClips(clips, 'all');
  assert.deepEqual([all.wide.map(item => item.slug), all.tall.map(item => item.slug)], [['a', 'game'], ['tall']]);
  // A second section makes the filter find the clip.
  assert.deepEqual(splitClips(clips, 'promo').wide.map(item => item.slug), ['a', 'game']);
  assert.deepEqual(splitClips(clips, 'vertical'), { wide: [], tall: [clips[1]] });
});
