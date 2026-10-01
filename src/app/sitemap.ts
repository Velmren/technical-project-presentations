import type { MetadataRoute } from 'next';
import { getProjects } from '@/lib/projects';
export const dynamic = 'force-static';
// Home and project pages in both languages, plus the live versions hosted on this site (a page path, not a file under /assets/).
const livePage = (href?: string) => href && href.startsWith('/') && href.endsWith('/') && !href.startsWith('/assets/');
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects();
  const live = projects.map(project => project.actions[0]?.href).filter(livePage);
  const english = projects.filter(project => project.presentation === 'case' && project.en).map(project => `/en/${project.slug}/`);
  const pages = ['/', '/en/', ...projects.map(project => `/${project.slug}/`), ...english, ...live];
  return pages.map(path => ({ url: `https://velmren.com${path}` }));
}
