import { motion } from "motion/react";
import { Download, RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatRoute, navigate, setQuery, type Route } from "../../app/router";
import { queues } from "../../data/attention";
import { useToasts, useWorkspace } from "../../data/store";
import { useI18n, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { fadeUp, stagger } from "../../motion/tokens";
import { Kbd } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { downloadCsv } from "../../lib/csv";
import { BulkBar } from "./BulkBar";
import { OrderDrawer } from "./OrderDrawer";
import { OrdersTable } from "./OrdersTable";
import { pageSizes, placedOptions, placedSince, readQuery, runQuery, sortOptions, viewCounts, views, type View } from "./query";
import { orderStatusKey } from "./status";
import "./orders.css";

export function OrdersScreen({ route }: { route: Route }) {
  const { t, number, stamp } = useI18n();
  const { db, indexes } = useWorkspace();
  const { notify } = useToasts();
  const reduced = useReduced();
  const query = readQuery(route);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(query.q);

  const result = useMemo(() => runQuery(db, indexes, query), [db, indexes, query.view, query.q, query.payment, query.channel, query.shipping, query.placed, query.sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => viewCounts(db, indexes, placedSince(query.placed === "any" ? "any" : query.placed)), [db, indexes, query.placed]);
  const work = queues(db, indexes);
  const pages = Math.max(1, Math.ceil(result.rows.length / query.size));
  const page = Math.min(query.page, pages);
  const rows = result.rows.slice((page - 1) * query.size, page * query.size);

  // Remember the last measured search time for the product page claim.
  useEffect(() => {
    try {
      localStorage.setItem("orbit-last-query", JSON.stringify({ ms: result.ms, scanned: result.scanned }));
    } catch {
      /* optional */
    }
  }, [result]);

  // Search is typed freely and written to the address a moment later.
  useEffect(() => setDraft(query.q), [query.q]);
  useEffect(() => {
    if (draft === query.q) return;
    const timer = setTimeout(() => setQuery(route, { q: draft || undefined, page: undefined }), 140);
    return () => clearTimeout(timer);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const focus = () => searchRef.current?.focus();
    window.addEventListener("orbit:focus-search", focus);
    return () => window.removeEventListener("orbit:focus-search", focus);
  }, []);

  // Selection belongs to the current list; changing the view starts fresh.
  useEffect(() => setSelected(new Set()), [query.view, query.placed]);

  const update = (patch: Record<string, string | undefined>) => setQuery(route, { ...patch, page: undefined });
  const filtersActive = !!(query.q || query.payment || query.channel || query.shipping || route.query.get("placed") || route.query.get("sort"));
  const openOrder = (id: string) => navigate(formatRoute("orders", id, route.query));
  const closeOrder = () => navigate(formatRoute("orders", undefined, route.query));
  const active = route.id ? indexes.orders.get(route.id) : undefined;

  const exportRows = (ids?: Set<string>) => {
    const list = ids ? result.rows.filter((o) => ids.has(o.id)) : result.rows;
    downloadCsv(
      `orbit-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      [t("orders.csv.order"), t("orders.csv.placed"), t("orders.csv.customer"), t("orders.csv.email"), t("orders.csv.status"), t("orders.csv.payment"), t("orders.csv.total")],
      list.map((o) => {
        const customer = indexes.users.get(o.userId);
        return [o.id, stamp(o.date), customer?.name ?? "", customer?.email ?? "", t(orderStatusKey(o)), t(`status.payment.${indexes.payment(o)}` as Key), o.total.toFixed(2)];
      }),
    );
    notify({ key: "orders.exported", params: { count: list.length } }, "info");
  };

  const viewOptions = views.map((view: View) => ({ value: view, label: t(`orders.views.${view}` as Key), count: counts[view] }));

  return (
    <motion.div className="orders" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      <motion.header className="page-head" variants={fadeUp}>
        <div className="page-head__main">
          <h1 className="page-head__title">{t("orders.title")}</h1>
          <p className="page-head__subtitle">{t("orders.subtitle", { toPack: work.toPack.length, packed: work.packed.length, transit: work.transit.length })}</p>
        </div>
        <div className="page-head__side">
          <Button icon={<Download />} onClick={() => exportRows()}>
            {t("common.exportCsv")}
          </Button>
        </div>
      </motion.header>

      <motion.div className="orders__views" variants={fadeUp}>
        <Segmented variant="underline" label={t("orders.title")} value={query.view} onChange={(view) => update({ view: view === "all" ? undefined : view, placed: undefined })} options={viewOptions} />
      </motion.div>

      <motion.div className="orders__toolbar" variants={fadeUp}>
        <label className="search-field">
          <Search />
          <input ref={searchRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("orders.search")} aria-label={t("orders.search")} />
          {draft ? (
            <button type="button" className="search-field__clear" aria-label={t("common.close")} onClick={() => setDraft("")}>
              <X />
            </button>
          ) : (
            <Kbd>/</Kbd>
          )}
        </label>
        <div className="orders__filters">
          <Select label={t("orders.filters.period")} value={query.placed} onChange={(value) => update({ placed: value })} options={placedOptions.map((value) => ({ value, label: value === "any" ? t("orders.filters.any") : value === "today" ? t("orders.filters.today") : t("orders.filters.days", { count: Number(value) }) }))} />
          <Select label={t("orders.filters.payment")} value={query.payment} onChange={(value) => update({ payment: value || undefined })} options={[{ value: "", label: t("orders.filters.anyPayment") }, ...(["Paid", "Pending", "Failed", "Refunded", "Partial"] as const).map((value) => ({ value, label: t(`status.payment.${value}` as Key) }))]} />
          <Select label={t("orders.filters.channel")} value={query.channel} onChange={(value) => update({ channel: value || undefined })} options={[{ value: "", label: t("orders.filters.anyChannel") }, ...(["Web", "App", "Showroom"] as const).map((value) => ({ value, label: t(`channel.${value}` as Key) }))]} />
          <Select label={t("orders.filters.shipping")} value={query.shipping} onChange={(value) => update({ shipping: value || undefined })} options={[{ value: "", label: t("orders.filters.anyShipping") }, ...(["Standard", "Express", "Pickup"] as const).map((value) => ({ value, label: t(`shippingMethod.${value}` as Key) }))]} />
          <Select label={t("orders.filters.sort")} value={query.sort} onChange={(value) => update({ sort: value === "newest" ? undefined : value })} options={sortOptions.map((value) => ({ value, label: t(`orders.filters.${value}` as Key) }))} />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw />}
              onClick={() => {
                setDraft("");
                navigate(formatRoute("orders", route.id, query.view === "all" ? {} : { view: query.view }), { replace: true });
              }}
            >
              {t("orders.filters.reset")}
            </Button>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <OrdersTable
          rows={rows}
          query={query}
          total={result.rows.length}
          selected={selected}
          setSelected={setSelected}
          activeId={route.id}
          onOpen={openOrder}
          onReset={() => {
            setDraft("");
            navigate(formatRoute("orders", undefined, query.view === "all" ? {} : { view: query.view }), { replace: true });
          }}
        />
      </motion.div>

      <motion.footer className="orders__footer" variants={fadeUp}>
        <p className="num">{t("orders.pagination", { from: result.rows.length ? number((page - 1) * query.size + 1) : "0", to: number(Math.min(page * query.size, result.rows.length)), total: number(result.rows.length) })}</p>
        <div className="orders__pager">
          <Select label={t("orders.rows")} value={String(query.size)} onChange={(value) => update({ size: value === "25" ? undefined : value })} options={pageSizes.map((value) => ({ value: String(value), label: `${t("orders.rows")}: ${value}` }))} />
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setQuery(route, { page: page - 1 > 1 ? String(page - 1) : undefined })} aria-label={t("orders.previousPage")}>
            ‹
          </Button>
          <span className="orders__page num">
            {page} / {pages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setQuery(route, { page: String(page + 1) })} aria-label={t("orders.nextPage")}>
            ›
          </Button>
        </div>
      </motion.footer>

      <BulkBar selected={selected} onClear={() => setSelected(new Set())} onExport={() => exportRows(selected)} />
      <OrderDrawer order={active} missingId={route.id && !active ? route.id : undefined} onClose={closeOrder} />
    </motion.div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="ui-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
