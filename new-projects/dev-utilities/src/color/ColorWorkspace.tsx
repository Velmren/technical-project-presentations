import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  LockKeyhole,
  Pipette,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UnlockKeyhole,
  X,
} from "lucide-react";
import {
  copyText,
  downloadText,
  useSessionState,
  type ToolProps,
} from "../shared";
import {
  clamp,
  colorToHsl,
  composite,
  contrastRatio,
  exportPalette,
  formats,
  generateHarmony,
  hslToColor,
  isColor,
  parseColor,
  renderedPair,
  toCssColor,
  toHex,
  tokenNames,
  toRgb,
  type Color,
  type ColorFormat,
  type ExportFormat,
  type Harmony,
  type PaletteEntry,
} from "../color-utils";
import { useI18n } from "../i18n";
import { Select } from "../ui/Select";
import { SplitPane } from "../ui/SplitPane";
import { useNarrow } from "../ui/useNarrow";
import { colorError } from "./errors";
import {
  formatOklab,
  formatOklch,
  parsePerceptual,
  perceptualScale,
  simulate,
  VISIONS,
  type Vision,
} from "./perceptual";
import "./color.css";

type PairKey = "foreground" | "background" | "canvas";
type ExportKind = ExportFormat | "tailwind";
const EXPORT_KINDS: ExportKind[] = ["css", "tailwind", "tokens", "json"];

// Tailwind CSS v4 reads theme colors from an @theme block.
function tailwindTheme(palette: PaletteEntry[], namespace: string) {
  const names = tokenNames(palette, namespace);
  return `@theme {\n${palette
    .map((entry, i) => `  --color-${names[i]}: ${formatOklch(entry.color)};`)
    .join("\n")}\n}\n`;
}

// OKLCH and OKLab fields keep their own draft while typing; the palette only
// stores sRGB, so colors beyond it are mapped and the field says so.
function PerceptualField({
  kind,
  color,
  onColor,
  notify,
}: {
  kind: "oklch" | "oklab";
  color: Color;
  onColor: (color: Color) => void;
  notify: ToolProps["notify"];
}) {
  const { t } = useI18n();
  const formatted = (kind === "oklch" ? formatOklch : formatOklab)(color);
  const [draft, setDraft] = useState<string | null>(null);
  // Gamut of the last typed value, kept only while the color is still the
  // one it produced.
  const [typed, setTyped] = useState<{
    inSrgb: boolean;
    inP3: boolean;
    shown: string;
  } | null>(null);
  const format = kind === "oklch" ? formatOklch : formatOklab;
  const gamut = typed?.shown === formatted ? typed : null;
  const label = kind === "oklch" ? "OKLCH" : "OKLab";
  const parsed = draft === null ? null : parsePerceptual(draft, kind);
  const invalid = parsed !== null && !parsed.ok;
  const id = `color-format-${kind}`;
  return (
    <div className="format-row">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input mono"
        spellCheck={false}
        autoComplete="off"
        maxLength={180}
        value={draft ?? formatted}
        aria-invalid={invalid}
        aria-describedby={invalid || gamut ? `${id}-note` : undefined}
        onFocus={() => setDraft(formatted)}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const result = parsePerceptual(text, kind);
          if (result.ok) {
            setTyped({
              inSrgb: result.inSrgb,
              inP3: result.inP3,
              shown: format(result.color),
            });
            onColor(result.color);
          }
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => {
          if (event.key === "Enter") setDraft(null);
        }}
      />
      <button
        type="button"
        className="icon-btn"
        aria-label={t("color.editor.copyFormat", { format: label })}
        title={t("color.editor.copyFormat", { format: label })}
        onClick={() => void copyText(formatted, notify)}
      >
        <Copy size={14} />
      </button>
      {invalid ? (
        <span id={`${id}-note`} className="field-error" role="status">
          {t("color.editor.perceptualSyntax", {
            example:
              kind === "oklch"
                ? "oklch(62% 0.12 170)"
                : "oklab(62% -0.08 0.02)",
          })}
        </span>
      ) : (
        gamut &&
        !gamut.inSrgb && (
          <span id={`${id}-note`} className="field-warn" role="status">
            {t(
              gamut.inP3 ? "color.editor.gamutP3" : "color.editor.gamutOutside",
            )}
          </span>
        )
      )}
    </div>
  );
}
type Pane = "editor" | "palette" | "contrast" | "export";
type StudioState = {
  palette: PaletteEntry[];
  selectedId: string;
  hue: number;
  drafts: Record<ColorFormat, string>;
  pair: Record<PairKey, Color>;
  pairDrafts: Record<PairKey, string>;
  harmony: Harmony;
  exportKind: ExportKind;
  namespace: string;
};

