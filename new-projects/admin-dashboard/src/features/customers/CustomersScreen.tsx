import { motion } from "motion/react";
import { Download, RotateCcw, SearchX, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatRoute, navigate, setQuery, type Route } from "../../app/router";
import { useToasts, useWorkspace } from "../../data/store";
import { useI18n, type Key } from "../../i18n";
import { downloadCsv } from "../../lib/csv";
import { useReduced } from "../../motion/MotionPreference";
import { fadeUp, stagger } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { EmptyState } from "../../ui/Blocks";
import { Button } from "../../ui/Button";
import { BulkShell } from "../../ui/BulkShell";
import { DataTable, type Column } from "../../ui/DataTable";
import { Pager, SearchField, Select } from "../../ui/Form";
import { Segmented } from "../../ui/Segmented";
import { CustomerDrawer, SegmentBadge } from "./CustomerDrawer";
import { customerCounts, customerSorts, customerViews, readCustomersQuery, runCustomersQuery, segmentOf, type CustomerRow } from "./query";
import "./customers.css";

export function CustomersScreen({ route }: { route: Route }) {
  const { t, money, number, relative, locale } = useI18n();
  const { db, indexes } = useWorkspace();
  const { notify } = useToasts();
  const reduced = useReduced();
  const query = readCustomersQuery(route);
  const [draft, setDraft] = useState(query.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const rows = useMemo(() => runCustomersQuery(db, indexes, query), [db, indexes, query.view, query.q, query.country, query.sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const { counts, countries } = useMemo(() => customerCounts(db, indexes), [db, indexes]);
  const regionName = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const pages = Math.max(1, Math.ceil(rows.length / query.size));
  const page = Math.min(query.page, pages);
  const visible = rows.slice((page - 1) * query.size, page * query.size);
  const update = (patch: Record<string, string | undefined>) => setQuery(route, { ...patch, page: undefined });

  useEffect(() => setDraft(query.q), [query.q]);
  useEffect(() => {
    if (draft === query.q) return;
    const timer = setTimeout(() => update({ q: draft || undefined }), 140);
    return () => clearTimeout(timer);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setSelected(new Set()), [query.view]);

  const repeat = counts.all ? Math.round((counts.returning / counts.all) * 100) : 0;
  const columns: Column<CustomerRow>[] = [
    {
      key: "customer",
      header: t("customers.columns.customer"),
      width: "minmax(220px, 2fr)",
      area: "who",
      render: ({ user }) => (
        <span className="cell-person">
          <Avatar name={user.name} tone={user.avatar} size={32} />
          <span>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </span>
        </span>
      ),
    },
    { key: "location", header: t("customers.columns.location"), width: "minmax(130px, 1fr)", area: "where", hide: 1100, render: ({ user }) => <span className="cell-muted">{`${user.region.split(",")[0]}, ${regionName.of(user.country)}`}</span> },
    { key: "orders", header: t("customers.columns.orders"), width: "minmax(70px, 0.5fr)", align: "right", hide: 720, render: ({ stats }) => <span className="num">{number(stats.orders)}</span> },
    { key: "spent", header: t("customers.columns.spent"), width: "minmax(100px, 0.8fr)", align: "right", area: "spent", render: ({ stats }) => <strong className="num">{money(stats.spent)}</strong> },
    { key: "last", header: t("customers.columns.last"), width: "minmax(110px, 0.9fr)", area: "last", hide: 720, render: ({ stats }) => <span className="cell-muted">{stats.last ? relative(stats.last) : t("customers.never")}</span> },
    { key: "segment", header: t("customers.columns.segment"), width: "minmax(120px, 0.9fr)", area: "segment", render: ({ user, stats }) => <SegmentBadge segment={segmentOf(stats)} suspended={user.status === "Suspended"} /> },
  ];

  const exportRows = (ids?: Set<string>) => {
    const list = ids ? rows.filter((r) => ids.has(r.user.id)) : rows;
    downloadCsv(
      `orbit-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      [t("customers.csv.name"), t("customers.csv.email"), t("customers.csv.city"), t("customers.csv.country"), t("customers.csv.orders"), t("customers.csv.spent"), t("customers.csv.last"), t("customers.csv.segment")],
      list.map(({ user, stats }) => [user.name, user.email, user.region.split(",")[0], regionName.of(user.country) ?? user.country, stats.orders, stats.spent.toFixed(2), stats.last?.slice(0, 10) ?? "", t(`customers.segments.${segmentOf(stats)}` as Key)]),
    );
    notify({ key: "customers.exported", params: { count: list.length } }, "info");
  };

  return (
    <motion.div className="page" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      <motion.header className="page-head" variants={fadeUp}>
        <div className="page-head__main">
          <h1 className="page-head__title">{t("customers.title")}</h1>
          <p className="page-head__subtitle">{t("customers.subtitle", { count: counts.all, vip: counts.vip, repeat })}</p>
        </div>
        <div className="page-head__side">
          <Button icon={<Download />} onClick={() => exportRows()}>
            {t("common.exportCsv")}
          </Button>
        </div>
      </motion.header>
      <motion.div className="page__views" variants={fadeUp}>
        <Segmented variant="underline" label={t("customers.title")} value={query.view} onChange={(view) => update({ view: view === "all" ? undefined : view })} options={customerViews.map((view) => ({ value: view, label: t(`customers.views.${view}` as Key), count: counts[view], hint: t(`customers.viewHints.${view}` as Key) }))} />
      </motion.div>
      <motion.div className="page__toolbar" variants={fadeUp}>
        <SearchField value={draft} onChange={setDraft} placeholder={t("customers.search")} />
        <div className="page__filters">
          <Select label={t("customers.filters.country")} value={query.country} onChange={(value) => update({ country: value || undefined })} options={[{ value: "", label: t("customers.filters.anyCountry") }, ...countries.map(([code, count]) => ({ value: code, label: `${regionName.of(code)} · ${number(count)}` }))]} />
          <Select label={t("customers.filters.sort")} value={query.sort} onChange={(value) => update({ sort: value === "recent" ? undefined : value })} options={customerSorts.map((value) => ({ value, label: t(`customers.sorts.${value}` as Key) }))} />
          {(query.q || query.country || route.query.get("sort")) && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw />}
              onClick={() => {
                setDraft("");
                navigate(formatRoute("customers", undefined, query.view === "all" ? {} : { view: query.view }), { replace: true });
              }}
            >
              {t("orders.filters.reset")}
            </Button>
          )}
        </div>
      </motion.div>
      <motion.div variants={fadeUp}>
        <DataTable
          label={t("customers.title")}
          rows={visible}
          columns={columns}
          getId={(row) => row.user.id}
          total={rows.length}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          selectLabel={(id) => t("customers.select", { name: indexes.users.get(id)?.name ?? id })}
          selectPageLabel={t("customers.selectPage")}
          activeId={route.id}
          onOpen={(id) => navigate(formatRoute("customers", id, route.query))}
          swapKey={route.query.toString()}
          mobile={{ areas: '"check who spent" "check segment segment"', columns: "28px minmax(0, 1fr) auto" }}
          empty={
            query.q ? (
              <EmptyState icon={<SearchX />} title={t("customers.empty.title")} text={t("customers.empty.search", { query: query.q })} action={<Button onClick={() => setDraft("")}>{t("orders.filters.reset")}</Button>} />
            ) : (
              <EmptyState icon={<UsersRound />} title={t("customers.empty.title")} text={t("customers.empty.view")} />
            )
          }
        />
      </motion.div>
      {rows.length > 0 && (
        <motion.div variants={fadeUp}>
          <Pager page={page} pages={pages} total={rows.length} size={query.size} sizes={[25, 50, 100]} onPage={(next) => setQuery(route, { page: next > 1 ? String(next) : undefined })} onSize={(size) => update({ size: size === 25 ? undefined : String(size) })} />
        </motion.div>
      )}
      <SelectionBar count={selected.size} onClear={() => setSelected(new Set())} onExport={() => exportRows(selected)} />
      <CustomerDrawer userId={route.id} onClose={() => navigate(formatRoute("customers", undefined, route.query))} />
    </motion.div>
  );
}

function SelectionBar({ count, onClear, onExport }: { count: number; onClear: () => void; onExport: () => void }) {
  const { t } = useI18n();
  return (
    <BulkShell count={count} label={t("customers.bulk.label", { count })} onClear={onClear}>
      <Button size="sm" variant="primary" icon={<Download />} onClick={onExport}>
        {t("orders.bulk.export")}
      </Button>
    </BulkShell>
  );
}

