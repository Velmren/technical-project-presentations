import { motion } from "motion/react";
import { CreditCard, Download, Landmark, SearchX, Undo2, Wallet, AlertTriangle, ArrowDownLeft, ArrowUpRight, Hourglass } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRoute, navigate, setQuery, type Route } from "../../app/router";
import { periodDays } from "../../data/metrics";
import { useToasts, useWorkspace } from "../../data/store";
import type { Payment, Period } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { downloadCsv } from "../../lib/csv";
import { normalize } from "../../lib/text";
import { Counter } from "../../motion/Counter";
import { useReduced } from "../../motion/MotionPreference";
import { fadeUp, stagger } from "../../motion/tokens";
import { Badge, type Tone } from "../../ui/Badge";
import { EmptyState } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { DataTable, type Column } from "../../ui/DataTable";
import { Pager, SearchField, Select } from "../../ui/Form";
import { Segmented } from "../../ui/Segmented";
import { periods, usePeriod } from "../overview/period";
import { PaymentDrawer } from "./PaymentDrawer";
import "./payments.css";

const views = ["all", "charges", "refunds", "pending", "failed"] as const;
type View = (typeof views)[number];

const inView = (p: Payment, view: View) =>
  view === "all" ? true : view === "charges" ? p.type === "Charge" && p.status === "Paid" : view === "refunds" ? p.type === "Refund" : view === "pending" ? p.status === "Pending" : p.status === "Failed";

export function paymentTone(p: Payment): Tone {
  if (p.type === "Refund") return "warning";
  return p.status === "Paid" ? "positive" : p.status === "Pending" ? "warning" : "danger";
}

export function PaymentBadge({ payment }: { payment: Payment }) {
  const { t } = useI18n();
  const key = payment.type === "Refund" ? "payments.status.Refund" : `payments.status.${payment.status}`;
  return <Badge tone={paymentTone(payment)}>{t(key as Key)}</Badge>;
}

export function MethodLabel({ payment }: { payment: Payment }) {
  const { t } = useI18n();
  const Icon = payment.method === "Transfer" ? Landmark : payment.method === "Wallet" ? Wallet : CreditCard;
  return (
    <span className="method">
      <Icon />
      <span>
        {t(`paymentMethod.${payment.method}` as Key)}
        {payment.last4 && <span className="num"> •• {payment.last4}</span>}
      </span>
    </span>
  );
}

