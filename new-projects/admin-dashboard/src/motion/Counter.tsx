import { animate } from "motion/react";
import { useEffect, useRef } from "react";
import { useReduced } from "./MotionPreference";
import { duration, ease } from "./tokens";

/**
 * Counts to the value on first appearance and glides between values afterwards.
 * Writes the text node directly, so a running count never re-renders React.
 * The accessible text is always the final value.
 */
export function Counter({ value, format, from = 0, delay = 0 }: { value: number; format: (value: number) => string; from?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const reduced = useReduced();
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const start = shown.current ?? from;
    const paint = (n: number) => {
      shown.current = n;
      node.textContent = formatRef.current(n);
    };
    if (reduced || start === value) {
      paint(value);
      return;
    }
    const control = animate(start, value, { duration: shown.current === null ? duration.counter : duration.slow + 0.1, delay: shown.current === null ? delay : 0, ease: ease.out, onUpdate: paint });
    return () => control.stop();
  }, [value, reduced, from, delay]);

  // Language changes re-format the settled value without replaying the count.
  useEffect(() => {
    if (ref.current && shown.current !== null) ref.current.textContent = format(shown.current);
  }, [format]);

  return (
    <span className="counter">
      <span ref={ref} aria-hidden="true">
        {format(reduced ? value : from)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
