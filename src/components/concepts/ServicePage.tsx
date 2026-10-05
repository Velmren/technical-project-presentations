import { fontVariables } from '@/lib/fonts-c';
import { TELEGRAM } from '@/lib/contacts';
import { localePath, localizeProject, UI, type Locale } from '@/lib/i18n';
import { getProjects } from '@/lib/projects';
import type { Project, ProjectSection } from '@/lib/schema';
import { servicePath, SERVICES } from '@/lib/service-paths';
import { servicesOf, type Service } from '@/lib/services';
import { services } from '@/lib/services-data';
import { projectImage } from '@/lib/social';
import { SHOT_SIZES } from '@/lib/shots';
import { serviceData, servicesListData } from '@/lib/structured-data';
import { galleryPath } from '@/lib/videos';
import { JsonLd } from '@/components/JsonLd';
import { shown, toClip } from '@/components/video/clips';
import { TileRow } from '@/components/video/Gallery';
import { shareImage } from '@/components/video/pages';
import { VIDEO_UI } from '@/components/video/strings';
import { Shot } from './CasePage';
import { Footer, Header, TextLink } from './Chrome';
import { TelegramIcon } from './Contacts';
import '@/app/concepts/concepts.css';
import '@/app/concepts/c/concept-c.css';
import '@/app/concepts/c/case.css';
import '@/components/video/video.css';

type Benefit = Extract<ProjectSection, { kind: 'benefit' }>;
const other = (locale: Locale): Locale => locale === 'ru' ? 'en' : 'ru';
// How many cards of examples stand in a row on a wide window (.sv-grid in case.css): the width of their pictures.
const cardSizes = (count: number) => SHOT_SIZES.example(count === 1 ? 1 : count === 3 ? 3 : 2);

// The link preview of a service shows its main example, the one on its first screen: the first clip of a video
// service, otherwise the first work.
export async function serviceImage(service: Service, locale: Locale) {
  const clip = shown.find(video => video.slug === service.clips?.[0]);
  if (clip) return shareImage(clip, locale, service.name);
  const work = (await getProjects()).find(project => project.slug === service.works[0]);
  return work && projectImage(work, locale);
}

// The page about the work and the work itself: the two ways into an example.
function Ways({ project, locale }: { project: Project; locale: Locale }) {
  const [live] = project.actions;
  return <div className="cc-actions">
    <TextLink href={localePath(locale, `/${project.slug}/`)}>{UI[locale].aboutProject}</TextLink>
    {live && <TextLink href={live.href}>{live.label}</TextLink>}
  </div>;
}

// A work shown as proof: its first screen, what it is and the two ways in.
function Example({ project, locale, sizes }: { project: Project; locale: Locale; sizes: string }) {
  return <article className="sv-work">
    {project.showcase && <a className="sv-work-shot" href={localePath(locale, `/${project.slug}/`)} tabIndex={-1} aria-hidden="true">
      <Shot image={project.showcase.image} url={project.showcase.url} sizes={sizes}/>
    </a>}
    <p className="cs-name"><b>{project.title}</b><span>{project.eyebrow ?? project.category}</span></p>
    <p className="sv-work-text">{project.lead ?? project.summary}</p>
    <Ways project={project} locale={locale}/>
  </article>;
}

// A service proven by one work shows that work from several sides: the screens behind its advantages, each
// under the advantage it proves. The first screen of the work already stands at the top of the page.
function Screens({ project, locale }: { project: Project; locale: Locale }) {
  const benefits = project.sections.filter((section): section is Benefit => section.kind === 'benefit').slice(0, 3);
  return <>
    <div className="sv-grid" data-count={benefits.length}>{benefits.map(benefit => {
      // The whole screen rather than the detail beside it; a phone screen only when there is nothing else.
      const layer = benefit.layers.find(one => !one.phone && !one.front) ?? benefit.layers.find(one => !one.phone) ?? benefit.layers[0];
      return <article className="sv-work sv-screen" key={benefit.title}>
        <span className="sv-work-shot"><Shot image={layer.image} url={layer.url} phone={layer.phone} fade={layer.fade} sizes={cardSizes(benefits.length)}/></span>
        <p className="cs-name"><b>{benefit.title}</b></p>
        <p className="sv-work-text">{benefit.text}</p>
      </article>;
    })}</div>
    <div className="sv-one"><p className="cs-name"><b>{project.title}</b><span>{project.eyebrow ?? project.category}</span></p><Ways project={project} locale={locale}/></div>
  </>;
}

// A list of short points beside its heading: what the client gets, how the work goes, the questions.
function Points({ id, title, items, wide = false }: { id: string; title: string; items: { title: string; text: string }[]; wide?: boolean }) {
  return <section className={'cs-details' + (wide ? ' sv-wide' : '')} aria-labelledby={id}>
    <div><h2 id={id}>{title}</h2></div>
    <dl>{items.map(item => <div key={item.title}><dt>{item.title}</dt><dd>{item.text}</dd></div>)}</dl>
  </section>;
}

