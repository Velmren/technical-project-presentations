import {Suspense} from 'react';
import {Listing} from '@/components/listing';
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <Suspense><Listing category={slug}/></Suspense>}
