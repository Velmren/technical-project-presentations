import { z } from 'zod';

const link = z.object({ label: z.string().min(1), href: z.string().refine(v => v.startsWith('/') || v.startsWith('https://') || /^#[a-z][a-z0-9-]*$/.test(v), 'Use a site path, page anchor or HTTPS URL') });
const image = z.object({ src: z.string().startsWith('/assets/'), alt: z.string().min(1), width: z.number().positive(), height: z.number().positive() });
const intro = { title: z.string().min(1), text: z.string().min(1) };
// A proof is a small composition: the whole screen and the detail the heading talks about, side by side.
// x, y and w are fractions of the composition width; front: the layer that moves ahead on scroll;
// fade: the fragment continues past its lower edge. url shows the screen in a browser window, phone in a device.
// video plays a short silent loop of the real work in the frame; image is its first frame.
const clip = z.string().startsWith('/assets/').endsWith('.mp4');
// embed puts a live page of the work (Lottie, Canvas) in the frame; image stays as its poster.
const embedPage = z.string().startsWith('/assets/').endsWith('.html');
const layer = z.object({ image, x: z.number().min(0).max(1), y: z.number().min(0), w: z.number().positive().max(1), front: z.boolean().optional(), fade: z.boolean().optional(), phone: z.boolean().optional(), url: z.string().optional(), video: clip.optional(), embed: embedPage.optional() });
// Layers move vertically at different speeds, so they must never share horizontal space.
const sideBySide = (layers: z.infer<typeof layer>[]) => [...layers].sort((a, b) => a.x - b.x)
  .every((l, i, all) => l.x + l.w <= 1 + 1e-9 && (i === 0 || l.x >= all[i - 1].x + all[i - 1].w - 1e-9));
// English texts of a project, merged over the Russian ones; arrays follow the order of the original.
const translation = z.object({
  title: z.string(), eyebrow: z.string(), lead: z.string(), summary: z.string(), note: z.string(), closing: z.string(),
  actions: z.array(z.string()), showcase: z.array(z.string()),
  // English screenshots of a bilingual work, by the source of the Russian one they replace.
  media: z.record(z.string(), z.string().startsWith('/assets/')),
  sections: z.array(z.object({ title: z.string(), text: z.string(), figure: z.object({ value: z.string(), label: z.string() }), alts: z.array(z.string()), items: z.array(z.string()), descriptions: z.array(z.string()) }).partial()),
}).partial();
const sections = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('media'), image, caption: z.string() }),
  z.object({ kind: z.literal('features'), ...intro, items: z.array(z.string()).min(1), detailText: z.string().optional(), descriptions: z.array(z.string()).optional(), icons: z.array(z.enum(['search', 'layers', 'calculator', 'file', 'core', 'cube', 'check', 'arrow'])).optional() }),
  z.object({ kind: z.literal('mobile'), ...intro, image, link }),
  z.object({ kind: z.literal('gallery'), title: z.string().optional(), items: z.array(z.object({ ...intro, image })).min(1) }),
  z.object({ kind: z.literal('flow'), title: z.string(), items: z.array(z.object({ ...intro, image: image.optional(), diagram: z.object({ labels: z.array(z.string()).min(1), kind: z.enum(['objectives', 'progress', 'complete']) }).optional() })).min(1) }),
  z.object({ kind: z.literal('architecture'), ...intro, items: z.array(z.object({ ...intro, link })).min(1) }),
  z.object({ kind: z.literal('code'), ...intro, code: z.string(), language: z.string().optional(), link }),
  // One advantage of the work for its client, proven by real interface fragments or a figure.
  z.object({ kind: z.literal('benefit'), ...intro, figure: z.object({ value: z.string().min(1), label: z.string().min(1) }).optional(), layers: z.array(layer).min(1).max(3).refine(sideBySide, 'Layers overlap horizontally') }),
  z.object({ kind: z.literal('links'), title: z.string().min(1), text: z.string().min(1).optional(), links: z.array(link).min(1), brand: z.object({ image, eyebrow: z.string(), credit: link }).optional() }),
]);
export const projectSchema = z.object({
  status: z.enum(['published', 'draft']).default('published'),
  // 'case' pages use the concept C system; 'classic' pages keep the earlier editorial layout.
  presentation: z.enum(['classic', 'case']).default('classic'),
  year: z.number().int().optional(),
  // Case pages: the one main idea above the summary, a small honest note under the button, the closing line.
  lead: z.string().optional(),
  note: z.string().optional(),
  closing: z.string().optional(),
  // Colour of the work's own main button, used for the main button of its page.
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  // The real site in the first screen, in a browser window at url, with an optional phone screen beside it.
  showcase: z.object({ image, url: z.string().optional(), video: clip.optional(), phone: image.optional(), phoneVideo: clip.optional() }).optional(),
  en: translation.optional(),
  slug: z.string().regex(/^[a-z][a-z0-9-]*$/), title: z.string().min(1), summary: z.string().min(1),
  category: z.string().min(1), technologies: z.array(z.string().min(1)).min(1), order: z.number(),
  tone: z.enum(['cool', 'warm', 'night', 'slate']).default('cool'),
  heroCaption: z.string().optional(),
  heroImage: image.optional(),
  eyebrow: z.string().optional(),
  cover: z.union([z.object({ kind: z.literal('image'), image }), z.object({ kind: z.literal('flow'), steps: z.array(z.string()).min(1), details: z.array(z.string()).optional() })]),
  actions: z.array(link),
  video: z.object({ src: z.string().startsWith('/assets/'), poster: z.string().startsWith('/assets/'), caption: z.string() }).optional(),
  sections: z.array(sections).min(1),
});
export type Project = z.infer<typeof projectSchema>;
export type ProjectSection = Project['sections'][number];
export type ProjectSummary = Pick<Project, 'slug' | 'title' | 'summary' | 'category' | 'technologies' | 'cover' | 'tone'>;
