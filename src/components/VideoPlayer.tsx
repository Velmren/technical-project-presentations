'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import styles from './VideoPlayer.module.css';

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}
function PlayerIcon({ kind }: { kind: 'play' | 'pause' | 'sound' | 'mute' | 'fullscreen' | 'exit' }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'play' && <path d="m9 5 11 7-11 7Z"/>}
    {kind === 'pause' && <><path d="M8 5v14M16 5v14" strokeWidth="3"/></>}
    {(kind === 'sound' || kind === 'mute') && <><path d="M11 4 6 8H3v8h3l5 4Z"/>{kind === 'sound' ? <><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></> : <path d="m16 9 6 6m0-6-6 6"/>}</>}
    {kind === 'fullscreen' && <path d="M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"/>}
    {kind === 'exit' && <path d="M3 9h6V3m6 0v6h6M9 21v-6H3m18 0h-6v6"/>}
  </svg>;
}
type NativeFullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
export function VideoPlayer({ src, poster }: { src: string; poster: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setEnhanced(true);
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    const video = videoRef.current;
    // Metadata may arrive before hydration attaches the React handlers.
    if (video && Number.isFinite(video.duration)) setDuration(video.duration);
    if (video && (video.error || video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE)) {
      setEnhanced(false);
      setMessage('Запись не загрузилась. Можно открыть MP4 по ссылке под плеером.');
    }
    const begin = () => setFullscreen(true);
    const end = () => setFullscreen(false);
    video?.addEventListener('webkitbeginfullscreen', begin);
    video?.addEventListener('webkitendfullscreen', end);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      video?.removeEventListener('webkitbeginfullscreen', begin);
      video?.removeEventListener('webkitendfullscreen', end);
    };
  }, []);
  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    setMessage('');
    if (!video.paused) { video.pause(); return; }
    if (video.ended) video.currentTime = 0;
    try { await video.play(); }
    catch { setMessage('Не удалось начать воспроизведение. Используйте стандартные элементы видео.'); setEnhanced(false); }
  };
  const seek = (next: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(next, video.duration));
    setTime(video.currentTime);
  };
  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.volume === 0) video.volume = .5;
    video.muted = !video.muted;
  };
  const changeVolume = (next: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = next;
    video.muted = next === 0;
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (frameRef.current?.requestFullscreen && document.fullscreenEnabled) await frameRef.current.requestFullscreen();
      else if ((videoRef.current as NativeFullscreenVideo | null)?.webkitEnterFullscreen) (videoRef.current as NativeFullscreenVideo).webkitEnterFullscreen?.();
      else { setEnhanced(false); setMessage('Полноэкранный режим доступен через стандартные элементы видео.'); }
    } catch { setMessage('Браузер не разрешил полноэкранный режим.'); }
  };
  const playLabel = ended ? 'Повторить запись' : playing ? 'Пауза' : 'Воспроизвести запись';
  return <>
    <div className={styles.player} ref={frameRef} role="group" aria-label="Видеоплеер Category Spark" tabIndex={enhanced ? 0 : -1} onKeyDown={event => {
      if (event.target !== event.currentTarget && event.target !== videoRef.current) return;
      const key = event.key.toLowerCase();
      if (key === ' ' || key === 'k') { event.preventDefault(); void togglePlayback(); }
      else if (key === 'arrowleft' || key === 'arrowright') { event.preventDefault(); seek(time + (key === 'arrowleft' ? -5 : 5)); }
      else if (key === 'm') { event.preventDefault(); toggleMute(); }
      else if (key === 'f') { event.preventDefault(); void toggleFullscreen(); }
    }}>
      <video ref={videoRef} controls={!enhanced} preload="metadata" poster={poster} playsInline tabIndex={enhanced ? -1 : 0}
        onLoadedMetadata={event => setDuration(event.currentTarget.duration)}
        onDurationChange={event => setDuration(event.currentTarget.duration)}
        onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
        onSeeked={event => { setTime(event.currentTarget.currentTime); setEnded(event.currentTarget.ended); }}
        onPlay={() => { setPlaying(true); setEnded(false); }} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setEnded(true); }}
        onVolumeChange={event => { setVolume(event.currentTarget.volume); setMuted(event.currentTarget.muted); }}
        onError={() => { setEnhanced(false); setMessage('Запись не загрузилась. Можно открыть MP4 по ссылке под плеером.'); }}>
        <source src={src} type="video/mp4" onError={() => { setEnhanced(false); setMessage('Запись не загрузилась. Можно открыть MP4 по ссылке под плеером.'); }}/>Ваш браузер не поддерживает видео. <a href={src}>Открыть запись</a>
      </video>
      {enhanced && <>
        {!playing && <button className={styles.centralPlay} onClick={() => void togglePlayback()} aria-label={playLabel}><PlayerIcon kind="play"/></button>}
        <div className={styles.controls}>
          <div className={styles.timeline}><span className={styles.time}>{formatTime(time)}</span><input className={styles.seek} type="range" min="0" max={duration || 1} step="0.1" value={Math.min(time, duration || 1)} disabled={!duration} aria-label="Позиция в записи" aria-valuetext={`${formatTime(time)} из ${formatTime(duration)}`} onChange={event => seek(Number(event.target.value))} style={{'--progress': `linear-gradient(to right, white ${duration ? time / duration * 100 : 0}%, #ffffff55 0)`} as CSSProperties}/><span className={styles.time}>{formatTime(duration)}</span></div>
          <div className={styles.buttons}><button className={styles.controlButton} onClick={() => void togglePlayback()} aria-label={playLabel}><PlayerIcon kind={playing ? 'pause' : 'play'}/></button><button className={styles.controlButton} onClick={toggleMute} aria-label={muted || volume === 0 ? 'Включить звук' : 'Выключить звук'} aria-pressed={muted || volume === 0}><PlayerIcon kind={muted || volume === 0 ? 'mute' : 'sound'}/></button><input className={styles.volume} type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label="Громкость" aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)} процентов`} onChange={event => changeVolume(Number(event.target.value))}/><button className={`${styles.controlButton} ${styles.fullscreen}`} onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}><PlayerIcon kind={fullscreen ? 'exit' : 'fullscreen'}/></button></div>
        </div>
      </>}
    </div>
    {message && <p className={styles.message} role="status">{message}</p>}
    <div className={styles.recordingNote}><span>Запись без звука</span><a href={src}>Открыть MP4 ↗</a></div>
  </>;
}
