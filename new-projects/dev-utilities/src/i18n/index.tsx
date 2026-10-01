import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type Messages, type Plural } from "./en";
import { ru } from "./ru";
import { detectLang, writePrefs, type Lang } from "../prefs";

const dictionaries: Record<Lang, Messages> = { en, ru };

type Leaf = string | Plural;
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends Leaf
    ? `${P}${K}`
    : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Messages>;
export type Params = Record<string, string | number>;

let current: Lang = typeof navigator === "undefined" ? "en" : detectLang();

function lookup(lang: Lang, key: string): Leaf | undefined {
  let node: unknown = dictionaries[lang];
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node as Leaf | undefined;
}

export function formatNumber(value: number, lang: Lang = current) {
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(value);
}

export function formatBytes(bytes: number, lang: Lang = current) {
  const units =
    lang === "ru" ? ["Б", "КБ", "МБ", "ГБ"] : ["B", "KB", "MB", "GB"];
  let value = bytes,
    unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  const number = new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: digits,
  }).format(value);
  return `${number} ${units[unit]}`;
}

export function translate(
  key: MessageKey,
  params: Params = {},
  lang = current,
) {
  const entry = lookup(lang, key) ?? lookup("en", key);
  if (entry === undefined) return key;
  let text: string;
  if (typeof entry === "string") text = entry;
  else {
    const count = Number(params.count ?? 0);
    const form = new Intl.PluralRules(lang).select(count) as keyof Plural;
    text = entry[form] ?? entry.other;
  }
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) return `{${name}}`;
    return typeof value === "number" ? formatNumber(value, lang) : value;
  });
}

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, params?: Params) => string;
  num: (value: number) => string;
  bytes: (value: number) => string;
};

const Context = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);
  current = lang;
  const setLang = useCallback((next: Lang) => {
    current = next;
    document.documentElement.lang = next;
    writePrefs({ lang: next });
    setLangState(next);
  }, []);
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, params) => translate(key, params, lang),
      num: (v) => formatNumber(v, lang),
      bytes: (v) => formatBytes(v, lang),
    }),
    [lang, setLang],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n() {
  const value = useContext(Context);
  if (!value) throw Error("useI18n outside I18nProvider");
  return value;
}
