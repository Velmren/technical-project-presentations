import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { aspect, clock, localizeVideo, shownVideos, videoDataSchema, videoPath, type VideoData } from '../src/lib/videos.ts';

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
