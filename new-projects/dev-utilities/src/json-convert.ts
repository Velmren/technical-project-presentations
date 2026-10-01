import { stringify as stringifyYaml } from "yaml";
import type { Node } from "jsonc-parser";
import {
  CoreError,
  documentTree,
  normalizedDecimal,
  pointerParts,
} from "./json-core";

// Exact value tree: objects are Maps (any key, including __proto__, in source
// order), numbers keep their source token.
export class Exact {
  constructor(readonly raw: string) {}
}
export type Value =
  | string
  | boolean
  | null
  | Exact
  | Value[]
  | Map<string, Value>;

const fail = (
  code: string,
  message: string,
  params?: Record<string, string | number>,
) => new CoreError(code, message, params);

function build(text: string, node: Node): Value {
  if (node.type === "number")
    return new Exact(text.slice(node.offset, node.offset + node.length));
  if (node.type === "array")
    return (node.children || []).map((child) => build(text, child));
  if (node.type === "object") {
    const map = new Map<string, Value>();
    for (const prop of node.children || [])
      map.set(
        prop.children![0].value as string,
        build(text, prop.children![1]),
      );
    return map;
  }
  return node.value as string | boolean | null;
}

// Parses the source and returns the exact value at a JSON Pointer (root by default).
export function exactAt(text: string, pointer = ""): Value {
  const { node, duplicates } = documentTree(text);
  if (duplicates.length)
    throw fail("DuplicateKeys", "Duplicate object keys make this ambiguous.");
  let value = build(text, node);
  for (const part of pointerParts(pointer)) {
    if (
      Array.isArray(value) &&
      /^(0|[1-9]\d*)$/.test(part) &&
      Number(part) < value.length
    )
      value = value[Number(part)];
    else if (value instanceof Map && value.has(part)) value = value.get(part)!;
    else throw fail("NoValue", `No value exists at ${pointer}.`, { pointer });
  }
  return value;
}

export function serialize(value: Value, indent = 2, depth = 0): string {
  const pad = (n: number) => (indent ? "\n" + " ".repeat(indent * n) : "");
  const sep = indent ? ": " : ":";
  if (value instanceof Exact) return value.raw;
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return (
      "[" +
      value
        .map((item) => pad(depth + 1) + serialize(item, indent, depth + 1))
        .join(",") +
      pad(depth) +
      "]"
    );
  }
  if (value instanceof Map) {
    if (!value.size) return "{}";
    return (
      "{" +
      [...value]
        .map(
          ([key, item]) =>
            pad(depth + 1) +
            JSON.stringify(key) +
            sep +
            serialize(item, indent, depth + 1),
        )
        .join(",") +
      pad(depth) +
      "}"
    );
  }
  return JSON.stringify(value);
}

/* YAML ------------------------------------------------------------------ */

// Numbers go through the YAML library as unique placeholders and are put back
// as their exact source tokens, so no digit is ever rounded.
export function toYaml(value: Value): string {
  const numbers: string[] = [];
  let nonce = Math.random().toString(36).slice(2, 10);
  const mark = (i: number) => `@@${nonce}n${i}@@`;
  const plain = (v: Value): unknown => {
    if (v instanceof Exact) {
      numbers.push(v.raw);
      return mark(numbers.length - 1);
    }
    if (Array.isArray(v)) return v.map(plain);
    if (v instanceof Map)
      return new Map([...v].map(([k, item]) => [k, plain(item)]));
    return v;
  };
  const data = plain(value);
  let text = stringifyYaml(data, { compat: "yaml-1.1", lineWidth: 0 });
  if (numbers.some((_, i) => text.split(mark(i)).length !== 2)) {
    // A string in the document contained the placeholder; retry with another nonce.
    nonce += "x";
    return toYaml(value);
  }
  text = text.replace(
    new RegExp(`"@@${nonce}n(\\d+)@@"|@@${nonce}n(\\d+)@@`, "g"),
    (_, a, b) => numbers[Number(a ?? b)],
  );
  return text;
}

/* CSV ------------------------------------------------------------------- */

function cell(value: Value | undefined): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Exact) return value.raw;
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return String(value);
  return serialize(value, 0);
}

// Nested keys become dotted column names. Two paths that end up with the same
// name (a key "a.b" next to a.b) would lose a value, so that stops the export.
function flatten(value: Value, prefix: string, into: Map<string, Value>) {
  if (value instanceof Map && value.size) {
    for (const [key, item] of value)
      flatten(item, prefix ? `${prefix}.${key}` : key, into);
    return;
  }
  const column = prefix || "value";
  if (into.has(column))
    throw fail(
      "CsvColumnClash",
      `Two fields map to the CSV column ${column}.`,
      { column },
    );
  into.set(column, value);
}

