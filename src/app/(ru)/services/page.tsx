import { ServicesList } from '@/components/concepts/ServicePage';
import { pageMetadata } from '@/lib/seo';
import { SERVICES } from '@/lib/service-paths';
import { services } from '@/lib/services-data';

const { seo } = services.common.ru.hub;
export const metadata = pageMetadata({ locale: 'ru', path: SERVICES, title: seo.title, description: seo.description });

export default function Services() {
  return <ServicesList locale="ru"/>;
}
