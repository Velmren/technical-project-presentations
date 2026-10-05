import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { serviceImage, ServicePage } from '@/components/concepts/ServicePage';
import { pageMetadata } from '@/lib/seo';
import { servicePath } from '@/lib/service-paths';
import { servicesOf } from '@/lib/services';
import { services } from '@/lib/services-data';

// A service is written for one language, so its page names no other language version.
type Props = { params: Promise<{ service: string }> };
const find = (name: string) => servicesOf(services, 'en').find(item => item.slug === name);

export const dynamicParams = false;
export function generateStaticParams() { return servicesOf(services, 'en').map(item => ({ service: item.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = find((await params).service);
  return item ? pageMetadata({ locale: 'en', path: servicePath(item.slug), title: item.seo.title, description: item.seo.description, image: await serviceImage(item, 'en'), single: true }) : {};
}
export default async function ServiceEn({ params }: Props) {
  const item = find((await params).service);
  if (!item) notFound();
  return <ServicePage service={item} locale="en"/>;
}
