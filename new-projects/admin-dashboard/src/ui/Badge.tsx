import type { ReactNode } from "react";
import { cx } from "./Button";

export type Tone = "neutral" | "accent" | "positive" | "warning" | "danger" | "violet";

export function Badge({ tone = "neutral", dot = true, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cx("ui-badge", `ui-badge--${tone}`, className)}>
      {dot && <i aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ui-kbd">{children}</kbd>;
}
