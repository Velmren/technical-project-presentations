'use client';
import { useEffect, useRef, useState } from 'react';
import { copyText } from '@/lib/clipboard';
import { MAIL, type ContactPlace } from '@/lib/contacts';
import { UI, type Locale } from '@/lib/i18n';

// Copies the mail address for a visitor without a mail program. The button itself says how it went
// for a moment, so nothing appears beside it and nothing moves.
export function CopyMail({ locale, place }: { locale: Locale; place: ContactPlace }) {
  const t = UI[locale];
  const [result, setResult] = useState<'done' | 'failed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    setResult(await copyText(MAIL) ? 'done' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult(null), 2400);
  };
  return <button type="button" className="cc-copy" onClick={copy} aria-live="polite" data-contact={`copy/${place}`}>
    {result === 'done' ? t.mailCopied : result === 'failed' ? t.mailCopyFailed : t.copyMail}
  </button>;
}
