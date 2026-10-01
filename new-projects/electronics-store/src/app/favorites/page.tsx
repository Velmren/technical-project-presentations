import {Suspense} from 'react';
import {FavoritesPage} from '@/components/saved-lists';
export const metadata={title:'Избранное'};
export default function Page(){return <Suspense><FavoritesPage/></Suspense>}
