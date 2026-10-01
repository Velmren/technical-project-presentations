import { motion } from "motion/react";
import { spring } from "../motion/tokens";
import { cx } from "./Button";

/** On/off control. The knob travels on the same spring as the other selection indicators. */
export function Switch({ checked, onChange, label, hideLabel }: { checked: boolean; onChange: (checked: boolean) => void; label: string; hideLabel?: boolean }) {
  return (
    <label className={cx("ui-switch", checked && "is-on")}>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-checked={checked} />
      <span className="ui-switch__track" aria-hidden="true">
        <motion.span className="ui-switch__knob" layout transition={spring.indicator} />
      </span>
      <span className={hideLabel ? "sr-only" : "ui-switch__label"}>{label}</span>
    </label>
  );
}
