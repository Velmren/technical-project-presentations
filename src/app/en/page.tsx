import type { Metadata } from 'next';
import { ConceptCView } from '@/components/concepts/ConceptCView';
import { UI } from '@/lib/i18n';
import { socialImage } from '@/lib/social';

export const metadata: Metadata = {
  title: { absolute: 'VELMREN' },
  description: UI.en.heroLead,
  alternates: { canonical: '/en/', languages: { ru: '/', en: '/en/' } },
  openGraph: { title: 'VELMREN', description: UI.en.heroLead, url: '/en/', locale: 'en_GB', type: 'website', siteName: 'VELMREN', images: [socialImage] },
};

export default function HomeEn() {
  return <ConceptCView locale="en"/>;
}
