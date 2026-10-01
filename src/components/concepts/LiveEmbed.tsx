'use client';
import { useEffect, useRef, useState } from 'react';
import './live-embed.css';

// A live page of the work (Lottie, Canvas) over its poster. The page is requested only when the frame is
// about to come into view, and fades in once it has painted its first frame.
export function LiveEmbed({ src, label }: { src: string; label: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const [lang, setLang] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const watch = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setLang(node.closest('[lang]')?.getAttribute('lang') === 'en' ? '?lang=en' : ''); setNear(true); watch.disconnect(); }
    }, { rootMargin: '300px 0px' });
    watch.observe(node);
    return () => watch.disconnect();
  }, []);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === location.origin && event.data?.live === src) setReady(true);
    };
    addEventListener('message', onMessage);
    return () => removeEventListener('message', onMessage);
  }, [src]);
  return <span ref={host} className={'cs-live' + (ready ? ' cs-live-ready' : '')}>
    {near && <iframe src={src + lang} title={label} loading="lazy" allow="autoplay"/>}
  </span>;
}
