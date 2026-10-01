import { motion } from "motion/react";
import { ArrowUpRight, CreditCard, FileSearch, Landmark, Undo2 } from "lucide-react";
import { useState } from "react";
import { useAccess } from "../../app/access";
import { formatRoute, navigate } from "../../app/router";
import { netPaid } from "../../data/actions";
import { nextId, useWorkspace } from "../../data/store";
import type { Payment } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { EmptyState } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { Drawer } from "../../ui/Overlay";
import { RefundDialog } from "../orders/OrderDrawer";
import { OrderStatus, PaymentStatus } from "../orders/status";
import { MethodLabel, PaymentBadge } from "./PaymentsScreen";

export function PaymentDrawer({ paymentId, onClose }: { paymentId?: string; onClose: () => void }) {
  const { t } = useI18n();
  const { db } = useWorkspace();
  const payment = paymentId ? db.payments.find((p) => p.id === paymentId) : undefined;
  return (
    <Drawer
      open={!!paymentId}
      onClose={onClose}
      width={520}
      label={payment ? t("payments.detail.title", { id: payment.id }) : t("shell.notFound", { id: paymentId ?? "" })}
      header={
        payment ? (
          <div className="od-head">
            <p className="od-head__eyebrow">{t(`payments.type.${payment.type}` as Key)}</p>
            <h2 className="od-head__title">
              <span className="num">{payment.id}</span>
              <PaymentBadge payment={payment} />
            </h2>
          </div>
        ) : (
          <h2 className="od-head__title">{paymentId}</h2>
        )
      }
    >
      {payment ? <PaymentDetail payment={payment} /> : <EmptyState icon={<FileSearch />} title={t("shell.notFound", { id: paymentId ?? "" })} text={t("shell.notFoundHint")} />}
    </Drawer>
  );
}

function PaymentDetail({ payment }: { payment: Payment }) {
  const { t, money, inline, stamp } = useI18n();
  const { db, indexes, dispatch } = useWorkspace();
  const access = useAccess();
  const reduced = useReduced();
  const [refundOpen, setRefundOpen] = useState(false);
  const order = indexes.orders.get(payment.orderId);
  const customer = order ? indexes.users.get(order.userId) : undefined;
  const history = (indexes.paymentsByOrder.get(payment.orderId) ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const available = netPaid(history);
  const manage = access.can("payments.manage");
  const state = order ? indexes.payment(order) : "Unpaid";

  const action =
    payment.status === "Pending"
      ? { label: t("orders.detail.actions.capture"), hint: t("orders.detail.hints.capture"), icon: <Landmark />, run: () => dispatch({ type: "payment.capture", orderId: payment.orderId }) }
      : payment.status === "Failed" && state === "Failed" && order?.status !== "Cancelled"
        ? { label: t("orders.detail.actions.retry"), hint: t("orders.detail.hints.retry"), icon: <CreditCard />, run: () => dispatch({ type: "payment.retry", orderId: payment.orderId, paymentId: nextId(db, "PAY") }) }
        : null;

  const container = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.05, delayChildren: reduced ? 0 : 0.06 } } };
  const block = { hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } } };

  return (
    <motion.div className="od" variants={container} initial="hidden" animate="show">
      <motion.section className="od-summary" variants={block}>
        <div>
          <p className={cx("od-summary__total num", payment.type === "Refund" && "is-refund")}>
            {payment.type === "Refund" ? "−" : ""}
            {money(payment.amount)}
          </p>
          <p className="od-summary__meta">{t("payments.detail.when", { date: inline(payment.date) })}</p>
        </div>
        <MethodLabel payment={payment} />
      </motion.section>

      {action ? (
        <motion.section className="od-next" variants={block}>
          <div className="od-next__text">
            <p className="od-label">{t("orders.detail.nextStep")}</p>
            <p>{action.hint}</p>
          </div>
          <Button variant="primary" icon={action.icon} onClick={action.run} disabled={!manage} title={manage ? undefined : access.deniedHint} data-autofocus>
            {action.label}
          </Button>
        </motion.section>
      ) : (
        <motion.p className="od-done" variants={block}>
          {payment.type === "Refund" ? t("payments.detail.refundDone", { reason: payment.reason ? t(`refundReason.${payment.reason}` as Key) : "" }) : payment.status === "Paid" ? t("payments.detail.paidDone") : t("payments.detail.failedResolved")}
        </motion.p>
      )}

      {order && (
        <motion.section className="od-block" variants={block}>
          <h3 className="od-label">{t("payments.detail.order")}</h3>
          <a
            className="od-customer"
            href={formatRoute("orders", order.id)}
            onClick={(event) => {
              event.preventDefault();
              navigate(formatRoute("orders", order.id));
            }}
          >
            {customer && <Avatar name={customer.name} tone={customer.avatar} size={40} />}
            <span className="od-customer__text">
              <strong>
                <span className="num">{order.id}</span>
                <OrderStatus order={order} />
              </strong>
              <small>{customer?.name}</small>
              <small>
                {money(order.total)} · {inline(order.date)}
              </small>
            </span>
            <ArrowUpRight className="od-customer__go" />
          </a>
        </motion.section>
      )}

      <motion.section className="od-block" variants={block}>
        <h3 className="od-label">
          {t("payments.detail.history")} <PaymentStatus state={state} />
        </h3>
        <ul className="od-payments">
          {history.map((p) => (
            <li key={p.id} className={cx(p.type === "Refund" && "is-refund", p.status === "Failed" && "is-failed", p.id === payment.id && "is-current")}>
              <span className="od-payments__icon" aria-hidden="true">
                {p.type === "Refund" ? <Undo2 /> : p.method === "Transfer" ? <Landmark /> : <CreditCard />}
              </span>
              <span className="od-payments__text">
                <strong className="num">{p.id}</strong>
                <small>{stamp(p.date)}</small>
              </span>
              <span className="od-payments__amount">
                <span className="num">
                  {p.type === "Refund" ? "−" : ""}
                  {money(p.amount)}
                </span>
                <small>{t((p.type === "Refund" ? "payments.status.Refund" : `payments.status.${p.status}`) as Key)}</small>
              </span>
            </li>
          ))}
        </ul>
      </motion.section>

      {payment.type === "Charge" && payment.status === "Paid" && available > 0.009 && order && (
        <motion.footer className="od-actions" variants={block}>
          <Button variant="ghost" size="sm" icon={<Undo2 />} disabled={!manage} title={manage ? undefined : access.deniedHint} onClick={() => setRefundOpen(true)}>
            {t("orders.detail.actions.refund")}
          </Button>
        </motion.footer>
      )}
      {order && <RefundDialog order={order} open={refundOpen} available={available} onClose={() => setRefundOpen(false)} />}
    </motion.div>
  );
}
