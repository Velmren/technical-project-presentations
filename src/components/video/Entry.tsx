import type { Locale } from '@/lib/i18n';
import { galleryPath } from '@/lib/videos';
import { bestClips, shown } from './clips';
import { TileRow } from './Gallery';
import { VIDEO_UI } from './strings';
import './video.css';

// The way into the gallery from another page: a heading with the number of clips, a link to all of them and the
// best ones as large posters with the fragment on hover. It is rendered on the server, so a client page takes it
// as a ready node: <ConceptC video={<VideoEntry locale={locale}/>}/>. The posters load late and at low priority:
// the block stands under the first screen of its page and must not slow the pictures above it.
export function VideoEntry({ locale, count = 2 }: { locale: Locale; count?: number }) {
  const t = VIDEO_UI[locale];
  if (!shown.length) return null;
  return <section className="vg-entry" id="video" aria-labelledby="vg-entry-title">
    <div className="vg-entry-head">
      <h2 id="vg-entry-title">{t.gallery} <span>{shown.length}</span></h2>
      <a className="cc-link" href={galleryPath(locale)}>{t.allVideos}</a>
    </div>
    <TileRow clips={bestClips(locale, count)} priority="low"/>
  </section>;
}
