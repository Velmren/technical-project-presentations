import type { Metadata } from 'next';
import { Redirect } from '@/components/concepts/Redirect';

// The concept C prototype became the home page.
export const metadata: Metadata = { title: { absolute: 'VELMREN' }, robots: { index: false }, alternates: { canonical: '/' } };
export default function ConceptCMoved() { return <Redirect to="/"/>; }
