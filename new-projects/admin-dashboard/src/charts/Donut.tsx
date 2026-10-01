import { animate } from "motion/react";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease } from "../motion/tokens";
import { cx } from "../ui/Button";

const R = 54;
const C = 2 * Math.PI * R;
const GAP = 3;

export type DonutSegment = { key: string; share: number; color: string };

/**
 * Ring chart. Sweeps in clockwise on first appearance and re-balances its
 * segments smoothly when the period changes. Hovering a legend row lifts its segment.
 */
export function Donut({ segments, active, onActive, center }: { segments: DonutSegment[]; active: string | null; onActive: (key: string | null) => void; center: ReactNode }) {
  const reduced = useReduced();
  const maskId = `donut-${useId().replace(/:/g, "")}`;
  const refs = useRef<(SVGCircleElement | null)[]>([]);
  const sweep = useRef<SVGCircleElement>(null);
  const shown = useRef<number[] | null>(null);
  const signature = segments.map((s) => s.share.toFixed(4)).join(",");

  useLayoutEffect(() => {
    const target = segments.map((s) => s.share);
    const paint = (shares: number[]) => {
      let offset = 0;
      shares.forEach((share, i) => {
        const length = Math.max(0, share * C - GAP);
        refs.current[i]?.setAttribute("stroke-dasharray", `${length} ${C}`);
        refs.current[i]?.setAttribute("stroke-dashoffset", String(-offset));
        offset += share * C;
      });
    };
    const from = shown.current;
    if (!from) {
      shown.current = target;
      paint(target);
      if (reduced) {
        sweep.current?.setAttribute("stroke-dasharray", `${C} ${C}`);
        return;
      }
      const control = animate(0, C, { duration: duration.chart, ease: ease.out, delay: 0.1, onUpdate: (v) => sweep.current?.setAttribute("stroke-dasharray", `${v} ${C}`) });
      return () => control.stop();
    }
    if (reduced) {
      shown.current = target;
      paint(target);
      return;
    }
    const frame = target.map((_, i) => from[i] ?? 0);
    const start = frame.slice();
    const control = animate(0, 1, {
      duration: 0.55,
      ease: ease.inOut,
      onUpdate: (t) => {
        for (let i = 0; i < frame.length; i++) frame[i] = start[i] + (target[i] - start[i]) * t;
        shown.current = frame;
        paint(frame);
      },
    });
    return () => control.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, reduced]);

  return (
    <div className="donut">
      <svg viewBox="0 0 140 140" className="donut__svg" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <circle ref={sweep} cx="70" cy="70" r={R} fill="none" stroke="#fff" strokeWidth="26" strokeDasharray={`0 ${C}`} transform="rotate(-90 70 70)" />
          </mask>
        </defs>
        <circle cx="70" cy="70" r={R} className="donut__track" />
        <g mask={`url(#${maskId})`}>
          {segments.map((segment, i) => (
            <g key={segment.key} className={cx("donut__segment", active === segment.key && "is-active", active && active !== segment.key && "is-muted")} onPointerEnter={() => onActive(segment.key)} onPointerLeave={() => onActive(null)}>
              <circle
                ref={(node) => {
                  refs.current[i] = node;
                }}
                cx="70"
                cy="70"
                r={R}
                style={{ stroke: segment.color }}
                transform="rotate(-90 70 70)"
              />
            </g>
          ))}
        </g>
      </svg>
      <div className="donut__center">{center}</div>
    </div>
  );
}
