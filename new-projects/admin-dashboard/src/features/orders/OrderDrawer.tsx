import { motion } from "motion/react";
import { ArrowUpRight, Ban, Check, CheckSquare, CircleDashed, Copy, CreditCard, FileSearch, Landmark, MapPin, MessageSquare, PackageCheck, RotateCcw, Truck, Undo2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useAccess } from "../../app/access";
import { formatRoute, navigate } from "../../app/router";
import { netPaid } from "../../data/actions";
import { nextId, useToasts, useWorkspace } from "../../data/store";
import type { Order, Payment } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, spring, staggerDelay } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { EmptyState, ProductThumb } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { Dialog, Drawer } from "../../ui/Overlay";
import { OrderStatus, PaymentStatus } from "./status";

type Next = { action: "pack" | "ship" | "collected" | "deliver" | "capture" | "retry"; hint: Key; icon: typeof Check } | null;

function nextStep(order: Order, state: string): Next {
  if (order.status === "Processing") {
    if (state === "Paid") return { action: "pack", hint: "orders.detail.hints.pack", icon: PackageCheck };
    if (state === "Pending") return { action: "capture", hint: "orders.detail.hints.capture", icon: Landmark };
    return { action: "retry", hint: "orders.detail.hints.retry", icon: CreditCard };
  }
  if (order.status === "Ready") return order.shippingMethod === "Pickup" ? { action: "collected", hint: "orders.detail.hints.collected", icon: Check } : { action: "ship", hint: "orders.detail.hints.ship", icon: Truck };
  if (order.status === "Shipped") return { action: "deliver", hint: "orders.detail.hints.deliver", icon: Check };
  return null;
}

