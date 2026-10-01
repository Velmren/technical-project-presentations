'use client';
import { useEffect, useRef, useState } from 'react';
import type { HomeWork } from '@/lib/home';

export type LiveMode = 'video' | 'scroll' | 'slides';

// Picks the motion material a work has, in the order the caller prefers.
export function liveMode(work: HomeWork, prefer: LiveMode[]): LiveMode | null {
  return prefer.find(mode => work.live?.[mode]) ?? null;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return reduced;
}

// A tall page scrolling inside a fixed frame. The scroll distance depends on the frame height in pixels,
// so the frame measures itself; the page image loads only when the frame comes near the screen.
export function ScrollFrame({ src, alt, playing, className = '' }: { src: string; alt: string; playing: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const size = new ResizeObserver(() => el.style.setProperty('--live-frame-h', el.clientHeight + 'px'));
    size.observe(el);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => { size.disconnect(); io.disconnect(); };
  }, []);
  return <div ref={box} className={'live live-scroll ' + className} data-playing={playing}>
    {near && <img src={src} alt={alt} decoding="async"/>}
  </div>;
}

// Live preview of a work: plays only while active, and stays a still frame with reduced motion.
export function LivePreview({ work, mode, active, interval = 2400, className = '' }: { work: HomeWork; mode: LiveMode | null; active: boolean; interval?: number; className?: string }) {
  const reduced = useReducedMotion();
  const video = useRef<HTMLVideoElement>(null), box = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0), [seen, setSeen] = useState(1), [near, setNear] = useState(false), [started, setStarted] = useState(false);
  const playing = active && !reduced;

  // Media loads only when the preview gets close to the screen, and a video only once it first plays.
  useEffect(() => {
    const el = box.current;
    if (near || !el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  useEffect(() => { if (playing) setStarted(true); }, [playing]);
  const slides = work.live?.slides ?? [];

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (playing) el.play().catch(() => {}); else el.pause();
  }, [playing, started]);

  useEffect(() => {
    if (mode !== 'slides' || !playing) return;
    const timer = setInterval(() => setSlide(s => { const next = (s + 1) % slides.length; setSeen(n => Math.max(n, next + 1)); return next; }), interval);
    return () => clearInterval(timer);
  }, [mode, playing, slides.length, interval]);

  const alt = work.preview?.alt ?? work.title;
  if (mode === 'video' && work.live?.video) {
    return <div ref={box} className={'live live-video ' + className}>
      {started ? <video ref={video} src={work.live.video.src} poster={work.live.video.poster} muted playsInline loop preload="auto" aria-label={alt}/>
        : near && <img src={work.live.video.poster} alt={alt} decoding="async"/>}
    </div>;
  }
  if (mode === 'scroll' && work.live?.scroll) {
    return <ScrollFrame src={work.live.scroll} alt={alt} playing={playing} className={className}/>;
  }
  if (mode === 'slides' && slides.length) {
    return <div ref={box} className={'live live-slides ' + className} data-playing={playing} style={{ '--live-interval': interval + 'ms' } as React.CSSProperties}>
      {/* Only screens already shown and the next one are in the page, so a preview costs one image until it plays. */}
      {near && slides.map((src, i) => i <= seen && (i === 0 || playing || i < seen) ? <img key={src} src={src} alt={i === slide ? alt : ''} aria-hidden={i !== slide || undefined} data-active={i === slide} loading={i ? 'lazy' : 'eager'} decoding="async"/> : null)}
      <div className="live-progress" aria-hidden="true">{slides.map((src, i) => <span key={src} data-state={i < slide ? 'done' : i === slide ? 'now' : 'next'}/>)}</div>
    </div>;
  }
  return <div ref={box} className={'live ' + className}>{near && work.preview && <img src={work.preview.src} alt={alt} decoding="async"/>}</div>;
}
