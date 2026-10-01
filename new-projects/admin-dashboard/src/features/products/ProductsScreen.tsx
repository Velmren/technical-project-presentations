import { motion } from "motion/react";
import { LayoutGrid, PackageSearch, Rows3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatRoute, navigate, setQuery, type Route } from "../../app/router";
import { categories } from "../../data/catalog";
import { productStats, type ProductStats } from "../../data/metrics";
import { useWorkspace } from "../../data/store";
import type { Product } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { normalize } from "../../lib/text";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, fadeUp, stagger, staggerDelay } from "../../motion/tokens";
import { EmptyState, ProductThumb } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { DataTable, type Column } from "../../ui/DataTable";
import { SearchField, Select } from "../../ui/Form";
import { Segmented } from "../../ui/Segmented";
import { ProductDrawer, ProductStatus, StockMeter } from "./ProductDrawer";
import "./products.css";

const views = ["all", "active", "low", "draft", "archived"] as const;
type View = (typeof views)[number];
const sorts = ["bestsellers", "revenue", "stock", "price", "name"] as const;
type Row = { product: Product; stats: ProductStats };

function readQuery(route: Route) {
  const get = (key: string) => route.query.get(key) ?? "";
  return {
    view: (views as readonly string[]).includes(get("view")) ? (get("view") as View) : "all",
    q: get("q"),
    category: get("category"),
    sort: (sorts as readonly string[]).includes(get("sort")) ? (get("sort") as (typeof sorts)[number]) : "bestsellers",
    mode: get("mode") === "table" ? "table" : "grid",
  } as const;
}

const inView = (product: Product, view: View) =>
  view === "all" ? true : view === "active" ? product.status === "Active" : view === "low" ? product.status === "Active" && product.stock <= product.reorderPoint : view === "draft" ? product.status === "Draft" : product.status === "Archived";