const fromHex = (hex: string): Color => {
  const result = parseColor(hex);
  if (!result.ok) throw new Error(result.error);
  return result.color;
};
// A synthetic product palette: two locked neutrals, one brand color, two accents.
const INITIAL_PALETTE: PaletteEntry[] = [
  { id: "ink", name: "Ink", color: fromHex("#1F2328"), locked: true },
  { id: "paper", name: "Paper", color: fromHex("#F6F4EF"), locked: true },
  { id: "brand", name: "Brand", color: fromHex("#2F6F62"), locked: false },
  { id: "signal", name: "Signal", color: fromHex("#D9573B"), locked: false },
  { id: "sun", name: "Sun", color: fromHex("#E8B84A"), locked: false },
];
const INITIAL_STATE: StudioState = {
  palette: INITIAL_PALETTE,
  selectedId: "brand",
  hue: colorToHsl(INITIAL_PALETTE[2].color).h,
  drafts: formats(INITIAL_PALETTE[2].color),
  pair: {
    foreground: fromHex("#2F6F62"),
    background: fromHex("#F6F4EF"),
    canvas: fromHex("#FFFFFF"),
  },
  pairDrafts: {
    foreground: "#2F6F62",
    background: "#F6F4EF",
    canvas: "#FFFFFF",
  },
  harmony: "analogous",
  exportKind: "css",
  namespace: "brand",
};
const FORMAT_LABELS: Record<ColorFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
};
const HARMONIES: Harmony[] = ["complementary", "analogous", "triadic", "split"];
const WHITE: Color = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Color = { r: 0, g: 0, b: 0, a: 1 };
// Contrast of a palette color used as text on plain white or black.
const against = (color: Color, ground: Color) =>
  contrastRatio(composite(color, ground), ground);

function isStudioState(value: unknown): value is StudioState {
  if (!value || typeof value !== "object") return false;
  const s = value as StudioState;
  return (
    Array.isArray(s.palette) &&
    s.palette.length >= 1 &&
    s.palette.length <= 12 &&
    s.palette.every(
      (e) =>
        e &&
        typeof e.id === "string" &&
        typeof e.name === "string" &&
        e.name.length <= 40 &&
        typeof e.locked === "boolean" &&
        isColor(e.color),
    ) &&
    new Set(s.palette.map((e) => e.id)).size === s.palette.length &&
    s.palette.some((e) => e.id === s.selectedId) &&
    Number.isFinite(s.hue) &&
    s.hue >= 0 &&
    s.hue < 360 &&
    !!s.drafts &&
    ["hex", "rgb", "hsl"].every(
      (k) => typeof s.drafts[k as ColorFormat] === "string",
    ) &&
    !!s.pair &&
    !!s.pairDrafts &&
    ["foreground", "background", "canvas"].every(
      (k) =>
        isColor(s.pair[k as PairKey]) &&
        typeof s.pairDrafts[k as PairKey] === "string",
    ) &&
    s.pair.canvas.a === 1 &&
    HARMONIES.includes(s.harmony) &&
    EXPORT_KINDS.includes(s.exportKind) &&
    typeof s.namespace === "string" &&
    s.namespace.length <= 32
  );
}

function Verdict({
  passes,
  threshold,
}: {
  passes: boolean;
  threshold: string;
}) {
  const { t } = useI18n();
  return (
    <span className={"verdict " + (passes ? "is-pass" : "is-fail")}>
      {passes ? (
        <Check size={13} strokeWidth={2} />
      ) : (
        <X size={13} strokeWidth={2} />
      )}
      <span className="sr-only">
        {t(passes ? "color.contrast.pass" : "color.contrast.fail")}
      </span>
      <span className="verdict-threshold">{threshold}</span>
    </span>
  );
}

