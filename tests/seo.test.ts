import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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
      // The site name is added to the title by the layout; the name of a demonstration brand alone says nothing to a search.
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

test('no page moves a visitor to another language on its own', () => {
  const sources = ['src/lib/i18n.ts', 'src/components/concepts/ConceptCView.tsx', 'src/components/concepts/CasePage.tsx', 'src/components/video/pages.tsx', 'src/components/concepts/LangHint.tsx'];
  for (const file of sources) assert.doesNotMatch(readFileSync(file, 'utf8'), /location\.(replace|assign|href\s*=)/, file);
});
