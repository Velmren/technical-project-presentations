'use client';
import { useEffect, useRef } from 'react';

// A short silent loop of the real work. It loads and plays only while on screen; with reduced motion it
// stays on its first frame and offers the usual controls instead.
export function LoopVideo({ src, poster, width, height, label }: { src: string; poster: string; width: number; height: number; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { video.controls = true; return; }
    const watch = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => { video.controls = true; });
      else video.pause();
    }, { threshold: 0.3 });
    watch.observe(video);
    return () => watch.disconnect();
  }, []);
  return <video ref={ref} src={src} poster={poster} width={width} height={height} muted loop playsInline preload="none" aria-label={label}/>;
}
