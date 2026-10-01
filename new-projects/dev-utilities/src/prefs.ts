// Interface preferences (language, theme, pane sizes) are saved when the user
// changes them. They hold no document content, so they do not depend on the
// opt-in for drafts. Keys live under the same v3 prefix as drafts.
export const STORAGE_PREFIX = "velmren.du.v3.";
const LEGACY_PREFIX = "velmren.du.v2.";
const PREFS_KEY = STORAGE_PREFIX + "prefs";

export type Lang = "en" | "ru";
export type ThemePref = "system" | "light" | "dark";
export type Prefs = {
  lang?: Lang;
  theme?: ThemePref;
  splits?: Record<string, number>;
};

export function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const prefs: Prefs = {};
    if (raw.lang === "en" || raw.lang === "ru") prefs.lang = raw.lang;
    if (["system", "light", "dark"].includes(raw.theme))
      prefs.theme = raw.theme;
    if (raw.splits && typeof raw.splits === "object") {
      prefs.splits = {};
      for (const [key, value] of Object.entries(raw.splits))
        if (typeof value === "number" && value > 0.05 && value < 0.95)
          prefs.splits[key] = value;
    }
    return prefs;
  } catch {
    return {};
  }
}

export function writePrefs(patch: Prefs) {
  try {
    const next = { ...readPrefs(), ...patch };
    if (patch.splits) next.splits = { ...readPrefs().splits, ...patch.splits };
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Preferences are a convenience; the session keeps working without them.
  }
}

export function isPrefsKey(key: string) {
  return key === PREFS_KEY;
}

export function detectLang(): Lang {
  const stored = readPrefs().lang;
  if (stored) return stored;
  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return languages[0]?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// v2 stored consent and drafts under another prefix. Consent carries over;
// drafts do not, and malformed v2 values are never read.
export function migrateLegacyConsent() {
  try {
    if (
      localStorage.getItem(STORAGE_PREFIX + "enabled") === null &&
      localStorage.getItem(LEGACY_PREFIX + "enabled") === "true"
    )
      localStorage.setItem(STORAGE_PREFIX + "enabled", "true");
  } catch {}
}

export function ownedStorageKeys() {
  return Object.keys(localStorage).filter(
    (k) => k.startsWith(STORAGE_PREFIX) || k.startsWith(LEGACY_PREFIX),
  );
}
