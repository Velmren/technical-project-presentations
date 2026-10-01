import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { projectSchema, type Project } from './schema';

// Replace this provider when a CMS is needed; the page and section contracts stay the same.
export async function readProjects(directory = path.join(process.cwd(), 'src/content/projects')): Promise<Project[]> {
  const files = (await readdir(directory)).filter(file => file.endsWith('.json'));
  const projects = await Promise.all(files.map(async file => {
    const result = projectSchema.safeParse(JSON.parse(await readFile(path.join(directory, file), 'utf8')));
    if (!result.success) throw new Error(`${file}: ${result.error.message}`);
    if (file !== `${result.data.slug}.json`) throw new Error(`${file}: filename must match slug`);
    return result.data;
  }));
  if (new Set(projects.map(project => project.slug)).size !== projects.length) throw new Error('Duplicate project slug');
  return projects.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'));
}
export const getProjects = cache(async () => (await readProjects()).filter(project => project.status === 'published'));
