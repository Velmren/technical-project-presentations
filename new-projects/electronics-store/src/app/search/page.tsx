import {Suspense} from 'react';
import {Listing} from '@/components/listing';
export const metadata={title:'Поиск товаров'};
export default function SearchPage(){return <Suspense><Listing/></Suspense>}
