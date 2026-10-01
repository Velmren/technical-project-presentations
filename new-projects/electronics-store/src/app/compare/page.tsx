import {Suspense} from 'react';
import {ComparePage} from '@/components/saved-lists';
export const metadata={title:'Сравнение товаров'};
export default function Page(){return <Suspense><ComparePage/></Suspense>}
