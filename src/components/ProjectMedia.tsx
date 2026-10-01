import Image from 'next/image';
import type { Project } from '@/lib/schema';
export function Cover({ cover, priority = false }: { cover: Project['cover']; priority?: boolean }) {
  if (cover.kind === 'image') return <Image {...cover.image} priority={priority} sizes="(max-width: 700px) 100vw, 580px" />;
  return <div className="flow-cover" aria-label="Схема фаз сценария"><ol>{cover.steps.map((step, i) => <li key={step}><b>{i === cover.steps.length - 1 ? '✓' : '•'}</b><span><strong>{step}</strong>{cover.details?.[i] && <small>{cover.details[i]}</small>}</span></li>)}</ol><span className="diagram-label">ENCOUNTER FLOW</span></div>;
}
