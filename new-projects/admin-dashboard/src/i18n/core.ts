// Key-based dictionaries. English defines the shape; Russian must match it
// (checked by TypeScript and by scripts/check-i18n.mjs for plural forms).

export type Locale = "ru" | "en";
export type Plural = { one: string; few?: string; many?: string; other: string };
export type Params = Record<string, string | number>;

type Leaf = string | Plural;
export type DictionaryShape<T> = { [K in keyof T]: T[K] extends Leaf ? (T[K] extends string ? string : Plural) : DictionaryShape<T[K]> };

type Join<A extends string, B extends string> = `${A}.${B}`;
export type Path<T> = {
  [K in keyof T & string]: T[K] extends Leaf ? K : Join<K, Path<T[K]>>;
}[keyof T & string];

export function isPlural(value: unknown): value is Plural {
  return typeof value === "object" && value !== null && "other" in value && "one" in value;
}

export function lookup(dictionary: unknown, key: string): Leaf | undefined {
  let node: unknown = dictionary;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" || isPlural(node) ? node : undefined;
}

export type Formatters = {
  money: (value: number) => string;
  number: (value: number) => string;
  date: (value: string) => string;
  time: (value: string) => string;
};

const placeholder = /\{(\w+)(?::(\w+))?\}/g;

export function interpolate(template: string, params: Params | undefined, format: Formatters) {
  if (!params) return template;
  return template.replace(placeholder, (match, name: string, kind?: string) => {
    const value = params[name];
    if (value === undefined) return match;
    if (kind === "money") return format.money(Number(value));
    if (kind === "number") return format.number(Number(value));
    if (kind === "date") return format.date(String(value));
    if (kind === "time") return format.time(String(value));
    return typeof value === "number" ? format.number(value) : value;
  });
}

export function selectPlural(entry: Plural, count: number, rules: Intl.PluralRules) {
  const form = rules.select(count) as keyof Plural;
  return entry[form] ?? entry.other;
}
