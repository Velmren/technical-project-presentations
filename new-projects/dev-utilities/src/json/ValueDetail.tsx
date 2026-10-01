import { Copy, Download, X } from "lucide-react";
import { useI18n, type MessageKey } from "../i18n";

export type Selection = {
  path: string;
  value: string;
  type: string;
  offset: number;
  length: number;
  line: number;
  column: number;
};

const PREVIEW = 8192;

// A value cut from the source keeps its original indentation on every line
// after the first. The closing line shows the base indent, so strip that.
function dedent(value: string) {
  const lines = value.split("\n");
  if (lines.length < 2) return value;
  const indent = (line: string) => /^[ \t]*/.exec(line)![0].length;
  const base = indent(lines[lines.length - 1]);
  if (!base) return value;
  return lines
    .map((line, i) =>
      i === 0 ? line : line.slice(Math.min(base, indent(line))),
    )
    .join("\n");
}

// "/a~1b/0" becomes $ / a/b / 0, with the separators in the accent colour.
function Crumbs({ pointer }: { pointer: string }) {
  const parts = pointer
    ? pointer
        .slice(1)
        .split("/")
        .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"))
    : [];
  return (
    <span className="crumbs">
      <span className="crumb-root">$</span>
      {parts.map((part, i) => (
        <span key={i}>
          <span className="crumb-sep" aria-hidden="true">
            /
          </span>
          {part}
        </span>
      ))}
    </span>
  );
}

export function ValueDetail({
  selected,
  onCopy,
  onDownload,
  onClose,
}: {
  selected: Selection;
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  const { t, bytes } = useI18n();
  return (
    <section className="detail" aria-label={selected.path || t("common.root")}>
      <div className="detail-head">
        <code className="detail-path" title={selected.path || "/"}>
          <Crumbs pointer={selected.path} />
        </code>
        <span className="detail-meta">
          {t(`json.types.${selected.type}` as MessageKey)}
          <span aria-hidden="true">·</span>
          {bytes(new TextEncoder().encode(selected.value).byteLength)}
          <span className="hide-narrow">
            <span aria-hidden="true">· </span>
            {t("json.status.cursor", {
              line: selected.line,
              column: selected.column,
            })}
          </span>
        </span>
        <span className="detail-actions">
          <button
            type="button"
            className="icon-btn"
            title={t("json.detail.copy")}
            aria-label={t("json.detail.copy")}
            onClick={onCopy}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title={t("json.detail.download")}
            aria-label={t("json.detail.download")}
            onClick={onDownload}
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title={t("json.detail.close")}
            aria-label={t("json.detail.close")}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </span>
      </div>
      <pre className="detail-body">
        {dedent(selected.value.slice(0, PREVIEW))}
        {selected.value.length > PREVIEW && (
          <span className="detail-note">
            {"\n" + t("json.detail.truncated")}
          </span>
        )}
      </pre>
    </section>
  );
}
