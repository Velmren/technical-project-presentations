import homeData from '@/content/home.json';
import { homeSchema } from '@/lib/home';
import { shownWorks } from '@/lib/home-view';
import { fontVariables } from '@/lib/fonts-c';
import { languageGateScript, localePath, localizeWork, type Locale } from '@/lib/i18n';
import { HOME } from './Chrome';
import { ConceptC } from './ConceptC';
import '@/app/concepts/concepts.css';
import '@/app/concepts/c/concept-c.css';

// The concept C home in one language; the Russian and English routes both render it.
export function ConceptCView({ locale }: { locale: Locale }) {
  const works = shownWorks(homeSchema.parse(homeData)).all.map(work => localizeWork(work, locale));
  return <div className={fontVariables}>
    <script dangerouslySetInnerHTML={{ __html: languageGateScript(locale, localePath(locale === 'ru' ? 'en' : 'ru', HOME)) }}/>
    <ConceptC works={works} locale={locale}/>
  </div>;
}
