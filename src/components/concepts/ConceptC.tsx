'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HomeWork } from '@/lib/home';
import { filterTabs, matchesWork } from '@/lib/home-view';
import type { Mosaic, MosaicSource } from '@/lib/concepts/mosaic';
import { HOME, Footer, Header, TextLink } from './Chrome';
import { localePath, UI, type Dictionary, type Locale } from '@/lib/i18n';
import { LivePreview, liveMode } from './LivePreview';

const AUTOPLAY_MS = 6500;
// Each work's own colour, taken from its interface (dark ones lifted to read on the graphite page); the page
// borrows the colour of the work on screen.
const BOARDS: Record<string, { file: string; accent: string; titled?: boolean }> = {
  'electronics-store': { file: 'store', accent: '#3a6cf2' },
  forma: { file: 'forma', accent: '#2745c8' },
  'admin-dashboard': { file: 'orbit', accent: '#1eaefc' },
  sono: { file: 'sono', accent: '#5a6cf0' },
  godot: { file: 'spark', accent: '#ffb81f' },
  'game-concept': { file: 'lacuna', accent: '#ffb44f' },
  assembly: { file: 'veresta', accent: '#d9603f' },
  'mobile-game': { file: 'lumi', accent: '#f6c553' },
  shopify: { file: 'shopify', accent: '#5f9a7b' },
  falz: { file: 'falz', accent: '#6f97bb' },
  'tilda-tour': { file: 'tour', accent: '#4fa584' },
  'tilda-dental': { file: 'dental', accent: '#4aa38c' },
  'tilda-webinar': { file: 'webinar', accent: '#c7795a' },
  motion: { file: 'motion', accent: '#e4572e', titled: true },
  encounter: { file: 'encounter', accent: '#9a7cf4' },
  'tilda-interior': { file: 'tilda', accent: '#8e9b64' },
  khrum: { file: 'khrum', accent: '#6a47c2' },
  'dev-utilities': { file: 'devutil', accent: '#2fb39a' },
};
// A frame without the work's name carries a title in the picture, so it has a board per language.
const boardPath = (slug: string, locale: Locale, size = '', layer = '') => {
  const { file, titled } = BOARDS[slug];
  return `/assets/home/board-${file}${titled && locale === 'en' ? '-en' : ''}${size}${layer}.webp`;
};
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Hero({ works, t, locale }: { works: HomeWork[]; t: Dictionary; locale: Locale }) {
  const boardWorks = useMemo(() => works.filter(w => BOARDS[w.slug]), [works]);
  const stage = useRef<HTMLDivElement>(null), board = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), frame = useRef<HTMLAnchorElement>(null);
  const scene = useRef<Mosaic | null>(null);
  const press = useRef<{ x: number; y: number; t: number; vx: number; vy: number; moved: boolean; touch: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [index, setIndex] = useState(0), [ready, setReady] = useState(false), [structure, setStructure] = useState(false);
  const [playing, setPlaying] = useState(true), [hold, setHold] = useState(false), [announce, setAnnounce] = useState('');
  const work = boardWorks[index];

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const small = matchMedia('(max-width: 860px)').matches;
    if (reduced) setPlaying(false);
    const suffix = small ? '-768' : '';
    const sources: MosaicSource[] = boardWorks.map(w => ({
      color: boardPath(w.slug, locale, suffix),
      structure: boardPath(w.slug, locale, suffix, '-structure'),
      accent: rgb(BOARDS[w.slug].accent),
    }));
    let cancelled = false;
    const place = () => {
      const c = canvas.current?.getBoundingClientRect(), f = frame.current?.getBoundingClientRect();
      if (c && f) scene.current?.frame({ x: f.left - c.left, y: f.top - c.top, width: f.width, height: f.height });
    };
    const observer = new ResizeObserver(place);
    import('@/lib/concepts/mosaic').then(async ({ mountMosaic }) => {
      if (cancelled || !canvas.current) return;
      try {
        const instance = await mountMosaic(canvas.current, {
          sources, cols: small ? 40 : 64, rows: small ? 25 : 40, reduced, maxRatio: small ? 1.5 : 2,
          onFirstFrame: () => setReady(true), onLost: () => setReady(false),
        });
        if (cancelled) { instance.dispose(); return; }
        scene.current = instance;
        place();
        if (board.current) observer.observe(board.current);
      } catch { setReady(false); }
    });
    return () => { cancelled = true; observer.disconnect(); scene.current?.dispose(); scene.current = null; };
  }, [boardWorks, locale]);

  const go = useCallback((next: number, direction: 1 | -1, origin?: [number, number], byUser = false) => {
    const target = (next + boardWorks.length) % boardWorks.length;
    setIndex(target);
    scene.current?.show(target, direction, origin);
    if (byUser) setAnnounce(t.nowShowing + boardWorks[target].title);
  }, [boardWorks, t]);

  useEffect(() => { scene.current?.structure(structure); }, [structure]);

  const toCanvas = (e: React.PointerEvent): [number, number] => {
    const c = canvas.current!.getBoundingClientRect();
    return [e.clientX - c.left, e.clientY - c.top];
  };
  function down(e: React.PointerEvent<HTMLAnchorElement>) {
    press.current = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0, moved: false, touch: e.pointerType !== 'mouse' };
    if (e.pointerType === 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLAnchorElement>) {
    if (e.pointerType === 'mouse') scene.current?.point(...toCanvas(e));
    const p = press.current;
    if (!p || p.touch) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 6) return;
    p.moved = true;
    const now = performance.now(), dt = Math.max(8, now - p.t) / 1000;
    scene.current?.drag(dx * 0.004, dy * 0.003);
    press.current = { ...p, x: e.clientX, y: e.clientY, t: now, vx: dx * 0.004 / dt, vy: dy * 0.003 / dt };
  }
  function up(e: React.PointerEvent<HTMLAnchorElement>) {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (p.touch) {
      // Horizontal swipe on touch screens switches the work; vertical movement scrolls the page.
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) { suppressClick.current = true; go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1, undefined, true); }
      return;
    }
    if (p.moved) { suppressClick.current = true; scene.current?.release(p.vx * 0.5, p.vy * 0.5); }
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      go(index + d, d, undefined, true);
    }
  }
  function tabKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (index + d + boardWorks.length) % boardWorks.length;
    go(next, d as 1 | -1, undefined, true);
    (e.currentTarget.querySelectorAll('[role="tab"]')[next] as HTMLElement | undefined)?.focus();
  }

  const paused = !playing || hold;
  // The still under the canvas only matters until the scene draws (or if it is lost); freezing it avoids
  // decoding a new full-size image on every switch.
  const still = (ready ? boardWorks[0] : work).slug;
  return <section className="cc-hero" aria-labelledby="cc-title" style={{ '--accent': BOARDS[work.slug].accent } as React.CSSProperties}>
    <div className="cc-hero-copy">
      <h1 id="cc-title">{t.heroTitle}</h1>
      <p className="cc-lead">{t.heroLead}</p>
      <div className="cc-actions">
        <a className="cc-button" href="#works">{t.seeWork}</a>
        <a className="cc-link" href="#contact">{t.getInTouch}</a>
      </div>
    </div>
    <div className="cc-stage" ref={stage} data-ready={ready} data-structure={structure || undefined}
      onMouseEnter={() => setHold(true)} onMouseLeave={() => { setHold(false); scene.current?.leave(); }}
      onFocus={() => setHold(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setHold(false); }}>
      {/* The canvas is sized by the board alone, so caption changes never resize its drawing buffer. */}
      <div className="cc-board" ref={board}>
        <canvas ref={canvas} className="cc-canvas" aria-hidden="true"/>
        <a ref={frame} id="cc-board" role="tabpanel" className="cc-frame" href={work.details ?? work.action?.href}
          aria-label={t.boardLabel(work.title)}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { press.current = null; }}
          onClick={e => { if (suppressClick.current) { e.preventDefault(); suppressClick.current = false; } }} onKeyDown={key}>
          <img className="cc-still" src={boardPath(still, locale)} srcSet={`${boardPath(still, locale, '-768')} 768w, ${boardPath(still, locale)} 1440w`}
            sizes="(max-width: 860px) 100vw, 56vw" alt="" draggable={false} fetchPriority="high"/>
        </a>
      </div>
      <div className="cc-caption">
        <div className="cc-now"><p><b>{work.title}</b><span>{work.type ?? work.category} · {work.stack}</span></p><WorkLinks work={work} t={t}/></div>
        <div className="cc-tools">
          <button type="button" className="cc-tool" aria-pressed={structure} onClick={() => setStructure(s => !s)}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 1.5h13v13h-13zM1.5 6h13M1.5 10.5h13M6 1.5v13M10.5 1.5v13" fill="none" stroke="currentColor" strokeWidth="1.2"/></svg>
            {t.structure}
          </button>
          <button type="button" className="cc-tool cc-icon-tool" aria-label={playing ? t.pause : t.resume} onClick={() => setPlaying(p => !p)}>
            <svg viewBox="0 0 16 16" aria-hidden="true">{playing ? <path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="1.8"/> : <path d="M5 3l8 5-8 5z" fill="currentColor"/>}</svg>
          </button>
        </div>
      </div>
      <div className="cc-switch" role="tablist" aria-label={t.boardTabs} onKeyDown={tabKey}>
        {boardWorks.map((w, i) => <button key={w.slug} type="button" role="tab" aria-selected={i === index} aria-controls="cc-board" tabIndex={i === index ? 0 : -1}
          style={{ '--tab-accent': BOARDS[w.slug].accent } as React.CSSProperties} onClick={() => go(i, i >= index ? 1 : -1, undefined, true)}>
          {w.title}
          {i === index && <span className="cc-progress" data-paused={paused || undefined} style={{ animationDuration: AUTOPLAY_MS + 'ms' }}
            onAnimationEnd={() => go(index + 1, 1)} aria-hidden="true"/>}
        </button>)}
      </div>
      <p className="cc-sr" aria-live="polite">{announce}</p>
    </div>
  </section>;
}

