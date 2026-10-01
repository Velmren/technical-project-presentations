import { JSONPathEnvironment, JSONPathError } from "json-p3";

// RFC 9535 (2.4.4): length() of a string counts Unicode scalar values.
// json-p3 counts UTF-16 code units, so "😀" would have length 2.
const environment = new JSONPathEnvironment();
const builtinLength = environment.functionRegister.get("length")!;
environment.functionRegister.set("length", {
  argTypes: builtinLength.argTypes,
  returnType: builtinLength.returnType,
  call: (value: unknown) =>
    typeof value === "string" ? [...value].length : builtinLength.call(value),
});
import { findNodeAtLocation } from "jsonc-parser";
import { CoreError, documentTree } from "./json-core";

export const QUERY_RESULT_LIMIT = 2000;
const QUERY_COUNT_LIMIT = 200000;

export type QueryMatch = {
  path: string;
  pointer: string;
  type: string;
  preview: string;
  children: number;
  offset: number;
  length: number;
  line: number;
  column: number;
};

export type QueryResult = {
  matches: QueryMatch[];
  total: number;
  countCapped: boolean;
  approximate: boolean;
};

function lineStarts(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i++)
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function locate(starts: number[], offset: number) {
  let low = 0,
    high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low + 1, column: offset - starts[low] + 1 };
}

// RFC 9535 evaluation runs on a JSON.parse copy, which is only trustworthy when
// keys are unique. Matches are mapped back to the source text by location, so
// every returned value is the exact source token, big numbers included.
export function runQuery(text: string, expression: string): QueryResult {
  const { node, duplicates, unsafe } = documentTree(text);
  if (duplicates.length)
    throw new CoreError(
      "QueryDuplicates",
      "Remove duplicate keys to run queries.",
    );
  let query;
  try {
    query = environment.compile(expression);
  } catch (e) {
    throw queryError(e);
  }
  const data = JSON.parse(text);
  const starts = lineStarts(text);
  const matches: QueryMatch[] = [];
  let total = 0;
  try {
    for (const found of query.lazyQuery(data)) {
      total++;
      if (matches.length < QUERY_RESULT_LIMIT) {
        const source = findNodeAtLocation(node, found.location);
        if (!source) continue;
        const raw = text.slice(source.offset, source.offset + source.length);
        const children = source.children?.length || 0;
        matches.push({
          path: found.getPath({ form: "canonical" }),
          pointer: found.toPointer().toString(),
          type: source.type,
          preview:
            source.type === "object" || source.type === "array"
              ? ""
              : raw.slice(0, 200),
          children,
          offset: source.offset,
          length: source.length,
          ...locate(starts, source.offset),
        });
      }
      if (total >= QUERY_COUNT_LIMIT) break;
    }
  } catch (e) {
    throw queryError(e);
  }
  return {
    matches,
    total,
    countCapped: total >= QUERY_COUNT_LIMIT,
    approximate: unsafe > 0 && expression.includes("?"),
  };
}

function queryError(e: unknown) {
  if (e instanceof JSONPathError) {
    const detail = e.message.replace(/\s*\('.*':\d+\)$/, "");
    return new CoreError("QuerySyntax", e.message, {
      position: (e.token?.index ?? 0) + 1,
      index: e.token?.index ?? 0,
      detail,
    });
  }
  return e;
}
