import { motion } from "motion/react";
import { useState } from "react";
import { Donut } from "../../charts/Donut";
import { categories } from "../../data/catalog";
import { categoryShares, totals } from "../../data/metrics";
import { useWorkspace } from "../../data/store";
import type { Period } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Counter } from "../../motion/Counter";
import { useReduced } from "../../motion/MotionPreference";
import { spring } from "../../motion/tokens";
import { Panel } from "../../ui/Blocks";
import { cx } from "../../ui/Button";

const colors = ["var(--o-series-1)", "var(--o-series-2)", "var(--o-series-3)", "var(--o-series-4)", "var(--o-series-5)"];

export function CategoryPanel({ period }: { period: Period }) {
  const { t, money, moneyCompact, percent } = useI18n();
  const { db } = useWorkspace();
  const reduced = useReduced();
  const [active, setActive] = useState<string | null>(null);
  const shares = categoryShares(db, period);
  const revenue = totals(db, period).revenue;
  const byCategory = new Map(shares.map((s) => [s.category, s.share]));
  // Segments keep a fixed order so colours never swap; the legend is sorted by size.
  const segments = categories.map((category, i) => ({ key: category, share: byCategory.get(category) ?? 0, color: colors[i] }));
  const legend = [...segments].sort((a, b) => b.share - a.share);

  return (
    <Panel className="categories" id="overview-categories" title={t("overview.categories.title")}>
      <div className="categories__body">
        <Donut
          segments={segments}
          active={active}
          onActive={setActive}
          center={
            <>
              <strong className="num">
                <Counter value={revenue} format={(v) => moneyCompact(v)} />
              </strong>
              <span>{t("overview.categories.center", { period: t(`period.span.d${period}` as Key) })}</span>
            </>
          }
        />
        <ul className="categories__legend">
          {legend.map((segment) => (
            <motion.li
              key={segment.key}
              layout={!reduced}
              transition={spring.layout}
              className={cx(active === segment.key && "is-active", active && active !== segment.key && "is-muted")}
              onPointerEnter={() => setActive(segment.key)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(segment.key)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              aria-label={`${t(`categories.${segment.key}` as Key)}: ${percent(segment.share)}, ${money(Math.round(segment.share * revenue))}`}
            >
              <i style={{ background: segment.color }} aria-hidden="true" />
              <span className="categories__name">{t(`categories.${segment.key}` as Key)}</span>
              <span className="categories__share num">{percent(segment.share)}</span>
              <span className="categories__amount num">{money(Math.round(segment.share * revenue))}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
