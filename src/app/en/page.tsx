import { ConceptCView } from '@/components/concepts/ConceptCView';
import { UI } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ locale: 'en', path: '/', title: UI.en.siteTitle, description: UI.en.siteAbout, absoluteTitle: true });

export default function HomeEn() {
  return <ConceptCView locale="en"/>;
}
