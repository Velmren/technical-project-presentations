import { AnimatePresence, motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { forwardRef, memo, useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease, foldAway, staggerDelay } from "../motion/tokens";
import { Checkbox } from "./Blocks";
import { cx } from "./Button";

export type Column<T> = {
  key: string;
  header: ReactNode;
  width: string;
  render: (row: T) => ReactNode;
  align?: "right";
  /** Grid area on phones, where rows become cards. */
  area?: string;
  /** Hidden below this viewport width. */
  hide?: 1320 | 1100 | 720;
};

type Props<T> = {
  label: string;
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  total: number;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  selectLabel?: (id: string) => string;
  selectPageLabel?: string;
  activeId?: string;
  onOpen: (id: string) => void;
  empty: ReactNode;
  /** grid-template-areas and columns used on phones. */
  mobile: { areas: string; columns: string };
  className?: string;
  /** Changes whenever the list itself changes (view, filter, sort, page): the old rows go at once, the new ones fade in. */
  swapKey?: string;
};

/**
 * List of records as a grid of rows.
 * Switching the list (swapKey) replaces the rows in one step, so old and new text never overlap.
 * Within the same list a removed row folds away and the rows below close the gap.
 * Keyboard: J/K or arrows move, X selects, Shift+X or Shift+click selects a range, Enter opens.
 */
export function DataTable<T>({ label, rows, columns, getId, total, selectable, selected = new Set(), onSelectedChange, selectLabel, selectPageLabel, activeId, onOpen, empty, mobile, className, swapKey = "" }: Props<T>) {
  const reduced = useReduced();
  const [focus, setFocus] = useState(0);
  const anchor = useRef<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const firstPaint = useRef(true);
  const latest = useRef({ rows, selected, onOpen, onSelectedChange, getId });
  latest.current = { rows, selected, onOpen, onSelectedChange, getId };
  useEffect(() => {
    const timer = setTimeout(() => (firstPaint.current = false), 900);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => setFocus((index) => Math.min(index, Math.max(0, rows.length - 1))), [rows.length]);

  const toggle = useCallback((id: string, event?: MouseEvent | KeyboardEvent) => {
    const { rows, selected, onSelectedChange, getId } = latest.current;
    if (!onSelectedChange) return;
    const next = new Set(selected);
    if (event?.shiftKey && anchor.current) {
      const ids = rows.map(getId);
      const from = ids.indexOf(anchor.current);
      const to = ids.indexOf(id);
      if (from >= 0 && to >= 0) {
        const [a, b] = from < to ? [from, to] : [to, from];
        for (let i = a; i <= b; i++) next.add(ids[i]);
        onSelectedChange(next);
        return;
      }
    }
    if (next.has(id)) next.delete(id);
    else next.add(id);
    anchor.current = id;
    onSelectedChange(next);
  }, []);
  const open = useCallback((id: string, index: number) => {
    setFocus(index);
    latest.current.onOpen(id);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("input, button, select, a")) return;
    const move = (index: number) => {
      event.preventDefault();
      const next = Math.max(0, Math.min(rows.length - 1, index));
      setFocus(next);
      body.current?.querySelectorAll<HTMLElement>(".dt-row")[next]?.focus();
    };
    if (event.key === "j" || event.key === "ArrowDown") move(focus + 1);
    else if (event.key === "k" || event.key === "ArrowUp") move(focus - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(rows.length - 1);
    else if ((event.key === "x" || event.key === "X") && rows[focus] && selectable) {
      event.preventDefault();
      toggle(getId(rows[focus]), event);
    } else if (event.key === "Enter" && rows[focus]) {
      event.preventDefault();
      onOpen(getId(rows[focus]));
    }
  };

  if (!total) return <div className={cx("dt is-empty", className)}>{empty}</div>;

  const ids = rows.map(getId);
  const allOnPage = ids.length > 0 && ids.every((id) => selected.has(id));
  const someOnPage = ids.some((id) => selected.has(id));
  // A column hidden at a breakpoint also drops its track, so the remaining cells keep their own widths.
  const template = (below: number) => [selectable ? "36px" : "", ...columns.filter((c) => !c.hide || c.hide < below).map((c) => c.width), "20px"].filter(Boolean).join(" ");
  const style = { "--dt-cols": template(Infinity), "--dt-cols-1320": template(1320), "--dt-cols-1100": template(1100), "--dt-areas": mobile.areas, "--dt-mobile-cols": mobile.columns } as CSSProperties;

  return (
    <div className={cx("dt", className)} role="table" aria-label={label} aria-rowcount={total} onKeyDown={onKeyDown} style={style}>
      <div className="dt-row dt-row--head" role="row">
        {selectable && (
          <span role="columnheader" className="dt-cell dt-cell--check">
            <Checkbox
              checked={allOnPage}
              indeterminate={!allOnPage && someOnPage}
              label={selectPageLabel ?? ""}
              onChange={(checked) => {
                const next = new Set(selected);
                ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
                onSelectedChange?.(next);
              }}
            />
          </span>
        )}
        {columns.map((column) => (
          <span key={column.key} role="columnheader" className={cx("dt-cell", column.align === "right" && "is-num", column.hide && `hide-${column.hide}`)}>
            {column.header}
          </span>
        ))}
        <span aria-hidden="true" />
      </div>
      <motion.div
        key={swapKey}
        className="dt-body"
        role="rowgroup"
        ref={body}
        initial={firstPaint.current || reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration.fast, ease: ease.out }}
      >
        <AnimatePresence initial={false}>
          {rows.map((row, index) => {
            const id = getId(row);
            return (
              <Row
                key={id}
                id={id}
                row={row}
                index={index}
                columns={columns}
                first={firstPaint.current}
                reduced={reduced}
                focused={index === focus}
                active={id === activeId}
                checked={selected.has(id)}
                selectable={!!selectable}
                selectLabel={selectLabel?.(id) ?? ""}
                onToggle={toggle}
                onOpen={open}
              />
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

type RowProps<T> = {
  id: string;
  row: T;
  index: number;
  columns: Column<T>[];
  first: boolean;
  reduced: boolean;
  focused: boolean;
  active: boolean;
  checked: boolean;
  selectable: boolean;
  selectLabel: string;
  onToggle: (id: string, event?: MouseEvent) => void;
  onOpen: (id: string, index: number) => void;
};

const Row = memo(
  forwardRef<HTMLDivElement, RowProps<unknown>>(function Row({ id, row, index, columns, first, reduced, focused, active, checked, selectable, selectLabel, onToggle, onOpen }, ref) {
    return (
      <motion.div
        ref={ref}
        role="row"
        tabIndex={focused ? 0 : -1}
        aria-selected={selectable ? checked : undefined}
        className={cx("dt-row", checked && "is-checked", active && "is-active")}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out, delay: first ? 0.12 + staggerDelay(index, 0.03) : 0 } }}
        exit={reduced ? { opacity: 0, transition: { duration: duration.fast } } : foldAway}
        onClick={() => onOpen(id, index)}
      >
        {selectable && (
          <span role="cell" className="dt-cell dt-cell--check" style={{ "--area": "check" } as CSSProperties}>
            <Checkbox checked={checked} label={selectLabel} onChange={() => undefined} onClick={(event) => onToggle(id, event)} />
          </span>
        )}
        {columns.map((column) => (
          <span key={column.key} role="cell" className={cx("dt-cell", `dt-cell--${column.key}`, column.align === "right" && "is-num", column.hide && `hide-${column.hide}`)} style={column.area ? ({ "--area": column.area } as CSSProperties) : undefined}>
            {column.render(row)}
          </span>
        ))}
        <span className="dt-cell dt-go" aria-hidden="true">
          <ChevronRight />
        </span>
      </motion.div>
    );
  }),
) as unknown as <T>(props: RowProps<T> & { ref?: React.Ref<HTMLDivElement> }) => React.ReactElement;