export function ColorWorkspace({ notify }: ToolProps) {
  const { t, num, lang } = useI18n();
  const narrow = useNarrow();
  const [saved, setSaved] = useSessionState<StudioState>(
    "color-studio",
    INITIAL_STATE,
    isStudioState,
  );
  const state = isStudioState(saved) ? saved : INITIAL_STATE;
  const [pane, setPane] = useState<Pane>("editor");
  const dragging = useRef(false);
  const selectedIndex = state.palette.findIndex(
    (entry) => entry.id === state.selectedId,
  );
  const selected = state.palette[selectedIndex];
  const nameOf = (entry: PaletteEntry, index: number) =>
    entry.name || t("color.palette.fallbackName", { index: index + 1 });
  const selectedName = nameOf(selected, selectedIndex);
  const hsl = colorToHsl(selected.color, state.hue);
  const pair = renderedPair(
    state.pair.foreground,
    state.pair.background,
    state.pair.canvas,
  );
  const [vision, setVision] = useState<Vision>("normal");
  // Display color: what a person with the chosen vision would see.
  const shown = (color: Color) => toRgb(simulate(color, vision));
  const output =
    state.exportKind === "tailwind"
      ? tailwindTheme(state.palette, state.namespace)
      : exportPalette(state.palette, state.namespace, state.exportKind);
  const tones = perceptualScale(selected.color);
  const lockedCount = state.palette.filter((e) => e.locked).length;
  const generatedSlots = state.palette.filter(
    (e) => !e.locked && e.id !== state.selectedId,
  ).length;
  const fieldErrors = Object.fromEntries(
    (["hex", "rgb", "hsl"] as ColorFormat[]).map((format) => {
      const parsed = parseColor(state.drafts[format], format);
      return [format, parsed.ok ? "" : colorError(t, parsed.error)];
    }),
  ) as Record<ColorFormat, string>;
  const pairErrors = Object.fromEntries(
    (["foreground", "background", "canvas"] as PairKey[]).map((key) => {
      const parsed = parseColor(state.pairDrafts[key]);
      return [
        key,
        !parsed.ok
          ? colorError(t, parsed.error)
          : key === "canvas" && parsed.color.a !== 1
            ? t("color.contrast.canvasOpaque")
            : "",
      ];
    }),
  ) as Record<PairKey, string>;
  const invalidPair = Object.values(pairErrors).some(Boolean);
  const decimal = (value: number, digits = 2) =>
    value.toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const alphaPercent = Number((selected.color.a * 100).toFixed(1));

  useEffect(() => {
    if (!isStudioState(saved)) setSaved(INITIAL_STATE);
  }, [saved, setSaved]);

  function updateColor(
    color: Color,
    hue = colorToHsl(color, state.hue).h,
    source?: ColorFormat,
    raw?: string,
  ) {
    setSaved((previous) => {
      const current = isStudioState(previous) ? previous : INITIAL_STATE;
      const values = formats(color, hue);
      if (source && raw !== undefined) values[source] = raw;
      return {
        ...current,
        hue,
        drafts: values,
        palette: current.palette.map((entry) =>
          entry.id === current.selectedId ? { ...entry, color } : entry,
        ),
      };
    });
  }

  function editFormat(format: ColorFormat, text: string) {
    const result = parseColor(text, format);
    if (result.ok)
      updateColor(
        result.color,
        result.hue ?? colorToHsl(result.color, state.hue).h,
        format,
        text,
      );
    else
      setSaved((current) => ({
        ...current,
        drafts: { ...current.drafts, [format]: text },
      }));
  }

  function normalizeFormat(format: ColorFormat) {
    if (!fieldErrors[format])
      setSaved((current) => ({
        ...current,
        drafts: formats(selected.color, state.hue),
      }));
  }

  function selectEntry(entry: PaletteEntry) {
    const hue = colorToHsl(entry.color, state.hue).h;
    setSaved((current) => ({
      ...current,
      selectedId: entry.id,
      hue,
      drafts: formats(entry.color, hue),
    }));
  }

  function changeHsl(changes: Partial<typeof hsl>) {
    const next = { ...hsl, ...changes };
    updateColor(hslToColor(next), next.h);
  }

  function pickFromPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    changeHsl({
      s: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      l: clamp(
        100 - ((event.clientY - bounds.top) / bounds.height) * 100,
        0,
        100,
      ),
    });
  }

  function pickFromKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 10 : 1;
    const changes: Partial<typeof hsl> =
      event.key === "ArrowLeft"
        ? { s: clamp(hsl.s - step, 0, 100) }
        : event.key === "ArrowRight"
          ? { s: clamp(hsl.s + step, 0, 100) }
          : event.key === "ArrowUp"
            ? { l: clamp(hsl.l + step, 0, 100) }
            : event.key === "ArrowDown"
              ? { l: clamp(hsl.l - step, 0, 100) }
              : event.key === "Home"
                ? { s: 0 }
                : event.key === "End"
                  ? { s: 100 }
                  : event.key === "PageUp"
                    ? { l: clamp(hsl.l + 10, 0, 100) }
                    : event.key === "PageDown"
                      ? { l: clamp(hsl.l - 10, 0, 100) }
                      : {};
    if (Object.keys(changes).length) {
      event.preventDefault();
      changeHsl(changes);
    }
  }

  function addColor() {
    if (state.palette.length >= 12) return;
    const id = `color-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const entry = {
      id,
      name: t("color.palette.fallbackName", {
        index: state.palette.length + 1,
      }),
      color: { ...selected.color },
      locked: false,
    };
    setSaved((current) => ({
      ...current,
      selectedId: id,
      palette: [...current.palette, entry],
      drafts: formats(entry.color, state.hue),
    }));
    notify(t("color.palette.added"));
  }

  function removeColor() {
    if (state.palette.length === 1) return;
    const palette = state.palette.filter(
      (entry) => entry.id !== state.selectedId,
    );
    const next = palette[Math.min(selectedIndex, palette.length - 1)];
    const hue = colorToHsl(next.color, state.hue).h;
    setSaved((current) => ({
      ...current,
      palette,
      selectedId: next.id,
      hue,
      drafts: formats(next.color, hue),
    }));
    notify(t("color.palette.removed", { name: selectedName }));
  }

  function moveColor(direction: -1 | 1) {
    const target = selectedIndex + direction;
    if (target < 0 || target >= state.palette.length) return;
    const palette = [...state.palette];
    [palette[selectedIndex], palette[target]] = [
      palette[target],
      palette[selectedIndex],
    ];
    setSaved((current) => ({ ...current, palette }));
    notify(t("color.palette.moved", { position: target + 1 }));
  }

  function editPair(key: PairKey, text: string) {
    const parsed = parseColor(text);
    setSaved((current) => ({
      ...current,
      pairDrafts: { ...current.pairDrafts, [key]: text },
      pair:
        parsed.ok && (key !== "canvas" || parsed.color.a === 1)
          ? { ...current.pair, [key]: parsed.color }
          : current.pair,
    }));
  }

  function useForPair(key: PairKey) {
    if (key === "canvas" && selected.color.a !== 1) {
      notify(t("color.contrast.canvasOpaque"));
      return;
    }
    setSaved((current) => ({
      ...current,
      pair: { ...current.pair, [key]: selected.color },
      pairDrafts: { ...current.pairDrafts, [key]: toHex(selected.color) },
    }));
    notify(t("color.contrast.applied"));
  }

  function swapPair() {
    setSaved((current) => ({
      ...current,
      pair: {
        ...current.pair,
        foreground: current.pair.background,
        background: current.pair.foreground,
      },
      pairDrafts: {
        ...current.pairDrafts,
        foreground: current.pairDrafts.background,
        background: current.pairDrafts.foreground,
      },
    }));
  }

  function makeHarmony() {
    setSaved((current) => ({
      ...current,
      palette: generateHarmony(
        current.palette,
        current.selectedId,
        current.harmony,
        current.hue,
      ),
    }));
    notify(
      t("color.palette.generated", {
        name: t(`color.palette.harmonies.${state.harmony}`),
        count: generatedSlots,
      }),
    );
  }

  const previewStyle = {
    "--pv-fg": toCssColor(simulate(pair.foreground, vision)),
    "--pv-bg": toCssColor(simulate(pair.background, vision)),
  } as CSSProperties;
  const selectedFormats = formats(selected.color, state.hue);
  const roleName = (key: PairKey) => t(`color.contrast.${key}`).toLowerCase();

  const editor = (
    <section className="color-editor" aria-labelledby="color-editor-title">
      <div className="pane-head">
        <div className="pane-title">
          <span className="swatch-dot checker" aria-hidden="true">
            <span style={{ background: shown(selected.color) }} />
          </span>
          <span id="color-editor-title">{selectedName}</span>
        </div>
        <span className="pane-role">
          {t("color.editor.slot", { index: selectedIndex + 1 })}
        </span>
        <div className="pane-actions">
          <button
            type="button"
            className="icon-btn"
            title={t("color.editor.copyAll")}
            aria-label={t("color.editor.copyAll")}
            onClick={() =>
              void copyText(Object.values(selectedFormats).join("\n"), notify)
            }
          >
            <Copy size={15} />
          </button>
        </div>
      </div>
      <div className="pane-body color-editor-body">
        <div
          className="sl-plane"
          tabIndex={0}
          role="slider"
          aria-roledescription={t("color.editor.planeRole")}
          aria-label={t("color.editor.plane")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsl.s)}
          aria-valuetext={t("color.editor.planeValue", {
            s: Math.round(hsl.s),
            l: Math.round(hsl.l),
          })}
          aria-describedby="color-plane-hint"
          style={{
            backgroundImage: `linear-gradient(to bottom, #fff, transparent 50%, #000), linear-gradient(to right, rgb(50% 50% 50%), hsl(${hsl.h} 100% 50%))`,
          }}
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.focus();
            pickFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (dragging.current) pickFromPointer(event);
          }}
          onPointerUp={(event) => {
            dragging.current = false;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          onLostPointerCapture={() => {
            dragging.current = false;
          }}
          onKeyDown={pickFromKeyboard}
        >
          <span
            className="sl-handle"
            style={{
              left: `${hsl.s}%`,
              top: `${100 - hsl.l}%`,
              backgroundColor: toRgb({ ...selected.color, a: 1 }),
            }}
          />
        </div>
        <div className="sl-readout">
          <span id="color-plane-hint">{t("color.editor.planeHint")}</span>
          <span className="mono">
            S {Math.round(hsl.s)} · L {Math.round(hsl.l)}
          </span>
        </div>
        <label className="range-label" htmlFor="color-hue">
          <span>{t("color.editor.hue")}</span>
          <span className="mono">{Math.round(hsl.h)}°</span>
        </label>
        <input
          id="color-hue"
          className="range hue-range"
          type="range"
          min="0"
          max="359.9"
          step="0.1"
          value={hsl.h}
          onChange={(event) => changeHsl({ h: Number(event.target.value) })}
        />
        <label className="range-label" htmlFor="color-alpha">
          <span>{t("color.editor.alpha")}</span>
          <span className="mono">{num(alphaPercent)}%</span>
        </label>
        <div className="range-track checker">
          <input
            id="color-alpha"
            className="range alpha-range"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={selected.color.a * 100}
            aria-valuetext={t("color.editor.alphaValue", {
              value: alphaPercent,
            })}
            onChange={(event) =>
              changeHsl({ a: Number(event.target.value) / 100 })
            }
            style={{
              backgroundImage: `linear-gradient(to right, ${toRgb({ ...selected.color, a: 0 })}, ${toRgb({ ...selected.color, a: 1 })})`,
            }}
          />
        </div>
        <div className="formats">
          {(["hex", "rgb", "hsl"] as ColorFormat[]).map((format) => (
            <div className="format-row" key={format}>
              <label htmlFor={`color-format-${format}`}>
                {FORMAT_LABELS[format]}
              </label>
              <input
                id={`color-format-${format}`}
                className="input mono"
                spellCheck={false}
                autoComplete="off"
                value={state.drafts[format]}
                maxLength={180}
                aria-invalid={!!fieldErrors[format]}
                aria-describedby={
                  fieldErrors[format]
                    ? `color-format-${format}-error`
                    : undefined
                }
                onChange={(event) => editFormat(format, event.target.value)}
                onBlur={() => normalizeFormat(format)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") normalizeFormat(format);
                }}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={t("color.editor.copyFormat", {
                  format: FORMAT_LABELS[format],
                })}
                title={t("color.editor.copyFormat", {
                  format: FORMAT_LABELS[format],
                })}
                onClick={() => void copyText(selectedFormats[format], notify)}
              >
                <Copy size={14} />
              </button>
              {fieldErrors[format] && (
                <span
                  id={`color-format-${format}-error`}
                  className="field-error"
                  role="status"
                >
                  {fieldErrors[format]}
                </span>
              )}
            </div>
          ))}
          <PerceptualField
            kind="oklch"
            color={selected.color}
            onColor={(c) => updateColor(c)}
            notify={notify}
          />
          <PerceptualField
            kind="oklab"
            color={selected.color}
            onColor={(c) => updateColor(c)}
            notify={notify}
          />
        </div>
        <p className="pane-note">
          {t(
            selected.color.a === 1
              ? "color.editor.opaque"
              : "color.editor.translucent",
          )}
          . {t("color.editor.formatNote")}
        </p>
      </div>
    </section>
  );

  const palette = (
    <section className="color-palette" aria-labelledby="color-palette-title">
      <div className="pane-head">
        <div className="pane-title">
          <span id="color-palette-title">{t("color.palette.title")}</span>
        </div>
        <span className="pane-role">
          {t("color.palette.count", { count: state.palette.length })},{" "}
          {t("color.palette.locked", { count: lockedCount })}
        </span>
        <div className="pane-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={t("color.palette.moveUp")}
            title={t("color.palette.moveUp")}
            disabled={selectedIndex === 0}
            onClick={() => moveColor(-1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("color.palette.moveDown")}
            title={t("color.palette.moveDown")}
            disabled={selectedIndex === state.palette.length - 1}
            onClick={() => moveColor(1)}
          >
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("color.palette.remove", { name: selectedName })}
            title={t("color.palette.remove", { name: selectedName })}
            disabled={state.palette.length === 1}
            onClick={removeColor}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div className="pane-body palette-body">
        <div className="palette-head" aria-hidden="true">
          <span />
          <span>{t("color.palette.columns.name")}</span>
          <span>HEX</span>
          <span className="num" title={t("color.palette.columns.onWhiteHint")}>
            {t("color.palette.columns.onWhite")}
          </span>
          <span className="num" title={t("color.palette.columns.onBlackHint")}>
            {t("color.palette.columns.onBlack")}
          </span>
          <span className="num">{t("color.palette.columns.alpha")}</span>
        </div>
        <div
          className="palette-list"
          role="group"
          aria-label={t("color.palette.title")}
        >
          {state.palette.map((entry, i) => {
            const name = nameOf(entry, i);
            const current = entry.id === state.selectedId;
            return (
              <div
                className={"palette-row" + (current ? " selected" : "")}
                key={entry.id}
              >
                <button
                  type="button"
                  className="palette-select"
                  aria-pressed={current}
                  aria-label={
                    t("color.palette.select", {
                      name,
                      hex: toHex(entry.color),
                      position: i + 1,
                    }) + (entry.locked ? t("color.palette.lockedSuffix") : "")
                  }
                  onClick={() => selectEntry(entry)}
                >
                  <span className="palette-swatch checker" aria-hidden="true">
                    <span style={{ background: shown(entry.color) }} />
                  </span>
                  <span className="palette-name">{name}</span>
                  <code className="palette-hex">{toHex(entry.color)}</code>
                  <span className="palette-ratio">
                    {decimal(against(entry.color, WHITE), 1)}
                  </span>
                  <span className="palette-ratio">
                    {decimal(against(entry.color, BLACK), 1)}
                  </span>
                  <span className="palette-alpha">
                    {num(Number((entry.color.a * 100).toFixed(1)))}%
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn palette-lock"
                  aria-label={t(
                    entry.locked
                      ? "color.palette.unlock"
                      : "color.palette.lock",
                    { name },
                  )}
                  aria-pressed={entry.locked}
                  title={t("color.palette.lockHint")}
                  onClick={() =>
                    setSaved((s) => ({
                      ...s,
                      palette: s.palette.map((e) =>
                        e.id === entry.id ? { ...e, locked: !e.locked } : e,
                      ),
                    }))
                  }
                >
                  {entry.locked ? (
                    <LockKeyhole size={14} />
                  ) : (
                    <UnlockKeyhole size={14} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-edit">
          <label htmlFor="color-slot-name">{t("color.palette.name")}</label>
          <input
            id="color-slot-name"
            className="input"
            maxLength={40}
            value={selected.name}
            placeholder={t("color.palette.fallbackName", {
              index: selectedIndex + 1,
            })}
            onChange={(event) =>
              setSaved((s) => ({
                ...s,
                palette: s.palette.map((e) =>
                  e.id === s.selectedId
                    ? { ...e, name: event.target.value }
                    : e,
                ),
              }))
            }
          />
        </div>
        <div className="tones">
          <div className="tones-head">
            <h3>{t("color.palette.tones")}</h3>
            <span>{t("color.palette.tonesNote")}</span>
          </div>
          <div
            className="tones-strip"
            role="group"
            aria-label={t("color.palette.tones")}
          >
            {tones.map((tone) => {
              const color = tone.color;
              return (
                <button
                  type="button"
                  key={tone.label}
                  className="tone"
                  aria-label={t("color.palette.tone", {
                    label: tone.label,
                    lightness: Math.round(tone.lightness * 100),
                    hex: toHex(color),
                  })}
                  title={toHex(color)}
                  onClick={() => updateColor(color)}
                >
                  <span className="tone-swatch checker">
                    <span style={{ background: shown(color) }} />
                  </span>
                  <span className="tone-label">{tone.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );

  const exporter = (
    <section className="color-export" aria-labelledby="color-export-title">
      <div className="pane-head">
        <div className="pane-title">
          <span id="color-export-title">{t("color.export.title")}</span>
        </div>
        <div
          className="pane-tabs"
          role="tablist"
          aria-label={t("color.export.formatLabel")}
        >
          {EXPORT_KINDS.map((kind) => (
            <button
              type="button"
              key={kind}
              role="tab"
              className="pane-tab"
              aria-selected={state.exportKind === kind}
              onClick={() => setSaved((s) => ({ ...s, exportKind: kind }))}
            >
              {t(`color.export.formats.${kind}`)}
            </button>
          ))}
        </div>
        <div className="pane-actions">
          <label className="prefix-field">
            <span>{t("color.export.prefix")}</span>
            <input
              id="color-export-namespace"
              className="input mono"
              value={state.namespace}
              maxLength={32}
              onChange={(event) =>
                setSaved((s) => ({ ...s, namespace: event.target.value }))
              }
              placeholder="brand"
            />
          </label>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("color.export.copy")}
            title={t("color.export.copy")}
            onClick={() => void copyText(output, notify)}
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            className="btn quiet"
            onClick={() =>
              downloadText(
                output,
                state.exportKind === "css"
                  ? "palette.css"
                  : state.exportKind === "tailwind"
                    ? "theme.css"
                    : state.exportKind === "tokens"
                      ? "palette.tokens.json"
                      : "palette.json",
                state.exportKind === "css" || state.exportKind === "tailwind"
                  ? "text/css;charset=utf-8"
                  : "application/json;charset=utf-8",
                notify,
              )
            }
          >
            <Download size={14} />
            {t("color.export.download")}
          </button>
        </div>
      </div>
      <div className="pane-body export-body">
        <pre
          className="export-code"
          tabIndex={0}
          aria-label={t("color.export.preview")}
        >
          <code>{output}</code>
        </pre>
        <p className="pane-note">
          {t(`color.export.notes.${state.exportKind}`)}
        </p>
      </div>
    </section>
  );

  const contrast = (
    <section className="color-contrast" aria-labelledby="color-contrast-title">
      <div className="pane-head">
        <div className="pane-title">
          <span id="color-contrast-title">{t("color.contrast.title")}</span>
        </div>
        <span className="pane-role">WCAG 2</span>
        <div className="pane-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={swapPair}
            aria-label={t("color.contrast.swap")}
            title={t("color.contrast.swap")}
          >
            <ArrowRightLeft size={15} />
          </button>
        </div>
      </div>
      <div className="pane-body contrast-body">
        <div className="pair-fields">
          {(["foreground", "background", "canvas"] as PairKey[]).map((key) => (
            <div className="pair-field" key={key}>
              <label htmlFor={`color-pair-${key}`}>
                {t(`color.contrast.${key}`)}
              </label>
              <div className="input-swatch">
                <span
                  className={
                    "swatch-dot" + (key === "canvas" ? "" : " checker")
                  }
                  aria-hidden="true"
                >
                  <span style={{ background: toRgb(state.pair[key]) }} />
                </span>
                <input
                  id={`color-pair-${key}`}
                  className="input mono"
                  spellCheck={false}
                  maxLength={180}
                  value={state.pairDrafts[key]}
                  aria-invalid={!!pairErrors[key]}
                  aria-describedby={
                    pairErrors[key] ? `color-pair-${key}-error` : undefined
                  }
                  onChange={(event) => editPair(key, event.target.value)}
                />
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => useForPair(key)}
                aria-label={t("color.contrast.useSelectedTitle", {
                  name: selectedName,
                  role: roleName(key),
                })}
                title={t("color.contrast.useSelectedTitle", {
                  name: selectedName,
                  role: roleName(key),
                })}
              >
                <Pipette size={14} />
              </button>
              {pairErrors[key] && (
                <span
                  id={`color-pair-${key}-error`}
                  className="field-error"
                  role="status"
                >
                  {pairErrors[key]}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="color-ratio" aria-live="polite" aria-atomic="true">
          <strong>
            {decimal(pair.ratio)}
            <small>:1</small>
          </strong>
          <span>
            {invalidPair
              ? t("color.contrast.lastValid")
              : t("color.contrast.ratio")}
          </span>
        </div>
        <div className="checks" style={previewStyle}>
          <div className="check">
            <div className="check-head">
              <span>{t("color.contrast.body")}</span>
              <span className="check-verdicts">
                <Verdict passes={pair.normalAA} threshold="AA 4.5" />
                <Verdict passes={pair.normalAAA} threshold="AAA 7" />
              </span>
            </div>
            <div className="check-sample sample-body">
              {t("color.contrast.bodySample")}
            </div>
          </div>
          <div className="check">
            <div className="check-head">
              <span>{t("color.contrast.large")}</span>
              <Verdict passes={pair.largeAA} threshold="AA 3" />
            </div>
            <div className="check-sample sample-large">
              {t("color.contrast.largeSample")}
            </div>
          </div>
          <div className="check">
            <div className="check-head">
              <span>{t("color.contrast.ui")}</span>
              <Verdict passes={pair.boundary} threshold="3" />
            </div>
            <div className="check-sample sample-ui">
              <span className="sample-input">
                <Search size={14} />
                {t("color.contrast.uiSample")}
              </span>
              <span className="sample-toggle" aria-hidden="true">
                <span />
              </span>
            </div>
          </div>
        </div>
        <div className="rendered">
          <span>
            {t("color.contrast.rendered", {
              fg: toHex(pair.foreground),
              bg: toHex(pair.background),
            })}
          </span>
          <span>
            {t("color.contrast.surface", { ratio: decimal(pair.surfaceRatio) })}
          </span>
        </div>
        <p className="pane-note">{t("color.contrast.note")}</p>
      </div>
    </section>
  );

  const mobileTabs: Pane[] = ["editor", "palette", "contrast", "export"];

  return (
    <div className="color-tool" data-pane={pane}>
      <div className="tool-bar">
        <label className="input-group vision-select">
          <span className="hide-narrow">{t("color.vision.label")}</span>
          <Select
            label={t("color.vision.label")}
            value={vision}
            onChange={setVision}
            options={VISIONS.map((v) => ({
              value: v,
              label: t(`color.vision.options.${v}`),
            }))}
          />
        </label>
        <button
          type="button"
          className="btn quiet"
          onClick={addColor}
          disabled={state.palette.length >= 12}
          aria-label={t("color.palette.add")}
          title={t("color.palette.add")}
        >
          <Plus size={15} />
          <span className="hide-narrow">{t("color.palette.add")}</span>
        </button>
        <span className="tool-bar-sep" />
        <label className="input-group">
          <span className="hide-narrow">{t("color.palette.harmony")}</span>
          <Select
            id="color-harmony"
            label={t("color.palette.harmony")}
            value={state.harmony}
            onChange={(harmony) => setSaved((s) => ({ ...s, harmony }))}
            options={HARMONIES.map((value) => ({
              value,
              label: t(`color.palette.harmonies.${value}`),
            }))}
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={makeHarmony}
          disabled={generatedSlots === 0}
          title={t("color.palette.generateHint")}
          aria-label={t("color.palette.generate")}
        >
          <Sparkles size={15} />
          <span className="hide-narrow">{t("color.palette.generate")}</span>
        </button>
      </div>
      {narrow && (
        <div
          className="mobile-panes"
          role="tablist"
          aria-label={t("color.panes.mobileLabel")}
        >
          {mobileTabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="pane-tab"
              aria-selected={pane === id}
              onClick={() => setPane(id)}
            >
              {t(`color.panes.${id}`)}
            </button>
          ))}
        </div>
      )}
      {vision !== "normal" && (
        <div className="notice warn vision-notice" role="status">
          <Eye size={14} />
          <span>
            {t("color.vision.notice", {
              vision: t(`color.vision.options.${vision}`).toLowerCase(),
            })}
          </span>
        </div>
      )}
      <div className="color-body">
        <div className="color-col color-col-editor">{editor}</div>
        <div className="color-col color-col-center">
          {narrow ? (
            pane === "export" ? (
              exporter
            ) : (
              palette
            )
          ) : (
            <SplitPane
              id="color.export"
              direction="column"
              initial={0.62}
              min={0.3}
              max={0.85}
              label={t("color.export.title")}
              first={palette}
              second={exporter}
            />
          )}
        </div>
        <div className="color-col color-col-contrast">{contrast}</div>
      </div>
      <footer className="statusbar" aria-label={t("color.heading")}>
        <span className="status-swatch">
          <span className="swatch-dot checker" aria-hidden="true">
            <span style={{ background: shown(selected.color) }} />
          </span>
          {selectedName}
        </span>
        <span className="mono">{toHex(selected.color)}</span>
        <span className="hide-narrow">
          {t("color.status.alpha", { value: num(alphaPercent) })}
        </span>
        <span className={pair.normalAA ? "status-ok" : "status-warn"}>
          {t("color.status.ratio", { ratio: decimal(pair.ratio) })}
        </span>
        <span className="push hide-narrow">
          {t("color.status.colors", { count: state.palette.length })}
        </span>
        <span className="hide-narrow">sRGB</span>
      </footer>
    </div>
  );
}