export function ProductsScreen({ route }: { route: Route }) {
  const { t, tx, money, number } = useI18n();
  const { db } = useWorkspace();
  const reduced = useReduced();
  const swapped = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => (swapped.current = true), 900);
    return () => clearTimeout(timer);
  }, []);
  const query = readQuery(route);
  const [draft, setDraft] = useState(query.q);
  const stats = productStats(db);
  const update = (patch: Record<string, string | undefined>) => setQuery(route, patch);

  useEffect(() => setDraft(query.q), [query.q]);
  useEffect(() => {
    if (draft === query.q) return;
    const timer = setTimeout(() => update({ q: draft || undefined }), 140);
    return () => clearTimeout(timer);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const q = normalize(query.q.trim());
    const list = db.products
      .filter((p) => inView(p, query.view) && (!query.category || p.category === query.category) && (!q || normalize(p.name).includes(q) || normalize(p.sku).includes(q)))
      .map((product) => ({ product, stats: stats.get(product.id)! }));
    const by = {
      bestsellers: (a: Row, b: Row) => b.stats.units30 - a.stats.units30,
      revenue: (a: Row, b: Row) => b.stats.revenue30 - a.stats.revenue30,
      stock: (a: Row, b: Row) => a.product.stock / Math.max(1, a.product.reorderPoint) - b.product.stock / Math.max(1, b.product.reorderPoint),
      price: (a: Row, b: Row) => b.product.price - a.product.price,
      name: (a: Row, b: Row) => a.product.name.localeCompare(b.product.name),
    }[query.sort];
    return list.sort(by);
  }, [db.products, stats, query.view, query.category, query.q, query.sort]);

  const counts = Object.fromEntries(views.map((view) => [view, db.products.filter((p) => inView(p, view)).length])) as Record<View, number>;
  const stockValue = db.products.filter((p) => p.status !== "Archived").reduce((sum, p) => sum + p.stock * p.cost, 0);
  const open = (id: string) => navigate(formatRoute("products", id, route.query));

  const columns: Column<Row>[] = [
    {
      key: "product",
      header: t("products.columns.product"),
      width: "minmax(220px, 2fr)",
      area: "who",
      render: ({ product }) => (
        <span className="cell-person">
          <ProductThumb product={product} size={36} />
          <span>
            <strong>{product.name}</strong>
            <small>{product.sku}</small>
          </span>
        </span>
      ),
    },
    { key: "category", header: t("products.columns.category"), width: "minmax(110px, 0.9fr)", hide: 1320, render: ({ product }) => <span className="cell-muted">{t(`categories.${product.category}` as Key)}</span> },
    { key: "price", header: t("products.columns.price"), width: "minmax(80px, 0.6fr)", align: "right", area: "price", render: ({ product }) => <strong className="num">{money(product.price)}</strong> },
    { key: "stock", header: t("products.columns.stock"), width: "minmax(150px, 1.2fr)", area: "stock", render: ({ product }) => <StockMeter product={product} /> },
    { key: "sold", header: t("products.columns.sold"), width: "minmax(118px, 0.7fr)", align: "right", hide: 720, render: ({ stats }) => <span className="num">{number(stats.units30)}</span> },
    { key: "revenue", header: t("products.columns.revenue"), width: "minmax(124px, 0.8fr)", align: "right", hide: 1100, render: ({ stats }) => <span className="num">{money(Math.round(stats.revenue30))}</span> },
    { key: "status", header: t("products.columns.status"), width: "minmax(110px, 0.8fr)", area: "status", render: ({ product }) => <ProductStatus product={product} /> },
  ];

  return (
    <motion.div className="page" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      <motion.header className="page-head" variants={fadeUp}>
        <div className="page-head__main">
          <h1 className="page-head__title">{t("products.title")}</h1>
          <p className="page-head__subtitle">{t("products.subtitle", { active: counts.active, low: counts.low, value: Math.round(stockValue) })}</p>
        </div>
        <div className="page-head__side">
          <Segmented
            size="sm"
            label={t("products.modeLabel")}
            value={query.mode}
            onChange={(mode) => update({ mode: mode === "grid" ? undefined : mode })}
            options={[
              { value: "grid", label: <LayoutGrid aria-label={t("products.modes.grid")} />, hint: t("products.modes.grid") },
              { value: "table", label: <Rows3 aria-label={t("products.modes.table")} />, hint: t("products.modes.table") },
            ]}
          />
        </div>
      </motion.header>
      <motion.div className="page__views" variants={fadeUp}>
        <Segmented variant="underline" label={t("products.title")} value={query.view} onChange={(view) => update({ view: view === "all" ? undefined : view })} options={views.map((view) => ({ value: view, label: t(`products.views.${view}` as Key), count: counts[view] }))} />
      </motion.div>
      <motion.div className="page__toolbar" variants={fadeUp}>
        <SearchField value={draft} onChange={setDraft} placeholder={t("products.search")} />
        <div className="page__filters">
          <Select label={t("products.filters.category")} value={query.category} onChange={(value) => update({ category: value || undefined })} options={[{ value: "", label: t("products.filters.anyCategory") }, ...categories.map((c) => ({ value: c, label: t(`categories.${c}` as Key) }))]} />
          <Select label={t("products.filters.sort")} value={query.sort} onChange={(value) => update({ sort: value === "bestsellers" ? undefined : value })} options={sorts.map((value) => ({ value, label: t(`products.sorts.${value}` as Key) }))} />
        </div>
      </motion.div>
      <motion.div variants={fadeUp}>
        {!rows.length ? (
          <EmptyState icon={<PackageSearch />} title={t("products.empty.title")} text={query.q ? t("products.empty.search", { query: query.q }) : t("products.empty.view")} action={<Button onClick={() => (setDraft(""), navigate(formatRoute("products"), { replace: true }))}>{t("orders.filters.reset")}</Button>} />
        ) : query.mode === "table" ? (
          <DataTable label={t("products.title")} rows={rows} columns={columns} getId={(row) => row.product.id} total={rows.length} activeId={route.id} onOpen={open} swapKey={route.query.toString()} mobile={{ areas: '"who price" "stock status"', columns: "minmax(0, 1fr) auto" }} empty={null} />
        ) : (
          // Another view or filter replaces the whole grid in one quick fade; cards cascade in only on the first visit.
          <motion.ul key={route.query.toString()} className="catalog" initial={swapped.current && !reduced ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: duration.fast, ease: ease.out }}>
                {rows.map(({ product, stats: s }, index) => (
                  <motion.li
                    key={product.id}
                    initial={swapped.current ? false : reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out, delay: 0.08 + staggerDelay(index, 0.04) } }}
                  >
                    <a
                      href={formatRoute("products", product.id)}
                      className={cx("pcard", route.id === product.id && "is-active", product.status !== "Active" && "is-muted")}
                      onClick={(event) => {
                        event.preventDefault();
                        open(product.id);
                      }}
                    >
                      <span className="pcard__media">
                        <ProductThumb product={product} size={240} large />
                        <span className="pcard__status">
                          <ProductStatus product={product} />
                        </span>
                      </span>
                      <span className="pcard__body">
                        <span className="pcard__row">
                          <strong className="pcard__name">{product.name}</strong>
                          <strong className="num pcard__price">{money(product.price)}</strong>
                        </span>
                        <span className="pcard__meta">
                          {t(`categories.${product.category}` as Key)} · {product.sku}
                        </span>
                        <StockMeter product={product} />
                        <span className="pcard__sales">
                          <span>{t("products.card.sold", { count: s.units30 })}</span>
                          <span className="num">{money(Math.round(s.revenue30))}</span>
                        </span>
                        <span className="sr-only">{tx(product.description)}</span>
                      </span>
                    </a>
                  </motion.li>
                ))}
          </motion.ul>
        )}
      </motion.div>
      <ProductDrawer productId={route.id} onClose={() => navigate(formatRoute("products", undefined, route.query))} />
    </motion.div>
  );
}
