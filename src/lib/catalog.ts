import type { ProjectSummary } from './schema';
export type Filters = { query: string; category: string; technology: string };
export const emptyFilters: Filters = { query: '', category: '', technology: '' };
export function filtersFromSearch(search: string): Filters {
  const params = new URLSearchParams(search);
  return { query: params.get('q') ?? '', category: params.get('category') ?? '', technology: params.get('technology') ?? '' };
}
export function searchFromFilters(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.category) params.set('category', filters.category);
  if (filters.technology) params.set('technology', filters.technology);
  return params.toString();
}
export function filterProjects(projects: ProjectSummary[], filters: Filters) {
  const query = filters.query.trim().toLocaleLowerCase('ru');
  return projects.filter(project => (!filters.category || project.category === filters.category)
    && (!filters.technology || project.technologies.includes(filters.technology))
    && (!query || [project.title, project.summary, project.category, ...project.technologies].join(' ').toLocaleLowerCase('ru').includes(query)));
}