// The page of one service: the result for the client first, then working examples, the way of working and the
// questions people ask before they write. The service exists in one language; the switch leads to the list of
// services in the other one.
export async function ServicePage({ service, locale }: { service: Service; locale: Locale }) {
  const t = UI[locale], c = services.common[locale];
  const published = await getProjects();
  const works = service.works.flatMap(slug => published.filter(project => project.slug === slug)).map(project => localizeProject(project, locale));
  const clips = (service.clips ?? []).flatMap(slug => shown.filter(video => video.slug === slug)).map(video => toClip(video, locale));
  // The first screen shows the main example: the poster of the first clip for a video service, otherwise the
  // first screen of the first work.
  const [clip] = clips, [first] = works;
  const hero = clip
    ? <Shot image={{ src: clip.poster, alt: clip.title, width: clip.width, height: clip.height }} set={clip.posterSet ?? ''} priority="high" sizes={SHOT_SIZES.hero}/>
    : first?.showcase && <Shot image={first.showcase.image} url={first.showcase.url} priority="high" sizes={SHOT_SIZES.hero}/>;
  return <div className={fontVariables}>
    <JsonLd data={serviceData(locale, service, t.services)}/>
    <div className="cc-page" lang={locale}>
      <Header locale={locale} alternate={localePath(other(locale), SERVICES)}/>
      <main id="main" className="cs-main">
        <section className="cs-intro" aria-labelledby="sv-title">
          <div className="cs-intro-copy">
            <p className="cs-name"><b>{service.name}</b><span>{c.label}</span></p>
            <h1 id="sv-title">{service.title}</h1>
            <p className="cs-lead">{service.lead}</p>
            <div className="cc-actions">
              <a className="cc-button" href={TELEGRAM} target="_blank" rel="noopener noreferrer" data-contact="telegram/service"><TelegramIcon/>{t.writeTelegram}</a>
              <a className="cc-link" href="#sv-examples">{c.seeExamples}</a>
            </div>
          </div>
          {hero && <figure className="cs-hero-shot"><span className="cs-hero-screen">{hero}</span></figure>}
        </section>
        <Points id="sv-gets" title={c.getsTitle} items={service.gets}/>
        <section className="sv-works" id="sv-examples" aria-labelledby="sv-examples-title">
          <h2 id="sv-examples-title">{clips.length ? c.clipsTitle : c.worksTitle}</h2>
          {clips.length > 0
            ? <>
              <div className="sv-clips"><TileRow clips={clips} contained/></div>
              {/* Under the clips the works are plain links: the clips are the proof here. */}
              <div className="cc-actions">
                <TextLink href={galleryPath(locale)}>{VIDEO_UI[locale].allVideos}</TextLink>
                {works.map(project => <TextLink key={project.slug} href={localePath(locale, `/${project.slug}/`)}>{project.title}</TextLink>)}
              </div>
            </>
            : works.length === 1
              ? <Screens project={first} locale={locale}/>
              : <div className="sv-grid" data-count={works.length}>{works.map(project => <Example key={project.slug} project={project} locale={locale} sizes={cardSizes(works.length)}/>)}</div>}
        </section>
        <Points id="sv-steps" title={c.stepsTitle} items={c.steps}/>
        <Points id="sv-faq" title={c.faqTitle} items={service.faq.map(item => ({ title: item.q, text: item.a }))} wide/>
      </main>
      <Footer locale={locale} ask={service.ask} contained/>
    </div>
  </div>;
}

// The list of services in one language, with the way of working under it.
export function ServicesList({ locale }: { locale: Locale }) {
  const t = UI[locale], c = services.common[locale];
  const list = servicesOf(services, locale);
  return <div className={fontVariables}>
    <JsonLd data={servicesListData(locale, { name: t.services, description: c.hub.seo.description, path: SERVICES }, list.map(item => ({ name: item.name, path: servicePath(item.slug) })))}/>
    <div className="cc-page" lang={locale}>
      <Header locale={locale} alternate={localePath(other(locale), SERVICES)}/>
      <main id="main" className="cs-main">
        <section className="ct-page" aria-labelledby="sv-list-title">
          <h1 id="sv-list-title">{c.hub.title}</h1>
          <p className="cs-lead">{c.hub.lead}</p>
        </section>
        <ul className="sv-list">{list.map(item => <li key={item.slug}>
          <a href={localePath(locale, servicePath(item.slug))}><b>{item.name}</b><span>{item.title}</span></a>
        </li>)}</ul>
        <Points id="sv-steps" title={c.stepsTitle} items={c.steps}/>
      </main>
      <Footer locale={locale} contained/>
    </div>
  </div>;
}
