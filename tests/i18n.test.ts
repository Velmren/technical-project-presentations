import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { homeSchema } from '../src/lib/home.ts';
import { shownWorks } from '../src/lib/home-view.ts';
import { projectSchema } from '../src/lib/schema.ts';
import { localizeProject, localizeWork, localePath } from '../src/lib/i18n.ts';

const home = homeSchema.parse(JSON.parse(readFileSync('src/content/home.json', 'utf8')));
const store = projectSchema.parse(JSON.parse(readFileSync('src/content/projects/electronics-store.json', 'utf8')));

test('every shown work has its English type, description and link labels', () => {
  for (const work of shownWorks(home).all) {
    assert.ok(work.en?.type && work.en.description, `${work.slug}: English type and description`);
    if (work.action) assert.ok(work.en?.action, `${work.slug}: English action label`);
    if (work.extra) assert.ok(work.en?.extra, `${work.slug}: English extra label`);
    const en = localizeWork(work, 'en');
    assert.notEqual(en.description, work.description);
    assert.deepEqual(localizeWork(work, 'ru'), work);
  }
});

test('the store page is fully translated and keeps its structure', () => {
  const en = localizeProject(store, 'en');
  assert.equal(en.sections.length, store.sections.length);
  assert.equal(store.en?.sections?.length, store.sections.length);
  en.sections.forEach((section, i) => {
    const ru = store.sections[i];
    if (section.kind === 'benefit' && ru.kind === 'benefit') {
      assert.notEqual(section.title, ru.title);
      section.layers.forEach((layer, j) => assert.notEqual(layer.image.alt, ru.layers[j].image.alt, `benefit ${i} layer ${j} alt`));
    }
  });
  assert.equal(en.actions[0].href, store.actions[0].href);
  assert.notEqual(en.lead, store.lead);
});

test('a work that tells its task, solution and result tells them in English too, and names no client', () => {
  const works = readdirSync('src/content/projects').filter(file => file.endsWith('.json'))
    .map(file => projectSchema.parse(JSON.parse(readFileSync(`src/content/projects/${file}`, 'utf8'))));
  let told = 0;
  for (const work of works.filter(one => one.story)) {
    told++;
    assert.ok(work.en?.story, `${work.slug}: the English task, solution and result`);
    const english = localizeProject(work, 'en').story!;
    for (const part of ['task', 'solution', 'result'] as const) {
      assert.notEqual(english[part], work.story![part], `${work.slug}: ${part} is not translated`);
      // A story speaks of what was made and can be opened, not of somebody's sales or praise.
      for (const text of [english[part], work.story![part]]) assert.doesNotMatch(text, /отзыв|продаж[иа] выросл|конверси[яи] выросл|наш клиент|testimonial|sales (grew|rose)|our client/i, `${work.slug}: ${part}`);
    }
  }
  // A work without a story shows none on its English page either.
  for (const work of works.filter(one => !one.story)) assert.equal(localizeProject(work, 'en').story, undefined, work.slug);
  assert.ok(told <= works.length);
});

test('English pages live under /en/', () => {
  assert.equal(localePath('en', '/electronics-store/'), '/en/electronics-store/');
  assert.equal(localePath('ru', '/electronics-store/'), '/electronics-store/');
});
