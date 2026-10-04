'use client';
import { useEffect, useState } from 'react';
import { browserLocale, LANG_KEY, UI, type Locale } from '@/lib/i18n';

// A first-time visitor whose browser speaks the other language is told that the page has that version.
// Nothing moves on its own: the page stays where it is, and the note is gone for good once it is used or closed.
export function LangHint({ locale, alternate }: { locale: Locale; alternate: string }) {
  const offered: Locale = locale === 'ru' ? 'en' : 'ru';
  const [shown, setShown] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(LANG_KEY) && browserLocale(navigator.languages?.[0] ?? navigator.language ?? '') === offered) setShown(true);
    } catch {}
  }, [offered]);
  if (!shown) return null;
  const remember = (value: Locale) => { try { localStorage.setItem(LANG_KEY, value); } catch {} };
  // The note speaks the language it offers.
  const t = UI[offered];
  return <p className="cc-lang-hint" lang={offered}>
    <a className="cc-link" href={alternate} hrefLang={offered} onClick={() => remember(offered)}>{t.thisLanguage}</a>
    <button type="button" aria-label={t.closeHint} onClick={() => { remember(locale); setShown(false); }}>
      <svg viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 1l8 8M9 1L1 9"/></svg>
    </button>
  </p>;
}
