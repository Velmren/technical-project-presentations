import {
  analyze,
  formatJson,
  lookup,
  compareDocuments,
  validateSchema,
  CoreError,
} from "./json-core";
import { runQuery } from "./json-query";
import { applyPatch, convert } from "./json-convert";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = ({ data }) => {
  try {
    let result;
    if (data.action === "analyze") result = analyze(data.text, data.query);
    else if (data.action === "format")
      result = { text: formatJson(data.text, data.indent, data.minify) };
    else if (data.action === "lookup") result = lookup(data.text, data.pointer);
    else if (data.action === "compare")
      result = compareDocuments(data.text, data.comparison);
    else if (data.action === "schema")
      result = validateSchema(data.text, data.schema, data.lang);
    else if (data.action === "query")
      result = runQuery(data.text, data.expression);
    else if (data.action === "convert")
      result = { text: convert(data.text, data.format, data.options) };
    else if (data.action === "patch")
      result = applyPatch(data.text, data.patch, data.indent);
    else throw Error("Unknown operation");
    scope.postMessage({ id: data.id, action: data.action, result });
  } catch (e) {
    scope.postMessage({
      id: data.id,
      action: data.action,
      error: (e as Error).message,
      code: e instanceof CoreError ? e.code : "Unknown",
      params: e instanceof CoreError ? e.params : {},
    });
  }
};
