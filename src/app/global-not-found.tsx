import type { Metadata } from 'next';
import { RootDocument } from '@/components/RootDocument';
import { fontVariables } from '@/lib/fonts-c';
import { Footer, Header, HOME, TextLink } from '@/components/concepts/Chrome';
import { localePath } from '@/lib/i18n';
import { siteMetadata } from '@/lib/seo';
import '@/app/concepts/concepts.css';
import '@/app/concepts/c/concept-c.css';
import '@/app/concepts/c/case.css';

export const metadata: Metadata = { ...siteMetadata('Страница не найдена. Page not found.'), robots: { index: false } };

// One page answers every missing address, Russian or English, so it says its line in both languages.
export default function GlobalNotFound() {
  return <RootDocument locale="ru">
    <div className={fontVariables}>
      <div className="cc-page">
        <Header locale="ru" alternate={localePath('en', HOME)}/>
        <main id="main" className="cs-main">
          <section className="cs-closing" aria-labelledby="missing-title">
            <p id="missing-title">Страница не найдена<br/><span lang="en">Page not found</span></p>
            <div className="cc-actions">
              <TextLink className="cc-button" href={HOME}>На главную</TextLink>
              <a className="cc-link" href={localePath('en', HOME)} lang="en" hrefLang="en">Home page</a>
            </div>
          </section>
        </main>
        <Footer locale="ru" contained/>
      </div>
    </div>
  </RootDocument>;
}
