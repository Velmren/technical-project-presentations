import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n";
import { useReduced } from "../motion/MotionPreference";
import { duration, ease, spring } from "../motion/tokens";
import { Button } from "./Button";

/** Floating bar for actions on selected rows. Rises while something is selected. */
export function BulkShell({ count, label, onClear, children }: { count: number; label: string; onClear: () => void; children: ReactNode }) {
  const { t } = useI18n();
  const reduced = useReduced();
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          className="bulk"
          role="toolbar"
          aria-label={`${count} ${label}`}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.97, transition: { duration: duration.fast, ease: ease.in } }}
          transition={spring.pop}
        >
          <span className="bulk__count" aria-live="polite">
            <motion.span key={count} className="bulk__number num" initial={reduced ? false : { y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.pop}>
              {count}
            </motion.span>
            <span className="bulk__label">{label}</span>
          </span>
          <span className="bulk__sep" aria-hidden="true" />
          {children}
          <Button size="sm" variant="ghost" iconOnly icon={<X />} aria-label={t("orders.bulk.clear")} onClick={onClear} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
