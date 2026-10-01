// Link previews in messengers and social networks: the home first screen, or a work's own showcase.
import type { Project } from './schema';

export const socialImage = { url: '/og.png', width: 1200, height: 630, alt: 'VELMREN' };

export const projectImage = (project: Project) => project.showcase
  ? { url: project.showcase.image.src, width: project.showcase.image.width, height: project.showcase.image.height, alt: project.showcase.image.alt }
  : socialImage;
