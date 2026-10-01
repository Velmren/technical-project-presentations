'use client';
import { LANG_KEY, type Locale } from '@/lib/i18n';

// RU / EN switch. The chosen language is remembered, so later visits open in it.
export function LangSwitch({ locale, alternate, label }: { locale: Locale; alternate: string; label: string }) {
  const remember = (value: Locale) => { try { localStorage.setItem(LANG_KEY, value); } catch {} };
  return <div className="cc-lang" role="group" aria-label={label}>
    {(['ru', 'en'] as const).map(code => code === locale
      ? <span key={code} aria-current="true" lang={code}>{code.toUpperCase()}</span>
      : <a key={code} href={alternate} lang={code} hrefLang={code} onClick={() => remember(code)}>{code.toUpperCase()}</a>)}
  </div>;
}
