import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { now } from "../data/clock";
import type { Text } from "../data/types";
import { interpolate, isPlural, lookup, selectPlural, type Locale, type Params, type Path } from "./core";
import { en } from "./en";
import { ru } from "./ru";

export type { Locale } from "./core";
export type Key = Path<typeof en>;

const dictionaries = { en, ru };
const storageKey = "orbit-locale";

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(storageKey) ?? localStorage.getItem("orbit-locale-v4");
    if (saved === "en" || saved === "ru") return saved;
  } catch {
    /* Storage can be blocked; the default language still works. */
  }
  return "ru";
}

type LocaleState = { locale: Locale; setLocale: (locale: Locale) => void; timezone: string; setTimezone: (zone: string) => void };
const LocaleContext = createContext<LocaleState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [timezone, setTimezone] = useState("Europe/Dublin");
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(storageKey, locale);
    } catch {
      /* The choice still applies for this session. */
    }
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, timezone, setTimezone }), [locale, timezone]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleState() {
  const state = useContext(LocaleContext);
  if (!state) throw new Error("useLocaleState must be used inside I18nProvider.");
  return state;
}

function createTranslator(locale: Locale, timezone: string) {
  const tag = locale === "ru" ? "ru-RU" : "en-GB";
  const dictionary = dictionaries[locale];
  const plural = new Intl.PluralRules(tag);
  const numberFormat = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const integerFormat = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const moneyCents = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-IE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const moneyWhole = new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const moneyCompact = new Intl.NumberFormat(tag, { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 });
  const compactFormat = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 });
  const percentFormat = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 1 });
  const dayMonth = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: timezone });
  const dayMonthYear = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: timezone });
  const monthYear = new Intl.DateTimeFormat(tag, { month: "short", year: "numeric", timeZone: timezone });
  const monthOnly = new Intl.DateTimeFormat(tag, { month: "short", timeZone: timezone });
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: timezone });
  const clock = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  const localDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone });

  const parse = (value: string) => new Date(value.length === 10 ? value + "T12:00:00Z" : value);
  // Whole amounts read cleaner without ",00"; amounts with cents always show both digits.
  const money = (value: number) => (Math.abs(value - Math.round(value)) < 0.005 ? moneyWhole.format(value) : moneyCents.format(value));
  const format = {
    money,
    number: (value: number) => (Number.isInteger(value) ? integerFormat.format(value) : numberFormat.format(value)),
    date: (value: string) => dayMonth.format(parse(value)),
    time: (value: string) => clock.format(parse(value)),
  };

  // A parameter written as "@some.key" is itself translated, e.g. an order status inside an error.
  const resolveParams = (params?: Params) => {
    if (!params) return params;
    const resolved: Params = {};
    for (const [name, value] of Object.entries(params)) resolved[name] = typeof value === "string" && value.startsWith("@") ? t(value.slice(1) as Key) : value;
    return resolved;
  };
  const t = (key: Key, params?: Params): string => {
    const entry = lookup(dictionary, key) ?? lookup(en, key);
    if (entry === undefined) return key;
    const template = isPlural(entry) ? selectPlural(entry, Number(params?.count ?? 0), plural) : entry;
    return interpolate(template, params, format);
  };
  // Generated records store a key; records written by people store plain text.
  const tx = (text: Text | undefined): string => {
    if (text === undefined) return "";
    if (typeof text === "string") return text;
    return t(text.key as Key, resolveParams(text.params));
  };
  const has = (key: string) => lookup(dictionary, key) !== undefined;

  const dayKey = (value: string) => localDay.format(parse(value));
  const relative = (value: string) => {
    const at = parse(value).getTime();
    const current = Date.parse(now());
    const minutes = Math.floor((current - at) / 60_000);
    if (minutes < 1) return t("common.justNow");
    if (minutes < 60) return t("common.minutesAgo", { count: minutes });
    const today = dayKey(new Date(current).toISOString());
    const yesterday = dayKey(new Date(current - 86_400_000).toISOString());
    const day = dayKey(value);
    if (day === today) return minutes < 360 ? t("common.hoursAgo", { count: Math.floor(minutes / 60) }) : t("common.atTime", { day: t("common.today"), time: clock.format(parse(value)) });
    if (day === yesterday) return t("common.atTime", { day: t("common.yesterday"), time: clock.format(parse(value)) });
    // Dates from another year keep the year, so last August is not mistaken for this one.
    return day.slice(0, 4) === today.slice(0, 4) ? dayMonth.format(parse(value)) : dayMonthYear.format(parse(value));
  };
  const stamp = (value: string) => {
    const current = Date.parse(now());
    const day = dayKey(value);
    if (day === dayKey(new Date(current).toISOString())) return t("common.atTime", { day: t("common.today"), time: clock.format(parse(value)) });
    if (day === dayKey(new Date(current - 86_400_000).toISOString())) return t("common.atTime", { day: t("common.yesterday"), time: clock.format(parse(value)) });
    return `${dayMonthYear.format(parse(value))}, ${clock.format(parse(value))}`;
  };

  // A heading for a group of items from one day: "Today", "Yesterday", "27 Sept".
  const dayLabel = (value: string) => {
    const current = Date.parse(now());
    const day = dayKey(value);
    if (day === dayKey(new Date(current).toISOString())) return t("common.today");
    if (day === dayKey(new Date(current - 86_400_000).toISOString())) return t("common.yesterday");
    return day.slice(0, 4) === dayKey(new Date(current).toISOString()).slice(0, 4) ? dayMonth.format(parse(value)) : dayMonthYear.format(parse(value));
  };

  // For use inside a sentence: "placed today at 14:17".
  const inline = (value: string) => {
    const current = Date.parse(now());
    const day = dayKey(value);
    const time = clock.format(parse(value));
    if (day === dayKey(new Date(current).toISOString())) return t("common.todayAt", { time });
    if (day === dayKey(new Date(current - 86_400_000).toISOString())) return t("common.yesterdayAt", { time });
    const sameYear = day.slice(0, 4) === dayKey(new Date(current).toISOString()).slice(0, 4);
    return t("common.dateAt", { date: (sameYear ? dayMonth : dayMonthYear).format(parse(value)), time });
  };

  return {
    locale,
    tag,
    inline,
    t,
    tx,
    has,
    money,
    moneyCompact: (value: number) => moneyCompact.format(value),
    number: format.number,
    compact: (value: number) => compactFormat.format(value),
    percent: (value: number) => percentFormat.format(value),
    date: format.date,
    fullDate: (value: string) => dayMonthYear.format(parse(value)),
    monthYear: (value: string) => monthYear.format(parse(value)),
    month: (value: string) => monthOnly.format(parse(value)),
    weekday: (value: string) => weekday.format(parse(value)),
    time: format.time,
    relative,
    stamp,
    dayLabel,
    dayKey,
  };
}

export type Translator = ReturnType<typeof createTranslator>;

// One translator per language and time zone for the whole app: building the Intl formatters is the expensive
// part, and a table row that asks for them must not pay for it again.
const translators = new Map<string, ReturnType<typeof createTranslator>>();
function translatorFor(locale: Locale, timezone: string) {
  const key = `${locale}|${timezone}`;
  let translator = translators.get(key);
  if (!translator) translators.set(key, (translator = createTranslator(locale, timezone)));
  return translator;
}

export function useI18n() {
  const { locale, setLocale, timezone } = useLocaleState();
  const translator = translatorFor(locale, timezone);
  const toggle = useCallback(() => setLocale(locale === "ru" ? "en" : "ru"), [locale, setLocale]);
  return useMemo(() => ({ ...translator, setLocale, toggleLocale: toggle }), [translator, setLocale, toggle]);
}
