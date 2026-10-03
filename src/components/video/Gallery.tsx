'use client';
import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { IDEAL_ROW, MIN_ROW, type GalleryClip, type GalleryFilter, intoRows, rowSum, splitClips, VERTICAL } from './gallery-view';
import { VIDEO_UI } from './strings';
import { Tile } from './Tile';

// A row of posters of one height, each in the proportions of its clip: 16:9 and 1:1 stand side by side uncropped.
// A row that is not full (a lone poster, a short tail) does not stretch: it keeps the height of an ideal row.
export function TileRow({ clips, eager = false }: { clips: GalleryClip[]; eager?: boolean }) {
  const sum = rowSum(clips);
  const share = sum >= MIN_ROW ? 1 : sum / IDEAL_ROW;
  return <div className="vg-row" style={{ '--vg-share': share } as React.CSSProperties}>
    {clips.map(clip => <Tile key={clip.slug} clip={clip} eager={eager}/>)}
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
      <h1 className="vg-title">{t.gallery}<span>{clips.length}</span></h1>
      <div className="vg-filter" role="group" aria-label={t.sectionsLabel}>
        {options.map(option => <button key={option} type="button" aria-pressed={option === filter} onClick={() => choose(option)}>{label(option)}</button>)}
      </div>
    </section>
    {rows.length > 0 && <div className="vg-rows">{rows.map((row, index) => <TileRow key={row[0].slug} clips={row} eager={index === 0}/>)}</div>}
    {tall.length > 0 && <>
      {filter !== VERTICAL && <h2 className="vg-sub">{t.vertical}<span>{tall.length}</span></h2>}
      <div className="vg-strip">{tall.map(clip => <Tile key={clip.slug} clip={clip} eager={rows.length === 0}/>)}</div>
    </>}
  </>;
}
