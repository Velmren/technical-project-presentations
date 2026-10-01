import { motion } from "motion/react";
import { useState } from "react";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease } from "../motion/tokens";

/**
 * Orders by weekday and hour. Cell brightness is the share of the busiest hour;
 * columns fade in from morning to night on entry.
 */
export function Heatmap({ data, days, cellLabel, legend }: { data: number[][]; days: string[]; cellLabel: (day: number, hour: number, value: number) => string; legend: { low: string; high: string } }) {
  const reduced = useReduced();
  const [active, setActive] = useState<[number, number] | null>(null);
  const peak = Math.max(1, ...data.flat());
  return (
    <div className="heat">
      <div className="heat__grid" role="img" aria-label={active ? cellLabel(active[0], active[1], data[active[0]][active[1]]) : `${legend.low} / ${legend.high}`}>
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="heat__hour num">
            {hour % 3 === 0 ? String(hour).padStart(2, "0") : ""}
          </span>
        ))}
        {data.map((row, day) => (
          <div key={day} className="heat__row">
            <span className="heat__day">{days[day]}</span>
            {row.map((value, hour) => (
              <motion.span
                key={hour}
                className="heat__cell"
                title={cellLabel(day, hour, value)}
                style={{ "--v": value / peak } as React.CSSProperties}
                initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: duration.slow, ease: ease.out, delay: reduced ? 0 : 0.1 + hour * 0.018 + day * 0.01 }}
                onPointerEnter={() => setActive([day, hour])}
                onPointerLeave={() => setActive(null)}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heat__legend">
        <span>{legend.low}</span>
        <span className="heat__scale" aria-hidden="true" />
        <span>{legend.high}</span>
        <span className="heat__readout">{active ? cellLabel(active[0], active[1], data[active[0]][active[1]]) : ""}</span>
      </div>
    </div>
  );
}
