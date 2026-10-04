import { RootDocument } from '@/components/RootDocument';
import { SiteFrame } from '@/components/SiteFrame';
import { getProjects } from '@/lib/projects';
import { UI } from '@/lib/i18n';
import { siteMetadata } from '@/lib/seo';

export const metadata = siteMetadata(UI.ru.siteAbout);
export default async function RussianLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const classicPages = (await getProjects()).filter(project => project.presentation !== 'case').map(project => '/' + project.slug + '/');
  return <RootDocument locale="ru"><SiteFrame framed={classicPages}>{children}</SiteFrame></RootDocument>;
}
