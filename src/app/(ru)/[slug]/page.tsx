import Image from 'next/image';
import type { Metadata } from 'next';

import { notFound } from 'next/navigation';
import { getProjects } from '@/lib/projects';
import { Section } from '@/components/Sections';
import { Cover } from '@/components/ProjectMedia';
import { Icon } from '@/components/Icon';
import { VideoPlayer } from '@/components/VideoPlayer';
import { CasePage } from '@/components/concepts/CasePage';
import { pageMetadata } from '@/lib/seo';
import { projectImage } from '@/lib/social';
export const dynamicParams = false;
export async function generateStaticParams() { return (await getProjects()).map(project => ({ slug: project.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = (await getProjects()).find(project => project.slug === slug);
  if (!project) return {};
  const page = pageMetadata({ locale: 'ru', path: `/${slug}/`, title: project.seo?.title ?? project.title, description: project.seo?.description ?? project.summary, image: projectImage(project) });
  // A page of the earlier template has no English version to name.
  return project.presentation === 'case' && project.en ? page : { ...page, alternates: { canonical: `/${slug}/` } };
}
export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = (await getProjects()).find(project => project.slug === slug);
  if (!project) notFound();
  if (project.presentation === 'case') return <CasePage project={project} locale="ru"/>;
  const title = <div className="project-title"><p className="project-tech">{project.eyebrow || project.technologies.join(' / ')}</p><h1>{project.title}</h1><p className="lead">{project.summary}</p><div className="actions">{project.actions.map((action, index) => <a className={`action ${index === 0 ? 'primary' : 'secondary'}`} key={action.href} href={action.href}>{action.href.includes('github.com') && <Icon name="github"/>}{action.href === '#video' && <Icon name="play"/>}{action.label}{index === 0 && action.href !== '#video' && <Icon name="arrow"/>}</a>)}</div>{project.tone === 'warm' && <ul className="hero-tags" aria-label="Технологии">{project.technologies.map(tag => <li key={tag}>{tag}</li>)}</ul>}</div>;
  return <main id="main" data-tone={project.tone}><div className="project-intro">{title}<figure className="hero-frame" id={project.video ? 'video' : undefined}>{project.video ? <><VideoPlayer src={project.video.src} poster={project.video.poster}/><figcaption>{project.video.caption}</figcaption></> : <>{project.heroImage ? <Image {...project.heroImage} priority sizes="(max-width: 700px) 100vw, 680px"/> : <Cover cover={project.cover} priority/>}{project.heroCaption && <figcaption>{project.heroCaption}</figcaption>}</>}</figure></div>{project.sections.map((section, index) => {
    const previous = project.sections[index - 1];
    if (section.kind === 'code' && previous?.kind === 'architecture') return null;
    const next = project.sections[index + 1];
    return <Section key={index} section={section} relatedCode={section.kind === 'architecture' && next?.kind === 'code' ? next : undefined}/>;
  })}</main>;
}
