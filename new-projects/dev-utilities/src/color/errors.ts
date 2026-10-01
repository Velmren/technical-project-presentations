import type { MessageKey, Params } from "../i18n";

type T = (key: MessageKey, params?: Params) => string;

// color-utils reports errors as fixed English sentences (its tests rely on
// them); the interface maps each one to a translated message.
const known: [RegExp, MessageKey][] = [
  [/^Enter a color value/, "color.errors.empty"],
  [/under 180 characters/, "color.errors.tooLong"],
  [/^Use #RGB/, "color.errors.hex"],
  [/^Use HEX, rgb\(\)/, "color.errors.syntax"],
  [/without mixing them/, "color.errors.mixed"],
  [/^Provide three channels/, "color.errors.channels"],
  [/^Alpha must be/, "color.errors.alpha"],
  [/^Provide only one alpha/, "color.errors.oneAlpha"],
  [/^Comma RGB channels/, "color.errors.rgbMixed"],
  [/^RGB channels must be/, "color.errors.rgbRange"],
  [/^Hue must be a number/, "color.errors.hue"],
  [/^Enter a finite hue/, "color.errors.hueRange"],
  [/^HSL saturation and lightness/, "color.errors.hsl"],
];

export function colorError(t: T, message: string) {
  const field = /^Use (HEX|RGB|HSL) syntax in this field/.exec(message);
  if (field) return t("color.errors.wrongField", { format: field[1] });
  const hit = known.find(([pattern]) => pattern.test(message));
  return hit ? t(hit[1]) : message;
}
