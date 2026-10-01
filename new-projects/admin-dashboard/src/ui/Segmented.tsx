import { LayoutGroup, motion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { spring } from "../motion/tokens";
import { cx } from "./Button";

export type SegmentOption<T extends string | number> = { value: T; label: ReactNode; count?: number; hint?: string };

/**
 * A row of options with an indicator that slides to the chosen one.
 * Arrow keys move between options (roving focus), as in a native radio group.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
  variant = "pill",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  variant?: "pill" | "underline";
  className?: string;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + delta + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  };
  return (
    <LayoutGroup id={id}>
      <div className={cx("ui-seg", `ui-seg--${variant}`, `ui-seg--${size}`, className)} role="radiogroup" aria-label={label}>
        {options.map((option, index) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              ref={(node) => {
                refs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              title={option.hint}
              className={cx("ui-seg__option", active && "is-active")}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {active && <motion.span className="ui-seg__indicator" layoutId="indicator" transition={spring.indicator} />}
              <span className="ui-seg__label">{option.label}</span>
              {option.count !== undefined && <span className="ui-seg__count num">{option.count}</span>}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