export function OrderDrawer({ order, missingId, onClose }: { order?: Order; missingId?: string; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Drawer
      open={!!order || !!missingId}
      onClose={onClose}
      label={order ? t("orders.detail.title", { id: order.id }) : t("shell.notFound", { id: missingId ?? "" })}
      header={
        order ? (
          <div className="od-head">
            <p className="od-head__eyebrow">{t("orders.columns.order")}</p>
            <h2 className="od-head__title">
              <motion.span layoutId={`order-id-${order.id}`} className="num od-head__id">
                {order.id}
              </motion.span>
              <OrderStatus order={order} />
            </h2>
          </div>
        ) : (
          <h2 className="od-head__title">{missingId}</h2>
        )
      }
    >
      {order ? <OrderDetail order={order} /> : <EmptyState icon={<FileSearch />} title={t("shell.notFound", { id: missingId ?? "" })} text={t("shell.notFoundHint")} />}
    </Drawer>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const { t, money, inline, fullDate, number, tx } = useI18n();
  const { db, indexes, dispatch } = useWorkspace();
  const { notify } = useToasts();
  const reduced = useReduced();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const access = useAccess();
  const payments = indexes.paymentsByOrder.get(order.id) ?? [];
  const state = indexes.payment(order);
  const paid = netPaid(payments);
  const customer = indexes.users.get(order.userId);
  const stats = customer ? indexes.customer(customer.id) : null;
  const step = nextStep(order, state);
  // Moving goods is the warehouse's job; taking or returning money is finance's.
  const stepAllowed = !step || access.can(step.action === "capture" || step.action === "retry" ? "payments.manage" : "orders.fulfil");
  const tasks = indexes.tasksByOrder.get(order.id) ?? [];
  const conversations = indexes.conversationsByOrder.get(order.id) ?? [];
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const segment = stats ? (stats.spent >= 800 || stats.orders >= 5 ? "vip" : stats.orders >= 2 ? "returning" : "new") : "new";

  const runStep = () => {
    if (!step) return;
    if (step.action === "pack") dispatch({ type: "order.advance", id: order.id, to: "Ready" });
    else if (step.action === "ship") dispatch({ type: "order.advance", id: order.id, to: "Shipped" });
    else if (step.action === "collected" || step.action === "deliver") dispatch({ type: "order.advance", id: order.id, to: "Delivered" });
    else if (step.action === "capture") dispatch({ type: "payment.capture", orderId: order.id });
    else dispatch({ type: "payment.retry", orderId: order.id, paymentId: nextId(db, "PAY") });
  };

  const container = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.045, delayChildren: reduced ? 0 : 0.08 } } };
  const block = { hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } } };

  return (
    <motion.div className="od" variants={container} initial="hidden" animate="show">
      <motion.section className="od-summary" variants={block}>
        <div>
          <p className="od-summary__total num">{money(order.total)}</p>
          <p className="od-summary__meta">{t("orders.detail.placed", { date: inline(order.date), channel: t(`channel.${order.channel}` as Key) })}</p>
        </div>
        <PaymentStatus state={state} />
      </motion.section>

      {step ? (
        <motion.section className="od-next" variants={block}>
          <div className="od-next__text">
            <p className="od-label">{t("orders.detail.nextStep")}</p>
            <p>{t(step.hint)}</p>
          </div>
          <Button variant="primary" icon={<step.icon />} onClick={runStep} data-autofocus disabled={!stepAllowed} title={stepAllowed ? undefined : access.deniedHint}>
            {t(`orders.detail.actions.${step.action}` as Key)}
          </Button>
        </motion.section>
      ) : (
        <motion.p className="od-done" variants={block}>
          {t(order.status === "Cancelled" ? "orders.detail.hints.cancelled" : "orders.detail.hints.done")}
        </motion.p>
      )}

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("orders.detail.progress")}</h3>
        <Timeline order={order} />
      </motion.section>

      {customer && stats && (
        <motion.section className="od-block" variants={block}>
          <h3 className="od-label">{t("orders.detail.customer")}</h3>
          <a
            className="od-customer"
            href={formatRoute("customers", customer.id)}
            onClick={(event) => {
              event.preventDefault();
              navigate(formatRoute("customers", customer.id));
            }}
          >
            <Avatar name={customer.name} tone={customer.avatar} size={40} />
            <span className="od-customer__text">
              <strong>
                {customer.name}
                {segment === "vip" && (
                  <Badge tone="violet" dot={false}>
                    VIP
                  </Badge>
                )}
              </strong>
              <small>{customer.email}</small>
              <small>
                {stats.orders > 1
                  ? `${t("orders.detail.customerStats", { orders: t("common.orders", { count: stats.orders }), spent: stats.spent })} · ${t("orders.detail.since", { date: fullDate(stats.first ?? customer.joined) })}`
                  : t("orders.detail.firstOrder")}
              </small>
            </span>
            <ArrowUpRight className="od-customer__go" />
          </a>
        </motion.section>
      )}

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">
          {t("orders.detail.items")} <span className="od-label__count num">{number(units)}</span>
        </h3>
        <ul className="od-items">
          {order.items.map((item, index) => {
            const product = indexes.products.get(item.productId);
            return (
              <motion.li key={item.productId} initial={reduced ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: duration.slow, ease: ease.out, delay: 0.2 + staggerDelay(index, 0.05) }}>
                <ProductThumb product={product} size={48} />
                <span className="od-items__name">
                  <strong>{product?.name}</strong>
                  <small>
                    {product?.sku} · {item.quantity} × {money(item.unitPrice)}
                  </small>
                </span>
                <span className="num od-items__total">{money(item.quantity * item.unitPrice)}</span>
              </motion.li>
            );
          })}
        </ul>
        <dl className="od-sum">
          <div>
            <dt>{t("orders.detail.subtotal")}</dt>
            <dd className="num">{money(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="is-discount">
              <dt>{t("orders.detail.discount", { code: order.promo ?? "" })}</dt>
              <dd className="num">−{money(order.discount)}</dd>
            </div>
          )}
          <div>
            <dt>{t("orders.detail.shipping")}</dt>
            <dd className="num">{order.shipping ? money(order.shipping) : t("orders.detail.free")}</dd>
          </div>
          <div className="is-total">
            <dt>{t("orders.detail.total")}</dt>
            <dd className="num">{money(order.total)}</dd>
          </div>
        </dl>
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("orders.detail.payment")}</h3>
        <PaymentHistory payments={payments} />
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("orders.detail.delivery")}</h3>
        <div className="od-delivery">
          <span className="od-delivery__icon" aria-hidden="true">
            {order.shippingMethod === "Pickup" ? <MapPin /> : <Truck />}
          </span>
          <span>
            <strong>{t(`shippingMethod.${order.shippingMethod}` as Key)}</strong>
            <small>
              {order.city}, {order.country}
            </small>
            <small className="num">{order.tracking ? t("orders.detail.tracking", { number: order.tracking }) : order.shippingMethod === "Pickup" ? "" : t("orders.detail.noTracking")}</small>
          </span>
        </div>
        {order.note && (
          <blockquote className="od-note">
            <span>{t("orders.detail.note")}</span>
            {tx(order.note)}
          </blockquote>
        )}
      </motion.section>

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">{t("orders.detail.related")}</h3>
        {tasks.length || conversations.length ? (
          <ul className="od-related">
            {tasks.map((task) => (
              <li key={task.id}>
                <a
                  href={formatRoute("tasks", task.id)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(formatRoute("tasks", task.id));
                  }}
                >
                  <CheckSquare />
                  <span>{tx(task.title)}</span>
                  <Badge tone={task.status === "Done" ? "positive" : "neutral"} dot={false}>
                    {task.status === "Done" ? "✓" : task.priority === "High" ? "!" : "·"}
                  </Badge>
                </a>
              </li>
            ))}
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <a
                  href={formatRoute("messages", conversation.id)}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(formatRoute("messages", conversation.id));
                  }}
                >
                  <MessageSquare />
                  <span>{t("orders.detail.conversation", { subject: tx(conversation.subject) })}</span>
                  {conversation.unread && <i className="od-related__dot" />}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="od-muted">{t("orders.detail.noRelated")}</p>
        )}
      </motion.section>

      <motion.footer className="od-actions" variants={block}>
        <Button
          variant="ghost"
          size="sm"
          icon={<Copy />}
          onClick={() => {
            const link = `${location.origin}${location.pathname}${formatRoute("orders", order.id)}`;
            navigator.clipboard?.writeText(link).then(
              () => notify({ key: "common.linkCopied" }, "info"),
              () => notify({ key: "errors.generic" }, "error"),
            );
          }}
        >
          {t("common.copyLink")}
        </Button>
        {paid > 0.009 && access.can("payments.manage") && (
          <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={() => setRefundOpen(true)}>
            {t("orders.detail.actions.refund")}
          </Button>
        )}
        {(order.status === "Processing" || order.status === "Ready") && access.can("orders.cancel") && (
          <Button variant="danger" size="sm" icon={<Ban />} onClick={() => setCancelOpen(true)}>
            {t("orders.detail.actions.cancel")}
          </Button>
        )}
      </motion.footer>

      <CancelDialog order={order} open={cancelOpen} paid={paid} units={units} onClose={() => setCancelOpen(false)} />
      <RefundDialog order={order} open={refundOpen} available={paid} onClose={() => setRefundOpen(false)} />
    </motion.div>
  );
}

