import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Receipt, ShoppingBag, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import { Sparkline } from "../../charts/Sparkline";
import { dailyValues, totals, type Metric } from "../../data/metrics";
import { useWorkspace } from "../../data/store";
import type { Period } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Counter } from "../../motion/Counter";
import { fadeUp } from "../../motion/tokens";
import { cx } from "../../ui/Button";

type Kpi = { key: string; label: Key; hint: Key; icon: LucideIcon; value: number; previous: number; format: "money" | "number"; trend: number[] };

export function KpiRow({ period, comparable }: { period: Period; comparable: boolean }) {
  const { t, money, number, percent } = useI18n();
  const { db } = useWorkspace();
  const now = totals(db, period);
  const before = totals(db, period, 1);
  const trend = (metric: Metric) => {
    const values = dailyValues(db, period, metric);
    // Long periods are smoothed by week so the small chart stays readable.
    if (values.length <= 30) return values;
    const size = period === 90 ? 7 : 30;
    const buckets: number[] = [];
    for (let i = 0; i < values.length; i += size) buckets.push(values.slice(i, i + size).reduce((a, b) => a + b, 0));
    return buckets;
  };
  const revenueTrend = trend("revenue");
  const orderTrend = trend("orders");
  const kpis: Kpi[] = [
    { key: "revenue", label: "overview.kpi.revenue", hint: "overview.kpi.revenueHint", icon: Wallet, value: now.revenue, previous: before.revenue, format: "money", trend: revenueTrend },
    { key: "orders", label: "overview.kpi.orders", hint: "overview.kpi.ordersHint", icon: ShoppingBag, value: now.orders, previous: before.orders, format: "number", trend: orderTrend },
    { key: "aov", label: "overview.kpi.aov", hint: "overview.kpi.aovHint", icon: Receipt, value: now.aov, previous: before.aov, format: "money", trend: revenueTrend.map((v, i) => (orderTrend[i] ? v / orderTrend[i] : 0)) },
    { key: "customers", label: "overview.kpi.customers", hint: "overview.kpi.customersHint", icon: UserPlus, value: now.customers, previous: before.customers, format: "number", trend: trend("customers") },
  ];
  const whole = (value: number) => money(Math.round(value));

  return (
    <motion.section className="kpis" variants={fadeUp} aria-label={t("period.label")}>
      {kpis.map((kpi, index) => {
        const change = comparable && kpi.previous ? (kpi.value - kpi.previous) / kpi.previous : null;
        const up = (change ?? 0) >= 0;
        return (
          <article className="kpi" key={kpi.key}>
            <div className="kpi__top">
              <span className="kpi__icon" aria-hidden="true">
                <kpi.icon />
              </span>
              <span className="kpi__label" title={t(kpi.hint)}>
                {t(kpi.label)}
              </span>
            </div>
            <p className="kpi__value num">
              <Counter value={kpi.value} format={kpi.format === "money" ? whole : (v) => number(Math.round(v))} delay={0.08 * index} />
            </p>
            <div className="kpi__bottom">
              {change !== null ? (
                <span className={cx("kpi__change", up ? "is-up" : "is-down")} title={t("overview.kpi.vs", { period: t(`period.previous.d${period}` as Key) })}>
                  {up ? <ArrowUpRight /> : <ArrowDownRight />}
                  <span className="num">{percent(Math.abs(change))}</span>
                  <small>{t("overview.kpi.vs", { period: t(`period.previous.d${period}` as Key) })}</small>
                </span>
              ) : (
                <span className="kpi__change is-flat">
                  <small>{t("overview.kpi.noCompare")}</small>
                </span>
              )}
              <span className={cx("kpi__spark", up ? "is-up" : "is-down")} title={t("overview.kpi.trend", { period: t(`period.long.d${period}` as Key) })}>
                <Sparkline values={kpi.trend} tone={change === null || up ? "accent" : "danger"} delay={0.1 + 0.08 * index} />
              </span>
            </div>
          </article>
        );
      })}
    </motion.section>
  );
}
