import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  FolderOpen,
  Download,
  Copy,
  Search,
  X,
  TriangleAlert,
  CircleCheck,
  CircleX,
  LoaderCircle,
  ChevronsDownUp,
  ChevronsUpDown,
  CornerDownLeft,
  Ellipsis,
  FileJson,
  GitCompareArrows,
  ShieldCheck,
  FileCode2,
  FileDiff,
  Replace,
  Upload,
} from "lucide-react";
import { CodeEditor, type EditorHandle } from "../CodeEditor";
import {
  copyText,
  downloadText,
  useSessionState,
  type ToolProps,
} from "../shared";
import type { Analysis, TreeNode, Change, JsonIssue } from "../json-core";
import type { QueryMatch, QueryResult } from "../json-query";
import { useI18n } from "../i18n";
import { Select } from "../ui/Select";
import { SplitPane } from "../ui/SplitPane";
import { useNarrow } from "../ui/useNarrow";
import { Menu, type MenuItem } from "../ui/Menu";
import { TreeView } from "./TreeView";
import { QueryPanel, type QueryState } from "./QueryPanel";
import { ValueDetail, type Selection } from "./ValueDetail";
import { describe, type WorkerError } from "./describe";
import {
  sourceSample,
  comparisonSample,
  schemaSample,
  patchSample,
  defaultQuery,
} from "./samples";
import "./json.css";

type View = "inspect" | "convert" | "compare" | "patch" | "schema";
type Second = "comparison" | "schema" | "patch";
type Format = "yaml" | "csv" | "typescript" | "schema";
type ConvertState =
  | { status: "idle" | "running" }
  | { status: "done"; text: string; key: string }
  | { status: "error"; message: string };
const VIEWS: View[] = ["inspect", "convert", "compare", "patch", "schema"];
const FORMATS: Format[] = ["yaml", "csv", "typescript", "schema"];
const NO_MARKS: { from: number; to: number }[] = [];
type Right = "tree" | "query";
type Mobile = "source" | "right" | "report";
type SchemaResult = {
  valid: boolean;
  issues: (JsonIssue & { keyword: string; path: string })[];
  totalErrors: number;
};

const workerUrl = () => new URL("./json-worker.js", import.meta.url);

function lineColumn(text: string, offset: number) {
  let line = 1,
    last = -1;
  for (let i = 0; i < offset; i++)
    if (text.charCodeAt(i) === 10) {
      line++;
      last = i;
    }
  return { line, column: offset - last };
}

