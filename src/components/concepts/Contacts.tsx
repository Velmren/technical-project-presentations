import { MAIL, TELEGRAM, type ContactPlace } from '@/lib/contacts';
import { UI, type Locale } from '@/lib/i18n';
import { CopyMail } from './CopyMail';

export function TelegramIcon() {
  return <svg className="cc-gh" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M21.4 3.3 2.9 10.4c-1.2.5-1.2 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.4-1.8ZM8.3 13 18 6.9c.5-.3.9-.1.5.2l-8 7.2-.3 3.3L8.3 13Z"/></svg>;
}

// The two ways to write: Telegram and mail, as plain links, plus a button that copies the address.
// primary makes Telegram the main button of its block; place names the block in the count of clicks.
export function ContactLinks({ locale, place, primary = false }: { locale: Locale; place: ContactPlace; primary?: boolean }) {
  const t = UI[locale];
  return <div className="cc-contact-links">
    <a className={primary ? 'cc-button' : 'cc-link'} href={TELEGRAM} target="_blank" rel="noopener noreferrer" data-contact={`telegram/${place}`}><TelegramIcon/>{t.writeTelegram}</a>
    <span className="cc-mail"><a className="cc-link" href={`mailto:${MAIL}`} data-contact={`mail/${place}`}>{MAIL}</a><CopyMail locale={locale} place={place}/></span>
  </div>;
}
