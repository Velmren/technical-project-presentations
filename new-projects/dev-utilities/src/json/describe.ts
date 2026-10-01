import type { MessageKey, Params } from "../i18n";
import { en } from "../i18n/en";

export type WorkerError = {
  code?: string;
  params?: Params;
  message: string;
};
type T = (key: MessageKey, params?: Params) => string;

const has = (table: object, code?: string): code is string =>
  !!code && Object.hasOwn(table, code);

// Turns a coded error from the worker into interface text. Unknown codes fall
// back to the engine's own message so nothing is silently lost.
export function describe(t: T, error: WorkerError): string {
  const { code, params = {} } = error;
  if (has(en.json.parse, code)) return t(`json.parse.${code}` as MessageKey);
  if (code === "DocInvalid") {
    const doc = String(params.doc);
    const name =
      doc === "comparison"
        ? t("json.panes.comparison")
        : doc === "schema"
          ? t("json.panes.schema")
          : t("json.panes.source");
    const detail = describe(t, {
      code: String(params.detailCode),
      message: String(params.detailMessage),
    });
    const where =
      params.line && params.column
        ? ` (${t("json.detail.at", { line: params.line, column: params.column })})`
        : "";
    return t("json.errors.DocInvalid", { doc: name, detail: detail + where });
  }
  if (code === "QuerySyntax")
    return t("json.query.error", {
      position: params.position,
      message: String(params.detail || error.message),
    });
  if (code === "QueryDuplicates") return t("json.query.duplicates");
  if (code === "PatchOperation")
    return t("json.errors.PatchOperation", {
      index: params.index,
      problem: t(`json.patch.problems.${params.problem}` as MessageKey),
    });
  if (has(en.json.errors, code) && code !== "Unknown")
    return t(`json.errors.${code}` as MessageKey, params);
  return String(params.message || error.message);
}
