export type Color = { r: number; g: number; b: number; a: number };
export type Hsl = { h: number; s: number; l: number; a: number };
export type ColorFormat = "hex" | "rgb" | "hsl";
export type Harmony = "complementary" | "analogous" | "triadic" | "split";
export type PaletteEntry = {
  id: string;
  name: string;
  color: Color;
  locked: boolean;
};
export type ParseColorResult =
  | { ok: true; color: Color; hue?: number }
  | { ok: false; error: string };

export const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
export const wrapHue = (value: number) => ((value % 360) + 360) % 360;
const decimal = (value: number, places = 2) =>
  String(Number(value.toFixed(places)));
const numberPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)$/;

export function isColor(value: unknown): value is Color {
  if (!value || typeof value !== "object") return false;
  const c = value as Color;
  return (
    [c.r, c.g, c.b, c.a].every(Number.isFinite) &&
    [c.r, c.g, c.b].every((v) => v >= 0 && v <= 255) &&
    c.a >= 0 &&
    c.a <= 1
  );
}

export function colorToHsl(color: Color, hueFallback = 0): Hsl {
  const r = color.r / 255,
    g = color.g / 255,
    b = color.b / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  const lightness = (max + min) / 2;
  if (delta < 1e-12)
    return { h: wrapHue(hueFallback), s: 0, l: lightness * 100, a: color.a };
  let hue =
    max === r
      ? ((g - b) / delta) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return {
    h: wrapHue(hue * 60),
    s: (delta / (1 - Math.abs(2 * lightness - 1))) * 100,
    l: lightness * 100,
    a: color.a,
  };
}

export function hslToColor({ h, s, l, a }: Hsl): Color {
  const hue = wrapHue(h),
    sat = clamp(s, 0, 100) / 100,
    light = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1)),
    m = light - chroma / 2;
  const [r, g, b] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return {
    r: clamp((r + m) * 255, 0, 255),
    g: clamp((g + m) * 255, 0, 255),
    b: clamp((b + m) * 255, 0, 255),
    a: clamp(a, 0, 1),
  };
}

export function toHex(color: Color, includeAlpha = color.a < 1): string {
  const channel = (n: number) =>
    Math.round(n).toString(16).padStart(2, "0").toUpperCase();
  return (
    "#" +
    channel(color.r) +
    channel(color.g) +
    channel(color.b) +
    (includeAlpha ? channel(color.a * 255) : "")
  );
}

export function toRgb(color: Color): string {
  const channels = [color.r, color.g, color.b].map((v) => decimal(v)).join(" ");
  return `rgb(${channels}${color.a < 1 ? ` / ${decimal(color.a, 4)}` : ""})`;
}

/** Keep rendering precision separate from the concise values shown in editable fields. */
export function toCssColor(color: Color): string {
  return `rgb(${[color.r, color.g, color.b].map((v) => decimal(v, 10)).join(" ")} / ${decimal(color.a, 10)})`;
}

export function toHsl(color: Color, hueFallback = 0): string {
  const c = colorToHsl(color, hueFallback);
  return `hsl(${decimal(c.h)} ${decimal(c.s)}% ${decimal(c.l)}%${color.a < 1 ? ` / ${decimal(color.a, 4)}` : ""})`;
}

export function formats(
  color: Color,
  hueFallback = 0,
): Record<ColorFormat, string> {
  return {
    hex: toHex(color),
    rgb: toRgb(color),
    hsl: toHsl(color, hueFallback),
  };
}

function numeric(value: string): number | null {
  return numberPattern.test(value) && Number.isFinite(Number(value))
    ? Number(value)
    : null;
}

function parseAlpha(value: string): number | null {
  const percent = value.endsWith("%"),
    parsed = numeric(percent ? value.slice(0, -1) : value);
  if (parsed === null) return null;
  const alpha = percent ? parsed / 100 : parsed;
  return alpha >= 0 && alpha <= 1 ? alpha : null;
}

