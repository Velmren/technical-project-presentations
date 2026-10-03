'use client';
import { useRef, useState } from 'react';
import type { GalleryClip } from './gallery-view';

// A large poster that leads to the page of its clip. While the pointer or the keyboard focus rests on it,
// a short silent fragment plays in place; the fragment is not requested before that. The name sits in a corner
// cut out of the poster, on the page ground, so it reads on any frame and nothing shades the picture.
export function Tile({ clip, eager = false }: { clip: GalleryClip; eager?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [playing, setPlaying] = useState(false);

  const start = () => {
    if (!clip.preview || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    clearTimeout(timer.current);
    // A pointer that only crosses the poster on its way elsewhere starts nothing.
    timer.current = setTimeout(() => {
      const element = video.current;
      if (!element) return;
      if (!element.getAttribute('src')) element.src = clip.preview!;
      element.muted = true;
      element.currentTime = 0;
      element.play().then(() => setPlaying(true), () => {});
    }, 140);
  };
  const stop = () => {
    clearTimeout(timer.current);
    video.current?.pause();
    setPlaying(false);
  };

  return <a className="vg-tile" href={clip.href} data-playing={playing || undefined} style={{ '--vg-ratio': clip.width / clip.height } as React.CSSProperties}
    onPointerEnter={event => { if (event.pointerType === 'mouse') start(); }} onPointerLeave={stop}
    onFocus={event => { if (event.currentTarget.matches(':focus-visible')) start(); }} onBlur={stop}>
    <img src={clip.poster} alt="" width={clip.width} height={clip.height} loading={eager ? 'eager' : 'lazy'} decoding="async"/>
    {clip.preview && <video ref={video} muted loop playsInline preload="none" tabIndex={-1} aria-hidden="true"/>}
    <i className="vg-run"/>
    {/* The length never parts from its dot: on a narrow poster the line breaks inside the words before it. */}
    <span className="vg-cap"><b>{clip.title}</b><span>{clip.kind}{'\u00a0·\u00a0'}{clip.length}</span></span>
  </a>;
}
