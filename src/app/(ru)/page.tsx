import { ConceptCView } from '@/components/concepts/ConceptCView';
import { UI } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ locale: 'ru', path: '/', title: UI.ru.siteTitle, description: UI.ru.siteAbout, absoluteTitle: true });

export default function Home() {
  return <ConceptCView locale="ru"/>;
}