/** Deliberately accepts numeric HEX/RGB/HSL only; arbitrary CSS is never injected. */
export function parseColor(
  input: string,
  expected?: ColorFormat,
): ParseColorResult {
  const text = input.trim();
  const error = (message: string): ParseColorResult => ({
    ok: false,
    error: message,
  });
  if (!text) return error("Enter a color value.");
  if (text.length > 180)
    return error("Color values must be under 180 characters.");
  if (
    text.startsWith("#") ||
    (expected === "hex" && /^[a-f\d]+$/i.test(text))
  ) {
    if (expected && expected !== "hex")
      return error(`Use ${expected.toUpperCase()} syntax in this field.`);
    const hex = text.replace(/^#/, "");
    if (!/^(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(hex))
      return error("Use #RGB, #RGBA, #RRGGBB, or #RRGGBBAA.");
    const expanded =
      hex.length <= 4
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    return {
      ok: true,
      color: {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16),
        a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      },
    };
  }
  const match = /^(rgba?|hsla?)\(([^()]*)\)$/i.exec(text);
  if (!match)
    return error(
      expected === "hex"
        ? "Use #RGB, #RGBA, #RRGGBB, or #RRGGBBAA."
        : "Use HEX, rgb(), or hsl() with numeric channels.",
    );
  const kind: ColorFormat = match[1].toLowerCase().startsWith("rgb")
    ? "rgb"
    : "hsl";
  if (expected && expected !== kind)
    return error(`Use ${expected.toUpperCase()} syntax in this field.`);
  const body = match[2].trim();
  let values: string[],
    alpha = 1;
  if (body.includes(",")) {
    if (body.includes("/"))
      return error(
        "Use comma syntax or space / alpha syntax, without mixing them.",
      );
    values = body.split(",").map((v) => v.trim());
    if (values.length !== 3 && values.length !== 4)
      return error("Provide three channels and an optional alpha value.");
    if (values.length === 4) {
      const parsed = parseAlpha(values.pop()!);
      if (parsed === null) return error("Alpha must be 0–1 or 0%–100%.");
      alpha = parsed;
    }
  } else {
    const parts = body.split("/");
    if (parts.length > 2) return error("Provide only one alpha value.");
    values = parts[0].trim().split(/\s+/);
    if (parts.length === 2) {
      const parsed = parseAlpha(parts[1].trim());
      if (parsed === null) return error("Alpha must be 0–1 or 0%–100%.");
      alpha = parsed;
    }
    if (values.length !== 3)
      return error("Provide three channels and an optional alpha value.");
  }
  if (kind === "rgb") {
    const isPercent = values.map((v) => v.endsWith("%"));
    if (
      body.includes(",") &&
      isPercent.some(Boolean) &&
      !isPercent.every(Boolean)
    )
      return error(
        "Comma RGB channels must all use numbers or all use percentages.",
      );
    const channels = values.map((v, i) => {
      const parsed = numeric(isPercent[i] ? v.slice(0, -1) : v);
      return parsed === null ||
        parsed < 0 ||
        parsed > (isPercent[i] ? 100 : 255)
        ? null
        : isPercent[i]
          ? (parsed * 255) / 100
          : parsed;
    });
    if (channels.some((v) => v === null))
      return error("RGB channels must be 0–255 or 0%–100%.");
    return {
      ok: true,
      color: { r: channels[0]!, g: channels[1]!, b: channels[2]!, a: alpha },
    };
  }
  const hueMatch = /^([-+]?(?:\d+\.?\d*|\.\d+))(deg|turn|rad|grad)?$/i.exec(
    values[0],
  );
  if (!hueMatch) return error("Hue must be a number, deg, turn, rad, or grad.");
  const rawHue = Number(hueMatch[1]);
  if (!Number.isFinite(rawHue) || Math.abs(rawHue) > 1e9)
    return error(
      "Enter a finite hue between −1,000,000,000 and 1,000,000,000.",
    );
  const unit = hueMatch[2]?.toLowerCase();
  const h = wrapHue(
    rawHue *
      (unit === "turn"
        ? 360
        : unit === "rad"
          ? 180 / Math.PI
          : unit === "grad"
            ? 0.9
            : 1),
  );
  const channels = values
    .slice(1)
    .map((v) => (v.endsWith("%") ? numeric(v.slice(0, -1)) : null));
  if (channels.some((v) => v === null || v < 0 || v > 100))
    return error("HSL saturation and lightness must be 0%–100%.");
  return {
    ok: true,
    color: hslToColor({ h, s: channels[0]!, l: channels[1]!, a: alpha }),
    hue: h,
  };
}

/** Source-over compositing in encoded sRGB, matching ordinary CSS color rendering. */
export function composite(foreground: Color, background: Color): Color {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const channel = (front: number, back: number) =>
    (front * foreground.a + back * background.a * (1 - foreground.a)) / alpha;
  return {
    r: channel(foreground.r, background.r),
    g: channel(foreground.g, background.g),
    b: channel(foreground.b, background.b),
    a: alpha,
  };
}

export function luminance(color: Color): number {
  const linear = (v: number) => {
    const n = v / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear(color.r) +
    0.7152 * linear(color.g) +
    0.0722 * linear(color.b)
  );
}

export function contrastRatio(a: Color, b: Color): number {
  const l1 = luminance(a),
    l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function renderedPair(
  foreground: Color,
  background: Color,
  canvas: Color,
) {
  const opaqueCanvas = { ...canvas, a: 1 };
  const renderedBackground = composite(background, opaqueCanvas);
  const renderedForeground = composite(foreground, renderedBackground);
  const ratio = contrastRatio(renderedForeground, renderedBackground);
  return {
    foreground: renderedForeground,
    background: renderedBackground,
    canvas: opaqueCanvas,
    ratio,
    normalAA: ratio >= 4.5,
    largeAA: ratio >= 3,
    normalAAA: ratio >= 7,
    boundary: ratio >= 3,
    surfaceRatio: contrastRatio(renderedBackground, opaqueCanvas),
  };
}

export function generateHarmony(
  palette: PaletteEntry[],
  selectedId: string,
  harmony: Harmony,
  hueFallback = 0,
): PaletteEntry[] {
  const anchorIndex = Math.max(
    0,
    palette.findIndex((entry) => entry.id === selectedId),
  );
  const base = colorToHsl(palette[anchorIndex].color, hueFallback);
  const offsets =
    harmony === "analogous"
      ? [0, -30, 30, -60, 60]
      : harmony === "triadic"
        ? [0, 120, 240]
        : harmony === "split"
          ? [0, 150, 210]
          : [0, 180];
  return palette.map((entry, i) => {
    if (entry.locked || i === anchorIndex) return entry;
    const position = (i - anchorIndex + palette.length) % palette.length;
    const cycle = Math.floor(position / offsets.length);
    const lightnessOffset =
      cycle === 0 ? 0 : (cycle % 2 ? -1 : 1) * Math.ceil(cycle / 2) * 14;
    return {
      ...entry,
      color: hslToColor({
        ...base,
        h: base.h + offsets[position % offsets.length],
        l: clamp(base.l + lightnessOffset, 8, 92),
      }),
    };
  });
}

export const TONE_STOPS = [
  { label: "50", lightness: 97 },
  { label: "100", lightness: 93 },
  { label: "200", lightness: 86 },
  { label: "300", lightness: 76 },
  { label: "400", lightness: 64 },
  { label: "500", lightness: 52 },
  { label: "600", lightness: 42 },
  { label: "700", lightness: 33 },
  { label: "800", lightness: 24 },
  { label: "900", lightness: 16 },
  { label: "950", lightness: 9 },
];

export function tokenNames(
  palette: PaletteEntry[],
  namespace: string,
): string[] {
  const slug = (s: string, fallback: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || fallback;
  const prefix = slug(namespace, "palette"),
    used = new Set<string>();
  return palette.map((entry, i) => {
    const base = `${prefix}-${slug(entry.name, `color-${i + 1}`)}`;
    let name = base,
      suffix = 2;
    while (used.has(name)) name = `${base}-${suffix++}`;
    used.add(name);
    return name;
  });
}

export type ExportFormat = "css" | "json" | "tokens";
export function exportPalette(
  palette: PaletteEntry[],
  namespace: string,
  kind: ExportFormat,
): string {
  const names = tokenNames(palette, namespace);
  if (kind === "css")
    return `:root {\n${palette.map((entry, i) => `  --${names[i]}: ${toHex(entry.color)};`).join("\n")}\n}\n`;
  if (kind === "tokens")
    return (
      JSON.stringify(
        Object.fromEntries(
          palette.map((entry, i) => [
            names[i],
            {
              $type: "color",
              $value: {
                colorSpace: "srgb",
                components: [entry.color.r, entry.color.g, entry.color.b].map(
                  (n) => Number((n / 255).toFixed(6)),
                ),
                alpha: Number(entry.color.a.toFixed(6)),
              },
            },
          ]),
        ),
        null,
        2,
      ) + "\n"
    );
  return (
    JSON.stringify(
      {
        name: namespace.trim() || "palette",
        colors: palette.map((entry, i) => ({
          name: entry.name,
          token: names[i],
          hex: toHex(entry.color),
          rgb: toRgb(entry.color),
          hsl: toHsl(entry.color),
          alpha: Number(entry.color.a.toFixed(6)),
          locked: entry.locked,
        })),
      },
      null,
      2,
    ) + "\n"
  );
}
