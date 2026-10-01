import {
  useMode,
  modeRgb,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeP3,
  parse,
  inGamut,
  toGamut,
  filterDeficiencyProt,
  filterDeficiencyDeuter,
  filterDeficiencyTrit,
  filterGrayscale,
  type Color as CuloriColor,
  type Oklch,
  type Oklab,
  type Rgb,
} from "culori/fn";
import type { Color } from "../color-utils";

// Only the modes this tool needs are registered, which keeps the bundle small.
const toRgb = useMode(modeRgb);
useMode(modeLrgb);
const toOklab = useMode(modeOklab);
const toOklch = useMode(modeOklch);
useMode(modeP3);

const inSrgb = inGamut("rgb");
const inP3 = inGamut("p3");
const mapToSrgb = toGamut("rgb", "oklch");

const fromColor = (c: Color): Rgb => ({
  mode: "rgb",
  r: c.r / 255,
  g: c.g / 255,
  b: c.b / 255,
  alpha: c.a,
});
const toColor = (c: Rgb): Color => {
  const channel = (v: number) => Math.min(255, Math.max(0, v * 255));
  return { r: channel(c.r), g: channel(c.g), b: channel(c.b), a: c.alpha ?? 1 };
};

const trim = (value: number, digits: number) =>
  Number.isFinite(value) ? String(Number(value.toFixed(digits))) : "0";
const alphaPart = (a: number) => (a < 1 ? ` / ${trim(a * 100, 1)}%` : "");

export function oklchOf(c: Color): Oklch {
  return toOklch(fromColor(c));
}

export function formatOklch(c: Color) {
  const { l, c: chroma, h } = oklchOf(c);
  return `oklch(${trim(l * 100, 2)}% ${trim(chroma, 5)} ${trim(chroma < 1e-4 ? 0 : (h ?? 0), 2)}${alphaPart(c.a)})`;
}

export function formatOklab(c: Color) {
  const { l, a, b } = toOklab(fromColor(c)) as Oklab;
  return `oklab(${trim(l * 100, 2)}% ${trim(a, 5)} ${trim(b, 5)}${alphaPart(c.a)})`;
}

export type PerceptualParse =
  | { ok: true; color: Color; inSrgb: boolean; inP3: boolean }
  | { ok: false };

// Accepts CSS oklch() or oklab(). Colors outside sRGB are mapped to the
// nearest sRGB color with the CSS Color 4 algorithm; the caller is told.
export function parsePerceptual(
  text: string,
  kind: "oklch" | "oklab",
): PerceptualParse {
  const value = text.trim();
  if (!value.toLowerCase().startsWith(kind + "(")) return { ok: false };
  const parsed = parse(value) as CuloriColor | undefined;
  if (!parsed || parsed.mode !== kind) return { ok: false };
  // Displayed values are rounded, so a color copied from this tool can land a
  // hair outside sRGB; within a quarter of a channel step it is simply clamped.
  const direct = toRgb(parsed);
  const nearly = [direct.r, direct.g, direct.b].every(
    (v) => v > -0.001 && v < 1.001,
  );
  const srgb = nearly || inSrgb(parsed);
  const p3 = srgb || inP3(parsed);
  const rgb = srgb ? direct : toRgb(mapToSrgb(parsed));
  return { ok: true, color: toColor(rgb), inSrgb: srgb, inP3: p3 };
}

// Tonal scale with even perceived lightness steps. Chroma follows the base
// color and tapers towards white and black, then is fitted into sRGB.
export const PERCEPTUAL_STOPS = [
  { label: "50", l: 0.975, k: 0.18 },
  { label: "100", l: 0.945, k: 0.32 },
  { label: "200", l: 0.89, k: 0.55 },
  { label: "300", l: 0.82, k: 0.78 },
  { label: "400", l: 0.72, k: 0.95 },
  { label: "500", l: 0.63, k: 1 },
  { label: "600", l: 0.54, k: 1 },
  { label: "700", l: 0.46, k: 0.92 },
  { label: "800", l: 0.38, k: 0.8 },
  { label: "900", l: 0.3, k: 0.66 },
  { label: "950", l: 0.22, k: 0.52 },
];

export function perceptualScale(base: Color) {
  const { c, h } = oklchOf(base);
  // Near-neutral colors keep a little chroma so the scale does not turn
  // grey-blue. True greys have no hue, and any chroma would tint them.
  const grey = h === undefined || c < 1e-4;
  const chroma = grey ? 0 : Math.max(c, 0.012);
  return PERCEPTUAL_STOPS.map((stop) => {
    const target: Oklch = {
      mode: "oklch",
      l: stop.l,
      c: chroma * stop.k,
      h: h ?? 0,
    };
    const color = toColor(toRgb(inSrgb(target) ? target : mapToSrgb(target)));
    return {
      label: stop.label,
      lightness: stop.l,
      color: { ...color, a: base.a },
    };
  });
}

export type Vision =
  | "normal"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";
export const VISIONS: Vision[] = [
  "normal",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
];
const filters: Record<Exclude<Vision, "normal">, (c: Rgb) => Rgb> = {
  protanopia: filterDeficiencyProt(1) as (c: Rgb) => Rgb,
  deuteranopia: filterDeficiencyDeuter(1) as (c: Rgb) => Rgb,
  tritanopia: filterDeficiencyTrit(1) as (c: Rgb) => Rgb,
  achromatopsia: filterGrayscale(1) as (c: Rgb) => Rgb,
};

// Simulation of color vision deficiency (Machado et al. 2009, full severity),
// used only for display; stored colors never change.
export function simulate(c: Color, vision: Vision): Color {
  if (vision === "normal") return c;
  return toColor(toRgb(filters[vision](fromColor(c))));
}