function Timeline({ order }: { order: Order }) {
  const { t, stamp } = useI18n();
  const { indexes } = useWorkspace();
  const reduced = useReduced();
  const pickup = order.shippingMethod === "Pickup";
  const planned: Order["timeline"][number]["status"][] = order.status === "Cancelled" ? order.timeline.map((e) => e.status) : ["Placed", "Paid", "Ready", ...(pickup ? [] : (["Shipped"] as const)), "Delivered"];
  const reached = new Map(order.timeline.map((entry) => [entry.status, entry]));
  const extra = order.timeline.filter((entry) => entry.status === "Refunded");
  const steps = [...planned.filter((s) => s !== "Refunded"), ...extra.map((e) => e.status)];
  const lastDone = steps.reduce((last, status, index) => (reached.has(status) ? index : last), 0);
  const progress = steps.length > 1 ? lastDone / (steps.length - 1) : 1;

  return (
    <div className="timeline">
      <div className="timeline__rail" aria-hidden="true">
        <motion.span className="timeline__fill" initial={reduced ? false : { scaleY: 0 }} animate={{ scaleY: progress }} transition={{ ...spring.panel, delay: reduced ? 0 : 0.25 }} />
      </div>
      <ol>
        {steps.map((status, index) => {
          const entry = reached.get(status);
          const by = entry?.by ? indexes.users.get(entry.by)?.name : undefined;
          const label = status === "Ready" && pickup ? t("status.order.ReadyPickup") : status === "Delivered" && pickup ? t("status.order.DeliveredPickup") : t(`status.timeline.${status}` as Key);
          return (
            <li key={`${status}-${index}`} className={cx("timeline__step", entry && "is-done", index === lastDone + 1 && "is-next", status === "Cancelled" && "is-cancelled", status === "Refunded" && "is-refund")}>
              <span className="timeline__dot" aria-hidden="true">
                {entry ? status === "Cancelled" ? <Ban /> : status === "Refunded" ? <RotateCcw /> : <Check /> : <CircleDashed />}
              </span>
              <span className="timeline__text">
                <strong>{label}</strong>
                <small>{entry ? `${stamp(entry.at)}${by ? " · " + by : ""}` : t("orders.detail.waiting")}</small>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PaymentHistory({ payments }: { payments: Payment[] }) {
  const { t, money, stamp } = useI18n();
  const sorted = [...payments].sort((a, b) => (a.date < b.date ? -1 : 1));
  return (
    <ul className="od-payments">
      {sorted.map((payment) => (
        <li key={payment.id} className={cx(payment.type === "Refund" && "is-refund", payment.status === "Failed" && "is-failed")}>
          <span className="od-payments__icon" aria-hidden="true">
            {payment.type === "Refund" ? <Undo2 /> : payment.method === "Transfer" ? <Landmark /> : payment.method === "Wallet" ? <Wallet /> : <CreditCard />}
          </span>
          <span className="od-payments__text">
            <strong>
              {payment.type === "Refund" ? t("orders.detail.refund") : t(`paymentMethod.${payment.method}` as Key)}
              {payment.last4 && payment.type === "Charge" && <span className="num"> •• {payment.last4}</span>}
            </strong>
            <small>
              {stamp(payment.date)}
              {payment.reason ? ` · ${t(`refundReason.${payment.reason}` as Key)}` : ""}
            </small>
          </span>
          <span className="od-payments__amount">
            <span className="num">
              {payment.type === "Refund" ? "−" : ""}
              {money(payment.amount)}
            </span>
            <small>{t(`status.payment.${payment.status === "Pending" ? "Pending" : payment.status === "Failed" ? "Failed" : payment.type === "Refund" ? "Refunded" : "Paid"}` as Key)}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

function CancelDialog({ order, open, paid, units, onClose }: { order: Order; open: boolean; paid: number; units: number; onClose: () => void }) {
  const { t } = useI18n();
  const { db, dispatch } = useWorkspace();
  const [refund, setRefund] = useState(true);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      tone="danger"
      icon={<Ban />}
      title={t("orders.cancel.title", { id: order.id })}
      actions={
        <>
          <Button onClick={onClose} data-autofocus>
            {t("orders.cancel.keep")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              const result = dispatch({ type: "order.cancel", id: order.id, refundId: refund && paid > 0 ? nextId(db, "REF") : undefined });
              if (result.ok) onClose();
            }}
          >
            {t("orders.cancel.confirm")}
          </Button>
        </>
      }
    >
      <p>{t("orders.cancel.text", { count: units })}</p>
      {paid > 0.009 ? (
        <label className="od-checkline">
          <input type="checkbox" checked={refund} onChange={(event) => setRefund(event.target.checked)} />
          <span>{t("orders.cancel.refund", { amount: paid })}</span>
        </label>
      ) : (
        <p className="od-muted">{t("orders.cancel.noPayment")}</p>
      )}
    </Dialog>
  );
}

export function RefundDialog({ order, open, available, onClose }: { order: Order; open: boolean; available: number; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { db, dispatch } = useWorkspace();
  const [amount, setAmount] = useState(String(available));
  const [reason, setReason] = useState<"Return" | "Damaged" | "Goodwill">("Return");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setAmount(String(available));
    setError("");
  }, [open, available]);
  const value = Number(amount.replace(",", "."));
  const submit = () => {
    if (!(value > 0)) return setError(t("orders.refund.invalid"));
    if (value > available + 0.009) return setError(t("orders.refund.tooMuch", { amount: available }));
    const result = dispatch({ type: "order.refund", id: order.id, amount: value, reason, refundId: nextId(db, "REF") });
    if (result.ok) onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={<Undo2 />}
      title={t("orders.refund.title", { id: order.id })}
      actions={
        <>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={submit}>
            {t("orders.refund.confirm", { amount: value > 0 ? Math.min(value, available) : 0 })}
          </Button>
        </>
      }
    >
      <p>{t("orders.refund.text", { amount: available })}</p>
      <div className="form-grid">
        <label className="field">
          <span>{t("orders.refund.amount")}</span>
          <input
            inputMode="decimal"
            value={amount}
            data-autofocus
            aria-invalid={!!error}
            aria-describedby={error ? "refund-error" : undefined}
            onChange={(event) => {
              setAmount(event.target.value);
              setError("");
            }}
            lang={locale}
          />
        </label>
        <label className="field">
          <span>{t("orders.refund.reason")}</span>
          <select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
            {(["Return", "Damaged", "Goodwill"] as const).map((value) => (
              <option key={value} value={value}>
                {t(`refundReason.${value}` as Key)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="field-error" id="refund-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
