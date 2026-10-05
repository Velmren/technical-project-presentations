import { ServicesList } from '@/components/concepts/ServicePage';
import { pageMetadata } from '@/lib/seo';
import { SERVICES } from '@/lib/service-paths';
import { services } from '@/lib/services-data';

const { seo } = services.common.en.hub;
export const metadata = pageMetadata({ locale: 'en', path: SERVICES, title: seo.title, description: seo.description });

export default function ServicesEn() {
  return <ServicesList locale="en"/>;
}
