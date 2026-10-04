import homeData from '@/content/home.json';
import { homeSchema } from '@/lib/home';
import { shownWorks } from '@/lib/home-view';
import { fontVariables } from '@/lib/fonts-c';
import { localizeWork, UI, type Locale } from '@/lib/i18n';
import { siteData } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd';
import { ConceptC } from './ConceptC';
import { VideoEntry } from '@/components/video/Entry';
import '@/app/concepts/concepts.css';
import '@/app/concepts/c/concept-c.css';

// The concept C home in one language; the Russian and English routes both render it.
export function ConceptCView({ locale }: { locale: Locale }) {
  // The page gets its own language only: the English texts and media stay out of the Russian payload.
  const works = shownWorks(homeSchema.parse(homeData)).all.map(work => { const { en: _en, ...shown } = localizeWork(work, locale); return shown; });
  return <div className={fontVariables}>
    <JsonLd data={siteData(UI[locale].siteAbout)}/>
    <ConceptC works={works} locale={locale} video={<VideoEntry locale={locale}/>}/>
  </div>;
}
