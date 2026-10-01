import Link from 'next/link';
export default function NotFound(){return <div className="container page empty-state"><p className="eyebrow">404</p><h1>Здесь пока ничего нет</h1><p>Но нужная техника наверняка найдётся в каталоге.</p><Link href="/catalog" className="button">Открыть каталог</Link></div>}
