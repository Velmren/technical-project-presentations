import { motion } from "motion/react";
import { ClipboardPlus, FileSearch, Save, ShoppingBag, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAccess } from "../../app/access";
import { formatRoute, navigate } from "../../app/router";
import { TODAY, addDays, now } from "../../data/clock";
import type { Action } from "../../data/actions";
import { productStats } from "../../data/metrics";
import { nextId, useWorkspace } from "../../data/store";
import type { Product } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Counter } from "../../motion/Counter";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, spring, staggerDelay } from "../../motion/tokens";
import { Badge } from "../../ui/Badge";
import { EmptyState, ProductThumb } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { Field, Input, NativeSelect, TextArea } from "../../ui/Form";
import { Drawer } from "../../ui/Overlay";
import { OrderStatus } from "../orders/status";

export function ProductStatus({ product }: { product: Product }) {
  const { t } = useI18n();
  if (product.status === "Draft") return <Badge tone="violet">{t("products.status.Draft")}</Badge>;
  if (product.status === "Archived") return <Badge tone="neutral">{t("products.status.Archived")}</Badge>;
  if (product.stock === 0) return <Badge tone="danger">{t("products.status.out")}</Badge>;
  if (product.stock <= product.reorderPoint) return <Badge tone="warning">{t("products.status.low")}</Badge>;
  return <Badge tone="positive">{t("products.status.Active")}</Badge>;
}

/** Stock against the reorder point: the bar fills to three reorder points, the tick marks the point itself. */
export function StockMeter({ product }: { product: Product }) {
  const { t, number } = useI18n();
  const reduced = useReduced();
  const scale = Math.max(1, product.reorderPoint * 3);
  const fill = Math.min(1, product.stock / scale);
  const tone = product.stock === 0 ? "out" : product.stock <= product.reorderPoint ? "low" : "ok";
  return (
    <span className={cx("stock", `stock--${tone}`)} title={t("products.stockHint", { stock: product.stock, point: product.reorderPoint })}>
      <span className="stock__track">
        <motion.span className="stock__fill" initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: fill }} transition={spring.layout} />
        {product.reorderPoint > 0 && <span className="stock__tick" style={{ left: `${(product.reorderPoint / scale) * 100}%` }} />}
      </span>
      <span className="stock__value num">{t("common.pieces", { count: product.stock })}</span>
      <span className="sr-only">{number(product.reorderPoint)}</span>
    </span>
  );
}

export function ProductDrawer({ productId, onClose }: { productId?: string; onClose: () => void }) {
  const { t } = useI18n();
  const { indexes } = useWorkspace();
  const product = productId ? indexes.products.get(productId) : undefined;
  return (
    <Drawer
      open={!!productId}
      onClose={onClose}
      width={600}
      label={product ? product.name : t("shell.notFound", { id: productId ?? "" })}
      header={
        product ? (
          <div className="od-head">
            <p className="od-head__eyebrow">{product.sku}</p>
            <h2 className="od-head__title">
              {product.name}
              <ProductStatus product={product} />
            </h2>
          </div>
        ) : (
          <h2 className="od-head__title">{productId}</h2>
        )
      }
    >
      {product ? <ProductDetail product={product} /> : <EmptyState icon={<FileSearch />} title={t("shell.notFound", { id: productId ?? "" })} text={t("shell.notFoundHint")} />}
    </Drawer>
  );
}

type Draft = { price: string; stock: string; reorderPoint: string; status: Product["status"]; description: string };

