import { fontVariables } from '@/lib/fonts-c';
import { Footer, Header, HOME, TextLink } from '@/components/concepts/Chrome';
import '@/app/concepts/concepts.css';
import '@/app/concepts/c/concept-c.css';
import '@/app/concepts/c/case.css';

export default function NotFound() {
  return <div className={fontVariables}>
    <div className="cc-page">
      <Header locale="ru" alternate="/en/"/>
      <main id="main" className="cs-main">
        <section className="cs-closing" aria-labelledby="missing-title">
          <p id="missing-title">Страница не найдена</p>
          <div className="cc-actions"><TextLink className="cc-button" href={HOME}>На главную</TextLink></div>
        </section>
      </main>
      <Footer locale="ru"/>
    </div>
  </div>;
}
