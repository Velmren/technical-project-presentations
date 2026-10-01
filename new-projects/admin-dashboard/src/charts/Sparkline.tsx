import { animate, motion } from "motion/react";
import { useId, useLayoutEffect, useMemo, useRef } from "react";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease } from "../motion/tokens";
import { blend, monotone, remesh, toPath, type Curve } from "./curve";

const W = 120;
const H = 40;

/** A small trend line: draws itself once, then morphs when the period changes. */
export function Sparkline({ values, tone = "accent", delay = 0 }: { values: number[]; tone?: "accent" | "positive" | "danger"; delay?: number }) {
  const id = useId().replace(/:/g, "");
  const reduced = useReduced();
  const line = useRef<SVGPathElement>(null);
  const area = useRef<SVGPathElement>(null);
  const shown = useRef<Curve | null>(null);
  const signature = values.join(",");
  const target = useMemo(() => {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    return monotone(values.map((v) => H - 4 - ((v - min) / (max - min || 1)) * (H - 10)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const paint = (curve: Curve) => {
    const d = toPath(curve, 2, W - 2);
    line.current?.setAttribute("d", d);
    area.current?.setAttribute("d", `${d}L${W - 2},${H}L2,${H}Z`);
  };

  useLayoutEffect(() => {
    const from = shown.current;
    if (!from || reduced) {
      shown.current = target;
      paint(target);
      return;
    }
    const knots = Array.from(new Set([...from.x, ...target.x])).sort((a, b) => a - b);
    const a = remesh(from, knots);
    const b = remesh(target, knots);
    const frame = remesh(from, knots);
    const control = animate(0, 1, {
      duration: 0.55,
      ease: ease.inOut,
      onUpdate: (t) => {
        shown.current = blend(a, b, t, frame);
        paint(frame);
      },
      onComplete: () => {
        shown.current = target;
        paint(target);
      },
    });
    return () => control.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced]);

  return (
    <svg className={`sparkline sparkline--${tone}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path ref={area} fill={`url(#${id}-g)`} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: duration.slow, delay: delay + 0.35 }} />
      <motion.path
        ref={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.chart, delay, ease: ease.out }}
      />
    </svg>
  );
}