function ProductDetail({ product }: { product: Product }) {
  const { t, tx, money, number, percent, inline, date } = useI18n();
  const { db, indexes, dispatch } = useWorkspace();
  const access = useAccess();
  const reduced = useReduced();
  const stats = productStats(db).get(product.id)!;
  const canEdit = access.can("products.edit");
  const canStock = canEdit || access.can("products.stock");
  const initial = useMemo<Draft>(() => ({ price: String(product.price), stock: String(product.stock), reorderPoint: String(product.reorderPoint), status: product.status, description: tx(product.description) }), [product, tx]);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  useEffect(() => {
    setDraft(initial);
    setErrors({});
  }, [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const margin = product.price ? (product.price - product.cost) / product.price : 0;
  const peak = Math.max(1, ...stats.weekly);
  const orders = stats.orders.map((id) => indexes.orders.get(id)).filter((o) => !!o);
  const taskExists = db.tasks.some((task) => task.productId === product.id && task.status !== "Done");

  const validate = () => {
    const next: typeof errors = {};
    const price = Number(draft.price.replace(",", "."));
    if (!(price > 0) || price > 100000 || Math.round(price * 100) !== price * 100) next.price = t("products.errors.price");
    if (!/^\d+$/.test(draft.stock) || Number(draft.stock) > 100000) next.stock = t("products.errors.stock");
    if (!/^\d+$/.test(draft.reorderPoint) || Number(draft.reorderPoint) > 10000) next.reorderPoint = t("products.errors.reorder");
    if (draft.description.trim().length < 10 || draft.description.trim().length > 600) next.description = t("products.errors.description");
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const save = () => {
    if (!validate()) return;
    const patch: Extract<Action, { type: "product.update" }>["patch"] = {};
    if (canEdit) {
      patch.price = Number(draft.price.replace(",", "."));
      patch.status = draft.status;
      if (draft.description.trim() !== tx(product.description)) patch.description = draft.description.trim();
    }
    patch.stock = Number(draft.stock);
    patch.reorderPoint = Number(draft.reorderPoint);
    dispatch({ type: "product.update", id: product.id, patch });
  };
  const reorderTask = () =>
    dispatch({
      type: "task.create",
      task: {
        id: nextId(db, "TSK"),
        title: { key: product.stock === 0 ? "task.t.outOfStock" : "task.t.reorder", params: { product: product.name, stock: product.stock } },
        description: { key: "task.d.reorder", params: { point: product.reorderPoint } },
        assigneeId: "USR-002",
        due: addDays(TODAY, 2),
        created: now(),
        status: "Backlog",
        priority: product.stock === 0 ? "High" : "Medium",
        productId: product.id,
      },
    });

  const container = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.045, delayChildren: reduced ? 0 : 0.06 } } };
  const block = { hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } } };

  return (
    <motion.div className="pd" variants={container} initial="hidden" animate="show">
      <motion.section className="pd-top" variants={block}>
        <div className="pd-photo">
          <ProductThumb product={product} size={176} large />
        </div>
        <div className="pd-facts">
          <p className="pd-desc">{tx(product.description)}</p>
          <dl className="pd-kv">
            <div>
              <dt>{t("products.columns.category")}</dt>
              <dd>{t(`categories.${product.category}` as Key)}</dd>
            </div>
            <div>
              <dt>{t("products.detail.price")}</dt>
              <dd className="num">{money(product.price)}</dd>
            </div>
            <div>
              <dt>{t("products.detail.cost")}</dt>
              <dd className="num">{money(product.cost)}</dd>
            </div>
            <div>
              <dt>{t("products.detail.margin")}</dt>
              <dd className="num">{percent(margin)}</dd>
            </div>
          </dl>
        </div>
      </motion.section>
      <motion.section className="cd-stats cd-stats--two" variants={block}>
        <div className="cd-stat">
          <span>{t("products.detail.sold30")}</span>
          <strong className="num">
            <Counter value={stats.units30} format={(v) => number(Math.round(v))} />
          </strong>
        </div>
        <div className="cd-stat">
          <span>{t("products.detail.revenue30")}</span>
          <strong className="num">
            <Counter value={stats.revenue30} format={(v) => money(Math.round(v))} delay={0.06} />
          </strong>
        </div>
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("products.detail.stock")}</h3>
        <StockMeter product={product} />
        <p className="od-muted pd-stock-note">{product.stock <= product.reorderPoint && product.status === "Active" ? t("products.detail.belowPoint", { point: product.reorderPoint }) : t("products.detail.abovePoint", { point: product.reorderPoint })}</p>
        {product.status === "Active" && product.stock <= product.reorderPoint && (
          <Button size="sm" icon={<ClipboardPlus />} disabled={taskExists || !access.can("tasks.manage")} onClick={reorderTask}>
            {taskExists ? t("products.detail.taskExists") : t("products.detail.createTask")}
          </Button>
        )}
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("products.detail.weekly")}</h3>
        <div className="minibars minibars--13" role="img" aria-label={t("products.detail.weekly")}>
          {stats.weekly.map((value, i) => (
            <div key={i} className="minibars__col" title={`${t("overview.chart.week", { date: date(addDays(TODAY, -90 + i * 7)) })}: ${t("common.pieces", { count: value })}`}>
              <motion.span className={value ? "minibars__bar" : "minibars__bar is-empty"} initial={reduced ? false : { scaleY: 0 }} animate={{ scaleY: value ? Math.max(0.06, value / peak) : 0.04 }} transition={{ ...spring.layout, delay: reduced ? 0 : 0.2 + staggerDelay(i, 0.02) }} />
              <small>{i % 4 === 0 ? date(addDays(TODAY, -90 + i * 7)) : ""}</small>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("products.detail.recentOrders")}</h3>
        {orders.length ? (
          <ul className="cd-orders">
            {orders.map((order) => (
              <li key={order.id}>
                <a
                  href={formatRoute("orders", order.id)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(formatRoute("orders", order.id));
                  }}
                >
                  <ShoppingBag />
                  <span className="cd-orders__id num">{order.id}</span>
                  <span className="cd-orders__date">{inline(order.date)}</span>
                  <OrderStatus order={order} />
                  <span className="num cd-orders__total">{money(order.total)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="od-muted">{t("products.detail.noOrders")}</p>
        )}
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("products.detail.edit")}</h3>
        {!canEdit && <p className="od-muted pd-lock">{canStock ? t("products.detail.stockOnly") : access.deniedHint}</p>}
        <div className="form-grid">
          <Field label={t("products.fields.price")} error={errors.price}>
            {(props) => <Input {...props} inputMode="decimal" value={draft.price} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />}
          </Field>
          <Field label={t("products.fields.status")}>
            {(props) => (
              <NativeSelect
                {...props}
                value={draft.status}
                disabled={!canEdit}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as Product["status"] })}
                options={(["Active", "Draft", "Archived"] as const).map((s) => ({ value: s, label: t(`products.status.${s}` as Key) }))}
              />
            )}
          </Field>
          <Field label={t("products.fields.stock")} error={errors.stock}>
            {(props) => <Input {...props} inputMode="numeric" value={draft.stock} disabled={!canStock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} />}
          </Field>
          <Field label={t("products.fields.reorderPoint")} error={errors.reorderPoint} hint={t("products.fields.reorderHint")}>
            {(props) => <Input {...props} inputMode="numeric" value={draft.reorderPoint} disabled={!canStock} onChange={(e) => setDraft({ ...draft, reorderPoint: e.target.value })} />}
          </Field>
        </div>
        <Field label={t("products.fields.description")} error={errors.description} className="pd-desc-field">
          {(props) => <TextArea {...props} value={draft.description} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} />}
        </Field>
        <div className="pd-save">
          <Button
            variant="ghost"
            icon={<Undo2 />}
            disabled={!dirty}
            onClick={() => {
              setDraft(initial);
              setErrors({});
            }}
          >
            {t("products.detail.revert")}
          </Button>
          <Button variant="primary" icon={<Save />} disabled={!dirty || !canStock} onClick={save}>
            {t("common.save")}
          </Button>
        </div>
      </motion.section>
    </motion.div>
  );
}
