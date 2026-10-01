import { motion } from "motion/react";
import { Download, Percent, Receipt, RefreshCcw, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { BarList } from "../../charts/BarList";
import { Donut } from "../../charts/Donut";
import { Heatmap } from "../../charts/Heatmap";
import { analytics, totals } from "../../data/metrics";
import { useToasts, useWorkspace } from "../../data/store";
import type { Period } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { downloadCsv } from "../../lib/csv";
import { Counter } from "../../motion/Counter";
import { useReduced } from "../../motion/MotionPreference";
import { fadeUp, stagger } from "../../motion/tokens";
import { ProductThumb, Panel } from "../../ui/Blocks";
import { Button, cx } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { periods, usePeriod } from "../overview/period";
import { RevenuePanel } from "../overview/RevenuePanel";
import "./analytics.css";

const channelColors = ["var(--o-series-1)", "var(--o-series-2)", "var(--o-series-4)"];

export function AnalyticsScreen() {
  const { t, money, number, percent, locale } = useI18n();
  const { db, indexes } = useWorkspace();
  const { notify } = useToasts();
  const reduced = useReduced();
  const [period, setPeriod] = usePeriod(db.settings.defaultPeriod);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const report = analytics(db, period, db.settings.timezone);
  const now = totals(db, period);
  const regionName = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 8, 28 + i)))), [locale]);
  const refundRate = report.received ? report.refunded / report.received : 0;
  const repeatShare = report.orders ? report.repeatOrders / report.orders : 0;
  const cancelRate = report.orders ? report.cancelled / report.orders : 0;
  const productTotal = report.products.reduce((s, p) => s + p.value, 0) || 1;
  const countryTotal = report.countries.reduce((s, c) => s + c.value, 0) || 1;
  const channelTotal = report.channels.reduce((s, c) => s + c.value, 0) || 1;
  const busiest = useMemo(() => {
    let best = { day: 0, hour: 0, value: -1 };
    report.heat.forEach((row, day) => row.forEach((value, hour) => value > best.value && (best = { day, hour, value })));
    return best;
  }, [report]);

  const tiles = [
    { key: "revenue", icon: Wallet, value: now.revenue, format: (v: number) => money(Math.round(v)), note: t("analytics.tiles.revenueNote", { orders: now.orders }) },
    { key: "aov", icon: Receipt, value: now.aov, format: (v: number) => money(Math.round(v)), note: t("analytics.tiles.aovNote") },
    { key: "repeat", icon: RefreshCcw, value: repeatShare * 100, format: (v: number) => percent(v / 100), note: t("analytics.tiles.repeatNote", { count: report.repeatOrders }) },
    { key: "refunds", icon: Percent, value: refundRate * 100, format: (v: number) => percent(v / 100), note: t("analytics.tiles.refundsNote", { amount: Math.round(report.refunded), cancelled: percent(cancelRate) }) },
  ];

  const exportReport = () => {
    downloadCsv(
      `orbit-report-${period}d-${new Date().toISOString().slice(0, 10)}.csv`,
      [t("analytics.csv.section"), t("analytics.csv.name"), t("analytics.csv.units"), t("analytics.csv.orders"), t("analytics.csv.revenue"), t("analytics.csv.share")],
      [
        ...report.products.map((p) => [t("analytics.products.title"), indexes.products.get(p.key)?.name ?? p.key, p.units ?? 0, p.orders ?? 0, p.value.toFixed(2), (p.value / productTotal).toFixed(4)]),
        ...report.countries.map((c) => [t("analytics.countries.title"), regionName.of(c.key) ?? c.key, "", c.orders ?? 0, c.value.toFixed(2), (c.value / countryTotal).toFixed(4)]),
        ...report.channels.map((c) => [t("analytics.channels.title"), t(`channel.${c.key}` as Key), "", c.orders ?? 0, c.value.toFixed(2), (c.value / channelTotal).toFixed(4)]),
      ],
    );
    notify({ key: "analytics.exported" }, "info");
  };

  return (
    <motion.div className="page analytics" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      <motion.header className="page-head" variants={fadeUp}>
        <div className="page-head__main">
          <h1 className="page-head__title">{t("analytics.title")}</h1>
          <p className="page-head__subtitle">{t("analytics.subtitle", { day: weekdays[busiest.day], hour: String(busiest.hour).padStart(2, "0") })}</p>
        </div>
        <div className="page-head__side">
          <Segmented label={t("period.label")} value={period} onChange={(v) => setPeriod(v as Period)} options={periods.map((value) => ({ value, label: t(`period.options.d${value}` as Key) }))} />
          <Button icon={<Download />} onClick={exportReport}>
            {t("common.exportCsv")}
          </Button>
        </div>
      </motion.header>

      <motion.section className="kpis" variants={fadeUp}>
        {tiles.map((tile, i) => (
          <article key={tile.key} className={cx("kpi", `an-tile--${tile.key}`)}>
            <div className="kpi__top">
              <span className="kpi__icon" aria-hidden="true">
                <tile.icon />
              </span>
              <span className="kpi__label">{t(`analytics.tiles.${tile.key}` as Key)}</span>
            </div>
            <p className="kpi__value num">
              <Counter value={tile.value} format={tile.format} delay={0.06 * i} />
            </p>
            <p className="pay-tile__note">{tile.note}</p>
          </article>
        ))}
      </motion.section>

      <div className="overview__grid analytics__main">
        <RevenuePanel period={period} comparable={period !== 365} />
        <Panel className="an-channels" id="analytics-channels" title={t("analytics.channels.title")} subtitle={t("analytics.channels.subtitle")}>
          <div className="categories__body">
            <Donut
              segments={(["Web", "App", "Showroom"] as const).map((key, i) => ({ key, share: (report.channels.find((c) => c.key === key)?.value ?? 0) / channelTotal, color: channelColors[i] }))}
              active={activeChannel}
              onActive={setActiveChannel}
              center={
                <>
                  <strong className="num">{number(report.orders - report.cancelled)}</strong>
                  <span>{t("analytics.channels.center", { count: report.orders - report.cancelled })}</span>
                </>
              }
            />
            <ul className="categories__legend">
              {(["Web", "App", "Showroom"] as const).map((key, i) => {
                const entry = report.channels.find((c) => c.key === key);
                return (
                  <li key={key} className={cx(activeChannel === key && "is-active", activeChannel && activeChannel !== key && "is-muted")} onPointerEnter={() => setActiveChannel(key)} onPointerLeave={() => setActiveChannel(null)} tabIndex={0}>
                    <i style={{ background: channelColors[i] }} aria-hidden="true" />
                    <span className="categories__name">{t(`channel.${key}` as Key)}</span>
                    <span className="categories__share num">{percent((entry?.value ?? 0) / channelTotal)}</span>
                    <span className="categories__amount num">{t("analytics.channels.orders", { count: entry?.orders ?? 0 })}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="split">
            <p className="od-label">{t("analytics.split.title")}</p>
            <div className="split__bar" aria-hidden="true">
              <motion.span className="split__new" initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: 1 - repeatShare }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }} />
            </div>
            <div className="split__legend">
              <span>
                <i className="is-new" />
                {t("analytics.split.first", { share: percent(1 - repeatShare) })}
              </span>
              <span>
                <i className="is-repeat" />
                {t("analytics.split.repeat", { share: percent(repeatShare) })}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="analytics__pair">
        <Panel id="analytics-products" title={t("analytics.products.title")} subtitle={t("analytics.products.subtitle")}>
          <div className="panel-pad">
            <BarList
              items={report.products.slice(0, 8).map((p) => {
                const product = indexes.products.get(p.key);
                return {
                  key: p.key,
                  lead: <ProductThumb product={product} size={34} />,
                  label: product?.name ?? p.key,
                  sub: t("analytics.products.units", { count: p.units ?? 0, share: percent(p.value / productTotal) }),
                  value: p.value,
                  display: money(Math.round(p.value)),
                };
              })}
            />
          </div>
        </Panel>
        <Panel id="analytics-countries" title={t("analytics.countries.title")} subtitle={t("analytics.countries.subtitle", { count: report.countries.length })}>
          <div className="panel-pad">
            <BarList
              items={report.countries.slice(0, 8).map((c) => ({
                key: c.key,
                lead: <span className="country-code">{c.key}</span>,
                label: regionName.of(c.key) ?? c.key,
                sub: t("analytics.countries.orders", { count: c.orders ?? 0, share: percent(c.value / countryTotal) }),
                value: c.value,
                display: money(Math.round(c.value)),
              }))}
            />
          </div>
        </Panel>
      </div>

      <Panel id="analytics-heat" title={t("analytics.heat.title")} subtitle={t("analytics.heat.subtitle", { timezone: db.settings.timezone })}>
        <div className="panel-pad">
          <Heatmap
            data={report.heat}
            days={weekdays}
            legend={{ low: t("analytics.heat.low"), high: t("analytics.heat.high") }}
            cellLabel={(day, hour, value) => t("analytics.heat.cell", { day: weekdays[day], from: String(hour).padStart(2, "0"), to: String((hour + 1) % 24).padStart(2, "0"), count: value })}
          />
        </div>
      </Panel>
    </motion.div>
  );
}
