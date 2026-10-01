import type { Metadata } from 'next';
import { ConceptCView } from '@/components/concepts/ConceptCView';
import { UI } from '@/lib/i18n';
import { socialImage } from '@/lib/social';

export const metadata: Metadata = {
  title: { absolute: 'VELMREN' },
  description: UI.ru.heroLead,
  alternates: { canonical: '/', languages: { ru: '/', en: '/en/' } },
  openGraph: { title: 'VELMREN', description: UI.ru.heroLead, url: '/', locale: 'ru_RU', type: 'website', siteName: 'VELMREN', images: [socialImage] },
};

export default function Home() {
  return <ConceptCView locale="ru"/>;
}
