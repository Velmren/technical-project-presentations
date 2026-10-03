import type { Metadata } from 'next';
import { VideoPage, videoMetadata, videoParams } from '@/components/video/VideoPage';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = videoParams;
export async function generateMetadata({ params }: Props): Promise<Metadata> { return videoMetadata((await params).slug, 'en'); }
export default async function VideoRouteEn({ params }: Props) { return <VideoPage slug={(await params).slug} locale="en"/>; }
