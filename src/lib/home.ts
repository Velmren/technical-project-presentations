import { z } from 'zod';

const href = z.string().refine(v => v.startsWith('/') || v.startsWith('https://'), 'Use a site path or HTTPS URL');
const picture = z.object({ src: z.string().startsWith('/'), alt: z.string().min(1) });
// Motion material for live previews: a looping video, a tall page to scroll through, or a set of screens.
const live = z.object({
  video: z.object({ src: z.string().startsWith('/'), poster: z.string().startsWith('/') }).optional(),
  scroll: z.string().startsWith('/').optional(),
  slides: z.array(z.string().startsWith('/')).min(2).optional(),
});

// A work stays in the data while it is being reworked; it appears on the page only once accepted,
// so accepting it means filling preview/action/details and switching the status.
const work = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/),
  status: z.enum(['accepted', 'rework']),
  placement: z.enum(['main', 'more']),
  title: z.string().min(1),
  // Short noun for what the work is, e.g. "Лендинг".
  type: z.string().min(1).optional(),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  stack: z.string().min(1),
  year: z.number().int(),
  // light: bright screenshots get a softer edge fade; frame: interface shown inset with a border.
  preview: picture.extend({ overlay: picture.optional(), frame: z.boolean().optional(), light: z.boolean().optional() }).optional(),
  live: live.optional(),
  // Real, verifiable figures shown next to a featured work.
  // label reads after the number ("60 моделей в каталоге"); name is the row title in a spec table.
  facts: z.array(z.object({ value: z.string().min(1), label: z.string().min(1), name: z.string().min(1).optional() })).max(4).optional(),
  // Without href the primary button is hidden (e.g. the store before it is deployed).
  action: z.object({ label: z.string().min(1), href: href.optional() }).optional(),
  // A second way to see the work, e.g. its recording next to the playable build.
  extra: z.object({ label: z.string().min(1), href }).optional(),
  details: href.optional(),
  // English texts shown on /en/ pages; anything missing falls back to Russian. slides and overlay are screens of the
  // work's English interface for a bilingual work.
  en: z.object({ title: z.string(), type: z.string(), description: z.string(), action: z.string(), extra: z.string(), details: href, alt: z.string(), overlayAlt: z.string(), slides: z.array(z.string().startsWith('/')).min(2), overlay: z.string().startsWith('/'), facts: z.array(z.object({ value: z.string(), label: z.string(), name: z.string() }).partial()) }).partial().optional(),
}).refine(w => w.status === 'rework' || (w.preview && (w.details || w.action?.href)), 'An accepted work needs a preview and a link');

export const homeSchema = z.object({
  moreThreshold: z.number().int().positive(),
  works: z.array(work).min(1),
}).superRefine((home, ctx) => {
  const slugs = new Set(home.works.map(w => w.slug));
  if (slugs.size !== home.works.length) ctx.addIssue({ code: 'custom', message: 'Duplicate work slug' });
});

export type HomeData = z.infer<typeof homeSchema>;
export type HomeWork = HomeData['works'][number];
