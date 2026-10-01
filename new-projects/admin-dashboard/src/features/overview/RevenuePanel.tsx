import { useMemo, useState } from "react";
import { AreaChart, type ChartDatum } from "../../charts/AreaChart";
import { TODAY, now } from "../../data/clock";
import { series, type Metric, type SeriesPoint } from "../../data/metrics";
import { useWorkspace } from "../../data/store";
import type { Period } from "../../data/types";
import { useI18n, type Key } from "../../i18n";
import { Panel } from "../../ui/Blocks";
import { Segmented } from "../../ui/Segmented";
import { Switch } from "../../ui/Switch";

type ChartMode = "daily" | "avg7";
// How the daily chart is drawn is a personal preference, remembered in this browser.
function useChartMode() {
  const [mode, setMode] = useState<ChartMode>(() => {
    try {
      return localStorage.getItem("orbit-chart-mode") === "daily" ? "daily" : "avg7";
    } catch {
      return "avg7";
    }
  });
  const update = (next: ChartMode) => {
    setMode(next);
    try {
      localStorage.setItem("orbit-chart-mode", next);
    } catch {
      /* Still applied for this session. */
    }
  };
  return [mode, update] as const;
}

export function RevenuePanel({ period, comparable }: { period: Period; comparable: boolean }) {
  const { t, money, moneyCompact, number, compact, date, weekday, monthYear, month, percent, time } = useI18n();
  const { db } = useWorkspace();
  const [metric, setMetric] = useState<Metric>("revenue");
  const [compare, setCompare] = useState(true);
  const [mode, setMode] = useChartMode();
  const daily = period <= 30;
  const smooth = daily && mode === "avg7";
  const points = useMemo(() => series(db, period, metric, smooth), [db, period, metric, smooth]);
  const byKey = useMemo(() => new Map(points.map((p) => [p.key, p])), [points]);
  const data: ChartDatum[] = points.map((p) => ({ key: p.key, value: Math.round(p.value * 100) / 100, previous: Math.round(p.previous * 100) / 100 }));
  const isMoney = metric === "revenue";
  const canCompare = comparable || period !== 365;
  const label = (datum: ChartDatum) => {
    const point = byKey.get(datum.key) as SeriesPoint;
    const last = datum.key === points[points.length - 1]?.key;
    if (point.unit === "month") return { short: month(point.start), long: monthYear(point.start) + (last ? ` · ${t("overview.chart.partialRange", { date: date(TODAY) })}` : "") };
    if (point.unit === "week") return { short: date(point.start), long: t("overview.chart.week", { date: date(point.start) }) + (last ? ` · ${t("overview.chart.partialRange", { date: date(TODAY) })}` : "") };
    return { short: date(point.start), long: `${weekday(point.start)}, ${date(point.start)}` + (last ? ` · ${t("overview.chart.partialDay", { time: time(now()) })}` : "") };
  };
  const total = useMemo(() => series(db, period, metric).reduce((sum, p) => sum + p.value, 0), [db, period, metric]);
  const currentLabel = smooth ? t("overview.chart.avgLabel") : t("overview.chart.current");

  return (
    <Panel
      className="revenue"
      id="overview-revenue"
      title={t(`overview.chart.titles.${metric}` as Key)}
      subtitle={
        <>
          <strong className="num">{isMoney ? money(Math.round(total)) : number(total)}</strong> {t(`period.long.d${period}` as Key)}
        </>
      }
      actions={
        <Segmented
          size="sm"
          label={t("overview.chart.title")}
          value={metric}
          onChange={setMetric}
          options={(["revenue", "orders", "customers"] as Metric[]).map((value) => ({ value, label: t(`overview.chart.metrics.${value}` as Key) }))}
        />
      }
    >
      <div className="revenue__bar">
        <div className="revenue__legend" aria-hidden="true">
          <span>
            <i className="is-current" />
            {currentLabel}
          </span>
          {canCompare && compare && (
            <span>
              <i className="is-previous" />
              {t("overview.chart.previous")}
            </span>
          )}
        </div>
        <div className="revenue__controls">
          {daily && (
            <Segmented
              size="sm"
              label={t("overview.chart.modeLabel")}
              value={mode}
              onChange={setMode}
              options={[
                { value: "daily", label: t("overview.chart.modes.daily") },
                { value: "avg7", label: t("overview.chart.modes.avg7") },
              ]}
            />
          )}
          {canCompare && <Switch checked={compare} onChange={setCompare} label={t("overview.chart.compare")} />}
        </div>
      </div>
      <AreaChart
        data={data}
        compare={canCompare && compare}
        format={(value) => (isMoney ? money(value) : number(value))}
        axisFormat={(value) => (isMoney ? moneyCompact(value) : compact(value))}
        label={label}
        percent={percent}
        partialLast
        currentLabel={currentLabel}
        previousLabel={t("overview.chart.previous")}
        ariaLabel={`${t(`overview.chart.titles.${metric}` as Key)}, ${t(`period.long.d${period}` as Key)}. ${t("overview.chart.inspect")}`}
        height={268}
      />
    </Panel>
  );
}
