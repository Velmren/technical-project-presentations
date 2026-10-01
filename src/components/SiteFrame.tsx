'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
// Only project pages still built with the earlier editorial template get its header and footer (the layout passes
// their paths); the home, the work pages and the error page draw their own.
export function SiteFrame({ children, framed = [] }: { children: React.ReactNode; framed?: string[] }) {
  const path = usePathname();
  const route = path.endsWith('/') ? path : path + '/';
  if (!framed.includes(route)) return children;
  return <div className="shell"><header id="top" className="header"><Link href="/" className="brand">VELMREN<span>.</span></Link><nav aria-label="Основная навигация"><Link href="/">Проекты</Link><a href="https://github.com/Velmren">GitHub ↗</a></nav></header>{children}<footer className="footer"><Link className="brand" href="/">VELMREN<span>.</span></Link><a href="#top">Назад к началу ↑</a></footer></div>;
}
