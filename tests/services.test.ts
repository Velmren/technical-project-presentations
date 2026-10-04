import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { projectSchema } from '../src/lib/schema.ts';
import { servicesOf, servicesSchema } from '../src/lib/services.ts';
import { shownVideos, videoDataSchema } from '../src/lib/videos.ts';

const data = servicesSchema.parse(JSON.parse(readFileSync('src/content/services.json', 'utf8')));
const published = readdirSync('src/content/projects').filter(file => file.endsWith('.json'))
  .map(file => projectSchema.parse(JSON.parse(readFileSync(`src/content/projects/${file}`, 'utf8'))))
  .filter(project => project.status === 'published');
const clips = shownVideos(videoDataSchema.parse(JSON.parse(readFileSync('src/content/videos.json', 'utf8')))).map(video => video.slug);

// Everything a visitor reads on a service page; the search title and description are not among it.
const visible = (service: typeof data.services[number]) => [service.name, service.title, service.lead, service.ask,
  ...service.gets.flatMap(item => [item.title, item.text]), ...service.faq.flatMap(item => [item.q, item.a])];

test('both languages have services, and every example of a service is a published work or a shown clip', () => {
  for (const locale of ['ru', 'en'] as const) assert.ok(servicesOf(data, locale).length >= 1, `${locale}: no services`);
  for (const service of data.services) {
    for (const slug of service.works) {
      const project = published.find(one => one.slug === slug);
      assert.ok(project, `${service.slug}: work ${slug} is not published`);
      assert.ok(project.showcase, `${service.slug}: work ${slug} has no first screen to show`);
      // A work shown on an English service page needs its English texts.
      if (service.locale === 'en') assert.ok(project.en?.lead, `${service.slug}: work ${slug} has no English texts`);
    }
    for (const slug of service.clips ?? []) assert.ok(clips.includes(slug), `${service.slug}: clip ${slug} is not shown in the gallery`);
  }
});

test('a visitor reads about the result, not about the stack: no platform names in headings, no worn phrases', () => {
  const platforms = /tilda|wordpress|woocommerce|shopify|next\.js|react|godot/i;
  const worn = /под ключ|которые продают|любой сложности|turnkey|of any complexity/i;
  for (const service of data.services) {
    assert.doesNotMatch(service.title, platforms, `${service.slug}: the heading names a platform`);
    for (const text of visible(service)) assert.doesNotMatch(text, worn, `${service.slug}: "${text}"`);
  }
  for (const locale of ['ru', 'en'] as const) {
    const common = data.common[locale];
    for (const text of [common.hub.title, common.hub.lead, ...common.steps.flatMap(step => [step.title, step.text])]) assert.doesNotMatch(text, worn);
  }
});

test('search titles of services are unique and differ from the headings shown on the page', () => {
  const titles = data.services.map(service => service.seo.title);
  assert.equal(new Set(titles).size, titles.length);
  for (const service of data.services) assert.notEqual(service.seo.title, service.title, service.slug);
});

test('no text of a service names a price or a deadline', () => {
  // Prices are worked out for the task, and a deadline is named only for a clear scope.
  const promise = /\d+\s?(₽|руб|\$|usd|€|eur)|за \d+ (дн|час|недел)|in \d+ (day|hour|week)/i;
  for (const service of data.services) for (const text of visible(service)) assert.doesNotMatch(text, promise, `${service.slug}: "${text}"`);
});