const accentOf = (slug: string) => BOARDS[slug]?.accent;

// Every work offers the project itself and the page about it, whichever exist.
function WorkLinks({ work, t, primary = false }: { work: HomeWork; t: Dictionary; primary?: boolean }) {
  const live = work.action?.href;
  return <div className="cc-work-links">
    {live && (primary
      ? <TextLink className="cc-button" href={live}>{work.action!.label}</TextLink>
      : <TextLink href={live}>{work.action!.label}</TextLink>)}
    {work.extra && <TextLink href={work.extra.href}>{work.extra.label}</TextLink>}
    {work.details && <TextLink href={work.details}>{t.aboutProject}</TextLink>}
  </div>;
}

// One work as one row: its preview and, beside it, what it is, what it does, its figures and links. Rows alternate
// sides and are separated by a rule, so every word and button sits with its own preview.
function Feature({ work, t, flip }: { work: HomeWork; t: Dictionary; flip: boolean }) {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { threshold: 0.35 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  const accent = accentOf(work.slug);
  const specs = [
    [t.stack, work.stack.replace(' / ', ', ')],
    ...(work.facts ?? []).map(f => [f.name ?? capitalize(f.label), f.value]),
    [t.year, String(work.year)],
  ];
  return <article ref={ref} className={'cc-feature' + (flip ? ' cc-feature-flip' : '')} id={'work-' + work.slug} style={{ '--accent': accent } as React.CSSProperties}>
    <a className="cc-feature-media" href={work.details ?? work.action?.href} tabIndex={-1} aria-hidden="true">
      <LivePreview work={work} mode={liveMode(work, ['scroll', 'slides', 'video'])} active={active}/>
      {work.preview?.overlay && <span className="cc-phone"><img src={work.preview.overlay.src} alt="" loading="lazy"/></span>}
    </a>
    <div className="cc-feature-copy">
      <p className="cc-kind">{work.type ?? work.category}</p>
      <h3>{work.title}</h3>
      <p className="cc-feature-text">{work.description}</p>
      <table className="cc-spec"><tbody>{specs.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table>
      <WorkLinks work={work} t={t} primary/>
    </div>
  </article>;
}

// Works arrive already translated; locale picks the interface texts.
export function ConceptC({ works, locale }: { works: HomeWork[]; locale: Locale }) {
  const t = UI[locale];
  const [category, setCategory] = useState('Все');
  const tabs = useMemo(() => filterTabs(works), [works]);
  const visible = works.filter(w => matchesWork(w, category, ''));

  return <div className="cc-page" lang={locale}>
    <Header home locale={locale} alternate={localePath(locale === 'ru' ? 'en' : 'ru', HOME)}/>
    <main id="main">
      <Hero works={works} t={t} locale={locale}/>
      <section className="cc-works" id="works" aria-labelledby="cc-works-title">
        <div className="cc-works-head">
          <h2 id="cc-works-title">{t.work} <span>{works.length}</span></h2>
          <div className="cc-filter" role="group" aria-label={t.categories}>
            {tabs.map(tab => <button type="button" key={tab} aria-pressed={category === tab} onClick={() => setCategory(tab)}>{t.tags[tab] ?? tab}</button>)}
          </div>
        </div>
        {visible.map((work, i) => <Feature key={work.slug} work={work} t={t} flip={i % 2 === 1}/>)}
      </section>
    </main>
    <Footer home locale={locale}/>
  </div>;
}