export function JsonWorkspace({
  notify,
  active,
}: ToolProps & { active: boolean }) {
  const { t, lang, num, bytes } = useI18n();
  const narrow = useNarrow();
  const [doc, setDoc] = useSessionState("json", {
    source: sourceSample,
    comparison: comparisonSample,
    schema: schemaSample,
    patch: patchSample,
    indent: 2,
  });
  const [convertOptions, setConvertOptions] = useSessionState("json.convert", {
    format: "yaml" as Format,
    pointer: "",
    delimiter: ",",
    name: "Service",
  });
  const [convertState, setConvertState] = useState<ConvertState>({
    status: "idle",
  });
  const [patchResult, setPatchResult] = useState<{
    text: string;
    operations: number;
  } | null>(null);
  const [expression, setExpression] = useSessionState(
    "json.query",
    defaultQuery,
  );
  const [view, setView] = useState<View>("inspect");
  const [right, setRight] = useState<Right>("tree");
  const [mobile, setMobile] = useState<Mobile>("source");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<WorkerError | null>(null);
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("");
  const [appliedFilter, setAppliedFilter] = useState("");
  const [pointer, setPointer] = useState("");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [patch, setPatch] = useState("");
  const [schemaResult, setSchemaResult] = useState<SchemaResult | null>(null);
  const [expanded, setExpanded] = useState<Set<string> | null>(null);
  const [filename, setFilename] = useState("service.json");
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [queryState, setQueryState] = useState<QueryState>({ status: "idle" });

  const current = useRef(doc);
  current.current = doc;
  const worker = useRef<Worker | null>(null);
  const analyzedSource = useRef<string | null>(null);
  const analyzedFilter = useRef<string | null>(null);
  const job = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryWorker = useRef<Worker | null>(null);
  const convertWorker = useRef<Worker | null>(null);
  const queryJob = useRef(0);
  const queried = useRef<{ source: string; expression: string } | null>(null);
  const querySource = useRef("");
  const editor = useRef<EditorHandle | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const bindEditor = useCallback((h: EditorHandle) => {
    editor.current = h;
  }, []);

  const cancel = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    if (timeout.current) clearTimeout(timeout.current);
    job.current++;
    setBusy("");
  }, []);
  useEffect(
    () => () => {
      worker.current?.terminate();
      queryWorker.current?.terminate();
      convertWorker.current?.terminate();
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );

  // One job at a time for analysis and document operations; a newer request
  // cancels the older one so a stale result can never land.
  function run(action: string, extra: Record<string, unknown> = {}) {
    cancel();
    const id = ++job.current;
    const sourceSnapshot = current.current.source;
    const filterSnapshot =
      typeof extra.query === "string" ? extra.query : appliedFilter;
    setError(null);
    setBusy(action);
    const w = new Worker(workerUrl(), { type: "module" });
    worker.current = w;
    timeout.current = setTimeout(() => {
      cancel();
      setError({ code: "Timeout", message: t("json.timeout") });
    }, 20000);
    w.onerror = () => {
      cancel();
      setError({ code: "Worker", message: t("json.workerFailed") });
    };
    w.onmessage = ({ data }) => {
      if (id !== job.current) return;
      if (timeout.current) clearTimeout(timeout.current);
      w.terminate();
      worker.current = null;
      setBusy("");
      if (data.error) {
        setError({ code: data.code, params: data.params, message: data.error });
        return;
      }
      if (action === "analyze") {
        analyzedSource.current = sourceSnapshot;
        analyzedFilter.current = filterSnapshot;
        const result: Analysis = data.result;
        setAnalysis(result);
        // First unfiltered view of a document opens the top two levels.
        if (!filterSnapshot)
          setExpanded(
            (open) =>
              open ??
              new Set(
                result.nodes
                  .filter((n) => n.children && n.depth <= 1)
                  .map((n) => n.path),
              ),
          );
      } else if (action === "format") {
        analyzedSource.current = null;
        setDoc((d) => ({ ...d, source: data.result.text }));
        setAnalysis(null);
        setSelected(null);
        setChanges(null);
        setPatch("");
        setSchemaResult(null);
        notify(t(extra.minify ? "json.minified" : "json.formatted"));
      } else if (action === "lookup") {
        const r = data.result;
        select({
          path: r.path,
          value: r.value,
          type: r.type,
          offset: r.offset,
          length: r.length,
          line: r.line,
          column: r.column,
        });
        editor.current?.focusRange(r.offset, r.length, false);
      } else if (action === "compare") {
        setChanges(data.result.changes);
        setPatch(data.result.patchText);
        if (narrow) setMobile("report");
      } else if (action === "schema") {
        setSchemaResult(data.result);
        if (narrow) setMobile("report");
      } else if (action === "patch") {
        setPatchResult(data.result);
        if (narrow) setMobile("report");
      }
    };
    w.postMessage({
      id,
      action,
      lang,
      text: current.current.source,
      comparison: current.current.comparison,
      schema: current.current.schema,
      patch: current.current.patch,
      indent: current.current.indent,
      query: appliedFilter,
      ...extra,
    });
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        !worker.current &&
        (analyzedSource.current !== current.current.source ||
          analyzedFilter.current !== appliedFilter)
      )
        run("analyze", { query: appliedFilter });
    }, 350);
    return () => clearTimeout(timer);
  }, [doc.source, appliedFilter, busy]);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedFilter(filter.trim()), 300);
    return () => clearTimeout(timer);
  }, [filter]);

  const queryVisible =
    active &&
    view === "inspect" &&
    right === "query" &&
    (!narrow || mobile === "right");
  const queryBlocked = !analysis
    ? null
    : !analysis.valid
      ? t("json.query.invalidDoc")
      : analysis.duplicatePaths?.length
        ? t("json.query.duplicates")
        : null;

  // Queries run live in their own worker, independent of the analysis job.
  useEffect(() => {
    if (!queryVisible || !analysis || queryBlocked) return;
    const source = current.current.source;
    if (analyzedSource.current !== source) return;
    const text = expression.trim();
    if (!text) {
      setQueryState({ status: "idle" });
      return;
    }
    if (
      queried.current?.source === source &&
      queried.current.expression === text
    )
      return;
    const timer = setTimeout(() => {
      queryWorker.current?.terminate();
      const id = ++queryJob.current;
      const w = new Worker(workerUrl(), { type: "module" });
      queryWorker.current = w;
      const previous = (s: QueryState) =>
        s.status === "done"
          ? s.result
          : s.status !== "idle"
            ? s.previous
            : undefined;
      setQueryState((s) => ({ status: "running", previous: previous(s) }));
      const limit = setTimeout(() => {
        w.terminate();
        if (id === queryJob.current)
          setQueryState((s) => ({
            status: "error",
            message: t("json.timeout"),
            previous: previous(s),
          }));
      }, 10000);
      w.onmessage = ({ data }) => {
        clearTimeout(limit);
        w.terminate();
        if (id !== queryJob.current) return;
        queryWorker.current = null;
        queried.current = { source, expression: text };
        if (data.error)
          setQueryState((s) => ({
            status: "error",
            message: describe(t, {
              code: data.code,
              params: data.params,
              message: data.error,
            }),
            index: data.params?.index,
            previous: previous(s),
          }));
        else {
          querySource.current = source;
          setQueryState({ status: "done", result: data.result as QueryResult });
        }
      };
      w.postMessage({ id, action: "query", text: source, expression: text });
    }, 180);
    return () => clearTimeout(timer);
  }, [expression, analysis, queryVisible, queryBlocked, t]);

  const convertVisible = active && view === "convert";
  const convertKey = JSON.stringify([doc.source, convertOptions]);
  useEffect(() => {
    if (!convertVisible) return;
    if (convertState.status === "done" && convertState.key === convertKey)
      return;
    const timer = setTimeout(() => {
      convertWorker.current?.terminate();
      const w = new Worker(workerUrl(), { type: "module" });
      convertWorker.current = w;
      setConvertState({ status: "running" });
      const limit = setTimeout(() => {
        w.terminate();
        if (convertWorker.current === w)
          setConvertState({ status: "error", message: t("json.timeout") });
      }, 20000);
      w.onmessage = ({ data }) => {
        clearTimeout(limit);
        w.terminate();
        if (convertWorker.current !== w) return;
        convertWorker.current = null;
        if (data.error)
          setConvertState({
            status: "error",
            message: describe(t, {
              code: data.code,
              params: data.params,
              message: data.error,
            }),
          });
        else
          setConvertState({
            status: "done",
            text: data.result.text,
            key: convertKey,
          });
      };
      w.postMessage({
        id: 0,
        action: "convert",
        text: current.current.source,
        format: convertOptions.format,
        options: {
          pointer: convertOptions.pointer.trim(),
          delimiter: convertOptions.delimiter,
          name: convertOptions.name.trim(),
        },
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [convertVisible, convertKey, t]);

  function edit(which: "source" | Second, value: string) {
    cancel();
    setError(null);
    if (which === "source") {
      setAnalysis(null);
      setSelected(null);
    }
    setChanges(null);
    setPatch("");
    setSchemaResult(null);
    setPatchResult(null);
    setDoc((d) => ({ ...d, [which]: value }));
  }

  function select(next: Selection) {
    setSelected(next);
    setPointer(next.path);
  }

  function selectNode(node: TreeNode, focusEditor: boolean) {
    const source = current.current.source;
    select({
      path: node.path,
      value: source.slice(node.offset, node.offset + node.length),
      type: node.type,
      offset: node.offset,
      length: node.length,
      ...lineColumn(source, node.offset),
    });
    editor.current?.focusRange(node.offset, node.length, focusEditor);
  }

  function selectMatch(match: QueryMatch) {
    const source = querySource.current;
    if (source !== current.current.source) return;
    select({
      path: match.pointer,
      value: source.slice(match.offset, match.offset + match.length),
      type: match.type,
      offset: match.offset,
      length: match.length,
      line: match.line,
      column: match.column,
    });
    editor.current?.focusRange(match.offset, match.length, false);
  }

  function copyQuery(kind: "values" | "paths" | "pointers") {
    if (queryState.status !== "done") return;
    const { matches, total } = queryState.result;
    const source = querySource.current;
    const text =
      kind === "values"
        ? "[\n" +
          matches
            .map((m) => "  " + source.slice(m.offset, m.offset + m.length))
            .join(",\n") +
          "\n]"
        : matches
            .map((m) => (kind === "paths" ? m.path : m.pointer))
            .join("\n");
    void copyText(text, (message) =>
      notify(
        total > matches.length
          ? t("json.query.copiedPartial", { shown: matches.length, total })
          : message,
      ),
    );
  }

  async function importFile(file: File, which: "source" | Second) {
    if (file.size > 5 * 1024 * 1024) {
      setError({ code: "File", message: t("json.fileTooLarge") });
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      edit(which, text);
      if (which === "source") {
        setFilename(file.name);
        setExpanded(null);
      }
      notify(t("json.imported", { name: file.name }));
    } catch {
      setError({ code: "File", message: t("json.notUtf8") });
    }
  }

  function switchView(next: View) {
    cancel();
    setView(next);
    setError(null);
    if (narrow) setMobile("source");
    if (!analysis) run("analyze");
  }

  function load(text: string, name: string) {
    edit("source", text);
    setFilename(name);
    setExpanded(null);
  }

  const diagnostics = useMemo(
    () =>
      [
        ...(analysis?.issues || []),
        ...(view === "schema" && schemaResult && !schemaResult.valid
          ? schemaResult.issues
          : []),
      ]
        .slice(0, 30)
        .map((i) => ({
          from: i.offset,
          to: i.offset + Math.min(Math.max(i.length, 1), 250),
          severity: "error" as const,
          message: i.code
            ? describe(t, {
                code: i.code,
                params: i.params,
                message: i.message,
              })
            : i.message,
        })),
    [analysis, schemaResult, view, t],
  );

  const valid = !!analysis?.valid;
  const issues = analysis && !analysis.valid ? analysis.issues : [];
  const sourceBytes = useMemo(
    () => new TextEncoder().encode(doc.source).byteLength,
    [doc.source],
  );
  const lines = useMemo(() => doc.source.split("\n").length, [doc.source]);
  const runPrimary = () =>
    view === "compare" || view === "schema" || view === "patch"
      ? run(view)
      : run("format");
  // Every JSONPath match is marked in the editor, not only the selected one.
  const marks = useMemo(
    () =>
      view === "inspect" &&
      right === "query" &&
      queryState.status === "done" &&
      querySource.current === doc.source
        ? queryState.result.matches.map((m) => ({
            from: m.offset,
            to: m.offset + m.length,
          }))
        : NO_MARKS,
    [view, right, queryState, doc.source],
  );

  const moreItems: MenuItem[] = [
    ...(narrow
      ? [
          {
            id: "open",
            label: t("json.actions.open"),
            onSelect: () => importRef.current?.click(),
          },
          {
            id: "format",
            label: t("json.actions.format"),
            onSelect: () => run("format"),
          },
          {
            id: "minify",
            label: t("json.actions.minify"),
            onSelect: () => run("format", { minify: true }),
          },
          {
            id: "indent",
            label: `${t("json.indent")}: ${t("json.indentOption", { count: doc.indent === 2 ? 4 : 2 })}`,
            onSelect: () =>
              setDoc((d) => ({ ...d, indent: d.indent === 2 ? 4 : 2 })),
          },
          {
            id: "copy",
            label: t("json.actions.copy"),
            onSelect: () => void copyText(doc.source, notify),
          },
          {
            id: "download",
            label: t("json.actions.download"),
            onSelect: () =>
              downloadText(doc.source, filename, "application/json", notify),
          },
        ]
      : []),
    {
      id: "new",
      label: t("json.actions.newDoc"),
      onSelect: () => load("{}", "untitled.json"),
    },
    {
      id: "example",
      label: t("json.actions.example"),
      onSelect: () => {
        load(sourceSample, "service.json");
        notify(t("json.exampleLoaded"));
      },
    },
  ];

  const mobileTabs: [Mobile, string, Right?][] =
    view === "inspect"
      ? [
          ["source", t("json.panes.source")],
          ["right", t("json.panes.tree"), "tree"],
          ["right", t("json.panes.query"), "query"],
        ]
      : view === "convert"
        ? [
            ["source", t("json.panes.source")],
            ["right", t("json.panes.output")],
          ]
        : view === "compare"
          ? [
              ["source", t("json.panes.source")],
              ["right", t("json.panes.comparison")],
              ["report", t("json.panes.changes")],
            ]
          : view === "patch"
            ? [
                ["source", t("json.panes.source")],
                ["right", t("json.panes.patch")],
                ["report", t("json.panes.result")],
              ]
            : [
                ["source", t("json.panes.source")],
                ["right", t("json.panes.schema")],
                ["report", t("json.panes.report")],
              ];

  const errorText = error ? describe(t, error) : "";

  const sourcePane = (
    <>
      <div className="pane-head">
        <div className="pane-title">
          <FileJson size={15} />
          <span title={filename}>{filename}</span>
        </div>
        {view !== "inspect" && (
          <span className="pane-role">{t("json.panes.source")}</span>
        )}
      </div>
      <div className="pane-body editor-host">
        <CodeEditor
          value={doc.source}
          onChange={(s) => edit("source", s)}
          label={t("json.editorLabel")}
          lang={lang}
          diagnostics={diagnostics}
          onRun={runPrimary}
          handle={bindEditor}
          onCursor={(line, column) => setCursor({ line, column })}
          marks={marks}
        />
      </div>
    </>
  );

  const treePane = !analysis ? (
    <div className="empty">{t("json.tree.preparing")}</div>
  ) : !analysis.valid ? (
    <div className="problems">
      <div className="problems-head">
        <CircleX size={14} />
        {t("json.problems.title")}
        <span className="count">{num(issues.length)}</span>
      </div>
      <ul>
        {issues.map((issue, i) => (
          <li key={i}>
            <button
              type="button"
              title={t("json.problems.goTo", {
                line: issue.line,
                column: issue.column,
              })}
              onClick={() => {
                editor.current?.focusRange(issue.offset, issue.length);
                if (narrow) setMobile("source");
              }}
            >
              <span className="problem-loc">
                {issue.line}:{issue.column}
              </span>
              <span>
                {describe(t, {
                  code: issue.code,
                  params: issue.params,
                  message: issue.message,
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="problems-note">{t("json.tree.invalid")}</p>
    </div>
  ) : (
    <div className="tree-wrap">
      <div className="tree-tools">
        <div className="search-field">
          <Search size={14} aria-hidden="true" />
          <input
            className="input"
            aria-label={t("json.tree.filter")}
            placeholder={t("json.tree.filterPlaceholder")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setFilter("");
            }}
            spellCheck={false}
          />
          {filter && (
            <button
              type="button"
              className="icon-btn"
              aria-label={t("json.tree.clearFilter")}
              onClick={() => setFilter("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-btn"
          title={t("json.tree.expandAll")}
          aria-label={t("json.tree.expandAll")}
          disabled={!!appliedFilter}
          onClick={() =>
            setExpanded(
              new Set(
                analysis.nodes.filter((n) => n.children).map((n) => n.path),
              ),
            )
          }
        >
          <ChevronsUpDown size={15} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title={t("json.tree.collapseAll")}
          aria-label={t("json.tree.collapseAll")}
          disabled={!!appliedFilter}
          onClick={() => setExpanded(new Set([""]))}
        >
          <ChevronsDownUp size={15} />
        </button>
      </div>
      <form
        className="pointer-field"
        onSubmit={(e) => {
          e.preventDefault();
          run("lookup", { pointer });
        }}
      >
        <label className="pointer-label" htmlFor="json-pointer">
          {t("json.tree.pointer")}
        </label>
        <input
          id="json-pointer"
          className="input mono"
          aria-label={t("json.tree.pointer")}
          value={pointer}
          onChange={(e) => setPointer(e.target.value)}
          placeholder={t("json.tree.pointerPlaceholder")}
          spellCheck={false}
          autoCapitalize="off"
        />
        <button
          type="submit"
          className="icon-btn"
          title={t("json.tree.go")}
          aria-label={t("json.tree.go")}
        >
          <CornerDownLeft size={14} />
        </button>
      </form>
      {appliedFilter && analysis.nodes.length === 0 ? (
        <div className="empty">{t("json.tree.noMatches")}</div>
      ) : (
        <TreeView
          nodes={analysis.nodes}
          expanded={expanded ?? new Set([""])}
          flat={!!appliedFilter}
          selectedPath={selected?.path ?? null}
          onToggle={(path) =>
            setExpanded((open) => {
              const next = new Set(open ?? []);
              if (next.has(path)) next.delete(path);
              else next.add(path);
              return next;
            })
          }
          onSelect={selectNode}
        />
      )}
      {analysis.nodeCount > analysis.nodes.length && !appliedFilter && (
        <div className="tree-foot">
          {t("json.tree.limited", {
            shown: num(analysis.nodes.length),
            total: num(analysis.nodeCount),
          })}
        </div>
      )}
    </div>
  );

  const inspector = (
    <>
      <div className="pane-head inspector-head">
        <div
          className="pane-tabs"
          role="tablist"
          aria-label={t("json.panes.mobileLabel")}
        >
          {(["tree", "query"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="pane-tab"
              aria-selected={right === id}
              onClick={() => setRight(id)}
            >
              {t(`json.panes.${id}`)}
              {id === "tree" && analysis?.valid && (
                <span className="tab-count" aria-hidden="true">
                  {num(analysis.nodeCount)}
                </span>
              )}
              {id === "query" && queryState.status === "done" && (
                <span className="tab-count" aria-hidden="true">
                  {num(queryState.result.total)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="pane-body inspector-body">
        <div className="inspector-main">
          {right === "tree" ? (
            treePane
          ) : (
            <QueryPanel
              expression={expression}
              onExpression={setExpression}
              state={queryState}
              blocked={queryBlocked}
              selectedPath={selected?.path ?? null}
              onSelect={selectMatch}
              onCopy={copyQuery}
            />
          )}
        </div>
        {selected && (
          <ValueDetail
            selected={selected}
            onCopy={() => copyText(selected.value, notify)}
            onDownload={() =>
              downloadText(
                selected.value,
                "selection.json",
                "application/json",
                notify,
              )
            }
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </>
  );

  const secondKey = (which: Second) =>
    which === "comparison" ? "compare" : which;
  const secondEditor = (which: Second) => (
    <>
      <div className="pane-head">
        <div className="pane-title">
          {which === "comparison" ? (
            <GitCompareArrows size={15} />
          ) : which === "patch" ? (
            <FileDiff size={15} />
          ) : (
            <ShieldCheck size={15} />
          )}
          <span>
            {which === "comparison"
              ? "comparison.json"
              : which === "patch"
                ? "changes.patch.json"
                : "schema.json"}
          </span>
        </div>
        <span className="pane-role">
          {which === "comparison"
            ? t("json.panes.comparison")
            : which === "patch"
              ? "RFC 6902"
              : "Draft 2020-12"}
        </span>
        <div className="pane-actions">
          <label
            className="icon-btn file-btn"
            title={t(`json.${secondKey(which)}.importLabel`)}
          >
            <Upload size={14} />
            <input
              type="file"
              aria-label={t(`json.${secondKey(which)}.importLabel`)}
              accept=".json,.txt,application/json,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f, which);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="icon-btn"
            title={
              which === "schema"
                ? t("json.actions.copy")
                : t(`json.${secondKey(which)}.copy` as "json.compare.copy")
            }
            aria-label={
              which === "schema"
                ? t("json.actions.copy")
                : t(`json.${secondKey(which)}.copy` as "json.compare.copy")
            }
            onClick={() => copyText(doc[which], notify)}
          >
            <Copy size={14} />
          </button>
        </div>
      </div>
      <div className="pane-body editor-host">
        <CodeEditor
          key={which}
          value={doc[which]}
          onChange={(s) => edit(which, s)}
          label={t(`json.${secondKey(which)}.editorLabel`)}
          lang={lang}
          onRun={runPrimary}
        />
      </div>
    </>
  );

  const converter = (
    <>
      <div className="pane-head">
        <div
          className="pane-tabs"
          role="tablist"
          aria-label={t("json.convert.formatLabel")}
        >
          {FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              role="tab"
              className="pane-tab"
              aria-selected={convertOptions.format === format}
              onClick={() => setConvertOptions((o) => ({ ...o, format }))}
            >
              {t(`json.convert.formats.${format}`)}
            </button>
          ))}
        </div>
        <div className="pane-actions">
          <button
            type="button"
            className="icon-btn"
            disabled={convertState.status !== "done"}
            title={t("json.convert.copy")}
            aria-label={t("json.convert.copy")}
            onClick={() =>
              convertState.status === "done" &&
              void copyText(convertState.text, notify)
            }
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={convertState.status !== "done"}
            title={t("json.convert.download")}
            aria-label={t("json.convert.download")}
            onClick={() => {
              if (convertState.status !== "done") return;
              const f = convertOptions.format;
              const base = filename.replace(/\.json$/i, "");
              downloadText(
                convertState.text,
                f === "yaml"
                  ? base + ".yaml"
                  : f === "csv"
                    ? base + ".csv"
                    : f === "typescript"
                      ? base + ".d.ts"
                      : base + ".schema.json",
                f === "csv"
                  ? "text/csv;charset=utf-8"
                  : f === "yaml"
                    ? "application/yaml"
                    : f === "typescript"
                      ? "text/plain;charset=utf-8"
                      : "application/schema+json",
                notify,
              );
            }}
          >
            <Download size={14} />
          </button>
        </div>
      </div>
      <div className="convert-options">
        <label className="input-group">
          <span>{t("json.convert.from")}</span>
          <input
            className="input mono"
            aria-label={t("json.convert.fromLabel")}
            placeholder={t("json.convert.fromPlaceholder")}
            value={convertOptions.pointer}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(e) =>
              setConvertOptions((o) => ({ ...o, pointer: e.target.value }))
            }
          />
        </label>
        {convertOptions.format === "csv" && (
          <label className="input-group">
            <span>{t("json.convert.delimiter")}</span>
            <Select
              label={t("json.convert.delimiter")}
              value={convertOptions.delimiter}
              onChange={(delimiter) =>
                setConvertOptions((o) => ({ ...o, delimiter }))
              }
              options={[
                { value: ",", label: t("json.convert.delimiters.comma") },
                { value: ";", label: t("json.convert.delimiters.semicolon") },
                { value: "\t", label: t("json.convert.delimiters.tab") },
              ]}
            />
          </label>
        )}
        {convertOptions.format === "typescript" && (
          <label className="input-group">
            <span>{t("json.convert.typeName")}</span>
            <input
              className="input mono"
              value={convertOptions.name}
              maxLength={60}
              spellCheck={false}
              onChange={(e) =>
                setConvertOptions((o) => ({ ...o, name: e.target.value }))
              }
            />
          </label>
        )}
        {convertOptions.format === "schema" && (
          <button
            type="button"
            className="btn quiet"
            disabled={convertState.status !== "done"}
            onClick={() => {
              if (convertState.status !== "done") return;
              edit("schema", convertState.text);
              switchView("schema");
              notify(t("json.convert.usedAsSchema"));
            }}
          >
            <ShieldCheck size={14} />
            {t("json.convert.useAsSchema")}
          </button>
        )}
      </div>
      {convertState.status === "error" && (
        <div className="notice err" role="alert">
          <TriangleAlert size={14} />
          <span>{convertState.message}</span>
        </div>
      )}
      <div
        className={
          "pane-body editor-host" +
          (convertState.status === "running" ? " is-stale" : "")
        }
      >
        <CodeEditor
          key={convertOptions.format}
          value={convertState.status === "done" ? convertState.text : ""}
          onChange={() => undefined}
          readOnly
          label={t("json.convert.outputLabel")}
          lang={lang}
          language={
            convertOptions.format === "yaml"
              ? "yaml"
              : convertOptions.format === "typescript"
                ? "typescript"
                : convertOptions.format === "schema"
                  ? "json"
                  : "text"
          }
        />
      </div>
      <div className="pane-foot">
        <span>{t(`json.convert.notes.${convertOptions.format}`)}</span>
      </div>
    </>
  );

  const patchReport = (
    <>
      <div className="pane-head">
        <div className="pane-title">
          {patchResult && <CircleCheck size={15} className="status-ok" />}
          <span>
            {patchResult
              ? t("json.patch.applied", { count: patchResult.operations })
              : t("json.panes.result")}
          </span>
        </div>
        <div className="pane-actions">
          <button
            type="button"
            className="btn quiet"
            disabled={!patchResult}
            onClick={() =>
              patchResult &&
              downloadText(
                patchResult.text,
                filename.replace(/\.json$/i, "") + ".patched.json",
                "application/json",
                notify,
              )
            }
          >
            <Download size={14} />
            {t("json.patch.download")}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!patchResult}
            onClick={() => {
              if (!patchResult) return;
              edit("source", patchResult.text);
              notify(t("json.patch.replaced"));
              if (narrow) setMobile("source");
            }}
          >
            <Replace size={14} />
            {t("json.patch.replace")}
          </button>
        </div>
      </div>
      <div className="pane-body editor-host">
        {patchResult ? (
          <CodeEditor
            value={patchResult.text}
            onChange={() => undefined}
            readOnly
            label={t("json.patch.resultLabel")}
            lang={lang}
          />
        ) : (
          <div className="empty">{t("json.patch.pending")}</div>
        )}
      </div>
    </>
  );

  const report =
    view === "compare" ? (
      <>
        <div className="pane-head">
          <div className="pane-title">
            <span>
              {changes === null
                ? t("json.panes.changes")
                : changes.length === 0
                  ? t("json.compare.equivalent")
                  : t("json.compare.changes", { count: changes.length })}
            </span>
          </div>
          <div className="pane-actions">
            <button
              type="button"
              className="btn quiet"
              disabled={!changes?.length}
              onClick={() =>
                downloadText(
                  patch,
                  "changes.patch.json",
                  "application/json",
                  notify,
                )
              }
            >
              <Download size={14} />
              {t("json.compare.exportPatch")}
            </button>
            <button
              type="button"
              className="btn quiet"
              disabled={!changes?.length}
              onClick={() => {
                setDoc((d) => ({
                  ...d,
                  patch,
                }));
                setPatchResult(null);
                switchView("patch");
              }}
            >
              <FileDiff size={14} />
              {t("json.compare.openPatch")}
            </button>
          </div>
        </div>
        <div className="pane-body report-body">
          {changes === null ? (
            <div className="empty">{t("json.compare.pending")}</div>
          ) : changes.length > 0 ? (
            <table className="diff">
              <thead>
                <tr>
                  <th className="col-kind">
                    <span className="sr-only">
                      {t("json.compare.kinds.changed")}
                    </span>
                  </th>
                  <th>{t("json.compare.pointer")}</th>
                  <th>{t("json.compare.source")}</th>
                  <th>{t("json.compare.comparison")}</th>
                </tr>
              </thead>
              <tbody>
                {changes.slice(0, 300).map((c) => (
                  <tr key={c.path + c.kind} className={"diff-" + c.kind}>
                    <td className="col-kind">
                      <span
                        className={"kind kind-" + c.kind}
                        title={t(`json.compare.kinds.${c.kind}`)}
                      >
                        {c.kind === "added"
                          ? "+"
                          : c.kind === "removed"
                            ? "−"
                            : "~"}
                      </span>
                      <span className="sr-only">
                        {t(`json.compare.kinds.${c.kind}`)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="diff-path"
                        onClick={() => {
                          if (c.kind === "added")
                            notify(t("json.compare.onlyInComparison"));
                          else {
                            run("lookup", { pointer: c.path });
                            if (narrow) setMobile("source");
                          }
                        }}
                      >
                        {c.path || t("common.root")}
                      </button>
                    </td>
                    <td className="diff-before">
                      {c.before?.slice(0, 500) ?? ""}
                    </td>
                    <td className="diff-after">
                      {c.after?.slice(0, 500) ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">
              <CircleCheck size={18} className="status-ok" />
              {t("json.compare.equivalent")}
            </div>
          )}
          {changes && changes.length > 300 && (
            <p className="report-note">
              {t("json.compare.shown", { shown: 300, total: changes.length })}
            </p>
          )}
        </div>
      </>
    ) : view === "patch" ? (
      patchReport
    ) : (
      <>
        <div className="pane-head">
          <div className="pane-title">
            {schemaResult &&
              (schemaResult.valid ? (
                <CircleCheck size={15} className="status-ok" />
              ) : (
                <CircleX size={15} className="status-err" />
              ))}
            <span>
              {!schemaResult
                ? t("json.panes.report")
                : schemaResult.valid
                  ? t("json.schema.valid")
                  : t("json.schema.issues", {
                      count: schemaResult.totalErrors,
                    })}
            </span>
          </div>
          <div className="pane-actions">
            <button
              type="button"
              className="btn quiet"
              disabled={!schemaResult}
              onClick={() =>
                downloadText(
                  JSON.stringify(schemaResult, null, 2),
                  "validation.json",
                  "application/json",
                  notify,
                )
              }
            >
              <Download size={14} />
              {t("json.schema.exportReport")}
            </button>
          </div>
        </div>
        <div className="pane-body report-body">
          {!schemaResult ? (
            <div className="empty">{t("json.schema.pending")}</div>
          ) : schemaResult.valid ? (
            <div className="empty">{t("json.schema.note")}</div>
          ) : (
            <ul className="issues">
              {schemaResult.issues.map((issue, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      editor.current?.focusRange(
                        issue.offset,
                        Math.min(issue.length, 200),
                      );
                      if (narrow) setMobile("source");
                    }}
                  >
                    <code className="issue-path">
                      {issue.path || t("common.root")}
                    </code>
                    <span className="issue-message">{issue.message}</span>
                    <code className="issue-keyword">{issue.keyword}</code>
                    <span className="issue-loc">
                      {issue.line}:{issue.column}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    );

  return (
    <div className="json-tool">
      <div className="tool-bar">
        {narrow ? (
          <Select
            className="view-select"
            label={t("json.viewsLabel")}
            value={view}
            onChange={switchView}
            options={VIEWS.map((id) => ({
              value: id,
              label: t(`json.views.${id}`),
            }))}
          />
        ) : (
          <div className="seg" role="group" aria-label={t("json.viewsLabel")}>
            {VIEWS.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => switchView(id)}
              >
                {t(`json.views.${id}`)}
              </button>
            ))}
          </div>
        )}
        <input
          ref={importRef}
          type="file"
          hidden
          aria-label={t("json.actions.openLabel")}
          className="source-file"
          accept=".json,.txt,application/json,text/plain"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f, "source");
            e.target.value = "";
          }}
        />
        {!narrow && (
          <>
            <span className="tool-bar-sep" />
            <button
              type="button"
              className="btn quiet"
              onClick={() => importRef.current?.click()}
            >
              <FolderOpen size={15} />
              {t("json.actions.open")}
            </button>
            <button
              type="button"
              className="icon-btn"
              title={t("json.actions.copy")}
              aria-label={t("json.actions.copy")}
              onClick={() => copyText(doc.source, notify)}
            >
              <Copy size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              title={t("json.actions.download")}
              aria-label={t("json.actions.download")}
              onClick={() =>
                downloadText(doc.source, filename, "application/json", notify)
              }
            >
              <Download size={15} />
            </button>
            <span className="tool-bar-sep" />
            <button
              type="button"
              className="btn"
              onClick={() => run("format")}
              disabled={busy === "format"}
            >
              {t("json.actions.format")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => run("format", { minify: true })}
              disabled={busy === "format"}
            >
              {t("json.actions.minify")}
            </button>
            <label className="input-group">
              <span className="hide-medium">{t("json.indent")}</span>
              <Select
                label={t("json.indent")}
                value={String(doc.indent)}
                onChange={(indent) =>
                  setDoc((d) => ({ ...d, indent: Number(indent) }))
                }
                options={["2", "4"].map((count) => ({
                  value: count,
                  label: t("json.indentOption", { count: Number(count) }),
                }))}
              />
            </label>
          </>
        )}
        <div className="tool-bar-end">
          <Menu
            label={t("json.actions.more")}
            className="icon-btn"
            align="end"
            trigger={<Ellipsis size={16} />}
            items={moreItems}
          />
          {(view === "compare" || view === "schema" || view === "patch") && (
            <button
              type="button"
              className="btn primary run-btn"
              onClick={() => run(view)}
            >
              {view === "compare" ? (
                <GitCompareArrows size={15} />
              ) : view === "patch" ? (
                <FileDiff size={15} />
              ) : (
                <ShieldCheck size={15} />
              )}
              {t(`json.${view}.run`)}
            </button>
          )}
        </div>
      </div>
      {narrow && (
        <div
          className="mobile-panes"
          role="tablist"
          aria-label={t("json.panes.mobileLabel")}
        >
          {mobileTabs.map(([pane, label, tab]) => (
            <button
              key={label}
              type="button"
              role="tab"
              className="pane-tab"
              aria-selected={mobile === pane && (!tab || right === tab)}
              onClick={() => {
                setMobile(pane);
                if (tab) setRight(tab);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="notice err" role="alert">
          <TriangleAlert size={14} />
          <span>{errorText}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("common.close")}
            onClick={() => setError(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {analysis?.valid &&
        analysis.duplicatePaths &&
        analysis.duplicatePaths.length > 0 && (
          <div className="notice warn">
            <TriangleAlert size={14} />
            <span>
              {t("json.warnings.duplicates", {
                paths: analysis.duplicatePaths.slice(0, 3).join(", "),
              })}
            </span>
          </div>
        )}
      <div className="json-body">
        <SplitPane
          id="json.report"
          direction="column"
          initial={0.66}
          min={0.3}
          max={0.85}
          label={t("json.panes.report")}
          collapsed={view === "inspect" || view === "convert"}
          mobile={mobile === "report" ? "second" : "first"}
          first={
            <SplitPane
              id="json.main"
              initial={0.52}
              label={t("json.panes.source")}
              mobile={mobile === "right" ? "second" : "first"}
              first={sourcePane}
              second={
                view === "inspect"
                  ? inspector
                  : view === "convert"
                    ? converter
                    : secondEditor(
                        view === "compare"
                          ? "comparison"
                          : view === "patch"
                            ? "patch"
                            : "schema",
                      )
              }
            />
          }
          second={report}
        />
      </div>
      <footer className="statusbar" aria-label={t("json.heading")}>
        {busy ? (
          <span>
            <LoaderCircle size={13} className="spin" />
            {t(
              busy === "analyze"
                ? "json.status.checking"
                : "json.status.processing",
            )}
            <button type="button" onClick={cancel}>
              {t("common.cancel")}
            </button>
          </span>
        ) : valid ? (
          <span className="status-ok">
            <CircleCheck size={13} />
            {t("json.status.valid")}
          </span>
        ) : analysis ? (
          <button
            type="button"
            className="status-err"
            onClick={() =>
              issues[0] &&
              editor.current?.focusRange(issues[0].offset, issues[0].length)
            }
          >
            <CircleX size={13} />
            {t("json.status.errors", { count: issues.length })}
          </button>
        ) : (
          <span>{t("json.status.checking")}</span>
        )}
        {valid && analysis && (
          <>
            <span>
              {t("json.status.values", { count: analysis.nodeCount })}
            </span>
            <span className="hide-narrow">
              {t("json.status.depth", { depth: analysis.maxDepth })}
            </span>
          </>
        )}
        <span>{bytes(sourceBytes)}</span>
        <span className="hide-narrow">
          {t("json.status.lines", { count: lines })}
        </span>
        {valid && analysis && analysis.unsafeCount > 0 && (
          <span className="status-warn" title={t("json.warnings.unsafe")}>
            <TriangleAlert size={13} />
            {t("json.status.unsafe", { count: analysis.unsafeCount })}
          </span>
        )}
        <span className="push">{t("json.status.cursor", cursor)}</span>
        <span className="hide-narrow">JSON</span>
      </footer>
    </div>
  );
}
