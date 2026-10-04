import { RootDocument } from '@/components/RootDocument';
import { UI } from '@/lib/i18n';
import { siteMetadata } from '@/lib/seo';

export const metadata = siteMetadata(UI.en.siteAbout);
export default function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument locale="en">{children}</RootDocument>;
}