export function PaymentsScreen({ route }: { route: Route }) {
  const { t, money, relative, stamp } = useI18n();
  const { db, indexes } = useWorkspace();
  const { notify } = useToasts();
  const reduced = useReduced();
  const [period, setPeriod] = usePeriod(db.settings.defaultPeriod);
  const get = (key: string) => route.query.get(key) ?? "";
  const view = (views as readonly string[]).includes(get("view")) ? (get("view") as View) : "all";
  const method = get("method");
  const sort = get("sort") === "amount" ? "amount" : "newest";
  const size = [25, 50, 100].includes(Number(get("size"))) ? Number(get("size")) : 25;
  const [draft, setDraft] = useState(get("q"));
  const update = (patch: Record<string, string | undefined>) => setQuery(route, { ...patch, page: undefined });

  useEffect(() => setDraft(get("q")), [route.query.get("q")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (draft === get("q")) return;
    const timer = setTimeout(() => update({ q: draft || undefined }), 140);
    return () => clearTimeout(timer);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const since = periodDays(period)[0];
  const inPeriod = useMemo(() => db.payments.filter((p) => p.date >= since), [db.payments, since]);
  const totals = useMemo(() => {
    let received = 0,
      refunded = 0,
      refunds = 0,
      pending = 0,
      pendingCount = 0,
      failed = 0;
    for (const p of inPeriod) {
      if (p.type === "Charge" && p.status === "Paid") received += p.amount;
      if (p.type === "Refund") {
        refunded += p.amount;
        refunds++;
      }
      if (p.status === "Pending") {
        pending += p.amount;
        pendingCount++;
      }
      if (p.status === "Failed" && indexes.payment(indexes.orders.get(p.orderId)!) === "Failed") failed++;
    }
    return { received, refunded, refunds, net: received - refunded, pending, pendingCount, failed };
  }, [inPeriod, indexes]);

  const rows = useMemo(() => {
    const q = normalize(draft.trim());
    const list = inPeriod.filter((p) => {
      if (!inView(p, view)) return false;
      if (method && p.method !== method) return false;
      if (!q) return true;
      if (normalize(p.id).includes(q) || normalize(p.orderId).includes(q)) return true;
      const order = indexes.orders.get(p.orderId);
      const customer = order && indexes.users.get(order.userId);
      return !!customer && (normalize(customer.name).includes(q) || customer.email.includes(q));
    });
    return sort === "amount" ? [...list].sort((a, b) => b.amount - a.amount) : list;
  }, [inPeriod, view, method, sort, get("q"), indexes]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = Object.fromEntries(views.map((v) => [v, inPeriod.filter((p) => inView(p, v)).length])) as Record<View, number>;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.min(Math.max(1, Number(get("page")) || 1), pages);
  const visible = rows.slice((page - 1) * size, page * size);

  const columns: Column<Payment>[] = [
    {
      key: "payment",
      header: t("payments.columns.payment"),
      width: "minmax(120px, 1fr)",
      area: "id",
      render: (p) => (
        <span className="cell-stack">
          <strong className="num">{p.id}</strong>
          <small>{relative(p.date)}</small>
        </span>
      ),
    },
    {
      key: "order",
      header: t("payments.columns.order"),
      width: "minmax(170px, 1.5fr)",
      area: "who",
      render: (p) => {
        const order = indexes.orders.get(p.orderId);
        const customer = order && indexes.users.get(order.userId);
        return (
          <span className="cell-stack">
            <strong className="num">{p.orderId}</strong>
            <small>{customer?.name}</small>
          </span>
        );
      },
    },
    { key: "method", header: t("payments.columns.method"), width: "minmax(150px, 1.1fr)", hide: 720, render: (p) => <MethodLabel payment={p} /> },
    { key: "status", header: t("payments.columns.status"), width: "minmax(130px, 1fr)", area: "status", render: (p) => <PaymentBadge payment={p} /> },
    {
      key: "amount",
      header: t("payments.columns.amount"),
      width: "minmax(100px, 0.8fr)",
      align: "right",
      area: "amount",
      render: (p) => (
        <strong className={cx("num", "amount", p.type === "Refund" && "is-refund", p.status === "Failed" && "is-failed")}>
          {p.type === "Refund" ? "−" : ""}
          {money(p.amount)}
        </strong>
      ),
    },
  ];

  const tiles = [
    { key: "received", icon: ArrowDownLeft, value: totals.received, note: t("payments.tiles.receivedNote") },
    { key: "refunded", icon: Undo2, value: totals.refunded, note: t("payments.tiles.refundedNote", { count: totals.refunds }) },
    { key: "net", icon: ArrowUpRight, value: totals.net, note: t("payments.tiles.netNote") },
    { key: "pending", icon: Hourglass, value: totals.pending, note: t("payments.tiles.pendingNote", { count: totals.pendingCount, failed: totals.failed }) },
  ];

  return (
    <motion.div className="page" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      <motion.header className="page-head" variants={fadeUp}>
        <div className="page-head__main">
          <h1 className="page-head__title">{t("payments.title")}</h1>
          <p className="page-head__subtitle">{t("payments.subtitle", { period: t(`period.long.d${period}` as Key) })}</p>
        </div>
        <div className="page-head__side">
          <Segmented label={t("period.label")} value={period} onChange={(v) => setPeriod(v as Period)} options={periods.map((value) => ({ value, label: t(`period.options.d${value}` as Key) }))} />
        </div>
      </motion.header>
      <motion.section className="kpis pay-tiles" variants={fadeUp}>
        {tiles.map((tile, i) => (
          <article key={tile.key} className={cx("kpi", `pay-tile--${tile.key}`)}>
            <div className="kpi__top">
              <span className="kpi__icon" aria-hidden="true">
                <tile.icon />
              </span>
              <span className="kpi__label">{t(`payments.tiles.${tile.key}` as Key)}</span>
            </div>
            <p className="kpi__value num">
              <Counter value={tile.value} format={(v) => money(Math.round(v))} delay={0.06 * i} />
            </p>
            <p className="pay-tile__note">{tile.note}</p>
          </article>
        ))}
      </motion.section>
      <motion.div className="page__views" variants={fadeUp}>
        <Segmented variant="underline" label={t("payments.title")} value={view} onChange={(v) => update({ view: v === "all" ? undefined : v })} options={views.map((v) => ({ value: v, label: t(`payments.views.${v}` as Key), count: counts[v] }))} />
      </motion.div>
      <motion.div className="page__toolbar" variants={fadeUp}>
        <SearchField value={draft} onChange={setDraft} placeholder={t("payments.search")} />
        <div className="page__filters">
          <Select label={t("payments.filters.method")} value={method} onChange={(v) => update({ method: v || undefined })} options={[{ value: "", label: t("payments.filters.anyMethod") }, ...(["Card", "Wallet", "Transfer"] as const).map((m) => ({ value: m, label: t(`paymentMethod.${m}` as Key) }))]} />
          <Select label={t("orders.filters.sort")} value={sort} onChange={(v) => update({ sort: v === "newest" ? undefined : v })} options={[{ value: "newest", label: t("orders.filters.newest") }, { value: "amount", label: t("payments.filters.amount") }]} />
          <Button
            variant="ghost"
            size="sm"
            icon={<Download />}
            onClick={() => {
              downloadCsv(
                `orbit-payments-${new Date().toISOString().slice(0, 10)}.csv`,
                [t("payments.csv.id"), t("payments.csv.date"), t("payments.csv.order"), t("payments.csv.type"), t("payments.csv.method"), t("payments.csv.status"), t("payments.csv.amount")],
                rows.map((p) => [p.id, stamp(p.date), p.orderId, t(`payments.type.${p.type}` as Key), t(`paymentMethod.${p.method}` as Key), t((p.type === "Refund" ? "payments.status.Refund" : `payments.status.${p.status}`) as Key), (p.type === "Refund" ? -p.amount : p.amount).toFixed(2)]),
              );
              notify({ key: "payments.exported", params: { count: rows.length } }, "info");
            }}
          >
            {t("common.exportCsv")}
          </Button>
        </div>
      </motion.div>
      <motion.div variants={fadeUp}>
        <DataTable
          label={t("payments.title")}
          rows={visible}
          columns={columns}
          getId={(p) => p.id}
          total={rows.length}
          activeId={route.id}
          onOpen={(id) => navigate(formatRoute("payments", id, route.query))}
          swapKey={route.query.toString()}
          mobile={{ areas: '"id amount" "who status"', columns: "minmax(0, 1fr) auto" }}
          empty={<EmptyState icon={view === "failed" ? <AlertTriangle /> : <SearchX />} title={t("payments.empty.title")} text={draft ? t("payments.empty.search", { query: draft }) : t("payments.empty.view")} />}
        />
      </motion.div>
      {rows.length > 0 && (
        <motion.div variants={fadeUp}>
          <Pager page={page} pages={pages} total={rows.length} size={size} sizes={[25, 50, 100]} onPage={(next) => setQuery(route, { page: next > 1 ? String(next) : undefined })} onSize={(s) => update({ size: s === 25 ? undefined : String(s) })} />
        </motion.div>
      )}
      <PaymentDrawer paymentId={route.id} onClose={() => navigate(formatRoute("payments", undefined, route.query))} />
    </motion.div>
  );
}
