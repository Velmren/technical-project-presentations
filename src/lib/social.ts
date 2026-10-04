// Link previews in messengers and social networks: the home first screen, or the first screen of a work.
import type { Locale } from './i18n';
import type { Project } from './schema';

const SHARE = { width: 1200, height: 630 };
export const socialImage = { url: '/og.png', ...SHARE, alt: 'VELMREN' };

// The preview of a work is a JPEG cut from its showcase by scripts/prepare-share.mjs. The English page has its own
// when it shows an English screenshot. project is the work as stored, not its translation.
export function projectImage(project: Project, locale: Locale = 'ru') {
  if (!project.showcase) return socialImage;
  const english = locale === 'en' && Boolean(project.en?.media?.[project.showcase.image.src]);
  const alt = (locale === 'en' && project.en?.showcase?.[0]) || project.showcase.image.alt;
  return { url: `/assets/share/${project.slug}${english ? '-en' : ''}.jpg`, ...SHARE, alt };
}
