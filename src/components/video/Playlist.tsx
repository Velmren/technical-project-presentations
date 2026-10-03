'use client';
import { useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import type { ShownVideo } from '@/lib/videos';
import { PlayerIcon } from './icons';
import { fullLength, Player } from './Player';
import { VIDEO_UI } from './strings';
import { useCopy } from './useCopy';

export type PlaylistClip = ShownVideo & { href: string };

// A collection for one client: a single player and the list of its clips, the whole thing on one screen.
// The chosen clip is kept in the address (?v=slug). When a clip ends the next one is put up, waiting for a press:
// nothing starts by itself.
export function Playlist({ title, text, clips, galleryHref, locale }: { title: string; text: string; clips: PlaylistClip[]; galleryHref: string; locale: Locale }) {
  const t = VIDEO_UI[locale];
  const [index, setIndex] = useState(0);
  const { copy, note } = useCopy(locale);
  const current = clips[index];
  const cut = current.cuts[0];
  const total = clips.reduce((sum, clip) => sum + clip.cuts[0].duration, 0);

  useEffect(() => {
    const wanted = clips.findIndex(clip => clip.slug === new URLSearchParams(location.search).get('v'));
    if (wanted > 0) setIndex(wanted);
  }, [clips]);

  const address = (at: number) => location.pathname + (at > 0 ? `?v=${clips[at].slug}` : '');
  const choose = (next: number) => {
    setIndex(next);
    history.replaceState(null, '', address(next));
  };

  return <div className="vg-playlist">
    <header className="vg-playlist-head">
      <p className="vg-kind">{t.collection}<i>·</i>{t.clips(clips.length)}<i>·</i>{fullLength(total)}</p>
      <h1>{title}</h1>
      <p className="vg-lead">{text}</p>
    </header>
    <div className="vg-playlist-main">
      <div className="vg-slot" data-shape={cut.width > cut.height ? 'wide' : 'tall'} style={{ '--vg-ratio': cut.width / cut.height } as React.CSSProperties}>
        <Player key={current.slug} source={cut} title={current.title} locale={locale} pageKeys onEnded={() => { if (index < clips.length - 1) choose(index + 1); }}/>
      </div>
      <div className="vg-under">
        <div>
          <p className="vg-kind">{current.kind}<i>·</i>{fullLength(cut.duration)}<i>·</i>{cut.format}<i>·</i>{current.year}</p>
          <h2>{current.title}</h2>
          <p className="vg-lead">{current.text}</p>
        </div>
        <a className="cc-link" href={current.href}>{t.openAlone}</a>
      </div>
    </div>
    <div className="vg-playlist-list">
      <h2 className="vg-list-title">{t.inCollection}</h2>
      <ol className="vg-list">
        {clips.map((clip, at) => <li key={clip.slug}>
          <button type="button" aria-current={at === index || undefined} onClick={() => choose(at)}>
            <b>{clip.title}</b><span>{clip.kind} · {fullLength(clip.cuts[0].duration)}</span>
          </button>
        </li>)}
      </ol>
      <div className="vg-actions">
        <button type="button" className="cc-button vg-copy-link" onClick={() => void copy(location.origin + address(index))}><PlayerIcon name="link"/>{t.copyLink}</button>
        <a className="cc-link" href={galleryHref}>{t.allVideos}</a>
        <p className="vg-status" role="status">{note}</p>
      </div>
    </div>
  </div>;
}
