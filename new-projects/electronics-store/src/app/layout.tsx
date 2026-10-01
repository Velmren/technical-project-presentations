import type {Metadata} from 'next';
import {Shell} from '@/components/shell';
import './globals.css';
import './product.css';
import './lists.css';
import './commerce.css';
import './refinements.css';
import './home.css';
import './motion.css';
export const metadata:Metadata={title:{default:'VELMREN tech — Технологии ближе',template:'%s · VELMREN tech'},description:'Магазин электроники VELMREN: смартфоны, ноутбуки, наушники и техника для вашей жизни. Выбирайте устройства, сравнивайте характеристики и оформляйте доставку.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru" data-scroll-behavior="smooth"><body><Shell>{children}</Shell></body></html>}
