import { Sofia_Sans_Condensed, Tektur } from 'next/font/google';

// Fonts of the concept C system; body text uses Golos Text from the site layout.
export const displayFont = Tektur({ subsets: ['latin', 'cyrillic'], axes: ['wdth'], display: 'swap', variable: '--cc-display' });
export const figuresFont = Sofia_Sans_Condensed({ subsets: ['latin', 'cyrillic'], weight: ['400', '600'], display: 'swap', variable: '--cc-figures' });
export const fontVariables = [displayFont.variable, figuresFont.variable].join(' ');
