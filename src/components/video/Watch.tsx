'use client';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import type { ShownVideo } from '@/lib/videos';
import { PlayerIcon } from './icons';
import { clock, Player } from './Player';
import { VIDEO_UI } from './strings';

// ?t=75 or ?t=1:15 opens the clip at that moment.
function readTime(value: string | null) {
  const parts = value?.match(/^(?:(\d{1,3}):)?(\d{1,5}(?:\.\d+)?)$/);
  return parts ? Number(parts[1] ?? 0) * 60 + Number(parts[2]) : 0;
}
const formatParam = (format: string) => format.replace(':', 'x');
// Links that leave the site open in a new tab; no arrow marks them.
const outside = (href: string) => href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {};

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  // Older browsers and pages opened without HTTPS.
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;opacity:0';
  document.body.append(field);
  field.select();
  const done = document.execCommand('copy');
  field.remove();
  return done;
}

// The clip with its text and actions. A wide film takes the stage and the text goes under it;
// a vertical or square one stands beside its text, so the screen is filled without bars.
export function Watch({ video, locale }: { video: ShownVideo; locale: Locale }) {
  const t = VIDEO_UI[locale];
  const [cutIndex, setCutIndex] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [withTime, setWithTime] = useState(false);
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cut = video.cuts[cutIndex];
  const wide = cut.width > cut.height;

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const wanted = video.cuts.findIndex(item => formatParam(item.format) === query.get('f'));
    if (wanted > 0) setCutIndex(wanted);
    setStartAt(readTime(query.get('t')));
    return () => clearTimeout(copiedTimer.current);
  }, [video.cuts]);

  // The other cut of the same clip continues from the same moment.
  const chooseCut = (index: number) => { setStartAt(seconds); setCutIndex(index); };

  const copy = async () => {
    const query = new URLSearchParams();
    if (cutIndex > 0) query.set('f', formatParam(cut.format));
    if (withTime && seconds > 0) query.set('t', String(seconds));
    const address = location.origin + location.pathname + (query.toString() ? '?' + query : '');
    setCopied(await copyText(address) ? 'done' : 'failed');
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), 2400);
  };

  const canLinkTime = seconds >= 1 && seconds < Math.floor(cut.duration);

  return <div className="vg-watch" data-shape={wide ? 'wide' : 'tall'} style={{ '--vg-ratio': cut.width / cut.height } as React.CSSProperties}>
    <div className="vg-frame"><div className="vg-frame-in">
      <Player key={cut.src} source={cut} title={video.title} locale={locale} startAt={startAt} pageKeys onTime={setSeconds}/>
    </div></div>
    <div className="vg-info">
      <div className="vg-copy">
        <p className="vg-kind">{video.kind}<i>·</i>{clock(cut.duration)}<i>·</i>{cut.format}<i>·</i>{video.year}</p>
        <h1>{video.title}</h1>
        <p className="vg-lead">{video.text}</p>
        {video.sound && <p className="vg-credit">{t.sound}: {video.soundLink ? <a href={video.soundLink} {...outside(video.soundLink)}>{video.sound}</a> : video.sound}</p>}
      </div>
      <div className="vg-actions">
        {video.cuts.length > 1 && <div className="cc-filter" role="group" aria-label={t.format}>
          {video.cuts.map((item, index) => <button key={item.format} type="button" aria-pressed={index === cutIndex} onClick={() => chooseCut(index)}>{item.format}</button>)}
        </div>}
        <button type="button" className="cc-button vg-copy-link" onClick={() => void copy()}><PlayerIcon name="link"/>{t.copyLink}</button>
        {canLinkTime && <button type="button" className="vg-toggle" aria-pressed={withTime} title={t.fromTimeHint} onClick={() => setWithTime(on => !on)}>{t.fromTime(clock(seconds))}</button>}
        {video.work && <a className="cc-link" href={video.work} {...outside(video.work)}>{t.workPage}</a>}
        <p className="vg-status" role="status">{copied === 'done' ? t.copied : copied === 'failed' ? t.copyFailed : ''}</p>
      </div>
    </div>
  </div>;
}
