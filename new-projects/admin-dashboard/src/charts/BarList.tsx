import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useReduced } from "../motion/MotionPreference";
import { spring, staggerDelay } from "../motion/tokens";

export type BarItem = { key: string; label: ReactNode; sub?: ReactNode; value: number; display: string; lead?: ReactNode };

/** Ranked horizontal bars. Bars grow from the left on entry and re-balance when the period changes. */
export function BarList({ items, max }: { items: BarItem[]; max?: number }) {
  const reduced = useReduced();
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ol className="barlist">
      {items.map((item, index) => (
        // Rows take their new places at once when the ranking changes; only the bars grow, so names never slide over each other.
        <li key={item.key}>
          {item.lead && <span className="barlist__lead">{item.lead}</span>}
          <span className="barlist__main">
            <span className="barlist__row">
              <span className="barlist__label">{item.label}</span>
              <span className="barlist__value num">{item.display}</span>
            </span>
            <span className="barlist__track" aria-hidden="true">
              <motion.span className="barlist__fill" initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: Math.max(0.005, item.value / top) }} transition={{ ...spring.layout, delay: reduced ? 0 : 0.15 + staggerDelay(index, 0.04) }} />
            </span>
            {item.sub && <span className="barlist__sub">{item.sub}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
