import { fontVariables } from '@/lib/fonts-c';
import { CONTACTS } from '@/lib/contacts';
import { localePath, UI, type Locale } from '@/lib/i18n';
import { Footer, Header } from './Chrome';
import { ContactLinks } from './Contacts';
import '@/app/concepts/concepts.css';
import '@/app/concepts/c/concept-c.css';
import '@/app/concepts/c/case.css';

// The contacts page in one language: the two ways to write and what helps to say in the first message.
export function ContactsPage({ locale }: { locale: Locale }) {
  const t = UI[locale];
  return <div className={fontVariables}>
    <div className="cc-page ct-screen" lang={locale}>
      <Header locale={locale} alternate={localePath(locale === 'ru' ? 'en' : 'ru', CONTACTS)}/>
      <main id="main" className="cs-main">
        <section className="ct-page" aria-labelledby="ct-title">
          <h1 id="ct-title">{t.contact}</h1>
          <p className="cs-lead">{t.contactsLead}</p>
          <ContactLinks locale={locale} primary/>
        </section>
        <section className="ct-first" aria-labelledby="ct-first-title">
          <h2 id="ct-first-title">{t.firstMessage}</h2>
          <ul>{t.firstMessageItems.map(item => <li key={item}>{item}</li>)}</ul>
        </section>
      </main>
      <Footer locale={locale} contacts={false}/>
    </div>
  </div>;
}
