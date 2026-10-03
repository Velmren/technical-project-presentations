'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { PlayerIcon } from './icons';
import { VIDEO_UI } from './strings';
import './player.css';

export type PlayerSource = { src: string; poster: string; width: number; height: number; duration: number; lightPoster?: boolean; captions?: string };

const SETTINGS_KEY = 'velmren.video';
const PLAY_EVENT = 'velmren:video-play';
const HIDE_AFTER = 2500;
const STEP = 5;

type Settings = { volume?: number; muted?: boolean; captions?: boolean };
const readSettings = (): Settings => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Settings; } catch { return {}; } };
const saveSettings = (patch: Settings) => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readSettings(), ...patch })); } catch {} };

export function clock(seconds: number) {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
// The length of a clip is rounded to the nearest second, the same on a poster, in a list and in the player.
export const fullLength = (seconds: number) => clock(Math.round(seconds));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const share = (event: React.PointerEvent<HTMLElement>) => {
  const box = event.currentTarget.getBoundingClientRect();
  return clamp((event.clientX - box.left) / box.width, 0, 1);
};

type NativeFullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

// One player for the whole site. Before scripts run it is a plain video with the browser controls;
// after that the controls are ours. Sound never starts by itself: playback begins only on a press.
// startAt opens the clip paused at a moment; pageKeys lets the main player of a page hear the keys
// even when nothing on the page has focus. The page of one clip preloads its index for a quick start;
// where several players share a page they pass preload="none" and load nothing before a press.
export function Player({ source, title, locale, startAt = 0, pageKeys = false, preload = 'metadata', onTime, onEnded }: {
  source: PlayerSource; title: string; locale: Locale; startAt?: number; pageKeys?: boolean; preload?: 'metadata' | 'none';
  onTime?: (seconds: number) => void; onEnded?: () => void;
}) {
  const t = VIDEO_UI[locale];
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shownBeforePress = useRef(true);
  const lastSecond = useRef(-1);
  const pendingStart = useRef<number | null>(null);
  const seekTarget = useRef<number | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(source.duration);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [shown, setShown] = useState(true);
  const [captions, setCaptions] = useState(false);
  const [cue, setCue] = useState('');
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  // The progress line moves every frame, so it is painted past React.
  const paint = useCallback((seconds: number) => {
    const all = video.current?.duration || source.duration;
    root.current?.style.setProperty('--vp-played', String(clamp(seconds / all, 0, 1)));
  }, [source.duration]);

  const note = useCallback((seconds: number) => {
    setTime(seconds);
    paint(seconds);
    const second = Math.floor(seconds);
    if (second !== lastSecond.current) { lastSecond.current = second; onTime?.(second); }
  }, [onTime, paint]);

  // The bar stays while the clip is paused or a control is in use, and leaves a little after the last movement.
  const wake = useCallback(() => {
    setShown(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(function hide() {
      const element = video.current;
      if (!element || element.paused) return;
      const focused = root.current?.querySelector(':focus-visible');
      if (focused && focused !== root.current) { hideTimer.current = setTimeout(hide, HIDE_AFTER); return; }
      setShown(false);
    }, HIDE_AFTER);
  }, []);

  const toggle = useCallback(async () => {
    const element = video.current;
    if (!element) return;
    if (!element.paused && !element.ended) { element.pause(); return; }
    if (element.ended) element.currentTime = 0;
    try { await element.play(); } catch { /* The browser refused or the file failed; the error handler shows the message. */ }
  }, []);

  const seek = useCallback((seconds: number) => {
    const element = video.current;
    if (!element) return;
    const next = clamp(seconds, 0, element.duration || source.duration);
    pendingStart.current = null;
    seekTarget.current = next;
    element.currentTime = next;
    setStarted(true);
    note(next);
  }, [note, source.duration]);

  const changeVolume = useCallback((next: number) => {
    const element = video.current;
    if (!element) return;
    element.volume = clamp(next, 0, 1);
    element.muted = element.volume === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const element = video.current;
    if (!element) return;
    if (element.muted || element.volume === 0) { if (element.volume === 0) element.volume = .5; element.muted = false; }
    else element.muted = true;
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const element = video.current as NativeFullscreenVideo | null;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.current?.requestFullscreen && document.fullscreenEnabled) await root.current.requestFullscreen();
      // A phone without element fullscreen opens its own full-screen player.
      else element?.webkitEnterFullscreen?.();
    } catch { /* The browser did not allow it; the clip keeps playing in the page. */ }
  }, []);

  const toggleCaptions = () => setCaptions(on => { saveSettings({ captions: !on }); return !on; });

  // Keys of the player: Space or K, arrows by five seconds, M, F. Codes, so they work in any keyboard layout.
  // While a seek is still in flight the next arrow counts from where it is heading, so quick presses add up.
  const pressKey = useCallback((code: string) => {
    const position = seekTarget.current ?? video.current?.currentTime ?? 0;
    if (code === 'Space' || code === 'KeyK') void toggle();
    else if (code === 'ArrowLeft') seek(position - STEP);
    else if (code === 'ArrowRight') seek(position + STEP);
    else if (code === 'KeyM') toggleMute();
    else if (code === 'KeyF') void toggleFullscreen();
    else return false;
    wake();
    return true;
  }, [seek, toggle, toggleFullscreen, toggleMute, wake]);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    setEnhanced(true);
    const saved = readSettings();
    if (typeof saved.volume === 'number') element.volume = clamp(saved.volume, 0, 1);
    if (saved.muted) element.muted = true;
    setVolume(element.volume);
    setMuted(element.muted);
    setCaptions(Boolean(saved.captions));

    // A link with a time mark opens the clip paused at that moment. Some engines drop a seek made while the file
    // is still loading and land back at the start, so the moment is set again at each loading step, after a seek
    // that missed, and once more when playback begins. A few tries only: an engine that cannot seek there is left alone.
    pendingStart.current = startAt > 0 ? startAt : null;
    let tries = 0;
    const ready = () => {
      if (Number.isFinite(element.duration)) setDuration(element.duration);
      const wanted = pendingStart.current;
      if (wanted === null) return;
      const moment = Math.min(wanted, element.duration || wanted);
      if (Math.abs(element.currentTime - moment) > .5 && !element.seeking && tries++ < 6) element.currentTime = moment;
      setStarted(true);
      note(moment);
    };
    const steps = ['loadedmetadata', 'loadeddata', 'canplay', 'seeked', 'play'] as const;
    for (const step of steps) element.addEventListener(step, ready);
    // Metadata may have arrived before the handlers were attached.
    if (element.readyState >= 1) ready();
    const settled = () => { pendingStart.current = null; };
    element.addEventListener('playing', settled);
    if (element.error) setFailed(true);

    const onFullscreen = () => setFullscreen(document.fullscreenElement === root.current);
    const onNativeBegin = () => setFullscreen(true);
    const onNativeEnd = () => setFullscreen(false);
    // Only one clip plays at a time on a page.
    const onOtherPlay = (event: Event) => { if ((event as CustomEvent).detail !== element && !element.paused) element.pause(); };
    document.addEventListener('fullscreenchange', onFullscreen);
    element.addEventListener('webkitbeginfullscreen', onNativeBegin);
    element.addEventListener('webkitendfullscreen', onNativeEnd);
    window.addEventListener(PLAY_EVENT, onOtherPlay);

    const track = element.textTracks[0];
    const onCue = () => setCue(track.activeCues?.length ? Array.from(track.activeCues, active => (active as VTTCue).text).join('\n') : '');
    if (track) { track.mode = 'hidden'; track.addEventListener('cuechange', onCue); }

    return () => {
      clearTimeout(hideTimer.current);
      document.removeEventListener('fullscreenchange', onFullscreen);
      for (const step of steps) element.removeEventListener(step, ready);
      element.removeEventListener('playing', settled);
      element.removeEventListener('webkitbeginfullscreen', onNativeBegin);
      element.removeEventListener('webkitendfullscreen', onNativeEnd);
      window.removeEventListener(PLAY_EVENT, onOtherPlay);
      track?.removeEventListener('cuechange', onCue);
    };
  }, [note, startAt]);

  useEffect(() => {
    if (!playing) return;
    let frame = requestAnimationFrame(function tick() {
      if (video.current) paint(video.current.currentTime);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [paint, playing]);

  useEffect(() => {
    if (!pageKeys) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // Keys pressed inside the player are handled there; controls elsewhere on the page keep their own keys.
      if (target && (root.current?.contains(target) || target.closest('a, button, input, textarea, select, [role="slider"], [contenteditable="true"]'))) return;
      if (pressKey(event.code)) event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pageKeys, pressKey]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Space on a focused button presses that button.
    if (event.code === 'Space' && (event.target as HTMLElement).closest('button')) { wake(); return; }
    if (pressKey(event.code)) event.preventDefault();
  };

  const onSeekKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === 'Home') seek(0);
    else if (event.code === 'End') seek(duration);
    else return;
    event.preventDefault();
    wake();
  };

  const onVolumeKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.code === 'ArrowUp' || event.code === 'ArrowRight' ? .05 : event.code === 'ArrowDown' || event.code === 'ArrowLeft' ? -.05 : 0;
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    changeVolume((muted ? 0 : volume) + step);
    wake();
  };

  // A tap on a hidden bar only brings the bar back; a click, or a tap with the bar in view, starts and pauses.
  const onSurfaceClick = () => { if (shownBeforePress.current) void toggle(); };

  const level = muted ? 0 : volume;
  const playLabel = ended ? t.replay : playing ? t.pause : started ? t.play : t.watch;
  const style = { '--vp-ratio': `${source.width} / ${source.height}` } as React.CSSProperties;

  return <div ref={root} className="vp" style={style} role="group" aria-label={t.player(title)} tabIndex={enhanced ? 0 : -1}
    data-enhanced={enhanced} data-shown={shown || !playing} data-started={started} data-light={source.lightPoster || undefined}
    onKeyDown={onKeyDown} onPointerMove={wake} onFocus={wake}
    onPointerDownCapture={event => { shownBeforePress.current = event.pointerType !== 'touch' || shown || !playing; wake(); }}>
    <video ref={video} src={source.src} poster={source.poster} width={source.width} height={source.height}
      preload={preload} playsInline controls={!enhanced} tabIndex={enhanced ? -1 : 0} aria-label={title}
      onClick={enhanced ? onSurfaceClick : undefined} onDoubleClick={enhanced ? () => void toggleFullscreen() : undefined}
      onDurationChange={event => { if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration); }}
      onTimeUpdate={event => note(event.currentTarget.currentTime)}
      onSeeked={event => { seekTarget.current = null; note(event.currentTarget.currentTime); setEnded(event.currentTarget.ended); }}
      onPlay={event => { setStarted(true); setPlaying(true); setEnded(false); window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: event.currentTarget })); wake(); }}
      onPause={() => { setPlaying(false); setShown(true); }}
      onEnded={() => { setPlaying(false); setEnded(true); setShown(true); onEnded?.(); }}
      onProgress={event => {
        const { buffered, currentTime, duration: all } = event.currentTarget;
        for (let i = 0; i < buffered.length; i++) if (buffered.start(i) <= currentTime + .5 && buffered.end(i) >= currentTime) root.current?.style.setProperty('--vp-buffered', String(clamp(buffered.end(i) / (all || source.duration), 0, 1)));
      }}
      onVolumeChange={event => { const { volume: next, muted: off } = event.currentTarget; setVolume(next); setMuted(off); saveSettings({ volume: next, muted: off }); }}
      onError={() => setFailed(true)}>
      {source.captions && <track kind="subtitles" src={source.captions} srcLang={locale} label={t.captionsLabel}/>}
    </video>
    {enhanced && !failed && <>
      {!started && <button type="button" className="vp-start" onClick={() => void toggle()}>
        <PlayerIcon name="play"/>{t.watch}<span>{fullLength(duration)}</span>
      </button>}
      {captions && cue && <p className="vp-cue" lang={locale}><span>{cue}</span></p>}
      {started && <div className="vp-bar">
        <div className="vp-seek" role="slider" tabIndex={0} aria-label={t.seek} aria-valuemin={0} aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)} aria-valuetext={t.position(clock(time), fullLength(duration))} onKeyDown={onSeekKey}
          onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); seek(share(event) * duration); }}
          onPointerMove={event => {
            const part = share(event);
            if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(part * duration);
            setHover(event.pointerType === 'touch' ? null : part);
          }}
          onPointerLeave={() => setHover(null)}>
          <span className="vp-track"><i className="vp-buffered"/><i className="vp-played"/></span>
          <i className="vp-thumb"/>
          {hover !== null && <span className="vp-tip" style={{ left: `${hover * 100}%` }}>{clock(hover * duration)}</span>}
        </div>
        <div className="vp-row">
          <button type="button" className="vp-button" onClick={() => void toggle()} aria-label={playLabel}>
            <PlayerIcon name={ended ? 'replay' : playing ? 'pause' : 'play'}/>
          </button>
          <button type="button" className="vp-button" onClick={toggleMute} aria-label={level === 0 ? t.unmute : t.mute}>
            <PlayerIcon name={level === 0 ? 'muted' : 'sound'}/>
          </button>
          <div className="vp-volume" role="slider" tabIndex={0} aria-label={t.volume} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)} aria-valuetext={t.percent(Math.round(level * 100))} onKeyDown={onVolumeKey}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); changeVolume(share(event)); }}
            onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) changeVolume(share(event)); }}>
            <span className="vp-track"><i style={{ transform: `scaleX(${level})` }}/></span>
          </div>
          <span className="vp-time">{clock(time)} <span>/ {fullLength(duration)}</span></span>
          <span className="vp-space"/>
          {source.captions && <button type="button" className="vp-button" onClick={toggleCaptions} aria-pressed={captions} aria-label={captions ? t.captionsOff : t.captionsOn}>
            <span className="vp-cc">CC</span>
          </button>}
          <button type="button" className="vp-button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? t.exitFullscreen : t.fullscreen}>
            <PlayerIcon name={fullscreen ? 'exit' : 'fullscreen'}/>
          </button>
        </div>
      </div>}
    </>}
    {failed && <p className="vp-failed" role="alert">{t.failed} <a href={source.src}>{t.openFile}</a></p>}
  </div>;
}
