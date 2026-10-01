import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { translate } from "./i18n";
import { STORAGE_PREFIX } from "./prefs";
export { STORAGE_PREFIX };
export type ToolProps = { notify: (message: string) => void };
export async function copyText(text: string, notify: ToolProps["notify"]) {
  try {
    await navigator.clipboard.writeText(text);
    notify(translate("common.copied"));
  } catch {
    notify(translate("common.clipboardFailed"));
  }
}
export function downloadBlob(
  blob: Blob,
  name: string,
  notify?: ToolProps["notify"],
) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify?.(translate("common.downloadStarted", { name }));
}
export function downloadText(
  text: string,
  name: string,
  type = "text/plain;charset=utf-8",
  notify?: ToolProps["notify"],
) {
  downloadBlob(new Blob([text], { type }), name, notify);
}
export function storageEnabled() {
  try {
    return localStorage.getItem(STORAGE_PREFIX + "enabled") === "true";
  } catch {
    return false;
  }
}
export function useSessionState<T>(
  key: string,
  initial: T | (() => T),
  validate?: (value: unknown) => boolean,
): [T, Dispatch<SetStateAction<T>>] {
  const [enabled, setEnabled] = useState(storageEnabled);
  const [value, setValue] = useState<T>(() => {
    const fallback =
      typeof initial === "function" ? (initial as () => T)() : initial;
    const matches = (candidate: any, template: any): boolean => {
      if (template === null) return candidate === null;
      if (Array.isArray(template))
        return (
          Array.isArray(candidate) &&
          (!template.length || candidate.every((v) => matches(v, template[0])))
        );
      if (typeof template === "object")
        return (
          !!candidate &&
          typeof candidate === "object" &&
          !Array.isArray(candidate) &&
          Object.keys(template).every(
            (k) =>
              Object.hasOwn(candidate, k) && matches(candidate[k], template[k]),
          )
        );
      return typeof candidate === typeof template;
    };
    if (storageEnabled()) {
      try {
        const stored = localStorage.getItem(STORAGE_PREFIX + key);
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (validate ? validate(parsed) : matches(parsed, fallback))
            return parsed;
        }
      } catch {}
    }
    return fallback;
  });
  useEffect(() => {
    const changed = () => setEnabled(storageEnabled());
    window.addEventListener("du-storage", changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("du-storage", changed);
      window.removeEventListener("storage", changed);
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      if (!storageEnabled()) return;
      try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      } catch {
        window.dispatchEvent(new CustomEvent("du-storage-error"));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [value, enabled, key]);
  return [value, setValue];
}
