import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { formatRoute, navigate } from "../../app/router";
import { useWorkspace } from "../../data/store";
import { useI18n } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, staggerDelay } from "../../motion/tokens";
import { Avatar } from "../../ui/Avatar";
import { Panel } from "../../ui/Blocks";
import { Button } from "../../ui/Button";
import { OrderStatus } from "../orders/status";

export function LatestOrders() {
  const { t, money, relative } = useI18n();
  const { db, indexes } = useWorkspace();
  const reduced = useReduced();
  const orders = db.orders.slice(0, 6);
  const open = (id: string) => navigate(formatRoute("orders", id));

  return (
    <Panel
      className="latest"
      id="overview-latest"
      title={t("overview.latest.title")}
      actions={
        <Button variant="ghost" size="sm" iconEnd={<ArrowRight />} onClick={() => navigate(formatRoute("orders"))}>
          {t("overview.latest.all")}
        </Button>
      }
    >
      <div className="latest__table" role="table" aria-label={t("overview.latest.title")}>
        <div className="latest__row latest__row--head" role="row">
          <span role="columnheader">{t("orders.columns.order")}</span>
          <span role="columnheader">{t("orders.columns.customer")}</span>
          <span role="columnheader">{t("orders.columns.status")}</span>
          <span role="columnheader" className="is-num">
            {t("orders.columns.total")}
          </span>
        </div>
        {orders.map((order, index) => {
          const customer = indexes.users.get(order.userId);
          return (
            <motion.a
              key={order.id}
              role="row"
              href={formatRoute("orders", order.id)}
              className="latest__row"
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: duration.slow, ease: ease.out, delay: 0.25 + staggerDelay(index) }}
              onClick={(event) => {
                event.preventDefault();
                open(order.id);
              }}
            >
              <span role="cell" className="latest__order">
                <motion.strong layoutId={`order-id-${order.id}`} className="num">
                  {order.id}
                </motion.strong>
                <small>{relative(order.date)}</small>
              </span>
              <span role="cell" className="latest__customer">
                {customer && <Avatar name={customer.name} tone={customer.avatar} size={28} />}
                <span>
                  <strong>{customer?.name}</strong>
                  <small>{order.city}</small>
                </span>
              </span>
              <span role="cell">
                <OrderStatus order={order} />
              </span>
              <span role="cell" className="is-num num latest__total">
                {money(order.total)}
              </span>
            </motion.a>
          );
        })}
      </div>
    </Panel>
  );
}
