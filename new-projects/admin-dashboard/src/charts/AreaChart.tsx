import { AnimatePresence, animate, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease } from "../motion/tokens";
import { blend, monotone, niceScale, remesh, sample, toPath, type Curve } from "./curve";

export type ChartDatum = { key: string; value: number; previous: number };

type Props = {
  data: ChartDatum[];
  compare: boolean;
  format: (value: number) => string;
  axisFormat: (value: number) => string;
  label: (datum: ChartDatum, index: number) => { short: string; long: string };
  currentLabel: string;
  previousLabel: string;
  ariaLabel: string;
  percent: (value: number) => string;
  /** The last bucket is still filling up (today, this week): drawn dashed so its dip isn't read as a drop. */
  partialLast?: boolean;
  height?: number;
};

type Geometry = { current: Curve; previous: Curve; zero: number; cut: number };
const pad = { top: 16, right: 14, bottom: 30, left: 52 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * Revenue-style area chart.
 * - First appearance: the line draws from left to right and the area follows its tip.
 * - Period or metric change: the curve morphs from its current shape, even mid-animation.
 * - Hover or arrow keys: a guide follows on a spring; the paths are never re-rendered.
 */
export function AreaChart({ data, compare, format, axisFormat, label, currentLabel, previousLabel, ariaLabel, percent, partialLast = false, height = 260 }: Props) {
  const id = useId().replace(/:/g, "");
  const reduced = useReduced();
  const [wrapRef, width] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const prevRef = useRef<SVGPathElement>(null);
  const endRef = useRef<SVGGElement>(null);
  const revealRef = useRef<SVGRectElement>(null);
  const tailRef = useRef<SVGPathElement>(null);
  const solidClip = useRef<SVGRectElement>(null);
  const tailClip = useRef<SVGRectElement>(null);
  const shown = useRef<Geometry | null>(null);
  const drawn = useRef(false);

  const top = pad.top;
  const bottom = height - pad.bottom;

  const signature = data.map((d) => `${d.value}:${d.previous}`).join("|");
  const scale = useMemo(() => {
    const max = Math.max(1, ...data.map((d) => d.value), ...(compare ? data.map((d) => d.previous) : []));
    const min = Math.min(0, ...data.map((d) => d.value));
    return niceScale(max, min, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, compare]);
  // The axis makes room for its longest label: "8 тыс. €" is wider than "€8k".
  const left = Math.max(pad.left, Math.ceil(Math.max(...scale.values.map((value) => axisFormat(value).length)) * 6.2) + 18);
  const right = Math.max(left + 40, width - pad.right);
  const y = (v: number) => bottom - ((v - scale.min) / (scale.max - scale.min || 1)) * (bottom - top);

  const target = useMemo<Geometry>(
    () => ({
      current: monotone(data.map((d) => y(d.value))),
      previous: monotone(data.map((d) => y(d.previous))),
      zero: y(Math.max(0, scale.min)),
      cut: partialLast && data.length > 2 ? (data.length - 2) / (data.length - 1) : 1,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, scale, height, partialLast],
  );

  const paint = (g: Geometry) => {
    const d = toPath(g.current, left, right);
    lineRef.current?.setAttribute("d", d);
    tailRef.current?.setAttribute("d", d);
    const cutX = left + g.cut * (right - left);
    solidClip.current?.setAttribute("width", String(Math.max(0, cutX - left + 6)));
    tailClip.current?.setAttribute("x", String(cutX));
    areaRef.current?.setAttribute("d", `${d}L${right},${g.zero}L${left},${g.zero}Z`);
    prevRef.current?.setAttribute("d", toPath(g.previous, left, right));
    const endY = g.current.y[g.current.y.length - 1];
    endRef.current?.setAttribute("transform", `translate(${right} ${endY})`);
  };

  // Drawing, morphing and resizing all go through one imperative painter.
  useLayoutEffect(() => {
    if (!width) return;
    const from = shown.current;
    if (!from || reduced || !drawn.current) {
      shown.current = target;
      paint(target);
      if (!drawn.current) {
        drawn.current = true;
        const full = right - left + 12;
        const open = () => revealRef.current?.setAttribute("width", "100000");
        if (reduced) open();
        else {
          const control = animate(0, 1, { duration: duration.chart, ease: ease.out, onUpdate: (p) => revealRef.current?.setAttribute("width", String(full * p)), onComplete: open });
          return () => {
            control.stop();
            open();
          };
        }
      }
      return;
    }
    const knots = Array.from(new Set([...from.current.x, ...target.current.x])).sort((a, b) => a - b);
    const a = remesh(from.current, knots);
    const b = remesh(target.current, knots);
    const ap = remesh(from.previous, knots);
    const bp = remesh(target.previous, knots);
    const frame: Geometry = { current: remesh(from.current, knots), previous: remesh(from.previous, knots), zero: from.zero, cut: from.cut };
    const control = animate(0, 1, {
      duration: 0.55,
      ease: ease.inOut,
      onUpdate: (t) => {
        blend(a, b, t, frame.current);
        blend(ap, bp, t, frame.previous);
        frame.zero = from.zero + (target.zero - from.zero) * t;
        frame.cut = from.cut + (target.cut - from.cut) * t;
        shown.current = frame;
        paint(frame);
      },
      onComplete: () => {
        shown.current = target;
        paint(target);
      },
    });
    return () => control.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, width]);

  // The inspection guide follows the pointer on a spring.
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const sx = useSpring(gx, { stiffness: 700, damping: 50 });
  const sy = useSpring(gy, { stiffness: 700, damping: 50 });
  const guideX = reduced ? gx : sx;
  const guideY = reduced ? gy : sy;
  const xAt = (index: number) => left + (data.length > 1 ? index / (data.length - 1) : 0) * (right - left);

  useEffect(() => {
    if (active === null || !shown.current) return;
    const u = data.length > 1 ? active / (data.length - 1) : 0;
    const first = gx.get() === 0;
    gx.set(xAt(active));
    gy.set(sample(shown.current.current, u));
    if (first) {
      sx.jump(xAt(active));
      sy.jump(sample(shown.current.current, u));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, signature, width]);
  useEffect(() => setActive((current) => (current === null ? null : Math.min(current, data.length - 1))), [data.length]);

  const onPointer = (event: PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const u = (event.clientX - rect.left) / rect.width;
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(u * (data.length - 1)))));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const last = data.length - 1;
    const map: Record<string, number | null> = { ArrowRight: Math.min(last, (active ?? -1) + 1), ArrowLeft: Math.max(0, (active ?? last + 1) - 1), Home: 0, End: last, Escape: null };
    if (!(event.key in map)) return;
    event.preventDefault();
    setActive(map[event.key]);
  };

  const labelEvery = Math.max(1, Math.ceil(data.length / (width < 520 ? 4 : 7)));
  const selected = active !== null ? data[active] : null;
  const selectedLabel = selected && active !== null ? label(selected, active) : null;
  const change = selected && selected.previous ? (selected.value - selected.previous) / selected.previous : null;
  const tipTarget = useMotionValue(0);
  const tipX = useSpring(tipTarget, { stiffness: 600, damping: 48 });
  useEffect(() => {
    if (active === null) return;
    const x = Math.min(Math.max(xAt(active), 96), Math.max(96, width - 96));
    const first = tipTarget.get() === 0;
    tipTarget.set(x);
    if (first || reduced) tipX.jump(x);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, width]);

  return (
    <div className="chart" ref={wrapRef} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="chart__svg" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--o-series-1)", stopOpacity: 0.32 }} />
              <stop offset="0.6" style={{ stopColor: "var(--o-series-1)", stopOpacity: 0.08 }} />
              <stop offset="1" style={{ stopColor: "var(--o-series-1)", stopOpacity: 0 }} />
            </linearGradient>
            <clipPath id={`${id}-reveal`}>
              <rect ref={revealRef} x={left - 6} y={0} width={0} height={height} />
            </clipPath>
            <clipPath id={`${id}-solid`}>
              <rect ref={solidClip} x={left - 6} y={0} width={100000} height={height} />
            </clipPath>
            <clipPath id={`${id}-tail`}>
              <rect ref={tailClip} x={100000} y={0} width={100000} height={height} />
            </clipPath>
          </defs>
          <AnimatePresence initial={false}>
            {scale.values.map((value) => (
              <motion.g key={value} className="chart__tick" initial={{ opacity: 0, y: y(value) }} animate={{ opacity: 1, y: y(value) }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: ease.inOut }}>
                <line x1={left} x2={right} y1={0} y2={0} className={value === 0 ? "is-zero" : undefined} />
                <text x={left - 10} y={4} textAnchor="end">
                  {axisFormat(value)}
                </text>
              </motion.g>
            ))}
          </AnimatePresence>
          <g clipPath={`url(#${id}-reveal)`}>
            <path ref={areaRef} fill={`url(#${id}-fill)`} />
            <motion.path ref={prevRef} className="chart__previous" fill="none" initial={false} animate={{ opacity: compare ? 1 : 0 }} transition={{ duration: duration.base }} />
            <path ref={lineRef} className="chart__line" fill="none" stroke="var(--o-accent)" clipPath={`url(#${id}-solid)`} />
            <path ref={tailRef} className="chart__line chart__line--partial" fill="none" clipPath={`url(#${id}-tail)`} />
          </g>
          <g ref={endRef} className="chart__end">
            <circle r={3.5} className="chart__end-dot" />
          </g>
          {data.map((datum, index) =>
            index % labelEvery === 0 || index === data.length - 1 ? (
              index !== data.length - 1 && data.length - 1 - index < labelEvery * 0.6 ? null : (
                <text key={datum.key} className="chart__x" x={xAt(index)} y={height - 8} textAnchor={index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"}>
                  {label(datum, index).short}
                </text>
              )
            ) : null,
          )}
          <AnimatePresence>
            {active !== null && (
              <motion.g key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: duration.fast }}>
                <motion.line className="chart__guide" x1={0} x2={0} y1={top} y2={bottom} style={{ x: guideX }} />
                <motion.g style={{ x: guideX, y: guideY }}>
                  <circle r={4} className="chart__focus-dot" />
                </motion.g>
              </motion.g>
            )}
          </AnimatePresence>
        </svg>
      )}
      <svg width={width} height={height} className="chart__hit">
        <rect
          x={left}
          y={top}
          width={Math.max(0, right - left)}
          height={Math.max(0, bottom - top)}
          fill="transparent"
          tabIndex={0}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={(event) => event.pointerType === "mouse" && setActive(null)}
          onKeyDown={onKeyDown}
          onFocus={() => setActive((current) => current ?? data.length - 1)}
          onBlur={() => setActive(null)}
        />
      </svg>
      <AnimatePresence>
        {selected && selectedLabel && (
          <motion.div className="chart__tooltip-anchor" style={{ x: tipX }} aria-hidden="true">
          <motion.div
            className="chart__tooltip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4, transition: { duration: duration.fast } }}
            transition={{ duration: duration.fast, ease: ease.out }}
          >
            <span className="chart__tooltip-date">{selectedLabel.long}</span>
            <span className="chart__tooltip-row">
              <i className="is-current" />
              {currentLabel}
              <strong className="num">{format(selected.value)}</strong>
            </span>
            {compare && (
              <span className="chart__tooltip-row">
                <i className="is-previous" />
                {previousLabel}
                <strong className="num">{format(selected.previous)}</strong>
              </span>
            )}
            {compare && change !== null && (
              <span className={`chart__tooltip-change ${change >= 0 ? "is-up" : "is-down"}`}>
                {change >= 0 ? "+" : "−"}
                {percent(Math.abs(change))}
              </span>
            )}
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="sr-only" aria-live="polite">
        {selected && selectedLabel ? `${selectedLabel.long}: ${format(selected.value)}${compare ? `, ${previousLabel}: ${format(selected.previous)}` : ""}` : ""}
      </p>
    </div>
  );
}
