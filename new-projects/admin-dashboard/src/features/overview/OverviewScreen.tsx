import { motion } from "motion/react";
import { AlertTriangle, ArrowUpRight, CreditCard, Landmark, MessageSquare, PackageCheck, type LucideIcon } from "lucide-react";
import { queues } from "../../data/attention";
import { HISTORY_START, TODAY, addDays, now } from "../../data/clock";
import { daily, totals } from "../../data/metrics";
import { useWorkspace } from "../../data/store";
import type { Period } from "../../data/types";
import { formatRoute, navigate } from "../../app/router";
import { useI18n, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { spring, stagger } from "../../motion/tokens";
import { Segmented } from "../../ui/Segmented";
import { ActivityFeed } from "./ActivityFeed";
import { CategoryPanel } from "./CategoryPanel";
import { KpiRow } from "./KpiRow";
import { LatestOrders } from "./LatestOrders";
import { periods, usePeriod } from "./period";
import { RevenuePanel } from "./RevenuePanel";
import "./overview.css";

export function OverviewScreen() {
  const { t, date } = useI18n();
  const { db, indexes } = useWorkspace();
  const reduced = useReduced();
  const [period, setPeriod] = usePeriod(db.settings.defaultPeriod);
  const work = queues(db, indexes);
  const todayOrders = daily(db).orders.get(TODAY) ?? 0;
  const todayRevenue = daily(db).revenue.get(TODAY) ?? 0;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: db.settings.timezone }).format(new Date(now())));
  const greeting = hour < 5 || hour >= 18 ? "greeting.evening" : hour < 12 ? "greeting.morning" : "greeting.afternoon";
  const firstName = db.settings.profileName.split(" ")[0];
  const current = totals(db, period);
  const comparable = addDays(TODAY, -2 * period + 1) >= HISTORY_START;

  const chips: { key: string; count: number; icon: LucideIcon; tone: string; label: Key; href: string }[] = [
    { key: "toPack", count: work.toPack.length, icon: PackageCheck, tone: "accent", label: "overview.attention.toPack", href: formatRoute("orders", undefined, { view: "toPack" }) },
    { key: "failed", count: work.failed.length, icon: CreditCard, tone: "danger", label: "overview.attention.failed", href: formatRoute("orders", undefined, { view: "awaiting" }) },
    { key: "transfers", count: work.transfers.length, icon: Landmark, tone: "warning", label: "overview.attention.transfers", href: formatRoute("orders", undefined, { view: "awaiting" }) },
    { key: "stock", count: work.lowStock, icon: AlertTriangle, tone: "warning", label: "overview.attention.stock", href: formatRoute("products") },
    { key: "messages", count: work.unread, icon: MessageSquare, tone: "violet", label: "overview.attention.messages", href: formatRoute("messages") },
  ];

  return (
    <motion.div className="overview" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : stagger.cards } } }}>
      <header className="page-head overview__head">
        <div className="page-head__main">
          <h1 className="page-head__title">{t(greeting, { name: firstName })}</h1>
          <p className="overview__summary">{todayOrders ? t("overview.summary", { count: todayOrders, amount: Math.round(todayRevenue) }) : t("overview.summaryNone")}</p>
        </div>
        <div className="page-head__side overview__period">
          <Segmented
            label={t("period.label")}
            value={period}
            onChange={(value) => setPeriod(value as Period)}
            options={periods.map((value) => ({ value, label: t(`period.options.d${value}` as Key), hint: t(`period.long.d${value}` as Key) }))}
          />
          <p className="overview__range">{t("period.range", { from: date(current.days[0]), to: date(TODAY) })}</p>
        </div>
      </header>
      <ul className="attention" aria-label={t("overview.attentionLabel")}>
            {chips
              .filter((chip) => chip.count > 0)
              .map((chip, index) => (
                <motion.li key={chip.key} initial={reduced ? false : { opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring.pop, delay: reduced ? 0 : 0.15 + index * 0.05 }}>
                  <a
                    className={`attention__chip attention__chip--${chip.tone}`}
                    href={chip.href}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(chip.href);
                    }}
                  >
                    <chip.icon />
                    <span>{t(chip.label, { count: chip.count })}</span>
                    <ArrowUpRight className="attention__arrow" />
                  </a>
                </motion.li>
              ))}
      </ul>
      <KpiRow period={period} comparable={comparable} />
      <div className="overview__grid">
        <RevenuePanel period={period} comparable={comparable} />
        <CategoryPanel period={period} />
      </div>
      <div className="overview__grid">
        <LatestOrders />
        <ActivityFeed />
      </div>
    </motion.div>
  );
}
