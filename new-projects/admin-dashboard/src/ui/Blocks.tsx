import { motion } from "motion/react";
import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";
import type { Product } from "../data/types";
import { useReduced } from "../motion/MotionPreference";
import { fadeUp } from "../motion/tokens";
import { cx } from "./Button";

export function Panel({ title, subtitle, actions, children, className, id, as = "section", animate = true }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string; as?: "section" | "div"; animate?: boolean }) {
  const Tag = as === "section" ? motion.section : motion.div;
  return (
    <Tag className={cx("ui-panel", className)} id={id} variants={animate ? fadeUp : undefined} aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || actions) && (
        <header className="ui-panel__header">
          <div className="ui-panel__titles">
            {title && (
              <h2 className="ui-panel__title" id={id ? `${id}-title` : undefined}>
                {title}
              </h2>
            )}
            {subtitle && <p className="ui-panel__subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ui-panel__actions">{actions}</div>}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function EmptyState({ icon, title, text, action, compact }: { icon: ReactNode; title: string; text?: string; action?: ReactNode; compact?: boolean }) {
  const reduced = useReduced();
  return (
    <motion.div className={cx("ui-empty", compact && "is-compact")} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <span className="ui-empty__icon" aria-hidden="true">
        {icon}
      </span>
      <h3 className="ui-empty__title">{title}</h3>
      {text && <p className="ui-empty__text">{text}</p>}
      {action}
    </motion.div>
  );
}

/** Keeps order numbers like NL-23760 on one line inside wrapping text. */
export function KeepIds({ text }: { text: string }) {
  const parts = text.split(/(NL-d+)/);
  return <>{parts.map((part, index) => (index % 2 ? <span key={index} className="nowrap">{part}</span> : part))}</>;
}

export function Skeleton({ width, height = 12, radius = 6, className }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={cx("ui-skeleton", className)} style={{ width, height, borderRadius: radius }} aria-hidden="true" />;
}

export function ProductThumb({ product, size = 36, large = false }: { product: Product | undefined; size?: number; large?: boolean }) {
  if (!product?.image) {
    return (
      <span className="ui-thumb is-empty" style={{ width: size, height: size }} aria-hidden="true">
        {product?.name.slice(0, 1)}
      </span>
    );
  }
  return (
    <span className={cx("ui-thumb", large && "is-large")} style={{ width: size, height: size }}>
      <img src={`./products/${product.image}-${large ? 512 : 112}.webp`} alt="" width={size} height={size} loading="lazy" decoding="async" />
    </span>
  );
}

export function Checkbox({ checked, indeterminate, onChange, label, onClick }: { checked: boolean; indeterminate?: boolean; onChange: (checked: boolean) => void; label: string; onClick?: (event: React.MouseEvent) => void }) {
  const on = checked || indeterminate;
  return (
    <label className={cx("ui-check", on && "is-on")} onClick={(event) => event.stopPropagation()}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        ref={(node) => {
          if (node) node.indeterminate = !!indeterminate;
        }}
        onChange={(event) => onChange(event.target.checked)}
        onClick={onClick}
      />
      <motion.span className="ui-check__box" aria-hidden="true" animate={{ scale: on ? [0.86, 1] : 1 }} transition={{ duration: 0.18 }}>
        {indeterminate ? <Minus /> : checked ? <Check /> : null}
      </motion.span>
    </label>
  );
}
