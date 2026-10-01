import {
  createScanner,
  SyntaxKind,
  parseTree,
  printParseErrorCode,
  format,
  applyEdits,
  findNodeAtLocation,
  type Node,
  type ParseError,
} from "jsonc-parser";
import { isSafeNumber } from "lossless-json";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import localizeRu from "ajv-i18n/localize/ru";
export const JSON_LIMIT = 5 * 1024 * 1024;
export type Params = Record<string, string | number>;
// Messages stay in English for logs and tests; the interface translates by code.
export class CoreError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly params: Params = {},
  ) {
    super(message);
  }
}
const fail = (code: string, message: string, params?: Params) =>
  new CoreError(code, message, params);
export type JsonIssue = {
  message: string;
  code?: string;
  params?: Params;
  offset: number;
  length: number;
  line: number;
  column: number;
  path?: string;
};
export type TreeNode = {
  id: number;
  parent: number;
  path: string;
  key: string;
  type: string;
  preview: string;
  offset: number;
  length: number;
  children: number;
  depth: number;
};
export type Analysis = {
  valid: boolean;
  issues: JsonIssue[];
  warnings: string[];
  nodes: TreeNode[];
  nodeCount: number;
  maxDepth: number;
  rootType?: string;
  unsafeCount: number;
  duplicatePaths?: string[];
};
export function pointerEscape(s: string) {
  return s.replace(/~/g, "~0").replace(/\//g, "~1");
}
export function pointerParts(pointer: string) {
  if (pointer === "") return [];
  if (!pointer.startsWith("/"))
    throw fail(
      "PointerSyntax",
      "Use JSON Pointer: a path starts with /; empty selects the root.",
    );
  return pointer
    .slice(1)
    .split("/")
    .map((p) => {
      if (/~(?![01])/g.test(p))
        throw fail(
          "PointerEscape",
          "Invalid pointer escape. Use ~0 for ~ and ~1 for /.",
        );
      return p.replace(/~1/g, "/").replace(/~0/g, "~");
    });
}
function position(text: string, offset: number) {
  const start = text.slice(0, offset);
  const i = start.lastIndexOf("\n");
  return { line: (start.match(/\n/g) || []).length + 1, column: offset - i };
}
function preflight(text: string) {
  if (text.length > JSON_LIMIT)
    throw fail("TooLarge", "Document is too large. Limit: 5 MiB of text.");
  let depth = 0,
    maxDepth = 0,
    tokens = 0;
  const scanner = createScanner(text, true);
  let token;
  while ((token = scanner.scan()) !== SyntaxKind.EOF) {
    if (
      token === SyntaxKind.OpenBraceToken ||
      token === SyntaxKind.OpenBracketToken
    ) {
      depth++;
      maxDepth = Math.max(depth, maxDepth);
      if (depth > 256)
        throw fail(
          "TooDeep",
          "Document nesting exceeds 256 levels. Edit a smaller section first.",
        );
    }
    if (
      token === SyntaxKind.CloseBraceToken ||
      token === SyntaxKind.CloseBracketToken
    )
      depth--;
    if (++tokens > 600000)
      throw fail(
        "TooManyTokens",
        "Document has too many tokens. Limit: 600,000.",
      );
  }
  return maxDepth;
}
function root(text: string) {
  preflight(text);
  const errors: ParseError[] = [];
  const node = parseTree(text, errors, {
    allowTrailingComma: false,
    disallowComments: true,
    allowEmptyContent: false,
  });
  return { node, errors };
}
function issue(text: string, error: ParseError): JsonIssue {
  return {
    message: printParseErrorCode(error.error).replace(
      /([a-z])([A-Z])/g,
      "$1 $2",
    ),
    code: printParseErrorCode(error.error),
    offset: error.offset,
    length: Math.max(error.length, 1),
    ...position(text, error.offset),
  };
}
function semanticCheck(text: string, node: Node) {
  let count = 0,
    unsafe = 0,
    duplicate: string[] = [];
  const stack = [{ node, path: "", depth: 0 }];
  let maxDepth = 0;
  while (stack.length) {
    const next = stack.pop()!;
    count++;
    maxDepth = Math.max(maxDepth, next.depth);
    if (count > 100000)
      throw fail(
        "TooManyValues",
        "Document has more than 100,000 values. Split it into smaller documents.",
      );
    if (
      next.node.type === "number" &&
      (!isSafeNumber(
        text.slice(next.node.offset, next.node.offset + next.node.length),
      ) ||
        Math.abs(
          Number(
            text.slice(next.node.offset, next.node.offset + next.node.length),
          ),
        ) > Number.MAX_SAFE_INTEGER)
    )
      unsafe++;
    if (next.node.type === "object") {
      const keys = new Set<string>();
      for (const prop of next.node.children || []) {
        const key = prop.children![0].value as string;
        const path = next.path + "/" + pointerEscape(key);
        if (keys.has(key)) duplicate.push(path);
        keys.add(key);
        stack.push({ node: prop.children![1], path, depth: next.depth + 1 });
      }
    } else if (next.node.type === "array") {
      (next.node.children || []).forEach((child, i) =>
        stack.push({
          node: child,
          path: next.path + "/" + i,
          depth: next.depth + 1,
        }),
      );
    }
  }
  return { count, unsafe, duplicate, maxDepth };
}
export function analyze(text: string, query = ""): Analysis {
  if (!text.trim())
    return {
      valid: false,
      issues: [
        {
          message:
            "Document is empty. Add a JSON value, including null, false, or an empty array.",
          code: "Empty",
          offset: 0,
          length: 0,
          line: 1,
          column: 1,
        },
      ],
      warnings: [],
      nodes: [],
      nodeCount: 0,
      maxDepth: 0,
      unsafeCount: 0,
    };
  try {
    const { node, errors } = root(text);
    if (errors.length || !node)
      return {
        valid: false,
        issues: errors.slice(0, 30).map((e) => issue(text, e)),
        warnings: [],
        nodes: [],
        nodeCount: 0,
        maxDepth: 0,
        unsafeCount: 0,
      };
    const info = semanticCheck(text, node);
    const warnings = [];
    if (info.unsafe)
      warnings.push(
        `${info.unsafe} numeric value${info.unsafe === 1 ? "" : "s"} exceed safe JavaScript precision. Source tokens stay exact; Schema validation is blocked.`,
      );
    if (info.duplicate.length)
      warnings.push(
        `Duplicate keys at ${info.duplicate.slice(0, 3).join(", ")}. Formatting preserves them; semantic tools require unique keys.`,
      );
    const nodes: TreeNode[] = [];
    let id = 0;
    const stack = [{ node, parent: -1, path: "", key: "$", depth: 0 }];
    const lower = query.toLowerCase();
    while (stack.length) {
      const current = stack.pop()!;
      const raw = text.slice(
        current.node.offset,
        current.node.offset + current.node.length,
      );
      const preview =
        current.node.type === "object"
          ? `{ ${current.node.children?.length || 0} properties }`
          : current.node.type === "array"
            ? `[ ${current.node.children?.length || 0} items ]`
            : raw.slice(0, 160);
      const own = id++;
      if (
        !query ||
        current.path.toLowerCase().includes(lower) ||
        (current.node.type === "object" || current.node.type === "array"
          ? preview
          : raw
        )
          .toLowerCase()
          .includes(lower)
      ) {
        if (nodes.length < 25000)
          nodes.push({
            id: own,
            parent: current.parent,
            path: current.path,
            key: current.key,
            type: current.node.type,
            preview,
            offset: current.node.offset,
            length: current.node.length,
            children: current.node.children?.length || 0,
            depth: current.depth,
          });
      }
      if (current.node.type === "object") {
        const children = current.node.children || [];
        for (let i = children.length - 1; i >= 0; i--) {
          const p = children[i];
          const key = p.children![0].value as string;
          stack.push({
            node: p.children![1],
            parent: own,
            path: current.path + "/" + pointerEscape(key),
            key,
            depth: current.depth + 1,
          });
        }
      } else if (current.node.type === "array") {
        const children = current.node.children || [];
        for (let i = children.length - 1; i >= 0; i--)
          stack.push({
            node: children[i],
            parent: own,
            path: current.path + "/" + i,
            key: String(i),
            depth: current.depth + 1,
          });
      }
    }
    if (info.count > 25000)
      warnings.push(
        "Tree rendering is limited to 25,000 values. Pointer lookup and search still inspect the whole document.",
      );
    return {
      valid: true,
      issues: [],
      warnings,
      nodes,
      nodeCount: info.count,
      maxDepth: info.maxDepth,
      rootType: node.type,
      unsafeCount: info.unsafe,
      duplicatePaths: info.duplicate,
    };
  } catch (e) {
    return {
      valid: false,
      issues: [
        {
          message: (e as Error).message,
          code: e instanceof CoreError ? e.code : "Unknown",
          params:
            e instanceof CoreError
              ? e.params
              : { message: (e as Error).message },
          offset: 0,
          length: 1,
          line: 1,
          column: 1,
        },
      ],
      warnings: [],
      nodes: [],
      nodeCount: 0,
      maxDepth: 0,
      unsafeCount: 0,
    };
  }
}
export function formatJson(text: string, indent = 2, minify = false) {
  const a = analyze(text);
  if (!a.valid) throw invalidDocument("Source", "source", a.issues[0]);
  if (minify) {
    const scanner = createScanner(text, true);
    const parts = [];
    let token;
    while ((token = scanner.scan()) !== SyntaxKind.EOF) {
      parts.push(
        text.slice(
          scanner.getTokenOffset(),
          scanner.getTokenOffset() + scanner.getTokenLength(),
        ),
      );
    }
    return parts.join("");
  }
  return applyEdits(
    text,
    format(text, undefined, { tabSize: indent, insertSpaces: true, eol: "\n" }),
  );
}
// Parsed tree plus the facts other tools need before trusting JSON.parse.
export function documentTree(text: string) {
  const { node, errors } = root(text);
  if (!node || errors.length)
    throw fail("SyntaxFirst", "Fix the JSON syntax first.");
  const info = semanticCheck(text, node);
  return { node, duplicates: info.duplicate, unsafe: info.unsafe };
}
export function lookup(text: string, pointer: string) {
  const { node, errors } = root(text);
  if (!node || errors.length)
    throw fail("SyntaxFirst", "Fix the JSON syntax before navigating by path.");
  if (semanticCheck(text, node).duplicate.length)
    throw fail(
      "DuplicateKeys",
      "Remove duplicate object keys before pointer lookup.",
    );
  const parts = pointerParts(pointer);
  let found: Node | undefined = node;
  for (const p of parts) {
    if (!found) break;
    if (found.type === "array") {
      if (!/^(0|[1-9]\d*)$/.test(p))
        throw fail(
          "ArrayIndex",
          "Array indexes must be non-negative decimal integers without leading zeros.",
        );
      found = found.children?.[Number(p)];
    } else if (found.type === "object") {
      found = (found.children || []).find(
        (prop) => prop.children?.[0].value === p,
      )?.children?.[1];
    } else found = undefined;
  }
  if (!found)
    throw fail("NoValue", `No value exists at ${pointer || "(root)"}.`, {
      pointer,
    });
  const value = text.slice(found.offset, found.offset + found.length);
  return {
    value,
    offset: found.offset,
    length: found.length,
    type: found.type,
    path: pointer,
    ...position(text, found.offset),
  };
}
export type Change = {
  path: string;
  kind: "added" | "removed" | "changed";
  before?: string;
  after?: string;
};
class ExactNumber {
  constructor(readonly raw: string) {}
}
function exactValue(text: string, node: Node): any {
  if (node.type === "number")
    return new ExactNumber(text.slice(node.offset, node.offset + node.length));
  if (node.type === "array")
    return (node.children || []).map((child) => exactValue(text, child));
  if (node.type === "object") {
    const value = Object.create(null);
    for (const prop of node.children || [])
      value[prop.children![0].value] = exactValue(text, prop.children![1]);
    return value;
  }
  return node.value;
}
// Serializes diff values with their source number tokens; indent > 0 gives
// one member per line, like JSON.stringify(value, null, indent).
function exactSerialize(value: any, indent = 0, depth = 0): string {
  if (value instanceof ExactNumber) return value.raw;
  const open = indent ? "\n" + " ".repeat(indent * (depth + 1)) : "";
  const close = indent ? "\n" + " ".repeat(indent * depth) : "";
  const join = "," + open;
  if (Array.isArray(value))
    return value.length
      ? "[" +
          open +
          value.map((v) => exactSerialize(v, indent, depth + 1)).join(join) +
          close +
          "]"
      : "[]";
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    return keys.length
      ? "{" +
          open +
          keys
            .map(
              (key) =>
                JSON.stringify(key) +
                (indent ? ": " : ":") +
                exactSerialize(value[key], indent, depth + 1),
            )
            .join(join) +
          close +
          "}"
      : "{}";
  }
  return JSON.stringify(value);
}
export function normalizedDecimal(raw: string) {
  const [coefficient, exponent = "0"] = raw.toLowerCase().split("e");
  if (exponent.replace(/^[+-]/, "").length > 10000)
    throw fail(
      "ExponentTooLong",
      "Comparison exponent exceeds 10,000 digits. Source and formatting stay exact.",
    );
  const negative = coefficient.startsWith("-");
  const unsigned = negative ? coefficient.slice(1) : coefficient;
  const [integer, fraction = ""] = unsigned.split(".");
  const digits = (integer + fraction).replace(/^0+/, "");
  if (!digits) return "0";
  const significant = digits.replace(/0+$/, "");
  const power =
    BigInt(exponent) -
    BigInt(fraction.length) +
    BigInt(digits.length - significant.length);
  return `${negative ? "-" : ""}${significant}e${power}`;
}
export function compareDocuments(before: string, after: string) {
  for (const [name, doc, text] of [
    ["Source", "source", before],
    ["Comparison", "comparison", after],
  ]) {
    const a = analyze(text);
    if (!a.valid) throw invalidDocument(name, doc, a.issues[0]);
    const { node } = root(text);
    if (node && semanticCheck(text, node).duplicate.length)
      throw fail(
        "DuplicateKeys",
        `${name}: duplicate keys make comparison ambiguous.`,
        { doc },
      );
  }
  const old = exactValue(before, root(before).node!),
    next = exactValue(after, root(after).node!);
  const changes: Change[] = [];
  const patch: any[] = [];
  const append = (change: Change) => {
    if (changes.length >= 5000)
      throw fail(
        "TooManyChanges",
        "Comparison contains over 5,000 changes. Compare smaller documents.",
      );
    changes.push(change);
  };
  const stack = [{ a: old, b: next, path: "" }];
  const serial = exactSerialize;
  while (stack.length) {
    const { a, b, path } = stack.pop()!;
    if (a instanceof ExactNumber && b instanceof ExactNumber) {
      if (normalizedDecimal(a.raw) !== normalizedDecimal(b.raw)) {
        append({
          path,
          kind: "changed",
          before: serial(a),
          after: serial(b),
        });
        patch.push({ op: "replace", path, value: b });
      }
      continue;
    }
    if (a === b) continue;
    const aArray = Array.isArray(a),
      bArray = Array.isArray(b);
    if (aArray && bArray) {
      const shared = Math.min(a.length, b.length);
      for (let i = a.length - 1; i >= b.length; i--) {
        append({
          path: path + "/" + i,
          kind: "removed",
          before: serial(a[i]),
        });
        patch.push({ op: "remove", path: path + "/" + i });
      }
      for (let i = a.length; i < b.length; i++) {
        append({
          path: path + "/" + i,
          kind: "added",
          after: serial(b[i]),
        });
        patch.push({ op: "add", path: path + "/" + i, value: b[i] });
      }
      for (let i = shared - 1; i >= 0; i--)
        stack.push({ a: a[i], b: b[i], path: path + "/" + i });
      continue;
    }
    if (
      a &&
      b &&
      typeof a === "object" &&
      typeof b === "object" &&
      !aArray &&
      !bArray &&
      !(a instanceof ExactNumber) &&
      !(b instanceof ExactNumber)
    ) {
      const ao = a as Record<string, unknown>,
        bo = b as Record<string, unknown>;
      for (const key of Object.keys(ao)) {
        const p = path + "/" + pointerEscape(key);
        if (!Object.hasOwn(bo, key)) {
          append({ path: p, kind: "removed", before: serial(ao[key]) });
          patch.push({ op: "remove", path: p });
        } else stack.push({ a: ao[key], b: bo[key], path: p });
      }
      for (const key of Object.keys(bo)) {
        if (!Object.hasOwn(ao, key)) {
          const p = path + "/" + pointerEscape(key);
          append({ path: p, kind: "added", after: serial(bo[key]) });
          patch.push({ op: "add", path: p, value: bo[key] });
        }
      }
      continue;
    }
    append({
      path,
      kind: "changed",
      before: serial(a),
      after: serial(b),
    });
    patch.push({ op: "replace", path, value: b });
  }
  return {
    changes: changes.sort((a, b) => a.path.localeCompare(b.path)),
    patchText: exactSerialize(patch, 2),
  };
}
function invalidDocument(name: string, doc: string, issue?: JsonIssue) {
  return fail("DocInvalid", `${name}: ${issue?.message}`, {
    doc,
    detailCode: issue?.code || "Unknown",
    detailMessage: issue?.message || "",
    line: issue?.line || 1,
    column: issue?.column || 1,
  });
}
export function validateSchema(
  text: string,
  schemaText: string,
  lang: "en" | "ru" = "en",
) {
  const dataAnalysis = analyze(text);
  if (!dataAnalysis.valid)
    throw invalidDocument("Source", "source", dataAnalysis.issues[0]);
  const { node } = root(text);
  if (node && semanticCheck(text, node).duplicate.length)
    throw fail(
      "DuplicateKeys",
      "Remove duplicate object keys before Schema validation.",
      { doc: "source" },
    );
  if (dataAnalysis.unsafeCount)
    throw fail(
      "UnsafeNumbers",
      "Schema validation uses JavaScript numbers. This document contains numbers outside safe precision; they are preserved, but cannot be validated reliably.",
    );
  const schemaAnalysis = analyze(schemaText);
  if (!schemaAnalysis.valid)
    throw invalidDocument("Schema", "schema", schemaAnalysis.issues[0]);
  if (schemaAnalysis.unsafeCount)
    throw fail(
      "SchemaUnsafe",
      "Schema contains a number outside safe JavaScript precision.",
    );
  const schemaNode = root(schemaText).node;
  if (schemaNode && semanticCheck(schemaText, schemaNode).duplicate.length)
    throw fail(
      "DuplicateKeys",
      "Remove duplicate object keys in the Schema before validation.",
      { doc: "schema" },
    );
  const schema = JSON.parse(schemaText);
  const stack = [schema];
  const single = new Set([
    "additionalProperties",
    "unevaluatedProperties",
    "unevaluatedItems",
    "propertyNames",
    "items",
    "contains",
    "not",
    "if",
    "then",
    "else",
    "contentSchema",
  ]);
  const lists = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);
  const maps = new Set([
    "properties",
    "patternProperties",
    "$defs",
    "dependentSchemas",
  ]);
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    for (const [key, value] of Object.entries(current)) {
      if (
        (key === "$ref" || key === "$dynamicRef") &&
        typeof value === "string" &&
        !value.startsWith("#")
      )
        throw fail(
          "RemoteRef",
          "Only local fragment references (#...) are supported. No remote schema is fetched.",
        );
      if (
        key === "$schema" &&
        value !== "https://json-schema.org/draft/2020-12/schema"
      )
        throw fail(
          "Draft",
          "This workspace supports JSON Schema draft 2020-12.",
        );
      if (single.has(key)) stack.push(value);
      if (lists.has(key) && Array.isArray(value)) stack.push(...value);
      if (
        maps.has(key) &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        if (Object.hasOwn(value, "__proto__"))
          throw fail(
            "ProtoKey",
            "Schema maps containing the literal key __proto__ are unsupported by this Ajv engine. Validation is blocked rather than returning an incomplete verdict.",
          );
        stack.push(...Object.values(value));
      }
    }
  }
  const ajv = new Ajv2020({
    allErrors: true,
    strictSchema: true,
    strictTypes: false,
    strictTuples: false,
    validateFormats: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
    ownProperties: true,
  });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(JSON.parse(text));
  if (lang === "ru") localizeRu(validate.errors);
  const issues = (validate.errors || []).slice(0, 200).map((e) => {
    let path = e.instancePath;
    if (e.keyword === "required")
      path += "/" + pointerEscape(e.params.missingProperty);
    if (e.keyword === "additionalProperties")
      path += "/" + pointerEscape(e.params.additionalProperty);
    let offset = 0,
      length = 1;
    try {
      const found = lookup(text, path);
      offset = found.offset;
      length = found.length;
    } catch {}
    return {
      path,
      message: (e.message || e.keyword).replace(
        "одной их схем",
        "одной из схем",
      ),
      keyword: e.keyword,
      offset,
      length,
      ...position(text, offset),
    };
  });
  return { valid, issues, totalErrors: validate.errors?.length || 0 };
}
