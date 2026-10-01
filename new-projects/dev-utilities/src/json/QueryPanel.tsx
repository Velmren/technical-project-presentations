import { useState } from "react";
import { Copy, TriangleAlert, ListFilter } from "lucide-react";
import type { QueryMatch, QueryResult } from "../json-query";
import { useI18n, type MessageKey } from "../i18n";
import { Menu } from "../ui/Menu";
import { ROW, Summary, useWindow, valueClass } from "./TreeView";
import { queryExamples } from "./samples";

export type QueryState =
  | { status: "idle" }
  | { status: "running"; previous?: QueryResult }
  | { status: "done"; result: QueryResult }
  | {
      status: "error";
      message: string;
      index?: number;
      previous?: QueryResult;
    };

type Props = {
  expression: string;
  onExpression: (value: string) => void;
  state: QueryState;
  blocked: string | null;
  selectedPath: string | null;
  onSelect: (match: QueryMatch) => void;
  onCopy: (kind: "values" | "paths" | "pointers") => void;
};

const syntax = [
  ["root", "$"],
  ["child", ".name  ['name']"],
  ["index", "[0]  [-1]"],
  ["slice", "[1:3]"],
  ["wildcard", "*"],
  ["descendant", "..name"],
  ["filter", "[?@.p95Ms > 200]"],
  ["compare", "==  !=  <  <=  >  >="],
  ["logic", "&&  ||  !"],
  ["functions", "length()  count()  match()  search()  value()"],
] as const;

