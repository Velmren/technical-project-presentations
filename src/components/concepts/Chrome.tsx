import { localePath, UI, type Locale } from '@/lib/i18n';
import { LangSwitch } from './LangSwitch';

// Header, footer and small marks shared by the home page, the work pages and the error page.

export const GITHUB = 'https://github.com/Velmren';
// The home page; English lives at /en/.
export const HOME = '/';

export const isExternal = (href: string) => href.startsWith('https://');

export function Mark() {
  // Four tiles, one caught mid-flip: the hero mosaic in miniature.
  return <svg className="cc-mark" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
    <rect x="0" y="0" width="8" height="8"/><rect x="10" y="0" width="8" height="8"/>
    <rect x="0" y="10" width="8" height="8"/><rect x="10" y="12.6" width="8" height="2.8"/>
  </svg>;
}

export function GithubIcon() {
  return <svg className="cc-gh" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1.01.07 1.54 1.04 1.54 1.04.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.99c.85 0 1.71.12 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.58c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>;
}

// Links that leave the site open in a new tab; no arrow marks them.
export function TextLink({ href, children, className = 'cc-link' }: { href: string; children: React.ReactNode; className?: string }) {
  return isExternal(href)
    ? <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <a className={className} href={href}>{children}</a>;
}

// On the home page the links are anchors; on other pages they lead back to the home page.
export function Header({ home = false, locale, alternate }: { home?: boolean; locale: Locale; alternate: string }) {
  const t = UI[locale], homePath = localePath(locale, HOME);
  return <header className="cc-header" id="top">
    <a className="cc-logo" href={home ? '#top' : homePath}><Mark/>VELMREN</a>
    <nav aria-label={t.nav}><a href={(home ? '' : homePath) + '#works'}>{t.work}</a><a href={GITHUB} target="_blank" rel="noopener noreferrer">{t.about}</a><a href="#contact">{t.contact}</a></nav>
    <LangSwitch locale={locale} alternate={alternate} label={t.language}/>
    <a className="cc-header-link" href={GITHUB} target="_blank" rel="noopener noreferrer"><GithubIcon/>GitHub</a>
  </header>;
}

export function Footer({ home = false, locale }: { home?: boolean; locale: Locale }) {
  const t = UI[locale];
  return <footer className="cc-footer" id="contact">
    <a className="cc-logo" href={home ? '#top' : localePath(locale, HOME)}><Mark/>VELMREN</a>
    <p>{t.quote}</p>
    <div><a href={GITHUB} target="_blank" rel="noopener noreferrer"><GithubIcon/>GitHub</a><a href="#top">{t.toTop}</a></div>
  </footer>;
}
