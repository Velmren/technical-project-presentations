import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { homeSchema, type HomeData } from '../src/lib/home.ts';
import { filterTabs, matchesWork, shownWorks } from '../src/lib/home-view.ts';

const home = homeSchema.parse(JSON.parse(readFileSync('src/content/home.json', 'utf8')));
const clone = (): HomeData => structuredClone(home);

test('home data is valid and every accepted work points to real files', () => {
  for (const work of home.works.filter(w => w.status === 'accepted')) {
    const live = work.live ? [work.live.video?.src, work.live.video?.poster, work.live.scroll?.src, work.live.scroll?.small, ...(work.live.slides ?? [])] : [];
    for (const src of [work.preview?.src, work.preview?.overlay?.src, ...live, ...(work.en?.slides ?? []), work.en?.overlay, ...Object.values(work.en?.media ?? {})]) if (src) assert.ok(existsSync('public' + src), `${work.slug}: missing ${src}`);
  }
  assert.throws(() => homeSchema.parse({ ...home, works: [...home.works, { ...home.works[0] }] }), 'duplicate slug');
});

test('works in rework are hidden until accepted and are counted only when shown', () => {
  const { main, more, all } = shownWorks(home);
  assert.ok(all.every(w => w.status === 'accepted'));
  assert.equal(all.length, main.length + more.length);
  // Sending a work back to rework hides it; accepting it again is a data change: status, preview and link.
  const next = clone();
  const work = next.works.find(w => w.placement === 'main')!;
  work.status = 'rework';
  assert.equal(shownWorks(homeSchema.parse(next)).all.some(w => w.slug === work.slug), false);
  Object.assign(work, { status: 'accepted', preview: { src: '/assets/home/card-store.webp', alt: work.title }, details: '/' });
  assert.ok(shownWorks(homeSchema.parse(next)).main.some(w => w.slug === work.slug));
});

test('other projects appear only from the threshold of accepted works', () => {
  const next = clone();
  // Enough candidates for the threshold, whatever the current data holds.
  const template = next.works.find(w => w.placement === 'more') ?? { ...next.works[0], placement: 'more' as const };
  for (let i = next.works.filter(w => w.placement === 'more').length; i < next.moreThreshold; i++) next.works.push({ ...template, slug: `extra-${i}`, status: 'rework' });
  const more = next.works.filter(w => w.placement === 'more');
  more.slice(0, next.moreThreshold - 1).forEach(w => Object.assign(w, { status: 'accepted', preview: { src: '/assets/home/card-store.webp', alt: w.title }, details: '/' }));
  assert.equal(shownWorks(homeSchema.parse(next)).more.length, 0);
  Object.assign(more[next.moreThreshold - 1], { status: 'accepted', preview: { src: '/assets/home/card-store.webp', alt: 'x' }, details: '/' });
  assert.equal(shownWorks(homeSchema.parse(next)).more.length, next.moreThreshold);
});

test('filters list only categories of shown works and search matches Cyrillic text', () => {
  const { all } = shownWorks(home);
  const tabs = filterTabs(all);
  assert.equal(tabs[0], 'Все');
  for (const tab of tabs.slice(1)) assert.ok(all.some(w => w.tags.includes(tab)), tab);
  assert.equal(all.filter(w => matchesWork(w, 'Все', 'МАГАЗИН')).some(w => w.slug === 'electronics-store'), true);
});
