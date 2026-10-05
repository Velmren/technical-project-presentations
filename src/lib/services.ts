// Service pages: what a client can order, shown with the works that prove it. One file, src/content/services.json.
// A service is written for one language: what people search for differs between Russian and English, so the two
// sets are not translations of each other.
import { z } from 'zod';
import type { Locale } from './i18n';

const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const pair = z.object({ title: z.string().min(1), text: z.string().min(1) });
// What a search result says: the query first. The page itself speaks about the result for the client.
const seo = z.object({ title: z.string().min(1).max(60), description: z.string().min(70).max(165) });

const service = z.object({
  slug,
  locale: z.enum(['ru', 'en']),
  seo,
  // The short name: navigation, the list of services, the line above the heading.
  name: z.string().min(1),
  // The heading: what the client ends up with, in his words, without platform names.
  title: z.string().min(1),
  lead: z.string().min(1),
  // The heading of the contacts under the page, a question: "Need a landing page?".
  ask: z.string().min(1),
  gets: z.array(pair).min(3).max(6),
  // Works shown as proof, by the slug of their page; the first one stands on the first screen.
  works: z.array(slug).min(1).max(4),
  // Clips of the video gallery shown as proof, by their slug.
  clips: z.array(z.string()).max(4).optional(),
  faq: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(2),
});

const common = z.object({
  label: z.string().min(1),
  hub: z.object({ seo, title: z.string().min(1), lead: z.string().min(1) }),
  getsTitle: z.string().min(1), worksTitle: z.string().min(1), clipsTitle: z.string().min(1),
  stepsTitle: z.string().min(1), faqTitle: z.string().min(1), seeExamples: z.string().min(1),
  // How the work goes, the same for every service.
  steps: z.array(pair).min(3).max(5),
});

export const servicesSchema = z.object({
  common: z.object({ ru: common, en: common }),
  services: z.array(service).min(1),
}).superRefine((data, ctx) => {
  const keys = data.services.map(item => `${item.locale}/${item.slug}`);
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: 'Duplicate service slug in one language' });
});

export type ServicesData = z.infer<typeof servicesSchema>;
export type Service = ServicesData['services'][number];
export type ServiceTexts = ServicesData['common'][Locale];

export { SERVICES, servicePath } from './service-paths';
export const servicesOf = (data: ServicesData, locale: Locale) => data.services.filter(item => item.locale === locale);