export function toCsv(value: Value, delimiter = ","): string {
  if (!Array.isArray(value))
    throw fail(
      "CsvNeedsArray",
      "CSV needs an array. Point the source at an array.",
    );
  const rows = value.map((item) => {
    const row = new Map<string, Value>();
    if (item instanceof Map) flatten(item, "", row);
    else row.set("value", item);
    return row;
  });
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows)
    for (const key of row.keys())
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
  const quote = (text: string) =>
    text.includes(delimiter) || /["\r\n]/.test(text) || /^\s|\s$/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  return (
    [columns.map(quote).join(delimiter)]
      .concat(
        rows.map((row) =>
          columns.map((c) => quote(cell(row.get(c)))).join(delimiter),
        ),
      )
      .join("\r\n") + "\r\n"
  );
}

/* Shape inference for TypeScript and JSON Schema ------------------------ */

type Primitive = "string" | "integer" | "number" | "boolean" | "null";
type Shape = {
  primitives: Set<Primitive>;
  // String formats that every string seen so far matches; null before the first string.
  formats: string[] | null;
  unsafe: boolean;
  object?: {
    fields: Map<string, { shape: Shape; count: number }>;
    count: number;
  };
  array?: { items: Shape; empty: boolean };
};
const emptyShape = (): Shape => ({
  primitives: new Set(),
  formats: null,
  unsafe: false,
});

function isInteger(raw: string) {
  return /^-?\d+$/.test(raw);
}

function observe(shape: Shape, value: Value) {
  if (value === null) shape.primitives.add("null");
  else if (typeof value === "boolean") shape.primitives.add("boolean");
  else if (typeof value === "string") {
    shape.primitives.add("string");
    shape.formats = (shape.formats ?? formats.map(([name]) => name)).filter(
      (name) => formats.find(([n]) => n === name)![1].test(value),
    );
  } else if (value instanceof Exact) {
    shape.primitives.add(isInteger(value.raw) ? "integer" : "number");
    const n = Number(value.raw);
    if (
      !Number.isFinite(n) ||
      (isInteger(value.raw) && !Number.isSafeInteger(n))
    )
      shape.unsafe = true;
  } else if (Array.isArray(value)) {
    shape.array ??= { items: emptyShape(), empty: true };
    for (const item of value) {
      shape.array.empty = false;
      observe(shape.array.items, item);
    }
  } else {
    shape.object ??= { fields: new Map(), count: 0 };
    shape.object.count++;
    for (const [key, item] of value) {
      const field = shape.object.fields.get(key) ?? {
        shape: emptyShape(),
        count: 0,
      };
      field.count++;
      observe(field.shape, item);
      shape.object.fields.set(key, field);
    }
  }
}

export function inferShape(value: Value) {
  const shape = emptyShape();
  observe(shape, value);
  return shape;
}

