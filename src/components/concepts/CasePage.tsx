import Image from 'next/image';
import type { Project, ProjectSection } from '@/lib/schema';
import { fontVariables } from '@/lib/fonts-c';
import { localePath, UI, type Locale } from '@/lib/i18n';
import { buttonColors } from '@/lib/color';
import { workData } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd';
import { Footer, Header, HOME, TextLink } from './Chrome';
import { Depth } from './Depth';
import { LiveEmbed } from './LiveEmbed';
import { LoopVideo } from './LoopVideo';
import '@/app/concepts/concepts.css';
import '@/app/concepts/c/concept-c.css';
import '@/app/concepts/c/case.css';

type Benefit = Extract<ProjectSection, { kind: 'benefit' }>;
type Details = Extract<ProjectSection, { kind: 'features' }>;
type Layer = Benefit['layers'][number];
type Picture = Layer['image'];

// Every screenshot on the page gets the same frame: a browser window when its address is known, a phone,
// or a plain cut-out of the interface. fade marks a cut where the interface continues; video replaces the
// still with a loop of the same view.
function Shot({ image, url, phone, fade, video, embed, sizes, priority }: { image: Picture; url?: string; phone?: boolean; fade?: boolean; video?: string; embed?: string; sizes: string; priority?: boolean }) {
  const kind = phone ? 'phone' : url ? 'browser' : 'panel';
  return <span className={`cs-shot cs-shot-${kind}` + (fade ? ' cs-shot-fade' : '')}>
    {url && !phone && <span className="cs-shot-bar" aria-hidden="true"><span>{url}</span></span>}
    {video
      ? <LoopVideo src={video} poster={image.src} width={image.width} height={image.height} label={image.alt}/>
      : <Image {...image} sizes={sizes} priority={priority}/>}
    {embed && <LiveEmbed src={embed} label={image.alt}/>}
  </span>;
}

// Layers stand side by side (the schema forbids horizontal overlap) and drift vertically at different
// speeds, so scroll depth never lets one cover the other. y is a margin in composition widths.
function Composition({ benefit }: { benefit: Benefit }) {
  const layers = [...benefit.layers].sort((a, b) => a.x - b.x);
  return <Depth className="cs-stage">
    {layers.map((layer, i) => {
      const before = i ? layers[i - 1].x + layers[i - 1].w : 0;
      return <span key={layer.image.src} className={'cs-layer' + (layer.front ? ' cs-layer-front' : ' cs-layer-back')}
        style={{ width: `${layer.w * 100}%`, marginLeft: `${(layer.x - before) * 100}%`, marginTop: `${layer.y * 100}%` }}>
        <span className="cs-layer-inner">
          <Shot image={layer.image} url={layer.url} phone={layer.phone} fade={layer.fade} video={layer.video} embed={layer.embed}
            sizes={`(max-width: 1100px) ${Math.round(layer.w * 100)}vw, ${Math.round(layer.w * 720)}px`}/>
        </span>
      </span>;
    })}
  </Depth>;
}

function BenefitBlock({ benefit, index }: { benefit: Benefit; index: number }) {
  const id = 'cs-benefit-' + index;
  // The first advantage reads text first, then the sides alternate.
  return <section className={'cs-benefit' + (index % 2 ? ' cs-benefit-flip' : '')} aria-labelledby={id}>
    <div className="cs-benefit-copy">
      <h2 id={id}>{benefit.title}</h2>
      <p>{benefit.text}</p>
      {benefit.figure && <p className="cs-figure"><b>{benefit.figure.value}</b> {benefit.figure.label}</p>}
    </div>
    <Composition benefit={benefit}/>
  </section>;
}

function DetailsBlock({ details }: { details: Details }) {
  return <section className="cs-details" aria-labelledby="cs-details-title">
    <div>
      <h2 id="cs-details-title">{details.title}</h2>
      <p>{details.text}</p>
    </div>
    <dl>{details.items.map((item, i) => <div key={item}><dt>{item}</dt>{details.descriptions?.[i] && <dd>{details.descriptions[i]}</dd>}</div>)}</dl>
  </section>;
}

// Project page in the concept C system: one main idea, the work's advantages with real proof, details last.
// The project comes already translated; locale picks the interface texts and the language links.
// share is the link preview picture of the page, named in its structured data as well.
export function CasePage({ project, locale, share }: { project: Project; locale: Locale; share: string }) {
  const t = UI[locale];
  const alternate = localePath(locale === 'ru' ? 'en' : 'ru', `/${project.slug}/`);
  const [live, ...more] = project.actions;
  const benefits = project.sections.filter((s): s is Benefit => s.kind === 'benefit');
  const details = project.sections.filter((s): s is Details => s.kind === 'features');
  // The main button takes the colour of the work itself; without one it stays white.
  const colors = project.accent && buttonColors(project.accent);
  const buttonStyle = colors ? { '--button': colors.button, '--button-ink': colors.ink, '--button-hover': colors.hover, '--button-press': colors.press } as React.CSSProperties : undefined;
  const about = { slug: project.slug, name: project.title, headline: project.seo?.title ?? project.title, description: project.seo?.description ?? project.summary, image: share, year: project.year, technologies: project.technologies };
  return <div className={fontVariables} lang={locale} style={buttonStyle}>
    <JsonLd data={workData(locale, about)}/>
    <div className="cc-page">
      <Header locale={locale} alternate={alternate}/>
      <main id="main" className="cs-main">
        <section className="cs-intro" aria-labelledby="cs-title">
          <div className="cs-intro-copy">
            <p className="cs-name"><b>{project.title}</b><span>{project.eyebrow ?? project.category}{project.year && ` · ${project.year}`}</span></p>
            <h1 id="cs-title">{project.lead ?? project.title}</h1>
            <p className="cs-lead">{project.summary}</p>
            <div className="cc-actions">
              {live && <TextLink className="cc-button" href={live.href}>{live.label}</TextLink>}
              {more.map(action => <TextLink key={action.href} href={action.href}>{action.label}</TextLink>)}
            </div>
            {project.note && <p className="cs-note">{project.note}</p>}
          </div>
          {project.showcase && <figure className="cs-hero-shot">
            <span className="cs-hero-screen"><Shot image={project.showcase.image} url={project.showcase.url} video={project.showcase.video} priority sizes="(max-width: 1100px) 78vw, 46vw"/></span>
            {project.showcase.phone && <span className="cs-hero-phone"><Shot image={project.showcase.phone} video={project.showcase.phoneVideo} phone sizes="(max-width: 1100px) 20vw, 160px"/></span>}
          </figure>}
        </section>
        {benefits.map((benefit, i) => <BenefitBlock key={benefit.title} benefit={benefit} index={i}/>)}
        {details.map(block => <DetailsBlock key={block.title} details={block}/>)}
        <section className="cs-closing" aria-label={t.openProject}>
          <p>{project.closing ?? project.title}</p>
          <div className="cc-actions">
            {live && <TextLink className="cc-button" href={live.href}>{live.label}</TextLink>}
            <TextLink href={localePath(locale, HOME) + '#works'}>{t.allWork}</TextLink>
          </div>
        </section>
      </main>
      <Footer locale={locale} ask={t.askSimilar} contained/>
    </div>
  </div>;
}
