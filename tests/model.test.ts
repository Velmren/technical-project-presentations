import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { projectSchema } from '../src/lib/schema.ts';
import { filterProjects, filtersFromSearch, searchFromFilters, emptyFilters } from '../src/lib/catalog.ts';
import { buttonColors, contrast, PAGE } from '../src/lib/color.ts';
const allProjects = readdirSync('src/content/projects').filter(file => file.endsWith('.json')).map(file => projectSchema.parse(JSON.parse(readFileSync(`src/content/projects/${file}`, 'utf8'))));
const projects = allProjects.filter(project => project.status === 'published');
test('published project data satisfies schema; invalid slug and unsafe links fail', () => {
  assert.ok(projects.length > 0);
  assert.equal(projectSchema.safeParse({ ...projects[0], slug: '../escape' }).success, false);
  assert.equal(projectSchema.safeParse({ ...projects[0], actions: [{ label: 'unsafe', href: 'javascript:alert(1)' }] }).success, false);
});
test('combined category, technology and Cyrillic search filter the catalogue', () => {
  // Drafts stay in the data, so the filter logic is checked on every project.
  assert.equal(filterProjects(allProjects, { query: 'МАТЕРИАЛ', category: 'Интерфейсы', technology: 'React' })[0]?.slug, 'forma');
  assert.equal(filterProjects(projects, { query: '', category: 'Игры', technology: 'Java' }).length, 0);
  assert.equal(filterProjects(projects, emptyFilters).length, projects.length);
});
test('filters round trip through shareable URL parameters', () => {
  const filters = { query: 'цели & переходы', category: 'Игровые системы', technology: 'Java' };
  assert.deepEqual(filtersFromSearch(searchFromFilters(filters)), filters);
});
test('new technologies and categories work without an interface change', () => {
  const extra = projectSchema.parse({ ...projects[0], slug: 'new-project', title: 'Новая работа', category: 'Веб-сайты', technologies: ['Tilda'] });
  assert.equal(filterProjects([...projects, extra], { query: 'новая', category: 'Веб-сайты', technology: 'Tilda' })[0]?.slug, 'new-project');
});
test('proof layers may not share horizontal space', () => {
  const store = allProjects.find(project => project.slug === 'electronics-store')!;
  const sections = store.sections.map(section => section.kind === 'benefit'
    ? { ...section, layers: section.layers.map((layer, i) => i ? { ...layer, x: 0 } : layer) } : section);
  assert.equal(projectSchema.safeParse({ ...store, sections }).success, false);
});
test('English screenshots replace existing ones', () => {
  for (const project of allProjects) for (const [ru, en] of Object.entries(project.en?.media ?? {})) {
    assert.ok(existsSync('public' + ru), ru);
    assert.ok(existsSync('public' + en), en);
  }
});
test('work buttons keep AA text and stand out from the page in every state', () => {
  for (const project of allProjects) {
    if (!project.accent) continue;
    const c = buttonColors(project.accent);
    for (const state of [c.button, c.hover, c.press]) {
      assert.ok(contrast(state, c.ink) >= 4.5, `${project.slug} text on ${state}`);
      assert.ok(contrast(state, PAGE) >= 3, `${project.slug} ${state} against the page`);
    }
  }
  const white = buttonColors('#ffffff');
  assert.equal(white.ink, '#111213');
});