const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function typeName(key: string, used: Set<string>) {
  const words = key
    .replace(/s$/i, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let base =
    words.map((w) => w[0].toUpperCase() + w.slice(1)).join("") || "Item";
  if (/^\d/.test(base)) base = "T" + base;
  let name = base,
    i = 2;
  while (used.has(name)) name = base + i++;
  used.add(name);
  return name;
}

export function toTypeScript(value: Value, rootName = "Root"): string {
  const shape = inferShape(value);
  const used = new Set<string>();
  const blocks: string[] = [];
  // Capitalized like the other type names, which also keeps it clear of
  // reserved words and built-in type names (class, string).
  const root = identifier.test(rootName)
    ? rootName[0].toUpperCase() + rootName.slice(1)
    : "Root";
  used.add(root);

  const expr = (s: Shape, hint: string, isRoot = false): string => {
    const parts: string[] = [];
    if (s.object) {
      const name = isRoot ? root : typeName(hint, used);
      // Reserve the slot first so interfaces appear in document order.
      const slot = blocks.push("") - 1;
      const lines = [...s.object.fields].map(([key, field]) => {
        const optional = field.count < s.object!.count ? "?" : "";
        const note = field.shape.unsafe
          ? "  /** Beyond double precision in the sample; consider string or bigint. */\n"
          : "";
        return `${note}  ${identifier.test(key) ? key : JSON.stringify(key)}${optional}: ${expr(field.shape, key)};`;
      });
      blocks[slot] = `export interface ${name} {\n${lines.join("\n")}\n}`;
      parts.push(name);
    }
    if (s.array) {
      const inner = s.array.empty
        ? "unknown"
        : expr(s.array.items, isRoot ? root + "Item" : hint);
      parts.push(inner.includes(" | ") ? `(${inner})[]` : `${inner}[]`);
    }
    const map: Record<Primitive, string> = {
      string: "string",
      integer: "number",
      number: "number",
      boolean: "boolean",
      null: "null",
    };
    for (const p of new Set([...s.primitives].map((x) => map[x])))
      parts.push(p);
    return parts.join(" | ") || "unknown";
  };

  const top = expr(shape, root, true);
  if (!shape.object) blocks.unshift(`export type ${root} = ${top};`);
  return blocks.join("\n\n") + "\n";
}

const formats: [string, RegExp][] = [
  [
    "date-time",
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  ],
  ["date", /^\d{4}-\d{2}-\d{2}$/],
  ["email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/],
  ["uri", /^https?:\/\/[^\s]+$/],
];

function schemaOf(s: Shape): Record<string, unknown> {
  const options: Record<string, unknown>[] = [];
  if (s.object) {
    // No prototype: a "__proto__" key must become a real property.
    const properties: Record<string, unknown> = Object.create(null);
    const required: string[] = [];
    for (const [key, field] of s.object.fields) {
      properties[key] = schemaOf(field.shape);
      if (field.count === s.object.count) required.push(key);
    }
    options.push({
      type: "object",
      properties,
      ...(required.length ? { required } : {}),
    });
  }
  if (s.array)
    options.push(
      s.array.empty
        ? { type: "array" }
        : { type: "array", items: schemaOf(s.array.items) },
    );
  const prims = new Set(s.primitives);
  if (prims.has("integer") && prims.has("number")) prims.delete("integer");
  const types = [...prims];
  if (types.length) {
    const entry: Record<string, unknown> = {
      type: types.length === 1 ? types[0] : types,
    };
    if (types.length === 1 && types[0] === "string" && s.formats?.length)
      entry.format = s.formats[0];
    options.push(entry);
  }
  if (!options.length) return {};
  return options.length === 1 ? options[0] : { anyOf: options };
}

export function toJsonSchema(value: Value, title = "Root"): string {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title,
    ...schemaOf(inferShape(value)),
  };
  return JSON.stringify(schema, null, 2) + "\n";
}

/* JSON Patch (RFC 6902) on the exact tree -------------------------------- */

function clone(value: Value): Value {
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Map)
    return new Map([...value].map(([k, v]) => [k, clone(v)]));
  return value;
}

function equal(a: Value, b: Value): boolean {
  if (a instanceof Exact && b instanceof Exact)
    return normalizedDecimal(a.raw) === normalizedDecimal(b.raw);
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, i) => equal(item, b[i]));
  if (a instanceof Map && b instanceof Map)
    return (
      a.size === b.size &&
      [...a].every(([k, v]) => b.has(k) && equal(v, b.get(k)!))
    );
  return a === b;
}

type Op = {
  op: string;
  path: string;
  from?: string;
  value?: Value;
  hasValue: boolean;
};

function readOps(patch: Value): Op[] {
  if (!Array.isArray(patch))
    throw fail("PatchNotArray", "A JSON Patch is an array of operations.");
  return patch.map((entry, index) => {
    const bad = (problem: string, detail: string) =>
      fail("PatchOperation", `Operation ${index + 1}: ${detail}`, {
        index: index + 1,
        problem,
      });
    if (!(entry instanceof Map)) throw bad("notObject", "not an object");
    const op = entry.get("op");
    const path = entry.get("path");
    if (
      typeof op !== "string" ||
      !["add", "remove", "replace", "move", "copy", "test"].includes(op)
    )
      throw bad("unknownOp", "unknown op");
    if (typeof path !== "string") throw bad("noPath", "missing path");
    const from = entry.get("from");
    if ((op === "move" || op === "copy") && typeof from !== "string")
      throw bad("noFrom", "missing from");
    const hasValue = entry.has("value");
    if ((op === "add" || op === "replace" || op === "test") && !hasValue)
      throw bad("noValue", "missing value");
    return {
      op,
      path,
      from: from as string | undefined,
      value: entry.get("value"),
      hasValue,
    };
  });
}

function parentOf(root: Value, pointer: string, index: number) {
  const parts = pointerParts(pointer);
  if (!parts.length) return { parent: null as Value | null, key: "" };
  let parent = root;
  for (const part of parts.slice(0, -1)) {
    if (
      Array.isArray(parent) &&
      /^(0|[1-9]\d*)$/.test(part) &&
      Number(part) < parent.length
    )
      parent = parent[Number(part)];
    else if (parent instanceof Map && parent.has(part))
      parent = parent.get(part)!;
    else
      throw fail(
        "PatchPath",
        `Operation ${index}: path ${pointer} does not exist.`,
        { index, pointer },
      );
  }
  return { parent, key: parts[parts.length - 1] };
}

