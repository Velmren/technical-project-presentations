import type { Metadata } from 'next';
import { videoMetadata, videoParams, VideoRoute } from '@/components/video/pages';

// One route for clips (/video/<slug>/) and collections (/video/c/<slug>/).
type Props = { params: Promise<{ path: string[] }> };

export const dynamicParams = false;
export const generateStaticParams = videoParams;
export async function generateMetadata({ params }: Props): Promise<Metadata> { return videoMetadata((await params).path, 'ru'); }
export default async function VideoPage({ params }: Props) { return <VideoRoute path={(await params).path} locale="ru"/>; }
