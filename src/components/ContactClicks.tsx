'use client';
import { useEffect } from 'react';

// Counts clicks on the contacts without cookies or outside scripts. Every link and button that leads to
// Telegram or mail names itself in data-contact ("telegram/footer"), and a click sends one empty request
// to /ping/<that name>, which the server only writes to a log (scripts/portfolio.caddy). The page the click
// came from arrives in Referer, with the marks of the link that brought the visitor.
export function ContactClicks() {
  useEffect(() => {
    const report = (event: MouseEvent) => {
      // auxclick also fires for the right button; only the middle one opens a link.
      if (event.type === 'auxclick' && event.button !== 1) return;
      const contact = (event.target as Element | null)?.closest?.('[data-contact]')?.getAttribute('data-contact');
      if (contact) navigator.sendBeacon?.(`/ping/${contact}`);
    };
    document.addEventListener('click', report);
    document.addEventListener('auxclick', report);
    return () => {
      document.removeEventListener('click', report);
      document.removeEventListener('auxclick', report);
    };
  }, []);
  return null;
}
