import { useLayoutEffect, useRef, useState } from "react";

export const ROW = 24;

// Windowed rendering: only rows inside the viewport (plus a margin) exist in
// the DOM, so a 25,000-value tree scrolls as fast as a 25-value one.
export function useWindow(count: number) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 600 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () =>
      setView({ top: el.scrollTop, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, []);
  const first = Math.max(0, Math.floor(view.top / ROW) - 10);
  const last = Math.min(count, Math.ceil((view.top + view.height) / ROW) + 10);
  const reveal = (index: number) => {
    const el = box.current;
    if (!el) return;
    const top = index * ROW;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW > el.scrollTop + el.clientHeight)
      el.scrollTop = top + ROW - el.clientHeight;
  };
  return { box, first, last, reveal };
}
