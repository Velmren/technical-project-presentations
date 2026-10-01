import { AnimatePresence, motion } from "motion/react";
import { Download, PackageCheck, Truck, X } from "lucide-react";
import { useAccess } from "../../app/access";
import { useToasts, useWorkspace } from "../../data/store";
import { useI18n, type Key } from "../../i18n";
import { useReduced } from "../../motion/MotionPreference";
import { duration, ease, spring } from "../../motion/tokens";
import { Button } from "../../ui/Button";

/** Appears from below while rows are selected. Actions apply only to orders at the right step. */
export function BulkBar({ selected, onClear, onExport }: { selected: Set<string>; onClear: () => void; onExport: () => void }) {
  const { t } = useI18n();
  const { indexes, dispatch } = useWorkspace();
  const { notify } = useToasts();
  const reduced = useReduced();
  const access = useAccess();
  const fulfil = access.can("orders.fulfil");
  const orders = [...selected].map((id) => indexes.orders.get(id)).filter((o) => !!o);
  const packable = orders.filter((o) => o.status === "Processing" && indexes.payment(o) === "Paid");
  const shippable = orders.filter((o) => o.status === "Ready" && o.shippingMethod !== "Pickup");

  const run = (to: "Ready" | "Shipped") => {
    const eligible = to === "Ready" ? packable : shippable;
    const skipped = orders.length - eligible.length;
    if (eligible.length) {
      const result = dispatch({ type: "order.bulkAdvance", ids: eligible.map((o) => o.id), to });
      if (!result.ok) return;
    }
    if (skipped) {
      const reason: Key = to === "Ready" ? (orders.some((o) => o.status === "Processing") ? "errors.notPaidReason" : "errors.wrongStatusReason") : orders.some((o) => o.status === "Processing") ? "errors.notPackedReason" : "errors.wrongStatusReason";
      notify({ key: "orders.bulk.skipped", params: { count: skipped, reason: `@${reason}` } }, "info");
    }
    onClear();
  };

  return (
    <AnimatePresence>
      {selected.size > 0 && (
        <motion.div
          className="bulk"
          role="toolbar"
          aria-label={t("orders.bulk.selected", { count: selected.size })}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.97, transition: { duration: duration.fast, ease: ease.in } }}
          transition={spring.pop}
        >
          <span className="bulk__count" aria-live="polite">
            <motion.span key={selected.size} className="bulk__number num" initial={reduced ? false : { y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.pop}>
              {selected.size}
            </motion.span>
            <span className="bulk__label">{t("orders.bulk.label", { count: selected.size })}</span>
          </span>
          <span className="bulk__sep" aria-hidden="true" />
          <Button variant="primary" size="sm" icon={<PackageCheck />} disabled={!packable.length || !fulfil} title={fulfil ? undefined : access.deniedHint} onClick={() => run("Ready")}>
            {t("orders.bulk.pack")}
            {packable.length > 0 && packable.length !== orders.length && <span className="bulk__eligible num">{packable.length}</span>}
          </Button>
          <Button size="sm" icon={<Truck />} disabled={!shippable.length || !fulfil} title={fulfil ? undefined : access.deniedHint} onClick={() => run("Shipped")}>
            {t("orders.bulk.ship")}
            {shippable.length > 0 && shippable.length !== orders.length && <span className="bulk__eligible num">{shippable.length}</span>}
          </Button>
          <Button size="sm" variant="ghost" icon={<Download />} onClick={onExport}>
            {t("orders.bulk.export")}
          </Button>
          <Button size="sm" variant="ghost" iconOnly icon={<X />} aria-label={t("orders.bulk.clear")} onClick={onClear} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
