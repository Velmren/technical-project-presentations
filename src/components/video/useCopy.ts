'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { VIDEO_UI } from './strings';

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  // Older browsers and pages opened without HTTPS.
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;opacity:0';
  document.body.append(field);
  field.select();
  const done = document.execCommand('copy');
  field.remove();
  return done;
}

// Copies an address and keeps a short note about how it went, for a status line next to the button.
export function useCopy(locale: Locale) {
  const t = VIDEO_UI[locale];
  const [result, setResult] = useState<'done' | 'failed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(async (address: string) => {
    setResult(await copyText(address) ? 'done' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult(null), 2400);
  }, []);
  return { copy, note: result === 'done' ? t.copied : result === 'failed' ? t.copyFailed : '' };
}
