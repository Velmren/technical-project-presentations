import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { projectSchema } from '../src/lib/schema.ts';
import { browserLocale, languageAddresses, localizeProject } from '../src/lib/i18n.ts';
import { localizeVideo, shownVideos, videoDataSchema } from '../src/lib/videos.ts';

const projects = readdirSync('src/content/projects').filter(file => file.endsWith('.json'))
  .map(file => projectSchema.parse(JSON.parse(readFileSync(`src/content/projects/${file}`, 'utf8'))))
  .filter(project => project.status === 'published');
const videos = shownVideos(videoDataSchema.parse(JSON.parse(readFileSync('src/content/videos.json', 'utf8'))));

test('a page names both languages and English as the default one', () => {
  assert.deepEqual(languageAddresses('/forma/'), { ru: '/forma/', en: '/en/forma/', 'x-default': '/en/forma/' });
  assert.deepEqual(languageAddresses('/'), { ru: '/', en: '/en/', 'x-default': '/en/' });
});

test('the language note is offered by the browser language and nothing else', () => {
  assert.equal(browserLocale('ru-RU'), 'ru');
  assert.equal(browserLocale('RU'), 'ru');
  assert.equal(browserLocale('en-US'), 'en');
  assert.equal(browserLocale('be-BY'), 'en');
  assert.equal(browserLocale(''), 'en');
});

test('every work has its own search title and description in both languages', () => {
  const titles = new Set<string>();
  for (const project of projects) {
    const en = localizeProject(project, 'en');
    assert.ok(project.seo && en.seo, `${project.slug}: search texts in both languages`);
    assert.notEqual(project.seo.title, en.seo.title, `${project.slug}: the English title is not the Russian one`);
    for (const seo of [project.seo, en.seo]) {
      // The site name is added to the title by the layout; the name of a work alone says nothing to a search.
      assert.notEqual(seo.title, project.title, `${project.slug}: the title says what the work is`);
      assert.ok(!titles.has(seo.title), `${project.slug}: title "${seo.title}" is used twice`);
      titles.add(seo.title);
      assert.ok(seo.description.length >= 70, `${project.slug}: description is too short for a search snippet`);
    }
  }
});

test('the English page of a work never shows the Russian search title', () => {
  const [project] = projects;
  const bare = localizeProject({ ...project, en: { ...project.en, seo: undefined } }, 'en');
  assert.equal(bare.seo, undefined);
});

test('every clip has a search title in both languages, unique across the gallery', () => {
  for (const locale of ['ru', 'en'] as const) {
    const titles = videos.map(video => localizeVideo(video, locale).searchTitle);
    assert.ok(titles.every(Boolean), `${locale}: a clip without a search title`);
    assert.equal(new Set(titles).size, titles.length, `${locale}: two clips share a search title`);
  }
});

test('every work has its link preview picture, an English one where the English page shows its own screenshot', () => {
  for (const project of projects) {
    assert.ok(project.showcase, `${project.slug}: a showcase to cut the preview from`);
    assert.ok(existsSync(`public/assets/share/${project.slug}.jpg`), `${project.slug}: run node scripts/prepare-share.mjs`);
    if (project.en?.media?.[project.showcase.image.src]) assert.ok(existsSync(`public/assets/share/${project.slug}-en.jpg`), `${project.slug}: the English preview is missing`);
  }
});

test('the site publishes two contacts and no others', () => {
  const walk = (folder: string): string[] => readdirSync(folder, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? walk(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]);
  const found = { telegram: new Set<string>(), mail: new Set<string>() };
  for (const file of walk('src').filter(name => /\.(ts|tsx|json)$/.test(name))) {
    const text = readFileSync(file, 'utf8');
    for (const [address] of text.matchAll(/t\.me\/[A-Za-z0-9_]+/g)) found.telegram.add(address);
    for (const [address] of text.matchAll(/[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[a-z]{2,}/g)) found.mail.add(address);
  }
  assert.deepEqual([...found.telegram], ['t.me/velmren']);
  assert.deepEqual([...found.mail], ['hello@velmren.com']);
});

test('every link to Telegram or mail and the copy button name themselves for the count of clicks', () => {
  const walk = (folder: string): string[] => readdirSync(folder, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? walk(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]);
  let found = 0;
  for (const file of walk('src/components').filter(name => name.endsWith('.tsx'))) {
    for (const [tag] of readFileSync(file, 'utf8').matchAll(/<a [^>]*href=\{(?:TELEGRAM|`mailto:)[^>]*>|<button [^>]*onClick=\{copy\}[^>]*>/g)) {
      found++;
      assert.match(tag, /data-contact=(?:"|\{`)(?:telegram|mail|copy)\//, `${file}: ${tag}`);
    }
  }
  assert.ok(found >= 6, 'the contact links were not found: the search of this test is out of date');
  assert.match(readFileSync('src/components/RootDocument.tsx', 'utf8'), /<ContactClicks\/>/);
  assert.match(readFileSync('scripts/portfolio.caddy', 'utf8'), /path \/ping\/\*/);
});

test('no page moves a visitor to another language on its own', () => {
  const sources = ['src/lib/i18n.ts', 'src/components/concepts/ConceptCView.tsx', 'src/components/concepts/CasePage.tsx', 'src/components/video/pages.tsx', 'src/components/concepts/LangHint.tsx'];
  for (const file of sources) assert.doesNotMatch(readFileSync(file, 'utf8'), /location\.(replace|assign|href\s*=)/, file);
});
