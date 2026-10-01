import { useRef, useState, type ReactNode } from "react";
import { readPrefs, writePrefs } from "../prefs";

type Props = {
  id: string;
  direction?: "row" | "column";
  initial?: number;
  min?: number;
  max?: number;
  label: string;
  first: ReactNode;
  second: ReactNode;
  // On narrow screens only one pane is shown; the caller decides which.
  mobile?: "first" | "second";
  // Hides the second pane while keeping the first mounted (editor state survives).
  collapsed?: boolean;
  className?: string;
};

export function SplitPane({
  id,
  direction = "row",
  initial = 0.5,
  min = 0.2,
  max = 0.8,
  label,
  first,
  second,
  mobile = "first",
  collapsed = false,
  className = "",
}: Props) {
  const [ratio, setRatio] = useState(() => {
    const saved = readPrefs().splits?.[id];
    return saved && saved >= min && saved <= max ? saved : initial;
  });
  const box = useRef<HTMLDivElement>(null);
  const clamp = (value: number) => Math.min(max, Math.max(min, value));
  const commit = (value: number) => writePrefs({ splits: { [id]: value } });

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const rect = box.current!.getBoundingClientRect();
    let latest = ratio;
    const move = (e: PointerEvent) => {
      latest = clamp(
        direction === "row"
          ? (e.clientX - rect.left) / rect.width
          : (e.clientY - rect.top) / rect.height,
      );
      setRatio(latest);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      document.body.classList.remove("is-resizing");
      commit(latest);
    };
    document.body.classList.add("is-resizing");
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const back = direction === "row" ? "ArrowLeft" : "ArrowUp";
    const forward = direction === "row" ? "ArrowRight" : "ArrowDown";
    const step = event.shiftKey ? 0.1 : 0.02;
    let next: number | null = null;
    if (event.key === back) next = clamp(ratio - step);
    else if (event.key === forward) next = clamp(ratio + step);
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else if (event.key === "Enter") next = initial;
    if (next === null) return;
    event.preventDefault();
    setRatio(next);
    commit(next);
  }

  return (
    <div
      ref={box}
      className={`split split-${direction}${collapsed ? " split-collapsed" : ""} ${className}`}
      data-mobile={mobile}
      style={{ "--split": ratio } as React.CSSProperties}
    >
      <div className="split-pane split-first">{first}</div>
      <div
        className="split-handle"
        role="separator"
        tabIndex={0}
        aria-label={label}
        aria-orientation={direction === "row" ? "vertical" : "horizontal"}
        aria-valuemin={Math.round(min * 100)}
        aria-valuemax={Math.round(max * 100)}
        aria-valuenow={Math.round(ratio * 100)}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onDoubleClick={() => {
          setRatio(initial);
          commit(initial);
        }}
      />
      <div className="split-pane split-second">{!collapsed && second}</div>
    </div>
  );
}
