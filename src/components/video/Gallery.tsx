'use client';
import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { IDEAL_ROW, MIN_ROW, type GalleryClip, type GalleryFilter, intoRows, rowSum, rowTileSizes, splitClips, stripTileSizes, VERTICAL } from './gallery-view';
import { VIDEO_UI } from './strings';
import { Tile } from './Tile';

// A row of posters of one height, each in the proportions of its clip: 16:9 and 1:1 stand side by side uncropped.
// A row that is not full (a lone poster, a short tail) does not stretch: it keeps the height of an ideal row.
// priority: 'high' for the row that opens a page. Its posters are the largest pictures of the first screen, and
// which of them the browser counts as the largest is decided by a rounded pixel, so all of them go first.
// 'low' for a row far down another page, which must not take the line from the pictures above it.
// contained: the row stands in the 1360 px column of a clip page, not across the window.
// eager: the row is seen on the first screen of a wide window, so its posters are not left to load lazily.
export function TileRow({ clips, priority, eager = false, contained = false }: { clips: GalleryClip[]; priority?: 'high' | 'low'; eager?: boolean; contained?: boolean }) {
  const sum = rowSum(clips);
  const share = sum >= MIN_ROW ? 1 : sum / IDEAL_ROW;
  return <div className="vg-row" style={{ '--vg-share': share } as React.CSSProperties}>
    {clips.map(clip => <Tile key={clip.slug} clip={clip} sizes={rowTileSizes(clip, clips, share, contained)} priority={priority} eager={eager}/>)}
  </div>;
}

// The gallery: the best clips first and largest, a filter by section, vertical clips in their own strip.
// The chosen section is kept in the address (?s=promo), so a filtered view can be sent as a link.
export function Gallery({ clips, options, locale }: { clips: GalleryClip[]; options: GalleryFilter[]; locale: Locale }) {
  const t = VIDEO_UI[locale];
  const [filter, setFilter] = useState<GalleryFilter>('all');

  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get('s') as GalleryFilter | null;
    if (wanted && options.includes(wanted)) setFilter(wanted);
  }, [options]);

  const choose = (next: GalleryFilter) => {
    setFilter(next);
    history.replaceState(null, '', next === 'all' ? location.pathname : `${location.pathname}?s=${next}`);
  };
  const label = (option: GalleryFilter) => option === 'all' ? t.all : option === VERTICAL ? t.vertical : t.sections[option];

  const { wide, tall } = splitClips(clips, filter);
  const rows = intoRows(wide);

  return <>
    <section className="vg-head">
      <div className="vg-title"><h1>{t.gallery}</h1><span>{clips.length}</span></div>
      <div className="vg-filter" role="group" aria-label={t.sectionsLabel}>
        {options.map(option => <button key={option} type="button" aria-pressed={option === filter} onClick={() => choose(option)}>{label(option)}</button>)}
      </div>
    </section>
    {rows.length > 0 && <div className="vg-rows">{rows.map((row, index) => <TileRow key={row[0].slug} clips={row} priority={index === 0 ? 'high' : undefined} eager={index === 1}/>)}</div>}
    {tall.length > 0 && <>
      {filter !== VERTICAL && <h2 className="vg-sub">{t.vertical}<span>{tall.length}</span></h2>}
      <div className="vg-strip">{tall.map(clip => <Tile key={clip.slug} clip={clip} sizes={stripTileSizes(clip)} priority={rows.length === 0 ? 'high' : undefined}/>)}</div>
    </>}
  </>;
}
