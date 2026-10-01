import type { Metadata } from 'next';
import { Redirect } from '@/components/concepts/Redirect';

export const metadata: Metadata = { title: { absolute: 'VELMREN' }, robots: { index: false }, alternates: { canonical: '/en/' } };
export default function ConceptCMovedEn() { return <Redirect to="/en/"/>; }
