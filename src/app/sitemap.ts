import type { MetadataRoute } from 'next';
import { getProjects } from '@/lib/projects';
import { shown } from '@/components/video/clips';
import { galleryPath, videoPath } from '@/lib/videos';
import { CONTACTS } from '@/lib/contacts';
import { languageAddresses, localePath } from '@/lib/i18n';
import { SITE } from '@/lib/seo';
export const dynamic = 'force-static';
// The home, the work pages, the video gallery, its clips and the contacts, each in both languages and naming its
// other version.
// Live demos are left out: the work pages are what should be found, and they link to the demos.
// Collections of clips open only by their links and are not listed either.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects();
  // A work page of the earlier template has no English version.
  const russianOnly = projects.filter(project => !(project.presentation === 'case' && project.en)).map(project => `/${project.slug}/`);
  const paths = ['/', ...projects.map(project => `/${project.slug}/`), galleryPath('ru'), ...shown.map(clip => videoPath('ru', clip.slug)), CONTACTS];
  // The day of the build: every release rewrites all pages.
  const lastModified = new Date().toISOString().slice(0, 10);
  const absolute = (path: string) => Object.fromEntries(Object.entries(languageAddresses(path)).map(([language, address]) => [language, SITE + address]));
  return paths.flatMap(path => russianOnly.includes(path)
    ? [{ url: SITE + path, lastModified }]
    : (['ru', 'en'] as const).map(locale => ({ url: SITE + localePath(locale, path), lastModified, alternates: { languages: absolute(path) } })));
}