function getAt(root: Value, pointer: string, index: number): Value {
  const { parent, key } = parentOf(root, pointer, index);
  if (parent === null) return root;
  if (
    Array.isArray(parent) &&
    /^(0|[1-9]\d*)$/.test(key) &&
    Number(key) < parent.length
  )
    return parent[Number(key)];
  if (parent instanceof Map && parent.has(key)) return parent.get(key)!;
  throw fail(
    "PatchPath",
    `Operation ${index}: path ${pointer} does not exist.`,
    { index, pointer },
  );
}

function removeAt(root: Value, pointer: string, index: number): Value {
  const { parent, key } = parentOf(root, pointer, index);
  if (parent === null)
    throw fail("PatchRoot", `Operation ${index}: the root cannot be removed.`, {
      index,
    });
  if (
    Array.isArray(parent) &&
    /^(0|[1-9]\d*)$/.test(key) &&
    Number(key) < parent.length
  )
    return parent.splice(Number(key), 1)[0];
  if (parent instanceof Map && parent.has(key)) {
    const old = parent.get(key)!;
    parent.delete(key);
    return old;
  }
  throw fail(
    "PatchPath",
    `Operation ${index}: path ${pointer} does not exist.`,
    { index, pointer },
  );
}

function addAt(
  root: Value,
  pointer: string,
  value: Value,
  index: number,
): Value {
  const { parent, key } = parentOf(root, pointer, index);
  if (parent === null) return value;
  if (Array.isArray(parent)) {
    if (key === "-") parent.push(value);
    else if (/^(0|[1-9]\d*)$/.test(key) && Number(key) <= parent.length)
      parent.splice(Number(key), 0, value);
    else
      throw fail(
        "PatchPath",
        `Operation ${index}: index ${key} is out of range.`,
        { index, pointer },
      );
  } else if (parent instanceof Map) parent.set(key, value);
  else
    throw fail(
      "PatchPath",
      `Operation ${index}: path ${pointer} does not exist.`,
      { index, pointer },
    );
  return root;
}

export function applyPatch(text: string, patchText: string, indent = 2) {
  let root = exactAt(text);
  let patch: Value;
  try {
    patch = exactAt(patchText);
  } catch (e) {
    const error = e as CoreError;
    if (error.code === "DuplicateKeys")
      throw fail(
        "PatchDuplicates",
        "The patch repeats a key inside one object, so its meaning is ambiguous.",
      );
    throw fail("PatchInvalid", `Patch: ${error.message}`, {
      detailCode: error.code || "Unknown",
    });
  }
  const ops = readOps(patch);
  ops.forEach((op, i) => {
    const index = i + 1;
    if (op.op === "add") root = addAt(root, op.path, clone(op.value!), index);
    else if (op.op === "remove") removeAt(root, op.path, index);
    else if (op.op === "replace") {
      getAt(root, op.path, index);
      const { parent, key } = parentOf(root, op.path, index);
      // Replace in place, so an object key keeps its position.
      if (parent === null) root = clone(op.value!);
      else if (Array.isArray(parent)) parent[Number(key)] = clone(op.value!);
      else (parent as Map<string, Value>).set(key, clone(op.value!));
    } else if (op.op === "move") {
      getAt(root, op.from!, index);
      // RFC 6902 allows moving a value onto itself; nothing changes.
      if (op.from === op.path) return;
      if (op.path.startsWith(op.from! + "/"))
        throw fail(
          "PatchMove",
          `Operation ${index}: a value cannot move into itself.`,
          { index },
        );
      const value = removeAt(root, op.from!, index);
      root = addAt(root, op.path, value, index);
    } else if (op.op === "copy") {
      root = addAt(root, op.path, clone(getAt(root, op.from!, index)), index);
    } else if (!equal(getAt(root, op.path, index), op.value!))
      throw fail(
        "PatchTest",
        `Operation ${index}: test failed at ${op.path}.`,
        {
          index,
          pointer: op.path,
        },
      );
  });
  return { text: serialize(root, indent) + "\n", operations: ops.length };
}

export function convert(
  text: string,
  format: "yaml" | "csv" | "typescript" | "schema",
  options: { pointer?: string; delimiter?: string; name?: string } = {},
) {
  const value = exactAt(text, options.pointer || "");
  const name =
    options.name ||
    (options.pointer ? pointerParts(options.pointer).pop() || "Root" : "Root");
  if (format === "yaml") return toYaml(value);
  if (format === "csv") return toCsv(value, options.delimiter || ",");
  if (format === "typescript")
    return toTypeScript(value, options.name || "Root");
  return toJsonSchema(value, name);
}
