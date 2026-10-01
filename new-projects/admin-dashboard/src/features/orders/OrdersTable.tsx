import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, Inbox, SearchX } from "lucide-react";
import { forwardRef, memo, useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useWorkspace } from "../../data/store";
import type { Order } from "../../data/types";
import { useI18n } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, foldAway, staggerDelay } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Checkbox, EmptyState, ProductThumb } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import type { OrdersQuery } from "./query";
import { OrderStatus, PaymentStatus } from "./status";

type Props = {
  rows: Order[];
  query: OrdersQuery;
  total: number;
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  activeId?: string;
  onOpen: (id: string) => void;
  onReset: () => void;
};

export function OrdersTable({ rows, query, total, selected, setSelected, activeId, onOpen, onReset }: Props) {
  const { t } = useI18n();
  const reduced = useReduced();
  const [focus, setFocus] = useState(0);
  const anchor = useRef<string | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const firstPaint = useRef(true);
  // Row callbacks stay the same between renders, so unchanged rows skip re-rendering.
  const latest = useRef({ rows, selected, onOpen });
  latest.current = { rows, selected, onOpen };
  useEffect(() => {
    const timer = setTimeout(() => (firstPaint.current = false), 900);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => setFocus((index) => Math.min(index, Math.max(0, rows.length - 1))), [rows.length]);

  // Another queue, filter, sort or page is another list: it replaces the rows in one step, so old and new text
  // never overlap. Within the same list, rows that leave (packed orders dropping out of a queue) fold away one by one.
  const swapKey = [query.view, query.q, query.payment, query.channel, query.shipping, query.placed, query.sort, query.page, query.size].join("|");

  const toggle = useCallback((id: string, event?: MouseEvent | KeyboardEvent) => {
    const { rows, selected } = latest.current;
    const next = new Set(selected);
    if (event?.shiftKey && anchor.current) {
      // Shift extends the selection from the last clicked row.
      const from = rows.findIndex((row) => row.id === anchor.current);
      const to = rows.findIndex((row) => row.id === id);
      if (from >= 0 && to >= 0) {
        const [a, b] = from < to ? [from, to] : [to, from];
        for (let i = a; i <= b; i++) next.add(rows[i].id);
        setSelected(next);
        return;
      }
    }
    if (next.has(id)) next.delete(id);
    else next.add(id);
    anchor.current = id;
    setSelected(next);
  }, [setSelected]);
  const openRow = useCallback((id: string, index: number) => {
    setFocus(index);
    latest.current.onOpen(id);
  }, []);
  const pageIds = rows.map((row) => row.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("input, button:not(.orders-row), select")) return;
    const move = (index: number) => {
      event.preventDefault();
      const next = Math.max(0, Math.min(rows.length - 1, index));
      setFocus(next);
      body.current?.querySelectorAll<HTMLElement>(".orders-row")[next]?.focus();
    };
    if (event.key === "j" || event.key === "ArrowDown") move(focus + 1);
    else if (event.key === "k" || event.key === "ArrowUp") move(focus - 1);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(rows.length - 1);
    else if ((event.key === "x" || event.key === "X") && rows[focus]) {
      event.preventDefault();
      toggle(rows[focus].id, event);
    } else if (event.key === "Enter" && rows[focus]) {
      event.preventDefault();
      onOpen(rows[focus].id);
    }
  };

  if (!total) {
    const queue = ["toPack", "awaiting", "packed", "transit"].includes(query.view) && !query.q && !query.payment && !query.channel && !query.shipping;
    return (
      <div className="orders-table is-empty">
        {query.q ? (
          <EmptyState icon={<SearchX />} title={t("orders.empty.title")} text={t("orders.empty.search", { query: query.q })} action={<Button onClick={onReset}>{t("orders.filters.reset")}</Button>} />
        ) : queue ? (
          <EmptyState icon={<Inbox />} title={t("orders.empty.queue")} text={t("orders.empty.queueText")} />
        ) : (
          <EmptyState icon={<SearchX />} title={t("orders.empty.title")} text={t("orders.empty.widen")} action={<Button onClick={onReset}>{t("orders.filters.reset")}</Button>} />
        )}
      </div>
    );
  }

  return (
    <div className="orders-table" role="table" aria-label={t("orders.title")} aria-rowcount={total} onKeyDown={onKeyDown}>
      <div className="orders-row orders-row--head" role="row">
        <span role="columnheader" className="orders-cell--check">
          <Checkbox
            checked={allOnPage}
            indeterminate={!allOnPage && someOnPage}
            label={t("orders.columns.selectPage")}
            onChange={(checked) => {
              const next = new Set(selected);
              pageIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
              setSelected(next);
            }}
          />
        </span>
        <span role="columnheader">{t("orders.columns.order")}</span>
        <span role="columnheader">{t("orders.columns.customer")}</span>
        <span role="columnheader" className="orders-cell--items">
          {t("orders.columns.items")}
        </span>
        <span role="columnheader">{t("orders.columns.payment")}</span>
        <span role="columnheader">{t("orders.columns.status")}</span>
        <span role="columnheader" className="is-num">
          {t("orders.columns.total")}
        </span>
        <span aria-hidden="true" />
      </div>
      <motion.div
        key={swapKey}
        className="orders-table__body"
        role="rowgroup"
        ref={body}
        initial={firstPaint.current || reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration.fast, ease: ease.out }}
      >
        <AnimatePresence initial={false}>
          {rows.map((order, index) => (
            <Row
              key={order.id}
              order={order}
              index={index}
              first={firstPaint.current}
              reduced={reduced}
              focused={index === focus}
              active={order.id === activeId}
              checked={selected.has(order.id)}
              onToggle={toggle}
              onOpen={openRow}
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

type RowProps = { order: Order; index: number; first: boolean; reduced: boolean; focused: boolean; active: boolean; checked: boolean; onToggle: (id: string, event?: MouseEvent) => void; onOpen: (id: string, index: number) => void };

const Row = memo(forwardRef<HTMLDivElement, RowProps>(function Row({ order, index, first, reduced, focused, active, checked, onToggle, onOpen }, ref) {
  const { t, money, relative } = useI18n();
  const { indexes } = useWorkspace();
  const customer = indexes.users.get(order.userId);
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <motion.div
      ref={ref}
      role="row"
      tabIndex={focused ? 0 : -1}
      aria-selected={checked}
      className={cx("orders-row", checked && "is-checked", active && "is-active")}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out, delay: first ? 0.12 + staggerDelay(index, 0.03) : 0 } }}
      exit={reduced ? { opacity: 0, transition: { duration: duration.fast } } : foldAway}
      onClick={() => onOpen(order.id, index)}
    >
      <span role="cell" className="orders-cell--check">
        <Checkbox checked={checked} label={t("orders.columns.select", { id: order.id })} onChange={() => undefined} onClick={(event) => onToggle(order.id, event)} />
      </span>
      <span role="cell" className="orders-cell--order">
        {/* While the order is open, its number lives in the panel; the row keeps a quiet copy. */}
        {active ? (
          <strong className="num orders-id is-ghost">{order.id}</strong>
        ) : (
          <motion.strong layoutId={`order-id-${order.id}`} className="num orders-id">
            {order.id}
          </motion.strong>
        )}
        <small>{relative(order.date)}</small>
      </span>
      <span role="cell" className="orders-cell--customer">
        {customer && <Avatar name={customer.name} tone={customer.avatar} size={30} />}
        <span>
          <strong>{customer?.name}</strong>
          <small>
            {order.city}, {order.country}
          </small>
        </span>
      </span>
      <span role="cell" className="orders-cell--items">
        <span className="thumb-stack" aria-hidden="true">
          {order.items.slice(0, 3).map((item) => (
            <ProductThumb key={item.productId} product={indexes.products.get(item.productId)} size={28} />
          ))}
        </span>
        <small>{t("common.items", { count: units })}</small>
      </span>
      <span role="cell" className="orders-cell--payment">
        <PaymentStatus state={indexes.payment(order)} />
      </span>
      <span role="cell" className="orders-cell--status">
        <OrderStatus order={order} />
      </span>
      <span role="cell" className="is-num num orders-cell--total">
        {money(order.total)}
      </span>
      <span className="orders-cell--go" aria-hidden="true">
        <ChevronRight />
      </span>
    </motion.div>
  );
}));