// Reference and runnable examples; fills the free space under short result lists.
function SyntaxGuide({
  onExpression,
}: {
  onExpression: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="guide">
      <h3>{t("json.query.guide.examples")}</h3>
      <ul className="guide-examples">
        {queryExamples.map((example) => (
          <li key={example.id}>
            <button type="button" onClick={() => onExpression(example.query)}>
              <code>{example.query}</code>
              <span>
                {t(`json.query.exampleItems.${example.id}` as MessageKey)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <h3>{t("json.query.guide.syntax")}</h3>
      <dl className="guide-syntax">
        {syntax.map(([id, code]) => (
          <div key={id}>
            <dt>
              <code>{code}</code>
            </dt>
            <dd>{t(`json.query.guide.items.${id}` as MessageKey)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function QueryPanel({
  expression,
  onExpression,
  state,
  blocked,
  selectedPath,
  onSelect,
  onCopy,
}: Props) {
  const { t, num } = useI18n();
  const result =
    state.status === "done"
      ? state.result
      : state.status === "running" || state.status === "error"
        ? state.previous
        : undefined;
  const matches = result?.matches || [];
  const { box, first, last, reveal } = useWindow(matches.length);
  const [active, setActive] = useState(0);
  const stale = state.status !== "done";
  const idle = !expression.trim();
  const none = !!result && !matches.length && state.status === "done";
  // Paths line up in one column sized to the longest path, within reason.
  const pathColumn = Math.min(
    56,
    matches.reduce((widest, m) => Math.max(widest, m.path.length), 12),
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (!matches.length) return;
    let next = active;
    if (e.key === "ArrowDown") next = active + 1;
    else if (e.key === "ArrowUp") next = active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = matches.length - 1;
    else if (e.key !== "Enter") return;
    e.preventDefault();
    next = Math.max(0, Math.min(matches.length - 1, next));
    setActive(next);
    reveal(next);
    onSelect(matches[next]);
  }

  return (
    <div className="query">
      <div className="query-bar">
        <label className="sr-only" htmlFor="jsonpath-input">
          {t("json.query.label")}
        </label>
        <input
          id="jsonpath-input"
          className={
            "input query-input" + (state.status === "error" ? " invalid" : "")
          }
          value={expression}
          onChange={(e) => onExpression(e.target.value)}
          placeholder={t("json.query.placeholder")}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-invalid={state.status === "error"}
          aria-describedby="jsonpath-status"
        />
        <Menu
          label={t("json.query.examples")}
          className="btn quiet"
          align="end"
          trigger={
            <>
              <ListFilter size={15} />
              <span className="hide-narrow">{t("json.query.examples")}</span>
            </>
          }
          items={queryExamples.map((example) => ({
            id: example.id,
            label: t(`json.query.exampleItems.${example.id}` as MessageKey),
            hint: example.query,
            onSelect: () => onExpression(example.query),
          }))}
        />
      </div>
      <div className="query-meta" id="jsonpath-status" aria-live="polite">
        {blocked ? (
          <span className="status-warn">{blocked}</span>
        ) : state.status === "error" ? (
          <span className="status-err query-error">{state.message}</span>
        ) : idle ? (
          <span>{t("json.query.idle")}</span>
        ) : result ? (
          <>
            <span className={stale ? "is-stale" : ""}>
              <strong>
                {t("json.query.matches", { count: result.total })}
              </strong>
              {result.countCapped ? "+" : ""}
            </span>
            <span className="query-std">{t("json.query.syntax")}</span>
            <Menu
              label={t("json.query.copy")}
              className="icon-btn query-copy"
              align="end"
              trigger={<Copy size={14} />}
              items={(["values", "paths", "pointers"] as const).map((kind) => ({
                id: kind,
                label: t(`json.query.copyItems.${kind}`),
                onSelect: () => onCopy(kind),
              }))}
            />
          </>
        ) : (
          <span>{t("json.status.checking")}</span>
        )}
      </div>
      {result?.approximate && !blocked && (
        <div className="notice warn">
          <TriangleAlert size={14} />
          <span>{t("json.query.approx")}</span>
        </div>
      )}
      {none && !blocked && (
        <div className="query-none">
          <strong>{t("json.query.none")}</strong>
          <span>{t("json.query.noneHint")}</span>
        </div>
      )}
      {matches.length > 0 && (
        <div
          className={"results-table" + (stale ? " is-stale" : "")}
          style={{ "--path-col": pathColumn + 1 + "ch" } as React.CSSProperties}
        >
          <div className="results-head" aria-hidden="true">
            <span className="result-index">#</span>
            <span className="result-path">{t("json.query.columns.path")}</span>
            <span className="result-type">{t("json.query.columns.type")}</span>
            <span>{t("json.query.columns.value")}</span>
          </div>
          <div
            ref={box}
            className="results"
            role="listbox"
            aria-label={t("json.query.results")}
            tabIndex={0}
            aria-activedescendant={
              matches[active] ? `match-${active}` : undefined
            }
            onKeyDown={onKeyDown}
          >
            <div style={{ height: matches.length * ROW, position: "relative" }}>
              {matches.slice(first, last).map((match, i) => {
                const index = first + i;
                return (
                  <div
                    key={index}
                    id={`match-${index}`}
                    role="option"
                    aria-selected={selectedPath === match.pointer}
                    className={
                      "result-row" +
                      (selectedPath === match.pointer ? " selected" : "") +
                      (index === active ? " active" : "")
                    }
                    style={{ top: index * ROW }}
                    title={match.path}
                    onClick={() => {
                      setActive(index);
                      onSelect(match);
                    }}
                  >
                    <span className="result-index">{num(index + 1)}</span>
                    <span className="result-path">{match.path}</span>
                    <span className="result-type">
                      {t(`json.types.${match.type}` as MessageKey)}
                    </span>
                    {match.type === "object" || match.type === "array" ? (
                      <Summary type={match.type} children={match.children} />
                    ) : (
                      <span className={"tree-value " + valueClass(match.type)}>
                        {match.preview}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {result && result.total > matches.length && (
            <div className="results-foot">
              {t("json.query.limited", {
                shown: num(matches.length),
                total: num(result.total),
              })}
            </div>
          )}
        </div>
      )}
      {(idle || none || matches.length < 12) && !blocked && (
        <SyntaxGuide onExpression={onExpression} />
      )}
    </div>
  );
}
