// Button colours from a work's own interface colour. The text keeps AA contrast (4.5:1) and the button keeps 3:1
// against the graphite page in every state; when the work's colour is too dark for that, the same hue is lifted in
// OKLab lightness, so it stays recognisably the work's colour.
export const PAGE = '#111213';
const INK = '#111213';
const WHITE = '#ffffff';

type Rgb = [number, number, number];
const channels = (hex: string): Rgb => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = (rgb: number[]) => '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const toLinear = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fromLinear = (c: number) => 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

const luminance = (hex: string) => { const [r, g, b] = channels(hex).map(toLinear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a: string, b: string) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

function toOklab(hex: string) {
  const [r, g, b] = channels(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return { L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s };
}
function linearFromOklab(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
// The colour at a new OKLab lightness with the same hue; chroma is reduced only as far as the screen gamut requires.
function withLightness(hex: string, L: number) {
  const c = toOklab(hex);
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) { const k = (lo + hi) / 2; if (linearFromOklab(L, c.a * k, c.b * k).every(v => v >= 0 && v <= 1)) lo = k; else hi = k; }
  return toHex(linearFromOklab(L, c.a * lo, c.b * lo).map(fromLinear));
}
const shift = (hex: string, dL: number) => withLightness(hex, Math.min(1, Math.max(0, toOklab(hex).L + dL)));

export type ButtonColors = { button: string; ink: string; hover: string; press: string };
const fits = (color: string, ink: string) => contrast(color, ink) >= 4.5 && contrast(color, PAGE) >= 3;

// White text where it reads, dark text on light colours. Hover shifts the tone a little, press is a bit darker.
export function buttonColors(base: string): ButtonColors {
  const ink = contrast(base, WHITE) >= 4.5 ? WHITE : INK;
  let button = base;
  // Lift a dark colour until the button stands out from the page with room for the darker press state.
  for (let i = 0; i < 60 && contrast(button, PAGE) < 3.4 && contrast(shift(button, 0.005), ink) >= 4.5; i++) button = shift(button, 0.005);
  const pick = (steps: number[]) => steps.map(d => shift(button, d)).find(c => fits(c, ink)) ?? button;
  return { button, ink, hover: pick([0.025, -0.025, 0.012, -0.012]), press: pick([-0.045, -0.03, -0.02, -0.01]) };
}
