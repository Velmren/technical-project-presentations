'use client';
import { useEffect, useRef } from 'react';

// Scroll depth for proof compositions. One shared scroll listener updates a --depth variable (-1..1) on the
// compositions that are on screen; layers turn it into small translations in CSS, so only transforms change.
// A composition is marked as shown once, which lets its front layer settle in. Reduced motion skips both.
const visible = new Set<HTMLElement>();
let frame = 0;
function update() {
  frame = 0;
  const middle = innerHeight / 2;
  for (const el of visible) {
    const r = el.getBoundingClientRect();
    const depth = Math.max(-1, Math.min(1, (r.top + r.height / 2 - middle) / innerHeight));
    el.style.setProperty('--depth', depth.toFixed(3));
  }
}
const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

export function Depth({ className, style, children }: { className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.dataset.shown = 'true'; return; }
    const watch = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { visible.add(el); schedule(); } else visible.delete(el);
    }, { rootMargin: '10% 0px' });
    const reveal = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { el.dataset.shown = 'true'; reveal.disconnect(); }
    }, { threshold: 0.25 });
    watch.observe(el);
    reveal.observe(el);
    // The browser ignores repeated registrations of the same listener, so every composition can add it.
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    return () => {
      watch.disconnect();
      reveal.disconnect();
      visible.delete(el);
    };
  }, []);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
