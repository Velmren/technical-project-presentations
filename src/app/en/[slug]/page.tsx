import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProjects } from '@/lib/projects';
import { localizeProject } from '@/lib/i18n';
import { CasePage } from '@/components/concepts/CasePage';
import { projectImage } from '@/lib/social';

// English versions exist for project pages built in the concept C system.
const caseProjects = async () => (await getProjects()).filter(project => project.presentation === 'case' && project.en);

export const dynamicParams = false;
export async function generateStaticParams() { return (await caseProjects()).map(project => ({ slug: project.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = (await caseProjects()).find(project => project.slug === slug);
  if (!project) return {};
  const en = localizeProject(project, 'en');
  return { title: en.title, description: en.summary, alternates: { canonical: `/en/${slug}/`, languages: { ru: `/${slug}/`, en: `/en/${slug}/` } },
    openGraph: { title: en.title, description: en.summary, url: `/en/${slug}/`, locale: 'en_GB', type: 'website', siteName: 'VELMREN', images: [projectImage(en)] } };
}
export default async function ProjectPageEn({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = (await caseProjects()).find(project => project.slug === slug);
  if (!project) notFound();
  return <CasePage project={localizeProject(project, 'en')} locale="en"/>;
}
