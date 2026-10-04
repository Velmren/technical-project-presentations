// Structured data of the pages (schema.org, JSON-LD): who stands behind the site, what a page shows and where it
// stands on the site. Every function returns a ready object for <JsonLd>.
import { GITHUB, MAIL, TELEGRAM } from './contacts';
import { localePath, type Locale } from './i18n';
import { ORGANIZATION_ID, SITE, SITE_NAME } from './seo';

const address = (locale: Locale, path: string) => SITE + localePath(locale, path);
const graph = (...nodes: object[]) => ({ '@context': 'https://schema.org', '@graph': nodes });

// The practice. No postal address and no phone: the site publishes only Telegram and mail.
const organization = {
  '@type': 'Organization', '@id': ORGANIZATION_ID, name: SITE_NAME, url: SITE + '/',
  logo: SITE + '/apple-touch-icon-v2.png', email: MAIL, sameAs: [TELEGRAM, GITHUB],
};
// The site as every page refers to it; the home page adds its description and languages.
const website = { '@type': 'WebSite', '@id': SITE + '/#website', url: SITE + '/', name: SITE_NAME };

// A trail from the home page down to this page; names are the words shown in the site navigation.
type Step = { name: string; path: string };
const breadcrumbs = (locale: Locale, steps: Step[]) => ({
  '@type': 'BreadcrumbList',
  itemListElement: steps.map((step, index) => ({ '@type': 'ListItem', position: index + 1, name: step.name, item: address(locale, step.path) })),
});
const home = { name: SITE_NAME, path: '/' };

// The home page: the practice and the site as a whole.
export function siteData(description: string) {
  return graph(organization, { ...website, description, inLanguage: ['ru', 'en'], publisher: { '@id': ORGANIZATION_ID } });
}

// name is the name of the work itself, headline says what kind of work it is.
type Work = { slug: string; name: string; headline: string; description: string; image: string; year?: number; technologies: string[] };
export function workData(locale: Locale, work: Work) {
  const path = `/${work.slug}/`;
  return graph({
    '@type': 'CreativeWork', '@id': address(locale, path) + '#work', url: address(locale, path),
    name: work.name, headline: work.headline, description: work.description, image: SITE + work.image, inLanguage: locale,
    ...(work.year ? { dateCreated: String(work.year) } : {}), keywords: work.technologies.join(', '),
    creator: { '@id': ORGANIZATION_ID }, isPartOf: website,
  }, organization, breadcrumbs(locale, [home, { name: work.name, path }]));
}

type Clip = { name: string; path: string };
export function galleryData(locale: Locale, gallery: { name: string; description: string; path: string }, clips: Clip[]) {
  return graph({
    '@type': 'CollectionPage', '@id': address(locale, gallery.path) + '#gallery', url: address(locale, gallery.path),
    name: gallery.name, description: gallery.description, inLanguage: locale, isPartOf: website, publisher: { '@id': ORGANIZATION_ID },
    mainEntity: {
      '@type': 'ItemList', numberOfItems: clips.length,
      itemListElement: clips.map((clip, index) => ({ '@type': 'ListItem', position: index + 1, name: clip.name, url: address(locale, clip.path) })),
    },
  }, organization, breadcrumbs(locale, [home, { name: gallery.name, path: gallery.path }]));
}

// The trail of a clip page; the clip itself is described next to it as a VideoObject.
export const clipTrail = (locale: Locale, gallery: Step, clip: Step) => ({ '@context': 'https://schema.org', ...breadcrumbs(locale, [home, gallery, clip]) });

// A service page: the service, the trail to it and the questions with their answers.
type Offer = { slug: string; name: string; seo: { title: string; description: string }; faq: { q: string; a: string }[] };
export function serviceData(locale: Locale, service: Offer, listName: string) {
  const path = `/services/${service.slug}/`;
  return graph({
    '@type': 'Service', '@id': address(locale, path) + '#service', url: address(locale, path),
    name: service.name, serviceType: service.seo.title, description: service.seo.description, provider: { '@id': ORGANIZATION_ID },
  }, organization, breadcrumbs(locale, [home, { name: listName, path: '/services/' }, { name: service.name, path }]), {
    '@type': 'FAQPage',
    mainEntity: service.faq.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
  });
}

// The list of services in one language.
export function servicesListData(locale: Locale, page: { name: string; description: string; path: string }, list: Step[]) {
  return graph({
    '@type': 'CollectionPage', '@id': address(locale, page.path) + '#services', url: address(locale, page.path),
    name: page.name, description: page.description, inLanguage: locale, isPartOf: website, publisher: { '@id': ORGANIZATION_ID },
    mainEntity: {
      '@type': 'ItemList', numberOfItems: list.length,
      itemListElement: list.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, url: address(locale, item.path) })),
    },
  }, organization, breadcrumbs(locale, [home, { name: page.name, path: page.path }]));
}

export function contactsData(locale: Locale, page: { name: string; description: string; path: string }) {
  return graph({
    '@type': 'ContactPage', '@id': address(locale, page.path) + '#contacts', url: address(locale, page.path),
    name: page.name, description: page.description, inLanguage: locale, isPartOf: website, about: { '@id': ORGANIZATION_ID },
  }, organization, breadcrumbs(locale, [home, { name: page.name, path: page.path }]));
}
